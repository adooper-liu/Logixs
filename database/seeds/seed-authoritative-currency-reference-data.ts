import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../../generated/prisma";

const FIXTURE_PATH = fileURLToPath(
  new URL(
    "./reference-data/iso-4217-list-one-synthetic-rehearsal.json",
    import.meta.url,
  ),
);

interface CurrencyFixture {
  schemaVersion: "1.0.0";
  fixtureKind: "synthetic_rehearsal";
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
    status: "staged";
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

export interface CurrencyReferenceSeedResult {
  currencyCount: number;
  releaseStatus: "staged";
  fixtureKind: "synthetic_rehearsal";
}

export async function seedAuthoritativeCurrencyReferenceData(
  prisma: PrismaClient,
): Promise<CurrencyReferenceSeedResult> {
  const fixture = JSON.parse(
    await readFile(FIXTURE_PATH, "utf8"),
  ) as CurrencyFixture;
  validateFixture(fixture);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.referenceDataRelease.findUnique({
      where: {
        authority_datasetCode_version: {
          authority: fixture.release.authority,
          datasetCode: fixture.release.datasetCode,
          version: fixture.release.version,
        },
      },
    });
    if (existing && existing.status !== "staged") {
      throw new Error("SYNTHETIC_CURRENCY_RELEASE_MUST_REMAIN_STAGED");
    }
    if (existing && existing.recordsSha256 !== fixture.release.recordsSha256) {
      throw new Error("CURRENCY_REFERENCE_RELEASE_CONFLICT");
    }
    if (!existing) {
      await transaction.referenceDataRelease.create({
        data: {
          id: fixture.release.id,
          authority: fixture.release.authority,
          datasetCode: fixture.release.datasetCode,
          version: fixture.release.version,
          publishedAt: new Date(`${fixture.release.publishedAt}T00:00:00Z`),
          sourceUrl: fixture.release.sourceUrl,
          retrievedAt: new Date(fixture.release.retrievedAt),
          sourceSha256: fixture.release.sourceSha256,
          recordsSha256: fixture.release.recordsSha256,
          license: fixture.release.license,
          filterRule: "synthetic_rehearsal; mechanism validation only",
          status: "staged",
        },
      });
    }
    await transaction.currencyCodeReference.createMany({
      data: fixture.records.map((record) => ({
        ...record,
        releaseId: fixture.release.id,
      })),
      skipDuplicates: true,
    });
    const count = await transaction.currencyCodeReference.count({
      where: { releaseId: fixture.release.id },
    });
    if (count !== fixture.recordCount) {
      throw new Error(
        `CURRENCY_REFERENCE_COUNT_MISMATCH:${count}:${fixture.recordCount}`,
      );
    }
    return {
      currencyCount: count,
      releaseStatus: "staged" as const,
      fixtureKind: fixture.fixtureKind,
    };
  });
}

function validateFixture(fixture: CurrencyFixture): void {
  if (
    fixture.schemaVersion !== "1.0.0" ||
    fixture.fixtureKind !== "synthetic_rehearsal" ||
    fixture.release.status !== "staged" ||
    fixture.release.datasetCode !== "ISO_4217_LIST_ONE" ||
    fixture.recordCount !== fixture.records.length ||
    fixture.records.length < 4 ||
    sha256(JSON.stringify(fixture.records)) !== fixture.release.recordsSha256
  ) {
    throw new Error("INVALID_SYNTHETIC_CURRENCY_REFERENCE_FIXTURE");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
