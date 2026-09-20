import { Module } from "@nestjs/common";
import { RegisterProductSkuService } from "./application/register-product-sku.service";
import { GetProductSkuService } from "./application/get-product-sku.service";
import { GetProductComplianceProfileService } from "./application/get-product-compliance-profile.service";
import { ReplaceProductComplianceProfileService } from "./application/replace-product-compliance-profile.service";
import { PRODUCT_COMPLIANCE_PROFILE_REPOSITORY } from "./domain/product-compliance-profile.repository";
import { PRODUCT_SKU_REPOSITORY } from "./domain/product-sku.repository";
import { GET_PRODUCT_COMPLIANCE_PROFILE } from "./get-product-compliance-profile.port";
import { PrismaProductComplianceProfileRepository } from "./infrastructure/prisma-product-compliance-profile.repository";
import { PrismaProductSkuRepository } from "./infrastructure/prisma-product-sku.repository";
import { GET_PRODUCT_SKU } from "./get-product-sku.port";
import { REGISTER_PRODUCT_SKU } from "./register-product-sku.port";
import { REPLACE_PRODUCT_COMPLIANCE_PROFILE } from "./replace-product-compliance-profile.port";

@Module({
  providers: [
    RegisterProductSkuService,
    GetProductSkuService,
    GetProductComplianceProfileService,
    ReplaceProductComplianceProfileService,
    {
      provide: PRODUCT_SKU_REPOSITORY,
      useClass: PrismaProductSkuRepository,
    },
    {
      provide: PRODUCT_COMPLIANCE_PROFILE_REPOSITORY,
      useClass: PrismaProductComplianceProfileRepository,
    },
    {
      provide: REGISTER_PRODUCT_SKU,
      useExisting: RegisterProductSkuService,
    },
    {
      provide: GET_PRODUCT_SKU,
      useExisting: GetProductSkuService,
    },
    {
      provide: GET_PRODUCT_COMPLIANCE_PROFILE,
      useExisting: GetProductComplianceProfileService,
    },
    {
      provide: REPLACE_PRODUCT_COMPLIANCE_PROFILE,
      useExisting: ReplaceProductComplianceProfileService,
    },
  ],
  exports: [
    GET_PRODUCT_COMPLIANCE_PROFILE,
    GET_PRODUCT_SKU,
    REGISTER_PRODUCT_SKU,
    REPLACE_PRODUCT_COMPLIANCE_PROFILE,
    GetProductComplianceProfileService,
    GetProductSkuService,
    RegisterProductSkuService,
    ReplaceProductComplianceProfileService,
  ],
})
export class MasterDataModule {}
