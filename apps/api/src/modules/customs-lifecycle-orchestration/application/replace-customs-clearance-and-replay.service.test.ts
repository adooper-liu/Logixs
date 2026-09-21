import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { REPLACE_CUSTOMS_CLEARANCE_CASE } from "../../customs-compliance";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { ReplaceCustomsClearanceAndReplayService } from "./replace-customs-clearance-and-replay.service";

const command = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "22222222-2222-4222-8222-222222222222",
  expectedVersion: 0,
  jurisdictionCountryCode: "US",
  customsBrokerPartyId: "33333333-3333-4333-8333-333333333333",
  declarationNumber: "ENTRY-001",
  filingState: "accepted" as const,
  decisionState: "released" as const,
  activeHoldCodes: [],
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
  actorId: "55555555-5555-4555-8555-555555555555",
  reasonCode: "CUSTOMS_RELEASE_CONFIRMED",
  idempotencyKey: "customs-1",
};

async function context(replayFails = false) {
  const replace = { execute: vi.fn().mockResolvedValue({ caseId: "case-1" }) };
  const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const replay = {
    execute: replayFails
      ? vi.fn().mockRejectedValue(new Error("down"))
      : vi.fn().mockResolvedValue({ applied: 1 }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceCustomsClearanceAndReplayService,
      { provide: REPLACE_CUSTOMS_CLEARANCE_CASE, useValue: replace },
      { provide: ASSERT_EVIDENCE_REFS, useValue: evidence },
      { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
    ],
  }).compile();
  return {
    service: module.get(ReplaceCustomsClearanceAndReplayService),
    replace,
    evidence,
    replay,
  };
}

describe("ReplaceCustomsClearanceAndReplayService", () => {
  it("qualifies evidence before saving and replays pending date facts", async () => {
    const value = await context();
    await expect(value.service.execute(command)).resolves.toEqual({
      caseId: "case-1",
    });
    expect(value.evidence.execute.mock.invocationCallOrder[0]).toBeLessThan(
      value.replace.execute.mock.invocationCallOrder[0]!,
    );
    expect(value.replay.execute).toHaveBeenCalledWith({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
  });

  it("returns a retryable boundary error after a committed case when replay fails", async () => {
    const value = await context(true);
    await expect(value.service.execute(command)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(value.replace.execute).toHaveBeenCalledOnce();
  });
});
