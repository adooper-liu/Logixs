import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { DraftProductIdentityService } from "./application/draft-product-identity.service";
import { GetProductIdentityService } from "./application/get-product-identity.service";
import { ListProductIdentityQueueService } from "./application/list-product-identity-queue.service";
import { ReleaseSellableSkuService } from "./application/release-sellable-sku.service";
import { PRODUCT_IDENTITY_REPOSITORY } from "./domain/product-identity.repository";
import { PrismaProductIdentityRepository } from "./infrastructure/prisma-product-identity.repository";
import { ProductIdentitiesController } from "./presentation/product-identities.controller";
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
import { ReferencePortDirectoryService } from "./application/reference-port-directory.service";
import { REFERENCE_PORT_REPOSITORY } from "./domain/reference-port.repository";
import { PrismaReferencePortRepository } from "./infrastructure/prisma-reference-port.repository";
import { REFERENCE_PORT_DIRECTORY } from "./reference-port-directory.port";
import { ResolveProductSkusService } from "./application/resolve-product-skus.service";
import { RESOLVE_PRODUCT_SKUS } from "./resolve-product-skus.port";
import { REFERENCE_LOCATION_CATALOG } from "./reference-location-catalog.port";
import { PrismaReferenceLocationCatalog } from "./infrastructure/prisma-reference-location-catalog";
import { CargoOwnerDirectoryService } from "./application/cargo-owner-directory.service";
import { CARGO_OWNER_REPOSITORY } from "./domain/cargo-owner.repository";
import { PrismaCargoOwnerRepository } from "./infrastructure/prisma-cargo-owner.repository";
import { CARGO_OWNER_DIRECTORY } from "./cargo-owner-directory.port";

@Module({
  imports: [IdentityModule],
  providers: [
    ListProductIdentityQueueService,
    GetProductIdentityService,
    DraftProductIdentityService,
    ReleaseSellableSkuService,
    {
      provide: PRODUCT_IDENTITY_REPOSITORY,
      useClass: PrismaProductIdentityRepository,
    },
    RegisterProductSkuService,
    GetProductSkuService,
    GetProductComplianceProfileService,
    ReplaceProductComplianceProfileService,
    ReferencePortDirectoryService,
    ResolveProductSkusService,
    CargoOwnerDirectoryService,
    {
      provide: PRODUCT_SKU_REPOSITORY,
      useClass: PrismaProductSkuRepository,
    },
    {
      provide: PRODUCT_COMPLIANCE_PROFILE_REPOSITORY,
      useClass: PrismaProductComplianceProfileRepository,
    },
    {
      provide: REFERENCE_PORT_REPOSITORY,
      useClass: PrismaReferencePortRepository,
    },
    {
      provide: REFERENCE_LOCATION_CATALOG,
      useClass: PrismaReferenceLocationCatalog,
    },
    {
      provide: CARGO_OWNER_REPOSITORY,
      useClass: PrismaCargoOwnerRepository,
    },
    {
      provide: CARGO_OWNER_DIRECTORY,
      useExisting: CargoOwnerDirectoryService,
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
    {
      provide: REFERENCE_PORT_DIRECTORY,
      useExisting: ReferencePortDirectoryService,
    },
    {
      provide: RESOLVE_PRODUCT_SKUS,
      useExisting: ResolveProductSkusService,
    },
  ],
  exports: [
    GET_PRODUCT_COMPLIANCE_PROFILE,
    GET_PRODUCT_SKU,
    REGISTER_PRODUCT_SKU,
    REPLACE_PRODUCT_COMPLIANCE_PROFILE,
    REFERENCE_PORT_DIRECTORY,
    REFERENCE_LOCATION_CATALOG,
    CARGO_OWNER_DIRECTORY,
    RESOLVE_PRODUCT_SKUS,
    GetProductComplianceProfileService,
    GetProductSkuService,
    RegisterProductSkuService,
    ReplaceProductComplianceProfileService,
    ReferencePortDirectoryService,
    ResolveProductSkusService,
    CargoOwnerDirectoryService,
  ],
  controllers: [ProductIdentitiesController],
})
export class MasterDataModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ProductIdentitiesController);
  }
}
