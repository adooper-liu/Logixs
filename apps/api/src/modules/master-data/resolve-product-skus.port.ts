export const RESOLVE_PRODUCT_SKUS = Symbol("ResolveProductSkus");

export interface ResolveProductSkusQuery {
  tenantId: string;
  productNumbers: string[];
}

export interface ResolvedProductSku {
  productSkuId: string;
  productNumber: string;
  version: number;
}

export interface ResolveProductSkusPort {
  execute(query: ResolveProductSkusQuery): Promise<ResolvedProductSku[]>;
}
