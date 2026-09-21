import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainerDispatchCommandController } from "./container-dispatch-command.controller";

const body = {
  expectedVersion: 0,
  stuffingSnapshotId: "22222222-2222-4222-8222-222222222222",
  stuffingSnapshotVersion: 2,
  bookingNumber: "BKG-1",
  carrierCode: "HMM",
  vesselName: "HMM LEAF",
  voyageNumber: "0002W",
  masterBillNumber: null,
  houseBillNumber: null,
  vgmHandoffState: "accepted" as const,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  reasonCode: "dispatch_confirmed",
  idempotencyKey: "dispatch-1",
};

describe("ContainerDispatchCommandController", () => {
  it("injects the manual channel, source and actor on write", async () => {
    const replace = {
      execute: vi.fn().mockResolvedValue({ snapshotId: "snapshot-1" }),
    };
    const controller = new ContainerDispatchCommandController(replace as never);
    await controller.replace("container-1", body, {
      identity: { tenantId: "tenant-a", actorId: "operator-a" },
    });
    expect(replace.execute).toHaveBeenCalledWith({
      ...body,
      tenantId: "tenant-a",
      containerRecordId: "container-1",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      actorId: "operator-a",
    });
  });

  it("declares the server-side operate capability", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainerDispatchCommandController.prototype.replace,
      ),
    ).toEqual(["container.operate"]);
  });
});
