import type {
  ProductAttributesV1,
  ProductSkuAttributesV1,
} from "@logix/contracts";
import type {
  PreparedProductIdentityDraft,
  PreparedSellableSkuRelease,
} from "./product-identity";

export const PRODUCT_IDENTITY_REPOSITORY = Symbol("ProductIdentityRepository");

export interface ProductSkuIdentityRecord {
  skuId: string;
  skuCode: string;
  attributes: ProductSkuAttributesV1;
}

export interface ProductIdentityRecord {
  productId: string;
  sourceHandoffId: string;
  productNumber: string;
  version: number;
  specification: string;
  attributes: ProductAttributesV1;
  skus: ProductSkuIdentityRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 建档队列上的一条：来自 3 号节点发布的产品设计，以及它有没有建过档。
 *
 * 队列取自发布交接快照 —— **快照是不可变的**，所以这里读它不违反"跨模块不写别人表"；
 * 与 product-selection 读 `market_opportunity_handoff` 是同一做法。
 */
export interface IdentityQueueEntry {
  releaseId: string;
  definitionId: string;
  specification: string;
  npiStage: string;
  releasedBy: string;
  releasedAt: Date;
  /** 已建档时非空。 */
  productId: string | null;
  productNumber: string | null;
}

export interface ProductIdentityRepository {
  /** 建档队列：已发布的产品设计，按发布时间倒序。 */
  listQueue(input: {
    tenantId: string;
    after?: { releasedAt: Date; id: string };
    take: number;
  }): Promise<IdentityQueueEntry[]>;
  findBySourceHandoffId(
    tenantId: string,
    sourceHandoffId: string,
  ): Promise<ProductIdentityRecord | null>;
  /**
   * 按幂等键找已落库的那一条。**重放必须先查它** —— 客户端重试时期望版本
   * 已经过期，先判版本会把一次成功的保存报成「版本冲突」。
   */
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ProductIdentityRecord | null>;
  persistDraft(input: {
    tenantId: string;
    sourceHandoffId: string;
    specification: string;
    actorId: string;
    command: PreparedProductIdentityDraft;
  }): Promise<{ record: ProductIdentityRecord; duplicate: boolean }>;
  persistRelease(input: {
    tenantId: string;
    productId: string;
    actorId: string;
    command: PreparedSellableSkuRelease;
  }): Promise<{ record: ProductIdentityRecord; duplicate: boolean }>;
}
