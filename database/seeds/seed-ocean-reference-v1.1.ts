import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma";
import {
  INITIAL_LINER_DIRECTORY,
  CONTAINER_DIRECTORY_V11,
  OCEAN_REFERENCE_V11 as release,
  oceanReferenceV11Hash,
  SMDG_SOURCE_METADATA,
} from "./internal-ocean-reference-v1.1";

export async function seedOceanReferenceV11(prisma: PrismaClient) {
  const recordsHash = oceanReferenceV11Hash();
  const carriers = INITIAL_LINER_DIRECTORY.map((row) => ({
    ...row,
    id: id(`carrier:${row.canonicalCode}`),
    releaseId: release.id,
    validFrom: row.validFrom ? new Date(row.validFrom) : null,
    validUntil: row.validUntil ? new Date(row.validUntil) : null,
  }));
  const types = CONTAINER_DIRECTORY_V11.map((row) => ({
    ...row,
    id: id(`type:${row.canonicalCode}`),
    releaseId: release.id,
    sourceRowHash: hash(JSON.stringify(row)),
    standardBasis: row.standardBasis as Prisma.InputJsonValue,
  }));
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"logix-ocean-reference-publish"}))`;
      const existing = await tx.referenceDataRelease.findUnique({
        where: { id: release.id },
      });
      if (
        existing &&
        (existing.recordsSha256 !== recordsHash ||
          existing.authority !== release.authority ||
          existing.datasetCode !== release.datasetCode ||
          existing.version !== release.version)
      )
        throw new Error("INTERNAL_OCEAN_REFERENCE_RELEASE_CONFLICT");
      if (!existing)
        await tx.referenceDataRelease.create({
          data: {
            id: release.id,
            authority: release.authority,
            datasetCode: release.datasetCode,
            version: release.version,
            sourceUrl: SMDG_SOURCE_METADATA.sourceUrl,
            sourceSha256: SMDG_SOURCE_METADATA.sourceSha256,
            recordsSha256: recordsHash,
            retrievedAt: new Date("2026-10-30T00:00:00Z"),
            license: SMDG_SOURCE_METADATA.license,
            filterRule:
              "SMDG LCL 20261028 initial project directory; code validity as of 2026-10-30, not business qualification. BIC basis retained per container row. Original workbook retained.",
            status: "staged",
          },
        });
      await tx.oceanCarrierReference.createMany({
        data: carriers,
        skipDuplicates: true,
      });
      await tx.containerTypeReference.createMany({
        data: types,
        skipDuplicates: true,
      });
      const actualCarriers = await tx.oceanCarrierReference.findMany({
        where: { releaseId: release.id },
      });
      const actualTypes = await tx.containerTypeReference.findMany({
        where: { releaseId: release.id },
      });
      if (
        actualCarriers.length !== carriers.length ||
        actualTypes.length !== types.length
      )
        throw new Error("OCEAN_REFERENCE_COUNT_MISMATCH");
      for (const expected of carriers) {
        const actual = actualCarriers.find((row) => row.id === expected.id);
        if (
          !actual ||
          Object.entries(expected).some(([key, value]) =>
            value instanceof Date
              ? (
                  actual[key as keyof typeof actual] as Date | null
                )?.toISOString() !== value.toISOString()
              : actual[key as keyof typeof actual] !== value,
          )
        )
          throw new Error("OCEAN_CARRIER_CONTENT_CONFLICT");
      }
      for (const expected of types) {
        const actual = actualTypes.find((row) => row.id === expected.id);
        if (
          !actual ||
          Object.entries(expected).some(([key, value]) =>
            key === "standardBasis"
              ? hash(stable(actual.standardBasis)) !== hash(stable(value))
              : actual[key as keyof typeof actual] !== value,
          )
        )
          throw new Error("OCEAN_CONTAINER_CONTENT_CONFLICT");
      }
      // First publication only: a repeated seed must not undo a later deliberate release selection.
      if (!existing) {
        await tx.referenceDataRelease.updateMany({
          where: {
            authority: release.authority,
            datasetCode: release.datasetCode,
            status: "active",
            id: { not: release.id },
          },
          data: { status: "superseded" },
        });
        await tx.referenceDataRelease.update({
          where: { id: release.id },
          data: { status: "active" },
        });
      }
      return {
        releaseId: release.id,
        version: release.version,
        carriers: actualCarriers.length,
        selectableCarriers: actualCarriers.filter(
          (row) => row.status === "active",
        ).length,
        containerTypes: actualTypes.length,
      };
    },
    { timeout: 30_000 },
  );
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function stable(value: unknown): string {
  return JSON.stringify(sort(value));
}
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sort(v)]),
    );
  return value;
}
function id(value: string): string {
  const b = Buffer.from(
    hash(`${release.version}:${value}`).slice(0, 32),
    "hex",
  );
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
