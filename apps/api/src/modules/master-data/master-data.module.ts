import { Module } from "@nestjs/common";
import { RegisterProductSkuService } from "./application/register-product-sku.service";
import { GetProductSkuService } from "./application/get-product-sku.service";
import { PRODUCT_SKU_REPOSITORY } from "./domain/product-sku.repository";
import { PrismaProductSkuRepository } from "./infrastructure/prisma-product-sku.repository";
import { REGISTER_PRODUCT_SKU } from "./register-product-sku.port";
import { GET_PRODUCT_SKU } from "./get-product-sku.port";

@Module({
  providers: [
    RegisterProductSkuService,
    GetProductSkuService,
    {
      provide: PRODUCT_SKU_REPOSITORY,
      useClass: PrismaProductSkuRepository,
    },
    {
      provide: REGISTER_PRODUCT_SKU,
      useExisting: RegisterProductSkuService,
    },
    {
      provide: GET_PRODUCT_SKU,
      useExisting: GetProductSkuService,
    },
  ],
  exports: [
    GET_PRODUCT_SKU,
    REGISTER_PRODUCT_SKU,
    GetProductSkuService,
    RegisterProductSkuService,
  ],
})
export class MasterDataModule {}
