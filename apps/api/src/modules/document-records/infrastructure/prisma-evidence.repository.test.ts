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
