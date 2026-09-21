import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { DECIDE_CARGO_READY_COMPLIANCE } from "../../compliance-management";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "../../lifecycle-control";
import { DecideCargoReadyAndReplayService } from "./decide-cargo-ready-and-replay.service";

describe("DecideCargoReadyAndReplayService", () => {
  it("replays pending date facts after an approved decision", async () => {
    const decide = {
      execute: vi.fn().mockResolvedValue({
        record: {
          assessmentId: command().assessmentId,
          version: 1,
          currentDecision: { decisionCode: "approved" },
        },
        duplicate: false,
      }),
    };
    const replay = {
      execute: vi.fn().mockResolvedValue({
        claimed: 1,
        applied: 1,
        pending: 0,
        rejected: 0,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        DecideCargoReadyAndReplayService,
        { provide: DECIDE_CARGO_READY_COMPLIANCE, useValue: decide },
        { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
      ],
    }).compile();

    const result = await module
      .get(DecideCargoReadyAndReplayService)
      .execute(command());

    expect(replay.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerId: "container-1",
    });
    expect(result.replay).toMatchObject({
      status: "completed",
      applied: 1,
    });
  });

  it("keeps the committed decision visible when replay must be retried", async () => {
    const module = await Test.createTestingModule({
      providers: [
        DecideCargoReadyAndReplayService,
        {
          provide: DECIDE_CARGO_READY_COMPLIANCE,
          useValue: {
            execute: vi.fn().mockResolvedValue({
              record: {
                assessmentId: command().assessmentId,
                version: 1,
                currentDecision: { decisionCode: "approved" },
              },
              duplicate: false,
            }),
          },
        },
        {
          provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
          useValue: { execute: vi.fn().mockRejectedValue(new Error("down")) },
        },
      ],
    }).compile();

    const result = await module
      .get(DecideCargoReadyAndReplayService)
      .execute(command());

    expect(result.record.assessmentId).toBe(command().assessmentId);
    expect(result.replay).toEqual({
      status: "retry_required",
      reasonCode: "REPLAY_REQUEST_FAILED",
      claimed: 0,
      applied: 0,
      pending: 0,
      rejected: 0,
    });
  });

  it("does not replay a blocking decision", async () => {
    const replay = { execute: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        DecideCargoReadyAndReplayService,
        {
          provide: DECIDE_CARGO_READY_COMPLIANCE,
          useValue: {
            execute: vi.fn().mockResolvedValue({
              record: { currentDecision: { decisionCode: "blocked" } },
              duplicate: false,
            }),
          },
        },
        { provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS, useValue: replay },
      ],
    }).compile();

    const result = await module
      .get(DecideCargoReadyAndReplayService)
      .execute({ ...command(), decisionCode: "blocked" });

    expect(replay.execute).not.toHaveBeenCalled();
    expect(result.replay.status).toBe("not_requested");
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    containerRecordId: "container-1",
    assessmentId: "11111111-1111-4111-8111-111111111111",
    expectedDecisionVersion: 0,
    decisionCode: "approved" as const,
    evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
    actorId: "reviewer-1",
    reasonCode: "REVIEW_APPROVED",
    idempotencyKey: "decision-1",
  };
}
