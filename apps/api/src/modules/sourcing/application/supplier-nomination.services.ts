import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  AdmitSupplierCommandV1,
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  RegisterSupplierCommandV1,
  SupplierNominationHandoffV1,
  SupplierQuotationV1,
  SupplierV1,
} from "@logix/contracts";
import {
  prepareNomination,
  prepareQuotation,
  prepareSupplierAdmission,
  prepareSupplierRegistration,
  SourcingConflictError,
  type CurrentSupplier,
} from "../domain/supplier-nomination";
import {
  SUPPLIER_NOMINATION_REPOSITORY,
  type NominationRecord,
  type QuotationRecord,
  type SourcingQueueEntryRecord,
  type SupplierNominationRepository,
  type SupplierRecord,
} from "../domain/supplier-nomination.repository";
import {
  SourcingNotFoundError,
  throwSourcingHttpError,
} from "./sourcing-errors";

/**
 * 待寻源队列：4 号发布的可售 SKU，逐 SKU 展开。
 *
 * **候选供应商是"报出来的"** —— 没有一张候选名单表；谁报过价谁就是候选。
 * 少一张表，就少一处会与报价对不上的状态。
 */
@Injectable()
export class ListSourcingQueueService {
  constructor(
    @Inject(SUPPLIER_NOMINATION_REPOSITORY)
    private readonly repository: SupplierNominationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    suppliersOnly?: string;
    take?: string;
  }): Promise<{
    suppliers: SupplierV1[];
    entries: SourcingQueueEntryRecord[];
  }> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const [suppliers, entries] = await Promise.all([
      this.repository.listSuppliers(input.tenantId, 500),
      input.suppliersOnly === "true"
        ? Promise.resolve([])
        : this.repository.listQueue({
            tenantId: input.tenantId,
            take: parseTake(input.take),
          }),
    ]);
    return { suppliers: suppliers.map(toSupplierV1), entries };
  }
}

/** 登记供应商。名称租户内唯一 —— 重名会让「定点给谁」说不清。 */
@Injectable()
export class RegisterSupplierService {
  constructor(
    @Inject(SUPPLIER_NOMINATION_REPOSITORY)
    private readonly repository: SupplierNominationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    command: RegisterSupplierCommandV1;
  }): Promise<SupplierV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const prepared = prepareSupplierRegistration(
        input.actorId,
        input.command,
      );
      // 先判重放：重试的期望是拿回原来那条，不是再登一次。
      const replay = await this.repository.findSupplierByIdempotencyKey(
        input.tenantId,
        prepared.idempotencyKey,
      );
      if (replay) return toSupplierV1(replay);

      const existing = await this.repository.findSupplierByName(
        input.tenantId,
        prepared.name,
      );
      if (existing) {
        throw new SourcingConflictError("SUPPLIER_NAME_TAKEN");
      }
      const result = await this.repository.registerSupplier({
        tenantId: input.tenantId,
        actorId: input.actorId,
        command: prepared,
      });
      return toSupplierV1(result.record);
    } catch (error) {
      throwSourcingHttpError(error);
    }
  }
}

/** 准入：独立授权动作。登记不等于准入，未准入不能定点。 */
@Injectable()
export class AdmitSupplierService {
  constructor(
    @Inject(SUPPLIER_NOMINATION_REPOSITORY)
    private readonly repository: SupplierNominationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    supplierId: string;
    command: AdmitSupplierCommandV1;
  }): Promise<SupplierV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const supplier = await this.repository.findSupplier(
        input.tenantId,
        input.supplierId,
      );
      if (!supplier) {
        throw new SourcingNotFoundError("SUPPLIER_NOT_FOUND");
      }
      // 已准入视为成功重放：避免重复点击把「已准入」误报成冲突。
      if (supplier.admissionState === "admitted") {
        return toSupplierV1(supplier);
      }
      const prepared = prepareSupplierAdmission(
        supplier,
        input.actorId,
        input.command,
      );
      const result = await this.repository.persistAdmission({
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        actorId: input.actorId,
        command: prepared,
      });
      return toSupplierV1(result.record);
    } catch (error) {
      throwSourcingHttpError(error);
    }
  }
}

