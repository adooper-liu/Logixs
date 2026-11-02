import { describe, expect, it, vi } from "vitest";
import { PrismaInternalOceanReferenceRepository } from "./prisma-internal-ocean-reference.repository";

describe("PrismaInternalOceanReferenceRepository", () => {
  it("reads only the explicitly bound internal release", async () => {
    const prisma = {
      referenceDataRelease: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "release-1", version: "1.0.0" }),
      },
      oceanCarrierReference: {
        findMany: vi.fn().mockResolvedValue([
          {
            canonicalCode: "MSC",
            nameZh: "地中海航运",
            nameEn: "MSC",
            status: "active",
          },
        ]),
      },
      containerTypeReference: {
        findMany: vi.fn().mockResolvedValue([
          {
            canonicalCode: "40HC",
            length: 40,
            typeCode: "HC",
            status: "active",
          },
        ]),
      },
    };
    const repository = new PrismaInternalOceanReferenceRepository(
      prisma as never,
    );
    await expect(repository.readBaseline()).resolves.toEqual({
      release: { id: "release-1", version: "1.0.0" },
      carriers: [
        {
          canonicalCode: "MSC",
          nameZh: "地中海航运",
          nameEn: "MSC",
          status: "active",
        },
      ],
      containerTypes: [
        { canonicalCode: "40HC", length: 40, typeCode: "HC", status: "active" },
      ],
    });
    expect(prisma.referenceDataRelease.findFirst).toHaveBeenCalledWith({
      where: {
        authority: "Logix",
        datasetCode: "ocean_internal_baseline",
        status: "active",
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
  });
});
