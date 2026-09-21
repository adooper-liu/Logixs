import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { REPLACE_CONTAINER_DISPATCH_SNAPSHOT } from "../../shipment-registry";
import { ReplaceContainerDispatchAndReplayService } from "./replace-container-dispatch-and-replay.service";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
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
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "dispatch_confirmed",
  idempotencyKey: "dispatch-1",
};

async function context(replayFails = false) {
  const replace = {
    execute: vi.fn().mockResolvedValue({ snapshotId: "snapshot-1" }),
  };
  const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const replay = {
    execute: replayFails
      ? vi.fn().mockRejectedValue(new Error("down"))
      : vi.fn().mockResolvedValue({ applied: 1 }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceContainerDispatchAndReplayService,
      { provide: REPLACE_CONTAINER_DISPATCH_SNAPSHOT, useValue: replace },
      { provide: ASSERT_EVIDENCE_REFS, useValue: evidence },
      { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
    ],
  }).compile();
  return {
    service: module.get(ReplaceContainerDispatchAndReplayService),
    replace,
    evidence,
    replay,
  };
}

describe("ReplaceContainerDispatchAndReplayService", () => {
  it("verifies evidence, saves the snapshot and replays pending facts", async () => {
    const value = await context();
    await expect(value.service.execute(command)).resolves.toEqual({
      snapshotId: "snapshot-1",
    });
    expect(value.evidence.execute).toHaveBeenCalledOnce();
    expect(value.replace.execute).toHaveBeenCalledWith(command);
    expect(value.evidence.execute.mock.invocationCallOrder[0]).toBeLessThan(
      value.replace.execute.mock.invocationCallOrder[0]!,
    );
    expect(value.replay.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
  });

  it("returns a retryable boundary error after a committed snapshot when replay fails", async () => {
    const value = await context(true);
    await expect(value.service.execute(command)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(value.replace.execute).toHaveBeenCalledOnce();
  });
});
