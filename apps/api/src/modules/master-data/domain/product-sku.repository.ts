import type { NormalizedRegisterProductSkuCommand } from "./product-sku";

export const PRODUCT_SKU_REPOSITORY = Symbol("ProductSkuRepository");

export class ProductSkuIdempotencyConflictError extends Error {
  constructor() {
    super("MASTER_DATA_IDEMPOTENCY_CONFLICT");
    this.name = "ProductSkuIdempotencyConflictError";
  }
}

export interface ProductSkuRecord {
  productSkuId: string;
  tenantId: string;
  productNumber: string;
  version: number;
}

export interface ProductSkuRepository {
  register(input: NormalizedRegisterProductSkuCommand): Promise<{
    record: ProductSkuRecord;
    duplicate: boolean;
  }>;
}
