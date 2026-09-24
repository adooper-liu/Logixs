import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  GET_PRODUCT_COMPLIANCE_PROFILE,
  type GetProductComplianceProfilePort,
  type ProductComplianceProfileRecord,
} from "../../master-data";
import {
  decodeContainerCursor,
  encodeContainerCursor,
  parsePageSize,
} from "../domain/container-page";
import { quantityToScaledInteger } from "../domain/container-cargo-allocation";
import {
  REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY,
  type ReplenishmentOrderLineRecord,
  type ReplenishmentOrderWorkbenchRecord,
  type ReplenishmentOrderWorkbenchRepository,
} from "../domain/replenishment-order-workbench.repository";

export type ReplenishmentWorkReasonCode =
  | "complete_order_lines"
  | "confirm_sku_identity"
  | "complete_product_profile"
  | "allocate_cargo"
  | "ready_for_container_review"
  | "waiting_other";

export interface ReplenishmentLineGap {
  code:
    | "sku_identity_missing"
    | "product_profile_missing"
    | "product_profile_unverified"
    | "battery_unknown"
    | "refrigerant_unknown"
    | "dangerous_goods_unknown"
    | "inspection_requirement_unknown";
  label: string;
}

export interface ReplenishmentOrderWorkbenchItem {
  id: string;
  orderNumber: string;
  updatedAt: string;
  workReason: {
    code: ReplenishmentWorkReasonCode;
    label: string;
    detail: string;
    responsibility: "mine" | "waiting_other";
  };
  nextAction: { code: string; label: string } | null;
  relatedContainers: Array<{ id: string; containerNumber: string | null }>;
  handoffShipments: Array<{
    id: string;
    shipmentNumber: string | null;
    currentLifecycleStatus: string;
  }>;
  lines: Array<
    ReplenishmentOrderLineRecord & {
      allocatedQuantity: string;
      unallocatedQuantity: string;
      profile: ProductProfileSummary | null;
      gaps: ReplenishmentLineGap[];
    }
  >;
}

interface ProductProfileSummary {
  profileId: string;
  version: number;
  verificationState: string;
  sourceSystem: string;
  createdAt: string;
  battery: {
    presenceState: string;
    packingMode: string | null;
  };
  refrigerant: { presenceState: string };
  dangerousGoods: { classificationState: string };
  inspectionRequirements: Array<{
    requirementType: string;
    requirementState: string;
    jurisdictionCountryCode: string | null;
  }>;
}

