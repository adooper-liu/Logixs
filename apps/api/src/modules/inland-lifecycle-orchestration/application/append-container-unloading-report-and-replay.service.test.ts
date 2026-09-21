import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { APPEND_CONTAINER_UNLOADING_REPORT } from "../../inland-fulfillment";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { AppendContainerUnloadingReportAndReplayService } from "./append-container-unloading-report-and-replay.service";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 1,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  operationState: "partial" as const,
  startedAt: "2026-04-23T06:00:00Z",
  completedAt: null,
  expectedQuantity: "524",
  unloadedQuantity: "300",
  remainingQuantity: "224",
  damagedQuantity: "0",
  shortageQuantity: "0",
  quantityUnit: "carton" as const,
  sealCheck: "matched" as const,
  exceptionResolved: false,
  exceptionNotes: null,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "unloading_progress_reported",
  idempotencyKey: "unloading-v2",
};

async function context(replayFails = false) {
  const append = {
    execute: vi.fn().mockResolvedValue({ reportId: "report-1" }),
  };
  const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const replay = {
    execute: replayFails
      ? vi.fn().mockRejectedValue(new Error("down"))
      : vi.fn().mockResolvedValue({ applied: 1 }),
  };
  const module = await Test.createTestingModule({
    providers: [
      AppendContainerUnloadingReportAndReplayService,
      { provide: APPEND_CONTAINER_UNLOADING_REPORT, useValue: append },
      { provide: ASSERT_EVIDENCE_REFS, useValue: evidence },
      { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
    ],
  }).compile();
  return {
    service: module.get(AppendContainerUnloadingReportAndReplayService),
    append,
    evidence,
    replay,
  };
}

describe("AppendContainerUnloadingReportAndReplayService", () => {
  it("qualifies evidence, appends progress and replays pending facts", async () => {
    const value = await context();
    await expect(value.service.execute(command)).resolves.toEqual({
      reportId: "report-1",
    });
    expect(value.evidence.execute.mock.invocationCallOrder[0]).toBeLessThan(
      value.append.execute.mock.invocationCallOrder[0]!,
    );
    expect(value.replay.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
  });

  it("returns a retryable error when replay fails after persistence", async () => {
    const value = await context(true);
    await expect(value.service.execute(command)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(value.append.execute).toHaveBeenCalledOnce();
  });
});
