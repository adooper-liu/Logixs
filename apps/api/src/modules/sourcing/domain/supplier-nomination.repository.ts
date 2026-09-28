import type {
  SupplierAdmissionStateV1,
  SupplierNominationHandoffV1,
  SupplierQuotationV1,
} from "@logix/contracts";
import type {
  PreparedNomination,
  PreparedQuotation,
  PreparedSupplier,
} from "./supplier-nomination";

export const SUPPLIER_NOMINATION_REPOSITORY = Symbol(
  "SupplierNominationRepository",
);

export interface SupplierRecord {
  supplierId: string;
  name: string;
  countryCode: string;
  contactName: string | null;
  contactEmail: string | null;
  admissionState: SupplierAdmissionStateV1;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type QuotationRecord = Omit<
  SupplierQuotationV1,
  "contractVersion" | "quotedAt" | "createdAt" | "updatedAt" | "validUntil"
> & {
  validUntil: Date | null;
  quotedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NominationRecord = Omit<
  SupplierNominationHandoffV1,
  "contractVersion" | "nominatedAt"
> & { nominatedAt: Date };

/** 队列上的一条：一份发布里的一个 SKU，以及它已有的候选与报价。 */
export interface SourcingQueueEntryRecord {
  skuReleaseId: string;
  skuId: string;
  /** 供应商只要报过价就是候选 —— 候选不是事先指定的，是报出来的。 */
  suppliers: SupplierRecord[];
  quotations: QuotationRecord[];
  nominated: NominationRecord | null;
}

export interface SupplierNominationRepository {
  /** 待寻源队列：按发布取页，逐 SKU 展开。 */
  listQueue(input: {
    tenantId: string;
    after?: { releasedAt: Date; id: string };
    take: number;
  }): Promise<SourcingQueueEntryRecord[]>;
  listSuppliers(tenantId: string, take: number): Promise<SupplierRecord[]>;
  findSupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierRecord | null>;
  /** 名称租户内唯一 —— 重名会让「定点给谁」说不清，所以先按名字找。 */
  findSupplierByName(
    tenantId: string,
    name: string,
  ): Promise<SupplierRecord | null>;
  findQuotation(
    tenantId: string,
    supplierId: string,
    skuReleaseId: string,
  ): Promise<QuotationRecord | null>;
  findQuotationById(
    tenantId: string,
    quotationId: string,
  ): Promise<QuotationRecord | null>;
  findNomination(
    tenantId: string,
    skuReleaseId: string,
    skuId: string,
  ): Promise<NominationRecord | null>;
  /**
   * 按幂等键找已落库的那一条。**重放必须先查它** —— 客户端重试时期望版本
   * 已经过期，先判版本会把一次成功的保存报成「版本冲突」。
   */
  findSupplierByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<SupplierRecord | null>;
  findQuotationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<QuotationRecord | null>;
  findNominationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NominationRecord | null>;
  registerSupplier(input: {
    tenantId: string;
    actorId: string;
    command: PreparedSupplier;
  }): Promise<{ record: SupplierRecord; duplicate: boolean }>;
  persistQuotation(input: {
    tenantId: string;
    supplierId: string;
    skuReleaseId: string;
    skuId: string;
    actorId: string;
    command: PreparedQuotation;
  }): Promise<{ record: QuotationRecord; duplicate: boolean }>;
  recordNomination(input: {
    tenantId: string;
    supplier: SupplierRecord;
    quotation: QuotationRecord;
    actorId: string;
    command: PreparedNomination;
  }): Promise<{ record: NominationRecord; duplicate: boolean }>;
}
