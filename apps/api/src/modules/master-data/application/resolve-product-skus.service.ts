import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  PRODUCT_SKU_REPOSITORY,
  type ProductSkuRepository,
} from "../domain/product-sku.repository";
import type {
  ResolveProductSkusPort,
  ResolveProductSkusQuery,
  ResolvedProductSku,
} from "../resolve-product-skus.port";

@Injectable()
export class ResolveProductSkusService implements ResolveProductSkusPort {
  constructor(
    @Inject(PRODUCT_SKU_REPOSITORY)
    private readonly repository: ProductSkuRepository,
  ) {}

  async execute(query: ResolveProductSkusQuery): Promise<ResolvedProductSku[]> {
    const tenantId = normalizeText(query.tenantId, 128);
    if (
      !Array.isArray(query.productNumbers) ||
      query.productNumbers.length > 1000
    ) {
      throw new BadRequestException("PRODUCT_SKU_LOOKUP_INVALID");
    }
    const productNumbers = [
      ...new Set(
        query.productNumbers.map((value) => normalizeText(value, 200)),
      ),
    ];
    if (productNumbers.length === 0) return [];
    const rows = await this.repository.findByProductNumbers({
      tenantId,
      productNumbers,
    });
    return rows.map(({ productSkuId, productNumber, version }) => ({
      productSkuId,
      productNumber,
      version,
    }));
  }
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    throw new BadRequestException("PRODUCT_SKU_LOOKUP_INVALID");
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequestException("PRODUCT_SKU_LOOKUP_INVALID");
  }
  return normalized;
}
