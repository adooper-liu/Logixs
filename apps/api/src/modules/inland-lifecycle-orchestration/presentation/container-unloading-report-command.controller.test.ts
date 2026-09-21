import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainerUnloadingReportCommandController } from "./container-unloading-report-command.controller";

const body = {
  expectedVersion: 0,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  operationState: "started" as const,
  startedAt: "2026-04-23T06:00:00Z",
  completedAt: null,
  expectedQuantity: "524",
  unloadedQuantity: "0",
  remainingQuantity: "524",
  damagedQuantity: "0",
  shortageQuantity: "0",
  quantityUnit: "carton" as const,
  sealCheck: "matched" as const,
  exceptionResolved: false,
  exceptionNotes: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"] as [string],
  reasonCode: "unloading_started",
  idempotencyKey: "unloading-v1",
};

describe("ContainerUnloadingReportCommandController", () => {
  it("injects the manual source and authenticated actor", async () => {
    const append = {
      execute: vi.fn().mockResolvedValue({ reportId: "report-1" }),
    };
    const controller = new ContainerUnloadingReportCommandController(
      append as never,
    );
    await controller.append("container-1", body, {
      identity: { tenantId: "tenant-a", actorId: "operator-a" },
    });
    expect(append.execute).toHaveBeenCalledWith({
      ...body,
      tenantId: "tenant-a",
      containerRecordId: "container-1",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      actorId: "operator-a",
    });
  });

  it("requires server-side operate capability", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainerUnloadingReportCommandController.prototype.append,
      ),
    ).toEqual(["container.operate"]);
  });
});
