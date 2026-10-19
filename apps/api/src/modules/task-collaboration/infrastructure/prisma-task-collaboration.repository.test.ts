import { describe, expect, it, vi } from "vitest";
import { CollaborationPersistenceConflictError } from "../domain/task-collaboration.repository";
import { PrismaTaskCollaborationRepository } from "./prisma-task-collaboration.repository";

describe("PrismaTaskCollaborationRepository transaction retries", () => {
  it.each(["P2002", "P2034"])(
    "retries %s and returns the converged transaction result",
    async (code) => {
      const expected = { idempotencyReplay: true };
      const transaction = vi
        .fn()
        .mockRejectedValueOnce({ code })
        .mockRejectedValueOnce({ code })
        .mockResolvedValueOnce(expected);
      const repository = new PrismaTaskCollaborationRepository(
        {
          $transaction: transaction,
        } as never,
        writeContext(),
        writeEvidence(),
      );

      await expect(repository.appendMessage(input())).resolves.toBe(expected);
      expect(transaction).toHaveBeenCalledTimes(3);
    },
  );

  it.each(["P2002", "P2034"])(
    "maps exhausted %s retries to a stable persistence conflict",
    async (code) => {
      const repository = new PrismaTaskCollaborationRepository(
        {
          $transaction: vi.fn().mockRejectedValue({ code }),
        } as never,
        writeContext(),
        writeEvidence(),
      );

      await expect(repository.appendMessage(input())).rejects.toBeInstanceOf(
        CollaborationPersistenceConflictError,
      );
    },
  );
});

function input() {
  return {
    scope: {
      tenantId: "tenant-a",
      subjectKind: "container" as const,
      subjectId: "30000000-0000-4000-8000-000000000001",
      workKind: "node_task" as const,
      workId: "20000000-0000-4000-8000-000000000001",
      visibilityScope: "task_scope" as const,
    },
    tenantId: "tenant-a",
    authorActorId: "actor-a",
    command: {
      contractVersion: "task-collaboration-post-command.v1" as const,
      subjectRef: {
        kind: "container" as const,
        id: "30000000-0000-4000-8000-000000000001",
      },
      workRef: {
        kind: "node_task" as const,
        id: "20000000-0000-4000-8000-000000000001",
      },
      visibility: "task_scope" as const,
      body: "hello",
      parentMessageId: null,
      mentionActorIds: [],
      evidenceRecordIds: [],
      sourceRefs: [],
      idempotencyKey: "key-a",
      payloadHash: "a".repeat(64),
    },
    occurredAt: new Date("2026-10-18T12:00:00.000Z"),
  };
}

function writeContext() {
  return { lock: vi.fn() } as never;
}

function writeEvidence() {
  return { lockExact: vi.fn() } as never;
}