export interface ReplenishmentOrderPage {
  items: ReplenishmentOrderWorkbenchItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListReplenishmentOrdersService {
  constructor(
    @Inject(REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY)
    private readonly repository: ReplenishmentOrderWorkbenchRepository,
    @Inject(GET_PRODUCT_COMPLIANCE_PROFILE)
    private readonly getProfile: GetProductComplianceProfilePort,
  ) {}

  async execute(input: {
    tenantId?: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ReplenishmentOrderPage> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const tenantId = input.tenantId;
    const pageSize = parsePaginationValue(() => parsePageSize(input.pageSize));
    const after = input.cursor
      ? parsePaginationValue(() => {
          const cursor = decodeContainerCursor(input.cursor!);
          if (cursor.tenantId !== tenantId) {
            throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
          }
          return { updatedAt: cursor.updatedAt, id: cursor.id };
        })
      : undefined;
    const rows = await this.repository.list({
      tenantId,
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
    const profileIds = [
      ...new Set(
        pageRows.flatMap((order) =>
          order.lines.flatMap((line) =>
            line.productSkuId ? [line.productSkuId] : [],
          ),
        ),
      ),
    ];
    const profiles = new Map(
      await Promise.all(
        profileIds.map(
          async (productSkuId) =>
            [
              productSkuId,
              await this.getProfile.execute({ tenantId, productSkuId }),
            ] as const,
        ),
      ),
    );
    const items = pageRows.map((order) => toWorkbenchItem(order, profiles));
    const last = items[items.length - 1];
    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeContainerCursor({
                tenantId,
                updatedAt: new Date(last.updatedAt),
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date(),
      projectionVersion: 1,
    };
  }
}

function toWorkbenchItem(
  order: ReplenishmentOrderWorkbenchRecord,
  profiles: ReadonlyMap<string, ProductComplianceProfileRecord | null>,
): ReplenishmentOrderWorkbenchItem {
  const lines = order.lines.map((line) => {
    const profile = line.productSkuId
      ? (profiles.get(line.productSkuId) ?? null)
      : null;
    const allocated = line.allocations.reduce(
      (total, allocation) =>
        total + quantityToScaledInteger(allocation.allocatedQuantity),
      0n,
    );
    const shipped = quantityToScaledInteger(line.shippedQuantity);
    if (allocated > shipped) {
      throw new Error("CARGO_ALLOCATION_EXCEEDS_SHIPPED_QUANTITY");
    }
    return {
      ...line,
      allocatedQuantity: scaledQuantity(allocated),
      unallocatedQuantity: scaledQuantity(shipped - allocated),
      profile: profile ? toProfileSummary(profile) : null,
      gaps: lineGaps(line, profile),
    };
  });
  const relatedContainers = [
    ...new Map(
      [
        ...order.linkedContainers,
        ...lines.flatMap((line) =>
          line.allocations.map((allocation) => ({
            id: allocation.containerId,
            containerNumber: allocation.containerNumber,
          })),
        ),
      ].map((container) => [container.id, container]),
    ).values(),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const unboundCount = lines.filter((line) => !line.productSkuId).length;
  const profileGapCount = lines.filter((line) => line.gaps.length > 0).length;
  const unallocatedCount = lines.filter(
    (line) => quantityToScaledInteger(line.unallocatedQuantity) > 0n,
  ).length;
  const work = workReason({
    lineCount: lines.length,
    unboundCount,
    profileGapCount,
    unallocatedCount,
  });
  return { ...order, lines, relatedContainers, ...work };
}

function lineGaps(
  line: ReplenishmentOrderLineRecord,
  profile: ProductComplianceProfileRecord | null,
): ReplenishmentLineGap[] {
  if (!line.productSkuId) {
    return [{ code: "sku_identity_missing", label: "尚未匹配 SKU 物料" }];
  }
  if (!profile) {
    return [{ code: "product_profile_missing", label: "物料属性档案尚未建立" }];
  }
  const gaps: ReplenishmentLineGap[] = [];
  if (profile.verificationState !== "verified") {
    gaps.push({
      code: "product_profile_unverified",
      label: "物料属性档案尚未核验",
    });
  }
  if (profile.battery.presenceState === "unknown") {
    gaps.push({ code: "battery_unknown", label: "尚未确认是否含电池" });
  }
  if (profile.refrigerant.presenceState === "unknown") {
    gaps.push({
      code: "refrigerant_unknown",
      label: "尚未确认是否含制冷剂",
    });
  }
  if (profile.dangerousGoods.classificationState === "undetermined") {
    gaps.push({
      code: "dangerous_goods_unknown",
      label: "尚未确认是否属于危险品",
    });
  }
  if (
    profile.inspectionRequirements.some(
      (requirement) => requirement.requirementState === "unknown",
    )
  ) {
    gaps.push({
      code: "inspection_requirement_unknown",
      label: "检验要求尚未确认",
    });
  }
  return gaps;
}

function workReason(counts: {
  lineCount: number;
  unboundCount: number;
  profileGapCount: number;
  unallocatedCount: number;
}): Pick<ReplenishmentOrderWorkbenchItem, "workReason" | "nextAction"> {
  if (counts.lineCount === 0) {
    return {
      workReason: {
        code: "complete_order_lines",
        label: "补充备货明细",
        detail: "备货单尚无当前 SKU 明细",
        responsibility: "mine",
      },
      nextAction: {
        code: "replenishment.import",
        label: "导入备货明细",
      },
    };
  }
  if (counts.unboundCount > 0) {
    return {
      workReason: {
        code: "confirm_sku_identity",
        label: "确认新 SKU",
        detail: `${counts.unboundCount} 个明细尚未匹配 SKU`,
        responsibility: "mine",
      },
      nextAction: {
        code: "shipment.resolve_sku_identity",
        label: "确认 SKU 身份",
      },
    };
  }
  if (counts.profileGapCount > 0) {
    return {
      workReason: {
        code: "complete_product_profile",
        label: "补物料资料",
        detail: `${counts.profileGapCount} 个 SKU 的物料属性需要确认`,
        responsibility: "mine",
      },
      nextAction: {
        code: "master_data.review_product",
        label: "确认物料属性",
      },
    };
  }
  if (counts.unallocatedCount > 0) {
    return {
      workReason: {
        code: "allocate_cargo",
        label: "分配装柜",
        detail: `${counts.unallocatedCount} 个明细仍有未分配数量`,
        responsibility: "mine",
      },
      nextAction: {
        code: "shipment.allocate_cargo",
        label: "安排装柜",
      },
    };
  }
  return {
    workReason: {
      code: "ready_for_container_review",
      label: "完成备货确认",
      detail: "物料事实齐全，已完成装柜分配",
      responsibility: "mine",
    },
    nextAction: {
      code: "work_execution.continue_cargo_ready",
      label: "继续备货确认",
    },
  };
}

function toProfileSummary(
  profile: ProductComplianceProfileRecord,
): ProductProfileSummary {
  return {
    profileId: profile.profileId,
    version: profile.version,
    verificationState: profile.verificationState,
    sourceSystem: profile.sourceSystem,
    createdAt: profile.createdAt,
    battery: {
      presenceState: profile.battery.presenceState,
      packingMode: profile.battery.packingMode,
    },
    refrigerant: {
      presenceState: profile.refrigerant.presenceState,
    },
    dangerousGoods: {
      classificationState: profile.dangerousGoods.classificationState,
    },
    inspectionRequirements: profile.inspectionRequirements.map(
      (requirement) => ({
        requirementType: requirement.requirementType,
        requirementState: requirement.requirementState,
        jurisdictionCountryCode: requirement.jurisdictionCountryCode,
      }),
    ),
  };
}

function scaledQuantity(value: bigint): string {
  const whole = value / 1000n;
  const fraction = String(value % 1000n)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function parsePaginationValue<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new HttpException(
      error instanceof Error ? error.message : "VALIDATION_FORMAT",
      HttpStatus.BAD_REQUEST,
    );
  }
}
