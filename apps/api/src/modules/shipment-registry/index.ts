// shipment-registry 公开入口：只导出其他模块可消费的稳定接口，内部实现默认私有。
export * from "./shipment-registry.module";
export type { ContainerSummary } from "./domain/container-summary";
