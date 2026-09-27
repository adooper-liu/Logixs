import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ProductIdentityV1 } from "@logix/contracts";
import {
  PRODUCT_IDENTITY_REPOSITORY,
  type ProductIdentityRecord,
  type ProductIdentityRepository,
} from "../domain/product-identity.repository";

/**
 * 建档队列：3 号节点发布的产品设计，以及它有没有建过档。
 *
 * 队列取自**不可变的发布快照**，所以这里读它不违反"跨模块不写别人表"。
 */
@Injectable()
export class ListProductIdentityQueueService {
  constructor(
    @Inject(PRODUCT_IDENTITY_REPOSITORY)
    private readonly repository: ProductIdentityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    pageSize?: string;
    cursor?: string;
  }) {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const pageSize = parsePageSize(input.pageSize);
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.listQueue({
      tenantId: input.tenantId,
      ...(after ? { after } : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    return {
      contractVersion: "product-identity-queue.v1" as const,
      items: items.map((row) => ({
        releaseId: row.releaseId,
        definitionId: row.definitionId,
        specification: row.specification,
        npiStage: row.npiStage,
        releasedBy: row.releasedBy,
        releasedAt: row.releasedAt.toISOString(),
        productId: row.productId,
        productNumber: row.productNumber,
      })),
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeCursor(input.tenantId, last.releasedAt, last.releaseId)
          : null,
    };
  }
}

export function toProductIdentityV1(
  record: ProductIdentityRecord,
): ProductIdentityV1 {
  return {
    contractVersion: "product-identity.v1",
    productId: record.productId,
    productNumber: record.productNumber,
    sourceHandoffId: record.sourceHandoffId,
    version: record.version,
    specification: record.specification,
    attributes: record.attributes,
    skus: record.skus.map((sku) => ({
      skuId: sku.skuId,
      skuCode: sku.skuCode,
      attributes: sku.attributes,
    })),
    pendingFieldCodes: ["bom", "listing"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 100;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 200) invalid("pageSize");
  return parsed;
}

function encodeCursor(tenantId: string, at: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ tenantId, at: at.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(
  value: string,
  tenantId: string,
): { releasedAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      at?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      invalid("cursor");
    }
    const at = new Date(parsed.at as string);
    if (Number.isNaN(at.getTime())) invalid("cursor");
    return { releasedAt: at, id: parsed.id as string };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid("cursor");
  }
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
