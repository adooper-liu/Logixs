import { Inject, Injectable } from "@nestjs/common";
import { canonicalExists } from "./canonical-reference-lookup";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  parseProviderProfile,
  profileContentHash,
} from "../domain/provider-profile";
import type {
  ExternalOceanMappingDirectoryPort,
  MappingQuery,
  MappingResolution,
} from "../reference-external-ocean-mapping.port";

@Injectable()
export class PrismaExternalOceanMappingRepository implements ExternalOceanMappingDirectoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async inspectProfile(provider: string, profileVersion: string) {
    const profiles = await this.prisma.externalOceanProviderProfile.findMany({
      where: { provider, profileVersion },
      orderBy: { datasetCode: "asc" },
      select: {
        id: true,
        provider: true,
        profileVersion: true,
        datasetCode: true,
        status: true,
        canonicalReleaseId: true,
        configuration: true,
      },
    });
    const mappings = await this.prisma.externalOceanReferenceMapping.findMany({
      where: { profileId: { in: profiles.map((item) => item.id) } },
      orderBy: [
        { datasetCode: "asc" },
        { sourceNamespace: "asc" },
        { sourceCode: "asc" },
      ],
      select: {
        provider: true,
        profileVersion: true,
        datasetCode: true,
        sourceNamespace: true,
        sourceCode: true,
        canonicalCode: true,
        mappingState: true,
        evidenceRef: true,
        reason: true,
      },
    });
    return { profiles, mappings };
  }

  async resolve(query: MappingQuery): Promise<MappingResolution> {
    const row = await this.prisma.externalOceanProviderProfile.findUnique({
      where: {
        provider_profileVersion_datasetCode: {
          provider: query.provider,
          profileVersion: query.profileVersion,
          datasetCode: query.dataset,
        },
      },
    });
    if (
      !row ||
      row.status !== "active" ||
      !row.configuration ||
      !row.canonicalReleaseId
    )
      return { status: "unavailable" };
    const config = parseProviderProfile(row.configuration);
    if (
      config.hash !== row.sourceSha256 ||
      config.profile.provider !== row.provider ||
      config.profile.version !== row.profileVersion
    )
      throw new Error("PROVIDER_PROFILE_CONTENT_CONFLICT");
    const dataset = config.profile.datasets.find(
      (item) => item.dataset === query.dataset,
    );
    if (!dataset || dataset.canonicalReleaseId !== row.canonicalReleaseId)
      throw new Error("PROVIDER_PROFILE_RELEASE_CONFLICT");
    if (!dataset.namespaces.includes(query.namespace))
      return { status: "unsupported_namespace" };
    const standardNamespace =
      (query.namespace === "logix" && query.dataset !== "port") ||
      (query.namespace === "unlocode" && query.dataset === "port");
    if (standardNamespace) {
      return (await canonicalExists(
        this.prisma,
        query.dataset,
        row.canonicalReleaseId,
        query.sourceCode,
      ))
        ? {
            status: "resolved",
            canonicalCode: query.sourceCode,
            canonicalReleaseId: row.canonicalReleaseId,
            via: "standard",
          }
        : { status: "unknown" };
    }
    const mapping = await this.prisma.externalOceanReferenceMapping.findUnique({
      where: {
        profileId_sourceNamespace_sourceCode: {
          profileId: row.id,
          sourceNamespace: query.namespace,
          sourceCode: query.sourceCode,
        },
      },
    });
    if (!mapping) return { status: "unknown" };
    if (mapping.mappingState === "candidate")
      return { status: "pending_review" };
    if (mapping.mappingState !== "confirmed") return { status: "rejected" };
    if (!mapping.reviewedBy || !mapping.reviewedAt || !mapping.evidenceRef)
      return { status: "pending_review" };
    const inputMapping = dataset.mappings.find(
      (item) =>
        item.namespace === query.namespace &&
        item.sourceCode === query.sourceCode,
    );
    if (
      !inputMapping ||
      !mapping.canonicalCode ||
      mapping.canonicalCode !== inputMapping.canonicalCode ||
      mapping.sourceRowHash !== profileContentHash(inputMapping)
    )
      throw new Error("PROVIDER_MAPPING_CONTENT_CONFLICT");
    if (
      !(await canonicalExists(
        this.prisma,
        query.dataset,
        row.canonicalReleaseId,
        mapping.canonicalCode,
      ))
    )
      return { status: "unknown" };
    return {
      status: "resolved",
      canonicalCode: mapping.canonicalCode,
      canonicalReleaseId: row.canonicalReleaseId,
      via: "mapping",
    };
  }
}
