import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerUnloadingReadinessResult,
  GetContainerUnloadingReadinessPort,
} from "../get-container-unloading-readiness.port";
import {
  CONTAINER_UNLOADING_REPORT_REPOSITORY,
  type ContainerUnloadingReportRepository,
} from "../domain/container-unloading-report.repository";
import {
  WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
  type WarehouseDeliveryInstructionRepository,
} from "../domain/warehouse-delivery-instruction.repository";

@Injectable()
export class GetContainerUnloadingReadinessService implements GetContainerUnloadingReadinessPort {
  constructor(
    @Inject(CONTAINER_UNLOADING_REPORT_REPOSITORY)
    private readonly reports: ContainerUnloadingReportRepository,
    @Inject(WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY)
    private readonly instructions: WarehouseDeliveryInstructionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerUnloadingReadinessResult> {
    const [instruction, report] = await Promise.all([
      this.instructions.findCurrent(input),
      this.reports.findCurrent(input),
    ]);
    if (!instruction) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION",
        instruction,
        report,
      };
    }
    if (!report) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_UNLOADING_REPORT",
        instruction,
        report,
      };
    }
    if (report.warehouseLocationId !== instruction.warehouseLocationId) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_UNLOADING_WAREHOUSE_MISMATCH",
        instruction,
        report,
      };
    }
    if (report.operationState !== "completed" || !report.completedAt) {
      return {
        confirmed: false,
        reasonCode: "LIFECYCLE_EVENT_PENDING_UNLOADING_COMPLETION",
        instruction,
        report,
      };
    }
    return { confirmed: true, reasonCode: null, instruction, report };
  }
}
