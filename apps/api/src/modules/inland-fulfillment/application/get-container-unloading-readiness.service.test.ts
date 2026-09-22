import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CONTAINER_UNLOADING_REPORT_REPOSITORY } from "../domain/container-unloading-report.repository";
import { WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY } from "../domain/warehouse-delivery-instruction.repository";
import { GetContainerUnloadingReadinessService } from "./get-container-unloading-readiness.service";

const input = { tenantId: "tenant-a", containerRecordId: "container-1" };
const instruction = {
  instructionId: "instruction-1",
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
};
const report = {
  reportId: "report-1",
  warehouseLocationId: instruction.warehouseLocationId,
  operationState: "completed",
  completedAt: "2026-04-23T08:30:00.000Z",
};

async function service(
  currentReport: unknown,
  currentInstruction: unknown = instruction,
) {
  const module = await Test.createTestingModule({
    providers: [
      GetContainerUnloadingReadinessService,
      {
        provide: CONTAINER_UNLOADING_REPORT_REPOSITORY,
        useValue: { findCurrent: vi.fn().mockResolvedValue(currentReport) },
      },
      {
        provide: WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
        useValue: {
          findCurrent: vi.fn().mockResolvedValue(currentInstruction),
        },
      },
    ],
  }).compile();
  return module.get(GetContainerUnloadingReadinessService);
}

describe("GetContainerUnloadingReadinessService", () => {
  it("keeps started and partial work pending", async () => {
    const value = await service({
      ...report,
      operationState: "partial",
      completedAt: null,
    });
    await expect(value.execute(input)).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_UNLOADING_COMPLETION",
    });
  });

  it("rejects a report for another warehouse", async () => {
    const value = await service({
      ...report,
      warehouseLocationId: "33333333-3333-4333-8333-333333333333",
    });
    await expect(value.execute(input)).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_UNLOADING_WAREHOUSE_MISMATCH",
    });
  });

  it("confirms only the completed report at the current destination", async () => {
    const value = await service(report);
    await expect(value.execute(input)).resolves.toMatchObject({
      confirmed: true,
      reasonCode: null,
      instruction,
      report,
    });
  });
});
