import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "../../generated/prisma";

const CATALOG_PATH = fileURLToPath(
  new URL(
    "../../packages/contracts/catalogs/v1/cargo-owners.json",
    import.meta.url,
  ),
);
const RELEASE_ID = "530d7e1f-0253-5c64-8052-5542040cab1a";
const DATASET_CODE = "CARGO_OWNER_SALES_COUNTRY";

interface CargoOwnerCatalog {
  version: string;
  sourceSystem: string;
  sourceVersion: string;
  status: "owner_confirmed";
  evidenceRef: string;
  records: Array<{
    id: string;
    stableCode: string;
    legalName: string;
    internalCountryShortCode: string;
    salesCountryCode: string;
  }>;
}

export async function seedCargoOwnerReferenceData(
  prisma: PrismaClient,
): Promise<{ cargoOwnerCount: number }> {
  const bytes = await readFile(CATALOG_PATH);
  const catalog = JSON.parse(bytes.toString("utf8")) as CargoOwnerCatalog;
  validateCatalog(catalog);
  const sourceSha256 = sha256(
    JSON.stringify({
      sourceSystem: catalog.sourceSystem,
      sourceVersion: catalog.sourceVersion,
      status: catalog.status,
      records: catalog.records,
    }),
  );
  const recordsSha256 = sha256(JSON.stringify(catalog.records));

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.referenceDataRelease.findUnique({
      where: {
        authority_datasetCode_version: {
          authority: "AOSOM internal master data",
          datasetCode: DATASET_CODE,
          version: catalog.sourceVersion,
        },
      },
    });
    if (existing) {
      if (
        existing.id !== RELEASE_ID ||
        existing.sourceSha256 !== sourceSha256 ||
        existing.recordsSha256 !== recordsSha256
      ) {
        throw new Error(`REFERENCE_DATA_RELEASE_CONFLICT:${DATASET_CODE}`);
      }
    } else {
      await transaction.referenceDataRelease.create({
        data: {
          id: RELEASE_ID,
          authority: "AOSOM internal master data",
          datasetCode: DATASET_CODE,
          version: catalog.sourceVersion,
          sourceUrl: "repo://packages/contracts/catalogs/v1/cargo-owners.json",
          retrievedAt: new Date("2026-09-23T00:00:00Z"),
          sourceSha256,
          recordsSha256,
          license: "Internal business master data",
          filterRule: "Owner-confirmed cargo owners only",
          status: "staged",
        },
      });
    }

    const countryCodes = [
      ...new Set(catalog.records.map((record) => record.salesCountryCode)),
    ];
    const countries = await transaction.countryCodeReference.findMany({
      where: {
        alpha2: { in: countryCodes },
        release: { datasetCode: "ISO_3166_1", status: "active" },
      },
      select: { id: true, alpha2: true },
    });
    const countryIdByCode = new Map(
      countries.map((country) => [country.alpha2, country.id]),
    );
    if (countryIdByCode.size !== countryCodes.length) {
      throw new Error("CARGO_OWNER_SALES_COUNTRY_REFERENCE_MISSING");
    }

    await transaction.cargoOwnerReference.createMany({
      data: catalog.records.map((record) => ({
        id: record.id,
        releaseId: RELEASE_ID,
        stableCode: record.stableCode,
        legalName: record.legalName,
        normalizedName: normalizeCompanyName(record.legalName),
        internalCountryShortCode: record.internalCountryShortCode,
        salesCountryId: countryIdByCode.get(record.salesCountryCode)!,
        sourceSystem: catalog.sourceSystem,
        sourceVersion: catalog.sourceVersion,
        sourceRecordId: record.stableCode,
        sourceRowHash: sha256(JSON.stringify(record)),
      })),
      skipDuplicates: true,
    });
    await transaction.referenceDataRelease.updateMany({
      where: {
        authority: "AOSOM internal master data",
        datasetCode: DATASET_CODE,
        status: "active",
        id: { not: RELEASE_ID },
      },
      data: { status: "superseded" },
    });
    await transaction.referenceDataRelease.update({
      where: { id: RELEASE_ID },
      data: { status: "active" },
    });
    const cargoOwnerCount = await transaction.cargoOwnerReference.count({
      where: { releaseId: RELEASE_ID },
    });
    if (cargoOwnerCount !== catalog.records.length) {
      throw new Error("CARGO_OWNER_REFERENCE_COUNT_MISMATCH");
    }
    return { cargoOwnerCount };
  });
}

function validateCatalog(catalog: CargoOwnerCatalog): void {
  if (
    catalog.version !== "1.0.0" ||
    catalog.status !== "owner_confirmed" ||
    catalog.records.length !== 9
  ) {
    throw new Error("Invalid cargo owner catalog metadata");
  }
  const byShortCode = new Map(
    catalog.records.map((record) => [record.internalCountryShortCode, record]),
  );
  if (
    byShortCode.size !== catalog.records.length ||
    byShortCode.get("UK")?.salesCountryCode !== "GB"
  ) {
    throw new Error("Invalid cargo owner country mapping");
  }
}

function normalizeCompanyName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
