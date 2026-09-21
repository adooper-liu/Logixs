// shipment-registry 公开入口：只导出其他模块可消费的稳定接口，内部实现默认私有。
export * from "./shipment-registry.module";
export type { ContainerSummary } from "./domain/container-summary";
export { ApplyContainerRecordService } from "./application/apply-container-record.service";
export { ApplyReplenishmentOrderImportService } from "./application/apply-replenishment-order-import.service";
export { BindReplenishmentLineProductSkuService } from "./application/bind-replenishment-line-product-sku.service";
export { ReplaceContainerCargoAllocationsService } from "./application/replace-container-cargo-allocations.service";
export { AssertContainerTenantService } from "./application/assert-container-tenant.service";
export { ListContainerTaskFactsService } from "./application/list-container-task-facts.service";
export {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "./assert-container-tenant.port";
export {
  LIST_CONTAINER_TASK_FACTS,
  type ContainerTaskFact,
  type ListContainerTaskFactsPort,
} from "./list-container-task-facts.port";
export type {
  ApplyContainerRecordCommand,
  ApplyContainerRecordResult,
} from "./domain/apply-container-record";
export {
  GET_CONTAINER_SUMMARY,
  type GetContainerSummaryPort,
} from "./get-container-summary.port";
export {
  RESOLVE_CONTAINER_BY_NUMBER,
  type ResolveContainerByNumberInput,
  type ResolveContainerByNumberPort,
  type ResolveContainerByNumberResult,
} from "./resolve-container-by-number.port";
export type {
  ApplyReplenishmentOrderImportCommand,
  ApplyReplenishmentOrderImportResult,
  ReplenishmentOrderImportLine,
  ShipmentTimeFactImport,
} from "./domain/apply-replenishment-order-import";
export {
  BIND_REPLENISHMENT_LINE_PRODUCT_SKU,
  type BindReplenishmentLineProductSkuCommand,
  type BindReplenishmentLineProductSkuPort,
  type BoundReplenishmentLineProductSku,
} from "./bind-replenishment-line-product-sku.port";
export {
  REPLACE_CONTAINER_CARGO_ALLOCATIONS,
  type ContainerCargoAllocationInput,
  type ContainerCargoAllocationResult,
  type ReplaceContainerCargoAllocationsCommand,
  type ReplaceContainerCargoAllocationsPort,
} from "./replace-container-cargo-allocations.port";
export {
  GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
  type ContainerCargoComplianceScope,
  type ContainerCargoComplianceScopeItem,
  type GetContainerCargoComplianceScopePort,
} from "./get-container-cargo-compliance-scope.port";
export {
  GET_CONTAINER_STUFFING_READINESS,
  type ContainerStuffingReadinessResult,
  type GetContainerStuffingReadinessPort,
} from "./get-container-stuffing-readiness.port";
export {
  ContainerStuffingSnapshotValidationError,
  normalizeContainerStuffingSnapshotCommand,
  type ContainerStuffingSnapshotRecord,
  type ReplaceContainerStuffingSnapshotCommand,
} from "./domain/container-stuffing-snapshot";
export {
  REPLACE_CONTAINER_STUFFING_SNAPSHOT,
  type ReplaceContainerStuffingSnapshotPort,
} from "./replace-container-stuffing-snapshot.port";
export {
  GET_CONTAINER_DISPATCH_READINESS,
  type ContainerDispatchReadinessResult,
  type GetContainerDispatchReadinessPort,
} from "./get-container-dispatch-readiness.port";
export {
  ContainerDispatchSnapshotValidationError,
  normalizeContainerDispatchSnapshotCommand,
  type ContainerDispatchSnapshotRecord,
  type ReplaceContainerDispatchSnapshotCommand,
} from "./domain/container-dispatch-snapshot";
export {
  REPLACE_CONTAINER_DISPATCH_SNAPSHOT,
  type ReplaceContainerDispatchSnapshotPort,
} from "./replace-container-dispatch-snapshot.port";
