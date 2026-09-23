import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { MasterDataModule } from "../master-data";
import { ApplyContainerRecordService } from "./application/apply-container-record.service";
import { ApplyReplenishmentOrderImportService } from "./application/apply-replenishment-order-import.service";
import { AssertContainerTenantService } from "./application/assert-container-tenant.service";
import { ASSERT_CONTAINER_TENANT } from "./assert-container-tenant.port";
import { GetContainerService } from "./application/get-container.service";
import { ListContainersService } from "./application/list-containers.service";
import { ListReplenishmentOrdersService } from "./application/list-replenishment-orders.service";
import { ListContainerTaskFactsService } from "./application/list-container-task-facts.service";
import { ResolveContainerByNumberService } from "./application/resolve-container-by-number.service";
import { BindReplenishmentLineProductSkuService } from "./application/bind-replenishment-line-product-sku.service";
import { ReplaceContainerCargoAllocationsService } from "./application/replace-container-cargo-allocations.service";
import { GetContainerCargoComplianceScopeService } from "./application/get-container-cargo-compliance-scope.service";
import { GetContainerStuffingSnapshotService } from "./application/get-container-stuffing-snapshot.service";
import { GetContainerStuffingReadinessService } from "./application/get-container-stuffing-readiness.service";
import { ReplaceContainerStuffingSnapshotService } from "./application/replace-container-stuffing-snapshot.service";
import { GetContainerDispatchSnapshotService } from "./application/get-container-dispatch-snapshot.service";
import { GetContainerDispatchReadinessService } from "./application/get-container-dispatch-readiness.service";
import { ReplaceContainerDispatchSnapshotService } from "./application/replace-container-dispatch-snapshot.service";
import { CommitShipmentHandoffService } from "./application/commit-shipment-handoff.service";
import { GetShipmentService } from "./application/get-shipment.service";
import { GetContainerOperationalViewService } from "./application/get-container-operational-view.service";
import { ListShipmentsService } from "./application/list-shipments.service";
import { BIND_REPLENISHMENT_LINE_PRODUCT_SKU } from "./bind-replenishment-line-product-sku.port";
import { CONTAINER_CARGO_ALLOCATION_REPOSITORY } from "./domain/container-cargo-allocation.repository";
import { CONTAINER_STUFFING_SNAPSHOT_REPOSITORY } from "./domain/container-stuffing-snapshot.repository";
import { CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY } from "./domain/container-dispatch-snapshot.repository";
import { REPLENISHMENT_LINE_SKU_BINDER } from "./domain/replenishment-line-sku-binding.repository";
import { REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY } from "./domain/replenishment-order-workbench.repository";
import { LIST_CONTAINER_TASK_FACTS } from "./list-container-task-facts.port";
import { GET_CONTAINER_SUMMARY } from "./get-container-summary.port";
import { RESOLVE_CONTAINER_BY_NUMBER } from "./resolve-container-by-number.port";
import { CONTAINER_RECORD_WRITER } from "./domain/apply-container-record";
import { REPLENISHMENT_ORDER_IMPORT_WRITER } from "./domain/apply-replenishment-order-import";
import { CONTAINER_REPOSITORY } from "./domain/container.repository";
import { PrismaContainerRecordWriter } from "./infrastructure/prisma-container-record-writer";
import { PrismaReplenishmentOrderImportWriter } from "./infrastructure/prisma-replenishment-order-import-writer";
import { PrismaContainerCargoAllocationRepository } from "./infrastructure/prisma-container-cargo-allocation.repository";
import { PrismaContainerStuffingSnapshotRepository } from "./infrastructure/prisma-container-stuffing-snapshot.repository";
import { PrismaContainerDispatchSnapshotRepository } from "./infrastructure/prisma-container-dispatch-snapshot.repository";
import { PrismaShipmentHandoffAcceptanceRepository } from "./infrastructure/prisma-shipment-handoff-acceptance.repository";
import { SHIPMENT_HANDOFF_ACCEPTANCE_REPOSITORY } from "./domain/shipment-handoff-acceptance";
import { SHIPMENT_READ_REPOSITORY } from "./domain/shipment-read.repository";
import { PrismaShipmentReadRepository } from "./infrastructure/prisma-shipment-read.repository";
import { PrismaContainerOperationalViewRepository } from "./infrastructure/prisma-container-operational-view.repository";
import { CONTAINER_OPERATIONAL_VIEW_REPOSITORY } from "./domain/container-operational-view.repository";
import { PrismaReplenishmentLineSkuBinder } from "./infrastructure/prisma-replenishment-line-sku-binder";
import { PrismaReplenishmentOrderWorkbenchRepository } from "./infrastructure/prisma-replenishment-order-workbench.repository";
import { PrismaContainerRepository } from "./infrastructure/prisma-container.repository";
import { ContainersController } from "./presentation/containers.controller";
import { ContainerStuffingController } from "./presentation/container-stuffing.controller";
import { ContainerDispatchController } from "./presentation/container-dispatch.controller";
import { ReplenishmentOrdersController } from "./presentation/replenishment-orders.controller";
import { ShipmentsController } from "./presentation/shipments.controller";
import { REPLACE_CONTAINER_CARGO_ALLOCATIONS } from "./replace-container-cargo-allocations.port";
import { GET_CONTAINER_CARGO_COMPLIANCE_SCOPE } from "./get-container-cargo-compliance-scope.port";
import { GET_CONTAINER_STUFFING_READINESS } from "./get-container-stuffing-readiness.port";
import { REPLACE_CONTAINER_STUFFING_SNAPSHOT } from "./replace-container-stuffing-snapshot.port";
import { GET_CONTAINER_DISPATCH_READINESS } from "./get-container-dispatch-readiness.port";
import { REPLACE_CONTAINER_DISPATCH_SNAPSHOT } from "./replace-container-dispatch-snapshot.port";
import { COMMIT_SHIPMENT_HANDOFF } from "./commit-shipment-handoff.port";
import { INSPECT_SHIPMENT_HANDOFF_CONFLICTS } from "./inspect-shipment-handoff-conflicts.port";
import { PrismaShipmentHandoffConflictInspector } from "./infrastructure/prisma-shipment-handoff-conflict-inspector";

