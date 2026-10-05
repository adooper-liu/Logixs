import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import { validateAuthorizedCurrencyReferenceSnapshot } from "./generate-currency-reference-snapshot.mjs";

const DATASET_CODE = "ISO_4217_LIST_ONE";
const AUTHORITY = "SIX";
const DEFAULT_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

export interface AuthorizedCurrencySnapshot {
  schemaVersion: "1.0.0";
  fixtureKind: "authorized_official";
  release: {
    id: string;
    authority: "SIX";
    datasetCode: "ISO_4217_LIST_ONE";
    version: string;
    publishedAt: string;
    sourceUrl: string;
    retrievedAt: string;
    sourceSha256: string;
    recordsSha256: string;
    license: string;
    status: "active";
  };
  recordCount: number;
  records: Array<{
    id: string;
    alphaCode: string;
    numericCode: string;
    minorUnit: number | null;
    currencyName: string;
    sourceRowHash: string;
  }>;
}

export interface CurrencyReferenceImportResult {
  releaseId: string;
  version: string;
  recordCount: number;
  status: "active";
  duplicate: boolean;
}

export async function importAuthorizedCurrencyReference(
  prisma: PrismaClient,
  input: unknown,
): Promise<CurrencyReferenceImportResult> {
  const snapshot = validateAuthorizedCurrencyReferenceSnapshot(
    input,
  ) as AuthorizedCurrencySnapshot;

  return prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.referenceDataRelease.findUnique({
        where: {
          authority_datasetCode_version: {
            authority: snapshot.release.authority,
            datasetCode: snapshot.release.datasetCode,
            version: snapshot.release.version,
          },
        },
        include: { currencyCodes: { orderBy: { alphaCode: "asc" } } },
      });
      if (existing?.status === "superseded") {
        throw new Error("CURRENCY_REFERENCE_RELEASE_SUPERSEDED");
      }
      if (existing) {
        assertReleaseMatches(existing, snapshot);
        assertRecordsMatch(existing.currencyCodes, snapshot);
      } else {
        await transaction.referenceDataRelease.create({
          data: {
            id: snapshot.release.id,
            authority: snapshot.release.authority,
            datasetCode: snapshot.release.datasetCode,
            version: snapshot.release.version,
            publishedAt: new Date(`${snapshot.release.publishedAt}T00:00:00Z`),
            sourceUrl: snapshot.release.sourceUrl,
            retrievedAt: new Date(snapshot.release.retrievedAt),
            sourceSha256: snapshot.release.sourceSha256,
            recordsSha256: snapshot.release.recordsSha256,
            license: snapshot.release.license,
            filterRule: "authorized_official",
            status: "staged",
          },
        });
        const inserted = await transaction.currencyCodeReference.createMany({
          data: snapshot.records.map((record) => ({
            ...record,
            releaseId: snapshot.release.id,
          })),
        });
        if (inserted.count !== snapshot.recordCount) {
          throw new Error(
            `CURRENCY_REFERENCE_COUNT_MISMATCH:${inserted.count}:${snapshot.recordCount}`,
          );
        }
      }

      const storedRecords = await transaction.currencyCodeReference.findMany({
        where: { releaseId: snapshot.release.id },
        orderBy: { alphaCode: "asc" },
      });
      assertRecordsMatch(storedRecords, snapshot);

      await transaction.referenceDataRelease.updateMany({
        where: {
          authority: AUTHORITY,
          datasetCode: DATASET_CODE,
          status: "active",
          id: { not: snapshot.release.id },
        },
        data: { status: "superseded" },
      });
      await transaction.referenceDataRelease.update({
        where: { id: snapshot.release.id },
        data: { status: "active", filterRule: "authorized_official" },
      });

      return {
        releaseId: snapshot.release.id,
        version: snapshot.release.version,
        recordCount: snapshot.recordCount,
        status: "active" as const,
        duplicate: existing?.status === "active",
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function assertReleaseMatches(
  existing: {
    id: string;
    authority: string;
    datasetCode: string;
    version: string;
    publishedAt: Date | null;
    sourceUrl: string;
    retrievedAt: Date;
    sourceSha256: string;
    recordsSha256: string;
    license: string;
    filterRule: string | null;
  },
  snapshot: AuthorizedCurrencySnapshot,
): void {
  if (
    existing.id !== snapshot.release.id ||
    existing.authority !== snapshot.release.authority ||
    existing.datasetCode !== snapshot.release.datasetCode ||
    existing.version !== snapshot.release.version ||
    existing.publishedAt?.toISOString().slice(0, 10) !==
      snapshot.release.publishedAt ||
    existing.sourceUrl !== snapshot.release.sourceUrl ||
    existing.retrievedAt.toISOString() !== snapshot.release.retrievedAt ||
    existing.sourceSha256 !== snapshot.release.sourceSha256 ||
    existing.recordsSha256 !== snapshot.release.recordsSha256 ||
    existing.license !== snapshot.release.license ||
    existing.filterRule !== "authorized_official"
  ) {
    throw new Error("CURRENCY_REFERENCE_RELEASE_CONFLICT");
  }
}

function assertRecordsMatch(
  stored: Array<{
    id: string;
    alphaCode: string;
    numericCode: string;
    minorUnit: number | null;
    currencyName: string;
    sourceRowHash: string;
  }>,
  snapshot: AuthorizedCurrencySnapshot,
): void {
  const normalized = stored.map((record) => ({
    id: record.id,
    alphaCode: record.alphaCode,
    numericCode: record.numericCode,
    minorUnit: record.minorUnit,
    currencyName: record.currencyName,
    sourceRowHash: record.sourceRowHash,
  }));
  if (
    normalized.length !== snapshot.recordCount ||
    JSON.stringify(normalized) !== JSON.stringify(snapshot.records)
  ) {
    throw new Error(
      `CURRENCY_REFERENCE_RECORDS_MISMATCH:${normalized.length}:${snapshot.recordCount}`,
    );
  }
}

async function main(): Promise<void> {
  const [snapshotPath, ...extra] = process.argv.slice(2);
  if (!snapshotPath || extra.length > 0) {
    throw new Error(
      "Usage: pnpm db:import:currency-reference -- <snapshot.json>",
    );
  }
  const input = JSON.parse(await readFile(snapshotPath, "utf8")) as unknown;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    }),
  });
  try {
    const result = await importAuthorizedCurrencyReference(prisma, input);
    console.log(
      `Currency reference imported: ${result.version} (${result.recordCount} records, active${result.duplicate ? ", idempotent replay" : ""})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
