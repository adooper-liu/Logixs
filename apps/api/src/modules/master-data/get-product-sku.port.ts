import type { GetProductSkuQuery } from "./domain/product-sku";

export const GET_PRODUCT_SKU = Symbol("GetProductSku");

export interface GetProductSkuResult {
  productSkuId: string;
  tenantId: string;
  productNumber: string;
  version: number;
}

export interface GetProductSkuPort {
  execute(query: GetProductSkuQuery): Promise<GetProductSkuResult | null>;
}

export type { GetProductSkuQuery };
