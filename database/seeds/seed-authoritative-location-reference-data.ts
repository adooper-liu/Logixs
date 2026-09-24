import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "../../generated/prisma";

const ISO_FIXTURE_PATH = fileURLToPath(
  new URL("./reference-data/iso-3166-1-20260923.json", import.meta.url),
);
const UNLOCODE_FIXTURE_PATH = fileURLToPath(
  new URL("./reference-data/unlocode-2025-1-ports.json", import.meta.url),
);
const ALIAS_FIXTURE_PATH = fileURLToPath(
  new URL(
    "./fixtures/post-departure-port-alias-candidates-20260923.json",
    import.meta.url,
  ),
);
const SOURCE_FIXTURE_PATH = fileURLToPath(
  new URL(
    "../../packages/contracts/fixtures/v1/post-departure-container-operational-source.json",
    import.meta.url,
  ),
);
const SOURCE_FIXTURE_REF =
  "packages/contracts/fixtures/v1/post-departure-container-operational-source.json";
const CHUNK_SIZE = 400;

interface ReleaseFixture {
  id: string;
  authority: string;
  datasetCode: string;
  version: string;
  publishedAt?: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceSha256: string;
  recordsSha256: string;
  license: string;
  filter?: string;
}

interface IsoFixture {
  schemaVersion: string;
  release: ReleaseFixture;
  recordCount: number;
  records: Array<{
    id: string;
    alpha2: string;
    alpha3: string;
    numeric: string;
    nameEnglish: string;
    nameFrench: string;
    sourceRowHash: string;
  }>;
}

interface UnlocodeFixture {
  schemaVersion: string;
  release: ReleaseFixture;
  sourceRowCount: number;
  areaCount: number;
  portCount: number;
  entryCount: number;
  areas: Array<{
    id: string;
    areaCode: string;
    name: string;
    isoCountryId: string | null;
    sourceRowHash: string;
  }>;
  ports: Array<{
    id: string;
    unlocode: string;
    areaId: string;
    areaCode: string;
    locationCode: string;
  }>;
  entries: Array<{
    id: string;
    portId: string;
    sourceFile: string;
    sourceRowNumber: number;
    changeIndicator: string | null;
    name: string;
    nameNormalized: string;
    nameWithoutDiacritics: string | null;
    nameWithoutDiacriticsNormalized: string | null;
    subdivisionCode: string | null;
    functionCode: string;
    statusCode: string | null;
    referenceDate: string | null;
    iataCode: string | null;
    coordinates: string | null;
    remarks: string | null;
    sourceRowHash: string;
  }>;
}

interface AliasFixture {
  fixtureVersion: number;
  sourceSystem: string;
  sourceVersion: string;
  sourceFixture: string;
  aliases: Array<{
    aliasName: string;
    sourceField: string;
    candidateUnlocodes: string[];
  }>;
}

export interface AuthoritativeLocationSeedResult {
  countryCount: number;
  areaCount: number;
  portCount: number;
  portEntryCount: number;
  aliasCandidateCount: number;
}

