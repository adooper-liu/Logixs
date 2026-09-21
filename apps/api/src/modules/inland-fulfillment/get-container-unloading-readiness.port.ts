import type { ContainerUnloadingReportRecord } from "./domain/container-unloading-report";
import type { WarehouseDeliveryInstructionRecord } from "./domain/warehouse-delivery-instruction";

export const GET_CONTAINER_UNLOADING_READINESS = Symbol.for(
  "logix.GetContainerUnloadingReadiness",
);

export interface ContainerUnloadingReadinessResult {
  confirmed: boolean;
  reasonCode:
    | "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION"
    | "LIFECYCLE_EVENT_PENDING_UNLOADING_REPORT"
    | "LIFECYCLE_EVENT_PENDING_UNLOADING_COMPLETION"
    | "LIFECYCLE_EVENT_UNLOADING_WAREHOUSE_MISMATCH"
    | null;
  instruction: WarehouseDeliveryInstructionRecord | null;
  report: ContainerUnloadingReportRecord | null;
}

export interface GetContainerUnloadingReadinessPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerUnloadingReadinessResult>;
}