/** 录入报价：十项 + 关键物料清单。**关键物料由报价带入，不是主数据侧预先编的。** */
@Injectable()
export class RecordQuotationService {
  constructor(
    @Inject(SUPPLIER_NOMINATION_REPOSITORY)
    private readonly repository: SupplierNominationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    supplierId: string;
    skuReleaseId: string;
    skuId: string;
    command: RecordQuotationCommandV1;
  }): Promise<SupplierQuotationV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      // 先按幂等键判重放**再**跑领域规则：重放探测手上没有当前版本，
      // 拿版本 0 去过规则会把一次正常重试误报成冲突。
      const replay = await this.repository.findQuotationByIdempotencyKey(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replay) return toQuotationV1(replay);

      const supplier = await this.repository.findSupplier(
        input.tenantId,
        input.supplierId,
      );
      if (!supplier) {
        throw new SourcingNotFoundError("SUPPLIER_NOT_FOUND");
      }
      const current = await this.repository.findQuotation(
        input.tenantId,
        input.supplierId,
        input.skuReleaseId,
      );
      const result = await this.repository.persistQuotation({
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        skuReleaseId: input.skuReleaseId,
        skuId: input.skuId,
        actorId: input.actorId,
        command: prepareQuotation(
          { version: current?.version ?? 0 },
          input.actorId,
          input.command,
        ),
      });
      return toQuotationV1(result.record);
    } catch (error) {
      throwSourcingHttpError(error);
    }
  }
}

/**
 * 定点：选定一家，产出一份不可变交接交给需求与补货侧。
 *
 * **没准入不能定点**（领域规则拦）；**样品结论与产能约束必填** ——
 * 没验过样就定点是拿量产赌，供不供得上是补货那边最需要先知道的。
 */
@Injectable()
export class NominateSupplierService {
  constructor(
    @Inject(SUPPLIER_NOMINATION_REPOSITORY)
    private readonly repository: SupplierNominationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    command: NominateSupplierCommandV1;
  }): Promise<SupplierNominationHandoffV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const replay = await this.repository.findNominationByIdempotencyKey(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replay) return toNominationV1(replay);

      const quotation = await this.repository.findQuotationById(
        input.tenantId,
        input.command.quotationId,
      );
      if (!quotation) {
        throw new SourcingNotFoundError("SUPPLIER_QUOTATION_NOT_FOUND");
      }
      const supplier = await this.repository.findSupplier(
        input.tenantId,
        quotation.supplierId,
      );
      if (!supplier) {
        throw new SourcingNotFoundError("SUPPLIER_NOT_FOUND");
      }
      const result = await this.repository.recordNomination({
        tenantId: input.tenantId,
        supplier,
        quotation,
        actorId: input.actorId,
        command: prepareNomination(
          currentSupplierOf(supplier),
          { version: quotation.version },
          input.actorId,
          input.command,
        ),
      });
      return toNominationV1(result.record);
    } catch (error) {
      throwSourcingHttpError(error);
    }
  }
}

export function currentSupplierOf(record: SupplierRecord): CurrentSupplier {
  return {
    version: record.version,
    admissionState: record.admissionState,
  };
}

export function toSupplierV1(record: SupplierRecord): SupplierV1 {
  return {
    contractVersion: "supplier.v1",
    supplierId: record.supplierId,
    name: record.name,
    countryCode: record.countryCode,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    admissionState: record.admissionState,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toQuotationV1(record: QuotationRecord): SupplierQuotationV1 {
  return {
    contractVersion: "supplier-quotation.v1",
    quotationId: record.quotationId,
    supplierId: record.supplierId,
    skuReleaseId: record.skuReleaseId,
    skuId: record.skuId,
    version: record.version,
    priceTiers: record.priceTiers,
    incoterms: record.incoterms,
    minimumOrderQuantity: record.minimumOrderQuantity,
    toolingCost: record.toolingCost,
    sampleCost: record.sampleCost,
    sampleRefundable: record.sampleRefundable,
    leadTimeDays: record.leadTimeDays,
    packagingSpec: record.packagingSpec,
    paymentTerms: record.paymentTerms,
    qualityTerms: record.qualityTerms,
    validUntil: record.validUntil?.toISOString() ?? null,
    keyMaterials: record.keyMaterials,
    exclusions: record.exclusions,
    quotedBy: record.quotedBy,
    quotedAt: record.quotedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toNominationV1(
  record: NominationRecord,
): SupplierNominationHandoffV1 {
  return {
    contractVersion: "supplier_nomination.v1",
    handoffId: record.handoffId,
    version: record.version,
    skuReleaseId: record.skuReleaseId,
    skuId: record.skuId,
    supplierId: record.supplierId,
    supplierName: record.supplierName,
    supplierCountryCode: record.supplierCountryCode,
    quotationId: record.quotationId,
    quotationVersion: record.quotationVersion,
    incoterms: record.incoterms,
    priceTiers: record.priceTiers,
    leadTimeDays: record.leadTimeDays,
    minimumOrderQuantity: record.minimumOrderQuantity,
    sampleConclusion: record.sampleConclusion,
    capacityConstraint: record.capacityConstraint,
    nominatedBy: record.nominatedBy,
    nominatedAt: record.nominatedAt.toISOString(),
    idempotencyKey: record.idempotencyKey,
  };
}

function parseTake(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) {
    throw new HttpException("VALIDATION_FORMAT: take", HttpStatus.BAD_REQUEST);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > 200) {
    throw new HttpException("VALIDATION_FORMAT: take", HttpStatus.BAD_REQUEST);
  }
  return parsed;
}
