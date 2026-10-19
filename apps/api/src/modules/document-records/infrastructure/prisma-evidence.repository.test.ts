import { describe, expect, it, vi } from "vitest";
import { PrismaEvidenceRepository } from "./prisma-evidence.repository";

describe("PrismaEvidenceRepository task collaboration scope", () => {
  it("pushes tenant, subject, validity and requested IDs into one Prisma where", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaEvidenceRepository({
      evidenceRecord: { findMany },
    } as never);

    await repository.findTaskCollaborationEvidence({
      tenantId: "tenant-a",
      subjectType: "container",
      subjectId: "container-a",
      validity: "effective",
      evidenceRecordIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000002",
      ],
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        subjectType: "container",
        subjectId: "container-a",
        validity: "effective",
        id: {
          in: [
            "10000000-0000-4000-8000-000000000001",
            "10000000-0000-4000-8000-000000000002",
          ],
        },
      },
    });
  });
});

describe("PrismaEvidenceRepository.appendDecision", () => {
  it("locks the evidence parent before child reads and re-evaluates an already revoked decision", async () => {
    const record = {
      id: "evidence-1",
      tenantId: "tenant-a",
      idempotencyKey: "evidence-key",
      evidenceType: "document",
      subjectType: "container",
      subjectId: "container-a",
      authorityLevel: "operational",
      contentRef: "private://evidence-1",
      contentHash: "a".repeat(64),
      source: {},
      verificationState: "revoked",
      confidenceState: "unknown",
      validity: "revoked",
      receivedAt: new Date("2026-10-19T00:00:00Z"),
      recordedAt: new Date("2026-10-19T00:00:00Z"),
    };
    const order: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async () => {
        order.push("parent_lock");
        return [record];
      }),
      evidenceVerificationDecision: {
        findFirst: vi.fn(async () => {
          order.push("decision_read");
          return {
            id: "decision-1",
            verificationSequence: 1,
            decision: "verified",
          };
        }),
        create: vi.fn(async () => {
          order.push("decision_create");
          return { id: "decision-2" };
        }),
      },
      evidenceRecord: {
        update: vi.fn().mockResolvedValue(record),
      },
    };
    const repository = new PrismaEvidenceRepository({
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as never);

    await expect(
      repository.appendDecision({
        evidenceId: record.id,
        tenantId: record.tenantId,
        decision: "revoked",
        actorOrServiceId: "actor-a",
        reasonCode: "manual_revoke",
      }),
    ).resolves.toMatchObject({ appended: false, decisionId: null });
    expect(order[0]).toBe("parent_lock");
    expect(tx.evidenceVerificationDecision.create).not.toHaveBeenCalled();
    expect(tx.evidenceRecord.update).not.toHaveBeenCalled();
  });
});
