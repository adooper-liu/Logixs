import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ResolveTaskCollaborationEvidenceService } from "./resolve-task-collaboration-evidence.service";

const evidenceA = "10000000-0000-4000-8000-000000000001";
const evidenceB = "10000000-0000-4000-8000-000000000002";

describe("ResolveTaskCollaborationEvidenceService", () => {
  it("returns only stable ID labels for effective evidence in the exact tenant/container", async () => {
    const findTaskCollaborationEvidence = vi
      .fn()
      .mockResolvedValue([record(evidenceA), record(evidenceB)]);
    const service = new ResolveTaskCollaborationEvidenceService({
      findTaskCollaborationEvidence,
    } as never);

    await expect(
      service.resolveExact({
        tenantId: "tenant-a",
        subjectRef: { kind: "container", id: "container-a" },
        evidenceRecordIds: [evidenceB, evidenceA, evidenceA],
      }),
    ).resolves.toEqual([
      { evidenceRecordId: evidenceA, label: evidenceA },
      { evidenceRecordId: evidenceB, label: evidenceB },
    ]);
    expect(findTaskCollaborationEvidence).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      subjectType: "container",
      subjectId: "container-a",
      validity: "effective",
      evidenceRecordIds: [evidenceA, evidenceB],
    });
  });

  it.each([
    ["missing", []],
    ["cross tenant", [record(evidenceA, { tenantId: "tenant-b" })]],
    ["wrong container", [record(evidenceA, { subjectId: "container-b" })]],
    ["wrong subject kind", [record(evidenceA, { subjectType: "node_task" })]],
    ["unreadable", [record(evidenceA, { validity: "revoked" })]],
  ])(
    "fails closed with RESOURCE_NOT_FOUND for %s evidence",
    async (_label, rows) => {
      const service = new ResolveTaskCollaborationEvidenceService({
        findTaskCollaborationEvidence: vi.fn().mockResolvedValue(rows),
      } as never);

      const failure = service.resolveExact({
        tenantId: "tenant-a",
        subjectRef: { kind: "container", id: "container-a" },
        evidenceRecordIds: [evidenceA],
      });
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      await expect(failure).rejects.toThrow("RESOURCE_NOT_FOUND");
    },
  );

  it("lists current options without exposing evidence contents", async () => {
    const service = new ResolveTaskCollaborationEvidenceService({
      listBySubjects: vi
        .fn()
        .mockResolvedValue([record(evidenceB), record(evidenceA)]),
    } as never);

    await expect(
      service.listOptions({
        tenantId: "tenant-a",
        subjectRef: { kind: "container", id: "container-a" },
      }),
    ).resolves.toEqual([
      { evidenceRecordId: evidenceA, label: evidenceA },
      { evidenceRecordId: evidenceB, label: evidenceB },
    ]);
  });

  it("batch filters historical refs without failing when some are no longer readable", async () => {
    const findTaskCollaborationEvidence = vi
      .fn()
      .mockResolvedValue([record(evidenceB)]);
    const service = new ResolveTaskCollaborationEvidenceService({
      findTaskCollaborationEvidence,
    } as never);

    await expect(
      service.filterReadable({
        tenantId: "tenant-a",
        subjectRef: { kind: "container", id: "container-a" },
        evidenceRecordIds: [evidenceB, evidenceA, evidenceA],
      }),
    ).resolves.toEqual([{ evidenceRecordId: evidenceB, label: evidenceB }]);
    expect(findTaskCollaborationEvidence).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      subjectType: "container",
      subjectId: "container-a",
      validity: "effective",
      evidenceRecordIds: [evidenceA, evidenceB],
    });
  });
});

function record(
  id: string,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    tenantId: "tenant-a",
    subjectType: "container",
    subjectId: "container-a",
    validity: "effective",
    contentRef: "must-not-leak",
    verificationState: "pending",
    ...override,
  };
}