export async function seedAuthoritativeLocationReferenceData(
  prisma: PrismaClient,
): Promise<AuthoritativeLocationSeedResult> {
  const [isoFixture, unlocodeFixture, aliasFixture, sourceFixtureBytes] =
    await Promise.all([
      readJson<IsoFixture>(ISO_FIXTURE_PATH),
      readJson<UnlocodeFixture>(UNLOCODE_FIXTURE_PATH),
      readJson<AliasFixture>(ALIAS_FIXTURE_PATH),
      readFile(SOURCE_FIXTURE_PATH),
    ]);
  validateFixtures(isoFixture, unlocodeFixture, aliasFixture);
  const sourceFixtureHash = sha256(sourceFixtureBytes);

  return prisma.$transaction(
    async (transaction) => {
      await ensureRelease(transaction, isoFixture.release);
      await transaction.countryCodeReference.createMany({
        data: isoFixture.records.map((record) => ({
          id: record.id,
          releaseId: isoFixture.release.id,
          alpha2: record.alpha2,
          alpha3: record.alpha3,
          numericCode: record.numeric,
          nameEnglish: record.nameEnglish,
          nameFrench: record.nameFrench,
          sourceRowHash: record.sourceRowHash,
        })),
        skipDuplicates: true,
      });

      await ensureRelease(transaction, unlocodeFixture.release);
      await transaction.unlocodeAreaReference.createMany({
        data: unlocodeFixture.areas.map((area) => ({
          ...area,
          releaseId: unlocodeFixture.release.id,
        })),
        skipDuplicates: true,
      });
      await createManyInChunks(
        unlocodeFixture.ports.map((port) => ({
          ...port,
          releaseId: unlocodeFixture.release.id,
        })),
        (data) =>
          transaction.portCodeReference.createMany({
            data,
            skipDuplicates: true,
          }),
      );
      await createManyInChunks(
        unlocodeFixture.entries.map((entry) => ({
          ...entry,
          releaseId: unlocodeFixture.release.id,
        })),
        (data) =>
          transaction.portCodeEntry.createMany({ data, skipDuplicates: true }),
      );

      const portIds = new Map(
        unlocodeFixture.ports.map((port) => [port.unlocode, port.id]),
      );
      const aliasCandidates = aliasFixture.aliases.flatMap((alias) =>
        alias.candidateUnlocodes.map((unlocode) => {
          const portId = portIds.get(unlocode);
          if (!portId)
            throw new Error(`Alias candidate port is missing: ${unlocode}`);
          const sourceRecordId = `${alias.sourceField}:${alias.aliasName}`;
          return {
            id: deterministicUuid(
              `port-alias:${aliasFixture.sourceSystem}:${aliasFixture.sourceVersion}:${sourceRecordId}:${unlocode}`,
            ),
            portId,
            aliasName: alias.aliasName,
            normalizedAlias: normalizeAlias(alias.aliasName),
            languageTag: "zh-Hans",
            sourceSystem: aliasFixture.sourceSystem,
            sourceVersion: aliasFixture.sourceVersion,
            sourceRecordId,
            mappingState: "candidate",
            evidenceRef: SOURCE_FIXTURE_REF,
            evidenceHash: sourceFixtureHash,
            createdBy: "system-seed",
          };
        }),
      );
      await transaction.portNameAlias.createMany({
        data: aliasCandidates,
        skipDuplicates: true,
      });

      await activateRelease(transaction, isoFixture.release);
      await activateRelease(transaction, unlocodeFixture.release);
      await assertPersistedCounts(
        transaction,
        isoFixture,
        unlocodeFixture,
        aliasCandidates.length,
      );

      return {
        countryCount: isoFixture.recordCount,
        areaCount: unlocodeFixture.areaCount,
        portCount: unlocodeFixture.portCount,
        portEntryCount: unlocodeFixture.entryCount,
        aliasCandidateCount: aliasCandidates.length,
      };
    },
    { timeout: 120_000 },
  );
}

async function ensureRelease(
  transaction: Prisma.TransactionClient,
  release: ReleaseFixture,
): Promise<void> {
  const existing = await transaction.referenceDataRelease.findUnique({
    where: {
      authority_datasetCode_version: {
        authority: release.authority,
        datasetCode: release.datasetCode,
        version: release.version,
      },
    },
  });
  if (existing) {
    if (
      existing.id !== release.id ||
      existing.sourceSha256 !== release.sourceSha256 ||
      existing.recordsSha256 !== release.recordsSha256
    ) {
      throw new Error(
        `REFERENCE_DATA_RELEASE_CONFLICT:${release.authority}:${release.datasetCode}:${release.version}`,
      );
    }
    return;
  }
  await transaction.referenceDataRelease.create({
    data: {
      id: release.id,
      authority: release.authority,
      datasetCode: release.datasetCode,
      version: release.version,
      publishedAt: release.publishedAt
        ? new Date(`${release.publishedAt}T00:00:00Z`)
        : null,
      sourceUrl: release.sourceUrl,
      retrievedAt: new Date(release.retrievedAt),
      sourceSha256: release.sourceSha256,
      recordsSha256: release.recordsSha256,
      license: release.license,
      filterRule: release.filter ?? null,
      status: "staged",
    },
  });
}

