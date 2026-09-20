import { Module } from "@nestjs/common";
import { RegisterProductSkuService } from "./application/register-product-sku.service";
import { PRODUCT_SKU_REPOSITORY } from "./domain/product-sku.repository";
import { PrismaProductSkuRepository } from "./infrastructure/prisma-product-sku.repository";
import { REGISTER_PRODUCT_SKU } from "./register-product-sku.port";

@Module({
  providers: [
    RegisterProductSkuService,
    {
      provide: PRODUCT_SKU_REPOSITORY,
      useClass: PrismaProductSkuRepository,
    },
    {
      provide: REGISTER_PRODUCT_SKU,
      useExisting: RegisterProductSkuService,
    },
  ],
  exports: [REGISTER_PRODUCT_SKU, RegisterProductSkuService],
})
export class MasterDataModule {}