@Module({
  imports: [IdentityModule, MasterDataModule],
  controllers: [
    ContainersController,
    ContainerStuffingController,
    ContainerDispatchController,
    ReplenishmentOrdersController,
    ShipmentsController,
  ],
  providers: [
    ListContainersService,
    ListReplenishmentOrdersService,
    ListContainerTaskFactsService,
    GetContainerService,
    ApplyContainerRecordService,
    ApplyReplenishmentOrderImportService,
    AssertContainerTenantService,
    ResolveContainerByNumberService,
    BindReplenishmentLineProductSkuService,
    ReplaceContainerCargoAllocationsService,
    GetContainerCargoComplianceScopeService,
    GetContainerStuffingSnapshotService,
    GetContainerStuffingReadinessService,
    ReplaceContainerStuffingSnapshotService,
    GetContainerDispatchSnapshotService,
    GetContainerDispatchReadinessService,
    ReplaceContainerDispatchSnapshotService,
    CommitShipmentHandoffService,
    GetShipmentService,
    ListShipmentsService,
    GetContainerOperationalViewService,
    {
      provide: ASSERT_CONTAINER_TENANT,
      useExisting: AssertContainerTenantService,
    },
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
    { provide: CONTAINER_RECORD_WRITER, useClass: PrismaContainerRecordWriter },
    {
      provide: REPLENISHMENT_ORDER_IMPORT_WRITER,
      useClass: PrismaReplenishmentOrderImportWriter,
    },
    {
      provide: REPLENISHMENT_LINE_SKU_BINDER,
      useClass: PrismaReplenishmentLineSkuBinder,
    },
    {
      provide: REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY,
      useClass: PrismaReplenishmentOrderWorkbenchRepository,
    },
    {
      provide: CONTAINER_CARGO_ALLOCATION_REPOSITORY,
      useClass: PrismaContainerCargoAllocationRepository,
    },
    {
      provide: CONTAINER_STUFFING_SNAPSHOT_REPOSITORY,
      useClass: PrismaContainerStuffingSnapshotRepository,
    },
    {
      provide: CONTAINER_DISPATCH_SNAPSHOT_REPOSITORY,
      useClass: PrismaContainerDispatchSnapshotRepository,
    },
    {
      provide: SHIPMENT_HANDOFF_ACCEPTANCE_REPOSITORY,
      useClass: PrismaShipmentHandoffAcceptanceRepository,
    },
    {
      provide: INSPECT_SHIPMENT_HANDOFF_CONFLICTS,
      useClass: PrismaShipmentHandoffConflictInspector,
    },
    {
      provide: SHIPMENT_READ_REPOSITORY,
      useClass: PrismaShipmentReadRepository,
    },
    {
      provide: CONTAINER_OPERATIONAL_VIEW_REPOSITORY,
      useClass: PrismaContainerOperationalViewRepository,
    },
    {
      provide: BIND_REPLENISHMENT_LINE_PRODUCT_SKU,
      useExisting: BindReplenishmentLineProductSkuService,
    },
    {
      provide: REPLACE_CONTAINER_CARGO_ALLOCATIONS,
      useExisting: ReplaceContainerCargoAllocationsService,
    },
    {
      provide: GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
      useExisting: GetContainerCargoComplianceScopeService,
    },
    {
      provide: GET_CONTAINER_STUFFING_READINESS,
      useExisting: GetContainerStuffingReadinessService,
    },
    {
      provide: REPLACE_CONTAINER_STUFFING_SNAPSHOT,
      useExisting: ReplaceContainerStuffingSnapshotService,
    },
    {
      provide: GET_CONTAINER_DISPATCH_READINESS,
      useExisting: GetContainerDispatchReadinessService,
    },
    {
      provide: REPLACE_CONTAINER_DISPATCH_SNAPSHOT,
      useExisting: ReplaceContainerDispatchSnapshotService,
    },
    {
      provide: COMMIT_SHIPMENT_HANDOFF,
      useExisting: CommitShipmentHandoffService,
    },
    {
      provide: LIST_CONTAINER_TASK_FACTS,
      useExisting: ListContainerTaskFactsService,
    },
    { provide: GET_CONTAINER_SUMMARY, useExisting: GetContainerService },
    {
      provide: RESOLVE_CONTAINER_BY_NUMBER,
      useExisting: ResolveContainerByNumberService,
    },
  ],
  exports: [
    ListContainersService,
    ApplyContainerRecordService,
    ApplyReplenishmentOrderImportService,
    AssertContainerTenantService,
    ASSERT_CONTAINER_TENANT,
    ListContainerTaskFactsService,
    LIST_CONTAINER_TASK_FACTS,
    GET_CONTAINER_SUMMARY,
    RESOLVE_CONTAINER_BY_NUMBER,
    BIND_REPLENISHMENT_LINE_PRODUCT_SKU,
    REPLACE_CONTAINER_CARGO_ALLOCATIONS,
    GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
    GET_CONTAINER_STUFFING_READINESS,
    REPLACE_CONTAINER_STUFFING_SNAPSHOT,
    GET_CONTAINER_DISPATCH_READINESS,
    REPLACE_CONTAINER_DISPATCH_SNAPSHOT,
    COMMIT_SHIPMENT_HANDOFF,
    INSPECT_SHIPMENT_HANDOFF_CONFLICTS,
    GetContainerService,
    BindReplenishmentLineProductSkuService,
    ReplaceContainerCargoAllocationsService,
    GetContainerCargoComplianceScopeService,
    GetContainerDispatchSnapshotService,
    CommitShipmentHandoffService,
    GetShipmentService,
    ListShipmentsService,
    GetContainerOperationalViewService,
  ],
})
export class ShipmentRegistryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(ContainersController);
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ContainerStuffingController);
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ContainerDispatchController);
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(ReplenishmentOrdersController);
    consumer.apply(DevIdentityMiddleware).forRoutes(ShipmentsController);
  }
}
