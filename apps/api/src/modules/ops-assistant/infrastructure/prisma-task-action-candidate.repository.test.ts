import { describe, expect, it, vi } from "vitest";
import {
  CandidateDecisionConflictError,
  CandidateNotFoundError,
} from "../domain/task-action-candidate.repository";
import { normalizeTaskActionDecision } from "../domain/task-action-candidate";
import { PrismaTaskActionCandidateRepository } from "./prisma-task-action-candidate.repository";

describe("PrismaTaskActionCandidateRepository", () => {
  it("always scopes candidate lookup by tenant and actor", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaTaskActionCandidateRepository({
      opsAssistantActionCandidate: { findFirst },
    } as never);

    await expect(
      repository.findCandidate({
        candidateId: "40000000-0000-4000-8000-000000000001",
        tenantId: "tenant-a",
        actorId: "actor-a",
      }),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "40000000-0000-4000-8000-000000000001",
          tenantId: "tenant-a",
          actorId: "actor-a",
        },
      }),
    );
  });

  it("fails closed when a decision candidate does not match tenant and actor", async () => {
    const repository = new PrismaTaskActionCandidateRepository({
      $transaction: vi.fn(async (callback) =>
        callback({
          $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
          opsAssistantActionCandidate: { findFirst: vi.fn(() => null) },
        }),
      ),
    } as never);
    await expect(
      repository.appendDecision(decisionInput()),
    ).rejects.toBeInstanceOf(CandidateNotFoundError);
  });

  it("converges a unique race only for the same actor/key/hash replay", async () => {
    const input = decisionInput();
    const existing = {
      id: input.decision.decisionId,
      candidateId: input.candidateId,
      decidedByActorId: input.actorId,
      decision: "accepted",
      reason: null,
      idempotencyKey: input.decision.idempotencyKey,
      decisionHash: input.decision.decisionHash,
      decidedAt: input.decision.decidedAt,
      clientOperationId: null,
      traceId: null,
      executionState: "pending",
      resultRefs: [],
      recordedAt: input.decision.decidedAt,
    };
    const repository = new PrismaTaskActionCandidateRepository({
      $transaction: vi.fn().mockRejectedValue({ code: "P2002" }),
      opsAssistantActionCandidate: {
        findFirst: vi.fn().mockResolvedValue({ decisions: [existing] }),
      },
    } as never);

    await expect(repository.appendDecision(input)).resolves.toMatchObject({
      idempotencyReplay: true,
      decision: expect.objectContaining({ decision: "accepted" }),
    });
  });

  it("rejects a different key or payload after a terminal decision", async () => {
    const input = decisionInput();
    const repository = new PrismaTaskActionCandidateRepository({
      $transaction: vi.fn().mockRejectedValue({ code: "P2002" }),
      opsAssistantActionCandidate: {
        findFirst: vi.fn().mockResolvedValue({
          decisions: [
            {
              ...input.decision,
              id: input.decision.decisionId,
              candidateId: input.candidateId,
              decidedByActorId: input.actorId,
              idempotencyKey: "different-key",
              decisionHash: "f".repeat(64),
              clientOperationId: null,
              traceId: null,
              executionState: "pending",
              resultRefs: [],
              recordedAt: input.decision.decidedAt,
            },
          ],
        }),
      },
    } as never);
    await expect(repository.appendDecision(input)).rejects.toBeInstanceOf(
      CandidateDecisionConflictError,
    );
  });
});

function decisionInput() {
  const decidedAt = "2026-10-19T06:00:00.000Z";
  return {
    candidateId: "40000000-0000-4000-8000-000000000001",
    tenantId: "tenant-a",
    actorId: "actor-a",
    decision: normalizeTaskActionDecision({
      decisionId: "50000000-0000-4000-8000-000000000001",
      decision: "accepted" as const,
      reason: null,
      idempotencyKey: "confirm-1",
      decidedAt,
      clientOperationId: null,
      traceId: null,
      executionState: "pending" as const,
      resultRefs: [],
    }),
  };
}
