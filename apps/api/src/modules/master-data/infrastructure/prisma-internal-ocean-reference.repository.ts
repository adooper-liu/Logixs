import { Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  type InternalOceanBaseline,
  type ReferenceInternalOceanBaselinePort,
} from "../reference-internal-ocean-baseline.port";

@Injectable()
export class PrismaInternalOceanReferenceRepository implements ReferenceInternalOceanBaselinePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async readBaseline(): Promise<InternalOceanBaseline> {
    const release = await this.prisma.referenceDataRelease.findFirst({
      where: {
        authority: "Logix",
        datasetCode: "ocean_internal_baseline",
        status: "active",
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    if (!release) throw new Error("INTERNAL_OCEAN_REFERENCE_RELEASE_NOT_FOUND");
    const [carriers, containerTypes] = await Promise.all([
      this.prisma.oceanCarrierReference.findMany({
        where: { releaseId: release.id, status: "active" },
        orderBy: { canonicalCode: "asc" },
        select: {
          canonicalCode: true,
          nameZh: true,
          nameEn: true,
          standardCode: true,
          standardVersion: true,
          sourceUrl: true,
          isVocc: true,
          isNvocc: true,
          validFrom: true,
          validUntil: true,
          status: true,
        },
      }),
      this.prisma.containerTypeReference.findMany({
        where: { releaseId: release.id, status: "active" },
        orderBy: { canonicalCode: "asc" },
        select: {
          canonicalCode: true,
          length: true,
          typeCode: true,
          standardBasis: true,
          status: true,
        },
      }),
    ]);
    return { release, carriers, containerTypes };
  }
}
