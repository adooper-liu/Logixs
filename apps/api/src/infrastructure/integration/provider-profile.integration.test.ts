import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { seedInternalOceanReferenceData } from "../../../../../database/seeds/seed-internal-ocean-reference-data";
import { importProviderProfile } from "../../modules/master-data/infrastructure/provider-profile-import";
import { PrismaExternalOceanMappingRepository } from "../../modules/master-data/infrastructure/prisma-external-ocean-mapping.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { parseProviderProfile } from "../../modules/master-data/domain/provider-profile";
import { seedOceanReferenceV11 } from "../../../../../database/seeds/seed-ocean-reference-v1.1";
import { PrismaInternalOceanReferenceRepository } from "../../modules/master-data/infrastructure/prisma-internal-ocean-reference.repository";

const baseUrl =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schema = `it_provider_${randomUUID().replaceAll("-", "")}`;
const url = new URL(baseUrl);
url.searchParams.set("schema", schema);
const root = resolve(__dirname, "../../../../..");
const raw = JSON.parse(
  readFileSync(
    resolve(
      root,
      "database/seeds/provider-profiles/freightower-reference-v2.json",
    ),
    "utf8",
  ),
);
let db: PrismaClient;
beforeAll(async () => {
  if (!process.env.npm_execpath) throw new Error("PNPM_ENTRYPOINT_REQUIRED");
  execFileSync(process.execPath, [process.env.npm_execpath, "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
  db = new PrismaClient({
    adapter: createPostgresAdapter(url.toString(), schema),
  });
  await seedInternalOceanReferenceData(db);
  const official = JSON.parse(
    readFileSync(
      resolve(root, "database/seeds/reference-data/unlocode-2025-1-ports.json"),
      "utf8",
    ),
  );
  const { publishedAt, filter, ...release } = official.release;
  await db.referenceDataRelease.create({
    data: {
      ...release,
      publishedAt: new Date(publishedAt),
      status: "active",
      filterRule: filter,
    },
  });
  const port = official.ports.find(
    (item: { unlocode: string }) => item.unlocode === "USSAV",
  );
  const area = official.areas.find(
    (item: { id: string }) => item.id === port.areaId,
  );
  await db.unlocodeAreaReference.create({
    data: { ...area, releaseId: release.id, isoCountryId: null },
  });
  await db.portCodeReference.create({
    data: { ...port, releaseId: release.id },
  });
});
afterAll(async () => {
  await db?.$disconnect();
  const publicUrl = new URL(baseUrl);
  publicUrl.searchParams.set("schema", "public");
  const admin = new PrismaClient({
    adapter: createPostgresAdapter(publicUrl.toString(), "public"),
  });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
});

describe("provider profile database behavior", () => {
  it("publishes a sourced initial catalog without changing old bindings or versions", async () => {
    const previous = await db.oceanCarrierReference.findMany({
      orderBy: { canonicalCode: "asc" },
    });
    await expect(seedOceanReferenceV11(db)).resolves.toMatchObject({
      version: "1.1.0",
      carriers: 373,
      selectableCarriers: 362,
      containerTypes: 12,
    });
    const once = await db.oceanCarrierReference.findMany({
      where: { releaseId: "00000000-0000-5000-8000-000000000002" },
      orderBy: { canonicalCode: "asc" },
    });
    await seedOceanReferenceV11(db);
    expect(
      await db.oceanCarrierReference.findMany({
        where: { releaseId: "00000000-0000-5000-8000-000000000002" },
        orderBy: { canonicalCode: "asc" },
      }),
    ).toEqual(once);
    expect(
      await db.oceanCarrierReference.findMany({
        where: { releaseId: "00000000-0000-5000-8000-000000000001" },
        orderBy: { canonicalCode: "asc" },
      }),
    ).toEqual(previous);
    const baseline = await new PrismaInternalOceanReferenceRepository(
      db as never,
    ).readBaseline();
    expect(baseline.release.version).toBe("1.1.0");
    expect(baseline.carriers).toHaveLength(362);
    expect(
      baseline.carriers.find((row) => row.canonicalCode === "MSK")?.nameEn,
    ).toBe("Maersk");
    expect(baseline.carriers.some((row) => row.canonicalCode === "TFP")).toBe(
      false,
    );
    expect(
      baseline.containerTypes.find((row) => row.canonicalCode === "40HC")
        ?.standardBasis,
    ).toMatchObject({ uniqueIsoEquipmentCode: null });
    expect(
      await db.referenceDataRelease.findUnique({
        where: { id: "00000000-0000-5000-8000-000000000001" },
      }),
    ).toMatchObject({ status: "superseded" });
    const target = once.find((row) => row.canonicalCode === "MSK")!;
    await db.oceanCarrierReference.update({
      where: { id: target.id },
      data: { nameEn: "tampered" },
    });
    await expect(seedOceanReferenceV11(db)).rejects.toThrow(
      "OCEAN_CARRIER_CONTENT_CONFLICT",
    );
    await db.oceanCarrierReference.update({
      where: { id: target.id },
      data: { nameEn: target.nameEn },
    });
  });
  it("audits, imports, replays, and rejects conflicts without changing canonical data", async () => {
    const before = await db.containerTypeReference.findMany({
      orderBy: { canonicalCode: "asc" },
    });
    expect(await importProviderProfile(db, raw)).toMatchObject({
      mode: "audit",
      profilesToCreate: 3,
      mappingsToCreate: 4,
    });
    expect(await db.externalOceanProviderProfile.count()).toBe(0);
    expect(await importProviderProfile(db, raw, true)).toMatchObject({
      profilesToCreate: 3,
      mappingsToCreate: 4,
    });
    expect(await importProviderProfile(db, raw, true)).toMatchObject({
      profilesToCreate: 0,
      mappingsToCreate: 0,
    });
    const changed = structuredClone(raw);
    changed.source.description = "Changed contents under the same version";
    await expect(importProviderProfile(db, changed, true)).rejects.toThrow(
      "PROVIDER_PROFILE_CONTENT_CONFLICT",
    );
    const reduced = structuredClone(raw);
    reduced.datasets = [reduced.datasets[0]];
    await expect(importProviderProfile(db, reduced, true)).rejects.toThrow(
      "PROVIDER_PROFILE_CONTENT_CONFLICT",
    );
    expect(
      await db.containerTypeReference.findMany({
        orderBy: { canonicalCode: "asc" },
      }),
    ).toEqual(before);
    expect(await db.shipment.count()).toBe(0);
    expect(await db.canonicalEvent.count()).toBe(0);
  });
  it("separates candidate inspection and formal resolution, pins supplier and version", async () => {
    const repo = new PrismaExternalOceanMappingRepository(db as never);
    const query = {
      provider: "freightower",
      profileVersion: raw.version,
      dataset: "carrier" as const,
      namespace: "scac",
      sourceCode: "MEDU",
    };
    await expect(repo.resolve(query)).resolves.toEqual({
      status: "pending_review",
    });
    await expect(
      repo.resolve({ ...query, profileVersion: "absent" }),
    ).resolves.toEqual({ status: "unavailable" });
    const other = structuredClone(raw);
    other.provider = "another_supplier";
    await importProviderProfile(db, other, true);
    expect(
      (await repo.inspectProfile("freightower", raw.version)).mappings,
    ).toHaveLength(4);
    await expect(
      repo.resolve({ ...query, namespace: "logix", sourceCode: "MSC" }),
    ).resolves.toMatchObject({
      status: "resolved",
      canonicalCode: "MSC",
      via: "standard",
    });
    await expect(
      repo.resolve({
        ...query,
        dataset: "port",
        namespace: "unlocode",
        sourceCode: "USSAV",
      }),
    ).resolves.toMatchObject({
      status: "resolved",
      canonicalCode: "USSAV",
      via: "standard",
    });
    await expect(
      repo.resolve({
        ...query,
        dataset: "port",
        namespace: "port_code",
        sourceCode: "CNFOC",
      }),
    ).resolves.toEqual({ status: "pending_review" });
    await expect(
      repo.resolve({
        ...query,
        dataset: "container_type",
        namespace: "logix",
        sourceCode: "40HQ",
      }),
    ).resolves.toEqual({ status: "unknown" });
    await expect(
      repo.resolve({
        ...query,
        namespace: "api_carrier_code",
        sourceCode: "MEDU",
      }),
    ).resolves.toEqual({ status: "unknown" });
  });
  it("enforces review metadata and checks confirmed mapping integrity on read", async () => {
    const repo = new PrismaExternalOceanMappingRepository(db as never);
    const profile = await db.externalOceanProviderProfile.findUniqueOrThrow({
      where: {
        provider_profileVersion_datasetCode: {
          provider: raw.provider,
          profileVersion: raw.version,
          datasetCode: "carrier",
        },
      },
    });
    const mapping = await db.externalOceanReferenceMapping.findUniqueOrThrow({
      where: {
        profileId_sourceNamespace_sourceCode: {
          profileId: profile.id,
          sourceNamespace: "scac",
          sourceCode: "MEDU",
        },
      },
    });
    await expect(
      db.externalOceanReferenceMapping.update({
        where: { id: mapping.id },
        data: { mappingState: "confirmed" },
      }),
    ).rejects.toThrow();
    // Isolated database fixture only; production approval is deliberately not part of the importer.
    await db.externalOceanReferenceMapping.update({
      where: { id: mapping.id },
      data: {
        mappingState: "confirmed",
        reviewedBy: "test-reviewer",
        reviewedAt: new Date(),
        evidenceRef: mapping.evidenceRef,
      },
    });
    const query = {
      provider: raw.provider,
      profileVersion: raw.version,
      dataset: "carrier" as const,
      namespace: "scac",
      sourceCode: "MEDU",
    };
    await expect(repo.resolve(query)).resolves.toMatchObject({
      status: "resolved",
      canonicalCode: "MSC",
      via: "mapping",
    });
    await db.externalOceanReferenceMapping.update({
      where: { id: mapping.id },
      data: { canonicalCode: "HMM" },
    });
    await expect(repo.resolve(query)).rejects.toThrow(
      "PROVIDER_MAPPING_CONTENT_CONFLICT",
    );
    await expect(importProviderProfile(db, raw, true)).rejects.toThrow(
      "PROVIDER_MAPPING_CONTENT_CONFLICT",
    );
  });
  it("rolls back all datasets when one canonical target is missing", async () => {
    const invalid = structuredClone(raw);
    invalid.provider = "invalid_supplier";
    invalid.datasets[2].mappings[0].canonicalCode = "XXXXX";
    parseProviderProfile(invalid);
    await expect(importProviderProfile(db, invalid, true)).rejects.toThrow(
      "CANONICAL_TARGET_NOT_FOUND",
    );
    expect(
      await db.externalOceanProviderProfile.count({
        where: { provider: invalid.provider },
      }),
    ).toBe(0);
  });
});
