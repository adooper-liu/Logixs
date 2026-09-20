import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  GetProductSkuPort,
  GetProductSkuResult,
} from "../get-product-sku.port";
import {
  normalizeGetProductSkuQuery,
  ProductSkuCommandError,
  type GetProductSkuQuery,
} from "../domain/product-sku";
import {
  PRODUCT_SKU_REPOSITORY,
  type ProductSkuRepository,
} from "../domain/product-sku.repository";

@Injectable()
export class GetProductSkuService implements GetProductSkuPort {
  constructor(
    @Inject(PRODUCT_SKU_REPOSITORY)
    private readonly repository: ProductSkuRepository,
  ) {}

  async execute(
    query: GetProductSkuQuery,
  ): Promise<GetProductSkuResult | null> {
    try {
      return await this.repository.findById(normalizeGetProductSkuQuery(query));
    } catch (error) {
      if (error instanceof ProductSkuCommandError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
