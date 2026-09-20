import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  normalizeGetProductSkuQuery,
  ProductSkuCommandError,
} from "../domain/product-sku";
import {
  PRODUCT_COMPLIANCE_PROFILE_REPOSITORY,
  type ProductComplianceProfileRepository,
} from "../domain/product-compliance-profile.repository";
import type {
  GetProductComplianceProfilePort,
  GetProductComplianceProfileQuery,
  ProductComplianceProfileRecord,
} from "../get-product-compliance-profile.port";

@Injectable()
export class GetProductComplianceProfileService implements GetProductComplianceProfilePort {
  constructor(
    @Inject(PRODUCT_COMPLIANCE_PROFILE_REPOSITORY)
    private readonly repository: ProductComplianceProfileRepository,
  ) {}

  async execute(
    query: GetProductComplianceProfileQuery,
  ): Promise<ProductComplianceProfileRecord | null> {
    try {
      return await this.repository.findCurrent(
        normalizeGetProductSkuQuery(query),
      );
    } catch (error) {
      if (error instanceof ProductSkuCommandError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
