import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { validateAuthorizedCurrencyReferenceSnapshot } from "./generate-currency-reference-snapshot.mjs";
import type { AuthorizedCurrencySnapshot } from "./import-authorized-currency-reference.mjs";

const DATASET_CODE = "ISO_4217_LIST_ONE";
const AUTHORITY = "SIX";
const DEFAULT_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

export interface CurrencyReferenceVerificationResult {
  releaseId: string;
  version: string;
  recordCount: number;
}

export async function verifyCurrencyReferenceData(
  prisma: PrismaClient,
): Promise<CurrencyReferenceVerificationResult> {
  const activeReleases = await prisma.referenceDataRelease.findMany({
    where: {
      authority: AUTHORITY,
      datasetCode: DATASET_CODE,
      status: "active",
    },
    include: { currencyCodes: { orderBy: { alphaCode: "asc" } } },
  });
  if (activeReleases.length === 0) {
    throw new Error("REFERENCE_CURRENCY_RELEASE_UNAVAILABLE");
  }
  if (activeReleases.length !== 1) {
    throw new Error(
      `REFERENCE_CURRENCY_ACTIVE_RELEASE_COUNT_INVALID:${activeReleases.length}`,
    );
  }

  const release = activeReleases[0];
  if (!release.publishedAt || release.filterRule !== "authorized_official") {
    throw new Error("CURRENCY_REFERENCE_ACTIVE_RELEASE_METADATA_INVALID");
  }
  const snapshot: AuthorizedCurrencySnapshot = {
    schemaVersion: "1.0.0",
    fixtureKind: "authorized_official",
    release: {
      id: release.id,
      authority: release.authority as "SIX",
      datasetCode: release.datasetCode as "ISO_4217_LIST_ONE",
      version: release.version,
      publishedAt: release.publishedAt.toISOString().slice(0, 10),
      sourceUrl: release.sourceUrl,
      retrievedAt: release.retrievedAt.toISOString(),
      sourceSha256: release.sourceSha256,
      recordsSha256: release.recordsSha256,
      license: release.license,
      status: "active",
    },
    recordCount: release.currencyCodes.length,
    records: release.currencyCodes.map((record) => ({
      id: record.id,
      alphaCode: record.alphaCode,
      numericCode: record.numericCode,
      minorUnit: record.minorUnit,
      currencyName: record.currencyName,
      sourceRowHash: record.sourceRowHash,
    })),
  };
  validateAuthorizedCurrencyReferenceSnapshot(snapshot);

  return {
    releaseId: release.id,
    version: release.version,
    recordCount: release.currencyCodes.length,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    }),
  });
  try {
    const result = await verifyCurrencyReferenceData(prisma);
    console.log(
      `Currency reference verified: ${result.version} (${result.recordCount} records, one active authorized release)`,
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
