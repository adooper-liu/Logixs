import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma";
import {
  INTERNAL_CONTAINER_TYPE_REFERENCES,
  INTERNAL_OCEAN_CARRIER_REFERENCES,
  validateInternalOceanReferenceFixture,
} from "./internal-ocean-reference-data";

const RELEASE_ID = "00000000-0000-5000-8000-000000000001";
const AUTHORITY = "Logix";
const DATASET_CODE = "ocean_internal_baseline";
const VERSION = "1.0.0";

export interface InternalOceanReferenceSeedResult {
  releaseId: string;
  carrierCount: number;
  containerTypeCount: number;
}

export async function seedInternalOceanReferenceData(
  prisma: PrismaClient,
): Promise<InternalOceanReferenceSeedResult> {
  validateInternalOceanReferenceFixture({
    carriers: INTERNAL_OCEAN_CARRIER_REFERENCES,
    containerTypes: INTERNAL_CONTAINER_TYPE_REFERENCES,
  });
  return prisma.$transaction(
    async (transaction) => {
      const release = await ensureRelease(transaction);
      const carrierRows = INTERNAL_OCEAN_CARRIER_REFERENCES.map((row) => ({
        id: deterministicUuid(
          `internal-ocean-carrier:${VERSION}:${row.canonicalCode}`,
        ),
        releaseId: release.id,
        ...row,
        sourceRowHash: rowHash(row),
      }));
      const containerRows = INTERNAL_CONTAINER_TYPE_REFERENCES.map((row) => ({
        id: deterministicUuid(
          `internal-ocean-container-type:${VERSION}:${row.canonicalCode}`,
        ),
        releaseId: release.id,
        ...row,
        sourceRowHash: rowHash(row),
      }));
      await transaction.oceanCarrierReference.createMany({
        data: carrierRows,
        skipDuplicates: true,
      });
      await transaction.containerTypeReference.createMany({
        data: containerRows,
        skipDuplicates: true,
      });
      const [carrierCount, containerTypeCount] = await Promise.all([
        transaction.oceanCarrierReference.count({
          where: { releaseId: release.id },
        }),
        transaction.containerTypeReference.count({
          where: { releaseId: release.id },
        }),
      ]);
      if (
        carrierCount !== carrierRows.length ||
        containerTypeCount !== containerRows.length
      )
        throw new Error(
          `INTERNAL_OCEAN_REFERENCE_COUNT_MISMATCH:${carrierCount}:${containerTypeCount}`,
        );
      return { releaseId: release.id, carrierCount, containerTypeCount };
    },
    { timeout: 30_000 },
  );
}

async function ensureRelease(transaction: Prisma.TransactionClient) {
  const existing = await transaction.referenceDataRelease.findUnique({
    where: {
      authority_datasetCode_version: {
        authority: AUTHORITY,
        datasetCode: DATASET_CODE,
        version: VERSION,
      },
    },
  });
  if (existing) {
    if (existing.id !== RELEASE_ID)
      throw new Error("INTERNAL_OCEAN_REFERENCE_RELEASE_CONFLICT");
    return existing;
  }
  return transaction.referenceDataRelease.create({
    data: {
      id: RELEASE_ID,
      authority: AUTHORITY,
      datasetCode: DATASET_CODE,
      version: VERSION,
      sourceUrl: "internal://logix/ocean-reference-baseline",
      retrievedAt: new Date("2026-10-30T00:00:00Z"),
      sourceSha256: sha256("logix-ocean-reference-baseline-v1"),
      recordsSha256: sha256(
        JSON.stringify({
          carriers: INTERNAL_OCEAN_CARRIER_REFERENCES,
          containerTypes: INTERNAL_CONTAINER_TYPE_REFERENCES,
        }),
      ),
      license: "internal-project-standard",
      filterRule:
        "Project-owned canonical baseline; external values require mapping.",
      status: "active",
    },
  });
}

function rowHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function deterministicUuid(value: string): string {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
