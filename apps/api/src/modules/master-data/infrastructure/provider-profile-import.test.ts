import { describe, expect, it, vi } from "vitest";
import { importProviderProfile } from "./provider-profile-import";

const input = {
  schemaVersion: 1,
  provider: "new-supplier",
  version: "v1",
  source: { reference: "fixture://supplier", description: "fixture" },
  datasets: [
    {
      dataset: "container_type",
      canonicalReleaseId: "00000000-0000-5000-8000-000000000001",
      namespaces: ["supplier_type", "logix"],
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
function mockDb() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
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
    externalOceanProviderProfile: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(({ data }) => ({ ...data, id: "new-profile" })),
    },
    externalOceanReferenceMapping: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
  };
  return { db, tx };
}
describe("provider profile import", () => {
  it("audits without writes by default and imports supplier identity from configuration", async () => {
    const { db, tx } = mockDb();
    await expect(
      importProviderProfile(db as never, input),
    ).resolves.toMatchObject({
      mode: "audit",
      provider: "new-supplier",
      profilesToCreate: 1,
      mappingsToCreate: 1,
    });
    expect(tx.externalOceanProviderProfile.create).not.toHaveBeenCalled();
    await importProviderProfile(db as never, input, true);
    expect(
      tx.externalOceanProviderProfile.create.mock.calls[0]?.[0].data.provider,
    ).toBe("new-supplier");
    expect(
      tx.externalOceanReferenceMapping.createMany.mock.calls[0]?.[0].data[0]
        .mappingState,
    ).toBe("candidate");
  });
  it("rejects same identity with different content before writing", async () => {
    const { db, tx } = mockDb();
    tx.externalOceanProviderProfile.findUnique.mockResolvedValue({
      id: "old",
      sourceSha256: "different",
    } as never);
    await expect(
      importProviderProfile(db as never, input, true),
    ).rejects.toThrow("PROVIDER_PROFILE_CONTENT_CONFLICT");
    expect(tx.externalOceanReferenceMapping.createMany).not.toHaveBeenCalled();
  });
  it("rejects a different dataset set under the same provider version", async () => {
    const { db, tx } = mockDb();
    tx.externalOceanProviderProfile.findMany.mockResolvedValue([
      { sourceSha256: "another-configuration" },
    ] as never);
    await expect(
      importProviderProfile(db as never, input, true),
    ).rejects.toThrow("PROVIDER_PROFILE_CONTENT_CONFLICT");
    expect(tx.externalOceanProviderProfile.create).not.toHaveBeenCalled();
  });
  it("rejects a missing canonical target instead of creating internal reference data", async () => {
    const { db, tx } = mockDb();
    tx.containerTypeReference.findUnique.mockResolvedValue(null);
    await expect(
      importProviderProfile(db as never, input, true),
    ).rejects.toThrow("CANONICAL_TARGET_NOT_FOUND");
    expect(tx.externalOceanProviderProfile.create).not.toHaveBeenCalled();
  });
});