async function activateRelease(
  transaction: Prisma.TransactionClient,
  release: ReleaseFixture,
): Promise<void> {
  await transaction.referenceDataRelease.updateMany({
    where: {
      authority: release.authority,
      datasetCode: release.datasetCode,
      status: "active",
      id: { not: release.id },
    },
    data: { status: "superseded" },
  });
  await transaction.referenceDataRelease.update({
    where: { id: release.id },
    data: { status: "active" },
  });
}

async function assertPersistedCounts(
  transaction: Prisma.TransactionClient,
  isoFixture: IsoFixture,
  unlocodeFixture: UnlocodeFixture,
  aliasCandidateCount: number,
): Promise<void> {
  const [countries, areas, ports, entries, aliases] = await Promise.all([
    transaction.countryCodeReference.count({
      where: { releaseId: isoFixture.release.id },
    }),
    transaction.unlocodeAreaReference.count({
      where: { releaseId: unlocodeFixture.release.id },
    }),
    transaction.portCodeReference.count({
      where: { releaseId: unlocodeFixture.release.id },
    }),
    transaction.portCodeEntry.count({
      where: { releaseId: unlocodeFixture.release.id },
    }),
    transaction.portNameAlias.count({
      where: {
        sourceSystem: "real_post_departure_fixture",
        sourceVersion: "2026-09-23",
      },
    }),
  ]);
  const observed = [countries, areas, ports, entries, aliases];
  const expected = [
    isoFixture.recordCount,
    unlocodeFixture.areaCount,
    unlocodeFixture.portCount,
    unlocodeFixture.entryCount,
    aliasCandidateCount,
  ];
  if (observed.some((count, index) => count !== expected[index])) {
    throw new Error(
      `REFERENCE_DATA_COUNT_MISMATCH:${observed.join(",")}:${expected.join(",")}`,
    );
  }
}

function validateFixtures(
  isoFixture: IsoFixture,
  unlocodeFixture: UnlocodeFixture,
  aliasFixture: AliasFixture,
): void {
  if (
    isoFixture.schemaVersion !== "1.0.0" ||
    isoFixture.recordCount !== 249 ||
    isoFixture.records.length !== 249
  ) {
    throw new Error("Invalid ISO 3166-1 fixture counts");
  }
  if (
    unlocodeFixture.schemaVersion !== "1.0.0" ||
    unlocodeFixture.sourceRowCount !== 116_533 ||
    unlocodeFixture.areaCount !== 249 ||
    unlocodeFixture.portCount !== 17_524 ||
    unlocodeFixture.entryCount !== 17_600 ||
    unlocodeFixture.areas.length !== unlocodeFixture.areaCount ||
    unlocodeFixture.ports.length !== unlocodeFixture.portCount ||
    unlocodeFixture.entries.length !== unlocodeFixture.entryCount
  ) {
    throw new Error("Invalid UN/LOCODE fixture counts");
  }
  if (
    sha256(JSON.stringify(isoFixture.records)) !==
      isoFixture.release.recordsSha256 ||
    sha256(
      JSON.stringify({
        areas: unlocodeFixture.areas,
        ports: unlocodeFixture.ports,
        entries: unlocodeFixture.entries,
      }),
    ) !== unlocodeFixture.release.recordsSha256
  ) {
    throw new Error("Reference data fixture content hash mismatch");
  }
  if (
    aliasFixture.fixtureVersion !== 1 ||
    aliasFixture.sourceFixture !== SOURCE_FIXTURE_REF ||
    aliasFixture.aliases.length !== 9
  ) {
    throw new Error("Invalid post-departure port alias fixture");
  }
}

async function createManyInChunks<T>(
  records: T[],
  create: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < records.length; index += CHUNK_SIZE) {
    await create(records.slice(index, index + CHUNK_SIZE));
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function normalizeAlias(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
