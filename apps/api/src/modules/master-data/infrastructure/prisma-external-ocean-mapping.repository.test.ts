import { describe, expect, it, vi } from "vitest";
import { PrismaExternalOceanMappingRepository } from "./prisma-external-ocean-mapping.repository";
import { parseProviderProfile } from "../domain/provider-profile";

function setup() {
  const raw = {
    schemaVersion: 1,
    provider: "example",
    version: "v1",
    source: { reference: "fixture://profile", description: "fixture" },
    datasets: [
      {
        dataset: "container_type",
        canonicalReleaseId: "00000000-0000-5000-8000-000000000001",
        namespaces: ["logix", "supplier_type"],
        mappings: [
          {
            namespace: "supplier_type",
            sourceCode: "HQ40",
            canonicalCode: "40HC",
            reason: "alias",
            evidence: "fixture://row",
          },
        ],
      },
    ],
  };
  const { profile, hash } = parseProviderProfile(raw);
  const db = {
    externalOceanProviderProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "p1",
        provider: "example",
        profileVersion: "v1",
        datasetCode: "container_type",
        status: "active",
        configuration: profile,
        sourceSha256: hash,
        canonicalReleaseId: raw.datasets[0]!.canonicalReleaseId,
      }),
      findMany: vi.fn().mockResolvedValue([{ id: "p1" }]),
    },
    externalOceanReferenceMapping: {
      findUnique: vi.fn().mockResolvedValue({
        mappingState: "candidate",
        canonicalCode: "40HC",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    referenceDataRelease: {
      findUnique: vi.fn().mockResolvedValue({
        authority: "Logix",
        datasetCode: "ocean_internal_baseline",
        status: "active",
      }),
    },
    containerTypeReference: {
      findUnique: vi.fn().mockResolvedValue({ status: "active" }),
    },
  };
  return { db, repo: new PrismaExternalOceanMappingRepository(db as never) };
}
const query = {
  provider: "example",
  profileVersion: "v1",
  dataset: "container_type" as const,
  namespace: "supplier_type",
  sourceCode: "HQ40",
};

describe("explicit provider profile consumption", () => {
  it("returns pending rather than a candidate target and requires an exact version", async () => {
    const { db, repo } = setup();
    await expect(repo.resolve(query)).resolves.toEqual({
      status: "pending_review",
    });
    expect(
      db.externalOceanProviderProfile.findUnique.mock.calls[0]?.[0],
    ).toEqual({
      where: {
        provider_profileVersion_datasetCode: {
          provider: "example",
          profileVersion: "v1",
          datasetCode: "container_type",
        },
      },
    });
    db.externalOceanProviderProfile.findUnique.mockResolvedValueOnce(null);
    await expect(
      repo.resolve({ ...query, profileVersion: "v2" }),
    ).resolves.toEqual({ status: "unavailable" });
  });
  it("validates standard codes directly without requiring identity mapping rows", async () => {
    const { db, repo } = setup();
    await expect(
      repo.resolve({ ...query, namespace: "logix", sourceCode: "40HC" }),
    ).resolves.toEqual({
      status: "resolved",
      canonicalCode: "40HC",
      canonicalReleaseId: "00000000-0000-5000-8000-000000000001",
      via: "standard",
    });
    expect(db.externalOceanReferenceMapping.findUnique).not.toHaveBeenCalled();
    db.containerTypeReference.findUnique.mockResolvedValueOnce(null);
    await expect(
      repo.resolve({ ...query, namespace: "logix", sourceCode: "40HQ" }),
    ).resolves.toEqual({ status: "unknown" });
  });
  it("inspection scopes mapping rows to the requested profile IDs", async () => {
    const { db, repo } = setup();
    await repo.inspectProfile("example", "v1");
    expect(
      db.externalOceanReferenceMapping.findMany.mock.calls[0]?.[0].where,
    ).toEqual({ profileId: { in: ["p1"] } });
  });
});
