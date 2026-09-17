// shipment-registry 公开入口：只导出其他模块可消费的稳定接口，内部实现默认私有。
export * from "./shipment-registry.module";
export type { ContainerSummary } from "./domain/container-summary";
export { ApplyContainerRecordService } from "./application/apply-container-record.service";
export { ApplyReplenishmentOrderImportService } from "./application/apply-replenishment-order-import.service";
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
export type {
  ApplyReplenishmentOrderImportCommand,
  ApplyReplenishmentOrderImportResult,
  ReplenishmentOrderImportLine,
  ShipmentTimeFactImport,
} from "./domain/apply-replenishment-order-import";
