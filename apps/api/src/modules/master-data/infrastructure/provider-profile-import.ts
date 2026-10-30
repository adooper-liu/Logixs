import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../../../../../generated/prisma";
import {
  parseProviderProfile,
  profileContentHash,
} from "../domain/provider-profile";
import { canonicalExists } from "./canonical-reference-lookup";

export async function importProviderProfile(
  prisma: PrismaClient,
  input: unknown,
  apply = false,
) {
  const { profile, hash } = parseProviderProfile(input);
  return prisma.$transaction(
    async (tx) => {
      if (apply)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`provider-profile:${profile.provider}:${profile.version}`}))`;
      const versions = await tx.externalOceanProviderProfile.findMany({
        where: { provider: profile.provider, profileVersion: profile.version },
        select: { sourceSha256: true },
      });
      if (versions.some((item) => item.sourceSha256 !== hash))
        throw new Error("PROVIDER_PROFILE_CONTENT_CONFLICT");
      let profilesToCreate = 0;
      let mappingsToCreate = 0;
      for (const dataset of profile.datasets) {
        const release = await tx.referenceDataRelease.findUnique({
          where: { id: dataset.canonicalReleaseId },
        });
        if (
          !release ||
          !["active", "superseded"].includes(release.status) ||
          (dataset.dataset === "port"
            ? release.authority !== "UNECE" ||
              release.datasetCode !== "UNLOCODE"
            : release.authority !== "Logix" ||
              release.datasetCode !== "ocean_internal_baseline")
        )
          throw new Error("CANONICAL_RELEASE_NOT_FOUND");
        for (const mapping of dataset.mappings) {
          if (
            mapping.canonicalCode !== null &&
            !(await canonicalExists(
              tx as PrismaClient,
              dataset.dataset,
              dataset.canonicalReleaseId,
              mapping.canonicalCode,
            ))
          )
            throw new Error(
              `CANONICAL_TARGET_NOT_FOUND:${dataset.dataset}:${mapping.canonicalCode}`,
            );
        }
        const where = {
          provider_profileVersion_datasetCode: {
            provider: profile.provider,
            profileVersion: profile.version,
            datasetCode: dataset.dataset,
          },
        };
        const existing = await tx.externalOceanProviderProfile.findUnique({
          where,
        });
        if (existing) {
          if (
            existing.sourceSha256 !== hash ||
            existing.canonicalReleaseId !== dataset.canonicalReleaseId ||
            profileContentHash(existing.configuration) !== hash
          )
            throw new Error("PROVIDER_PROFILE_CONTENT_CONFLICT");
          const rows = await tx.externalOceanReferenceMapping.findMany({
            where: { profileId: existing.id },
          });
          if (
            rows.length !== dataset.mappings.length ||
            rows.some((row) => {
              const expected = dataset.mappings.find(
                (mapping) =>
                  mapping.namespace === row.sourceNamespace &&
                  mapping.sourceCode === row.sourceCode,
              );
              return (
                !expected ||
                row.provider !== profile.provider ||
                row.profileVersion !== profile.version ||
                row.datasetCode !== dataset.dataset ||
                row.canonicalCode !== expected.canonicalCode ||
                row.reason !== expected.reason ||
                row.evidenceRef !== expected.evidence ||
                row.sourceRowHash !== profileContentHash(expected)
              );
            })
          )
            throw new Error("PROVIDER_MAPPING_CONTENT_CONFLICT");
          continue;
        }
        profilesToCreate += 1;
        mappingsToCreate += dataset.mappings.length;
        if (!apply) continue;
        const created = await tx.externalOceanProviderProfile.create({
          data: {
            provider: profile.provider,
            profileVersion: profile.version,
            datasetCode: dataset.dataset,
            status: "active",
            sourceUrl: profile.source.reference,
            sourceSha256: hash,
            canonicalReleaseId: dataset.canonicalReleaseId,
            configuration: profile as unknown as Prisma.InputJsonValue,
          },
        });
        if (dataset.mappings.length)
          await tx.externalOceanReferenceMapping.createMany({
            data: dataset.mappings.map((mapping) => ({
              id: randomUUID(),
              profileId: created.id,
              provider: profile.provider,
              profileVersion: profile.version,
              datasetCode: dataset.dataset,
              sourceNamespace: mapping.namespace,
              sourceCode: mapping.sourceCode,
              canonicalCode: mapping.canonicalCode,
              mappingState: "candidate",
              reason: mapping.reason,
              evidenceRef: mapping.evidence,
              sourceRowHash: profileContentHash(mapping),
            })),
          });
      }
      return {
        mode: apply ? "apply" : "audit",
        provider: profile.provider,
        version: profile.version,
        hash,
        profilesToCreate,
        mappingsToCreate,
      };
    },
    { timeout: 30_000 },
  );
}
