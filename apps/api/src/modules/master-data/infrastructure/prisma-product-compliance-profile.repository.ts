import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  NormalizedProductCertificate,
  NormalizedReplaceProductComplianceProfileCommand,
} from "../domain/product-compliance-profile";
import {
  ProductCertificateIdentityConflictError,
  ProductComplianceProfileIdempotencyConflictError,
  ProductComplianceProfileNotFoundError,
  ProductComplianceProfileVersionConflictError,
  type ProductCertificateVersionRecord,
  type ProductComplianceProfileRecord,
  type ProductComplianceProfileRepository,
} from "../domain/product-compliance-profile.repository";

const profileInclude = {
  battery: true,
  refrigerant: true,
  dangerousGoods: true,
  inspectionRequirements: {
    orderBy: [
      { requirementType: "asc" as const },
      { jurisdictionCountryCode: "asc" as const },
    ],
  },
  certificateLinks: {
    include: {
      certificateVersion: {
        include: {
          productCertificate: true,
          countryCoverage: { orderBy: { countryCode: "asc" as const } },
        },
      },
    },
  },
} satisfies Prisma.ProductComplianceProfileInclude;

type ProfileWithRelations = Prisma.ProductComplianceProfileGetPayload<{
  include: typeof profileInclude;
}>;

@Injectable()
export class PrismaProductComplianceProfileRepository implements ProductComplianceProfileRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    productSkuId: string;
  }): Promise<ProductComplianceProfileRecord | null> {
    const profile = await this.prisma.productComplianceProfile.findFirst({
      where: {
        tenantId: input.tenantId,
        productSkuId: input.productSkuId,
        state: "active",
      },
      include: profileInclude,
    });
    return profile ? toRecord(profile) : null;
  }

  async replace(
    input: NormalizedReplaceProductComplianceProfileCommand,
  ): Promise<{ record: ProductComplianceProfileRecord; duplicate: boolean }> {
    const persisted = await this.prisma.$transaction(async (transaction) => {
      const lockedSkus = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "product_sku"
        WHERE "id" = ${input.productSkuId}::uuid
          AND "tenant_id" = ${input.tenantId}
        FOR UPDATE
      `;
      if (lockedSkus.length === 0) {
        throw new ProductComplianceProfileNotFoundError();
      }

      const existingIdempotent =
        await transaction.productComplianceProfile.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { id: true, payloadHash: true },
        });
      if (existingIdempotent) {
        if (existingIdempotent.payloadHash !== input.payloadHash) {
          throw new ProductComplianceProfileIdempotencyConflictError();
        }
        return { profileId: existingIdempotent.id, duplicate: true };
      }

      const current = await transaction.productComplianceProfile.findFirst({
        where: {
          tenantId: input.tenantId,
          productSkuId: input.productSkuId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedProfileVersion) {
        throw new ProductComplianceProfileVersionConflictError();
      }

      const certificateVersionIds = await resolveCertificateVersions(
        transaction,
        input,
      );
      const now = new Date();
      if (current) {
        await transaction.productComplianceProfile.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }

      const profileId = randomUUID();
      await transaction.productComplianceProfile.create({
        data: {
          id: profileId,
          tenantId: input.tenantId,
          productSkuId: input.productSkuId,
          version: currentVersion + 1,
          state: "active",
          supersedesProfileId: current?.id ?? null,
          ingestionChannel: input.ingestionChannel,
          sourceSystem: input.sourceSystem,
          evidenceRefs: input.evidenceRefs,
          verificationState: input.verificationState,
          actorId: input.actorId,
          reasonCode: input.reasonCode,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
        },
      });
      await transaction.productBatteryProfile.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          profileId,
          ...input.battery,
        },
      });
      await transaction.productRefrigerantProfile.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          profileId,
          ...input.refrigerant,
        },
      });
      await transaction.productDangerousGoodsProfile.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          profileId,
          ...input.dangerousGoods,
        },
      });
      if (input.inspectionRequirements.length > 0) {
        await transaction.productInspectionRequirement.createMany({
          data: input.inspectionRequirements.map((requirement) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            profileId,
            ...requirement,
          })),
        });
      }
      if (certificateVersionIds.length > 0) {
        await transaction.productComplianceProfileCertificate.createMany({
          data: certificateVersionIds.map((certificateVersionId) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            productSkuId: input.productSkuId,
            profileId,
            certificateVersionId,
          })),
        });
      }

      return { profileId, duplicate: false };
    });
    const saved = await this.prisma.productComplianceProfile.findUniqueOrThrow({
      where: { id: persisted.profileId },
      include: profileInclude,
    });
    return { record: toRecord(saved), duplicate: persisted.duplicate };
  }
}

async function resolveCertificateVersions(
  transaction: Prisma.TransactionClient,
  input: NormalizedReplaceProductComplianceProfileCommand,
): Promise<string[]> {
  const versionIds: string[] = [];
  for (const certificate of input.certificates) {
    let identity = await transaction.productCertificate.findUnique({
      where: {
        tenantId_productSkuId_certificateKey: {
          tenantId: input.tenantId,
          productSkuId: input.productSkuId,
          certificateKey: certificate.certificateKey,
        },
      },
      select: { id: true, certificateType: true },
    });
    if (identity && identity.certificateType !== certificate.certificateType) {
      throw new ProductCertificateIdentityConflictError();
    }
    identity ??= await transaction.productCertificate.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        productSkuId: input.productSkuId,
        certificateKey: certificate.certificateKey,
        certificateType: certificate.certificateType,
      },
      select: { id: true, certificateType: true },
    });

    const latest = await transaction.productCertificateVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        productCertificateId: identity.id,
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true, payloadHash: true },
    });
    if (latest?.payloadHash === certificate.payloadHash) {
      versionIds.push(latest.id);
      continue;
    }

    const certificateVersionId = randomUUID();
    await transaction.productCertificateVersion.create({
      data: certificateVersionData({
        certificateVersionId,
        productCertificateId: identity.id,
        productSkuId: input.productSkuId,
        tenantId: input.tenantId,
        certificate,
        version: (latest?.version ?? 0) + 1,
        supersedesVersionId: latest?.id ?? null,
      }),
    });
    if (certificate.coveredCountryCodes.length > 0) {
      await transaction.productCertificateCountryCoverage.createMany({
        data: certificate.coveredCountryCodes.map((countryCode) => ({
          id: randomUUID(),
          tenantId: input.tenantId,
          certificateVersionId,
          countryCode,
        })),
      });
    }
    versionIds.push(certificateVersionId);
  }
  return versionIds;
}

function certificateVersionData(input: {
  certificateVersionId: string;
  productCertificateId: string;
  productSkuId: string;
  tenantId: string;
  certificate: NormalizedProductCertificate;
  version: number;
  supersedesVersionId: string | null;
}): Prisma.ProductCertificateVersionUncheckedCreateInput {
  const certificate = input.certificate;
  return {
    id: input.certificateVersionId,
    tenantId: input.tenantId,
    productCertificateId: input.productCertificateId,
    productSkuId: input.productSkuId,
    version: input.version,
    supersedesVersionId: input.supersedesVersionId,
    certificateNumber: certificate.certificateNumber,
    issuerName: certificate.issuerName,
    coverageScope: certificate.coverageScope,
    validFrom: new Date(`${certificate.validFrom}T00:00:00.000Z`),
    validUntil: certificate.validUntil
      ? new Date(`${certificate.validUntil}T00:00:00.000Z`)
      : null,
    documentRecordId: certificate.documentRecordId,
    verificationState: certificate.verificationState,
    payloadHash: certificate.payloadHash,
  };
}

function toRecord(
  profile: ProfileWithRelations,
): ProductComplianceProfileRecord {
  if (!profile.battery || !profile.refrigerant || !profile.dangerousGoods) {
    throw new Error("PRODUCT_COMPLIANCE_PROFILE_INCOMPLETE");
  }
  return {
    profileId: profile.id,
    tenantId: profile.tenantId,
    productSkuId: profile.productSkuId,
    version: profile.version,
    battery: {
      presenceState: profile.battery.presenceState as
        "present" | "absent" | "unknown",
      chemistryCode: profile.battery.chemistryCode,
      modelNumber: profile.battery.modelNumber,
      cellCount: profile.battery.cellCount,
      batteryCount: profile.battery.batteryCount,
      wattHours: decimalString(profile.battery.wattHours),
      lithiumContentGrams: decimalString(profile.battery.lithiumContentGrams),
      removable: profile.battery.removable,
      packingMode: profile.battery.packingMode as
        | "battery_only"
        | "packed_with_equipment"
        | "contained_in_equipment"
        | null,
    },
    refrigerant: {
      presenceState: profile.refrigerant.presenceState as
        "present" | "absent" | "unknown",
      refrigerantCode: profile.refrigerant.refrigerantCode,
      chargeQuantity: decimalString(profile.refrigerant.chargeQuantity),
      chargeUnit: profile.refrigerant.chargeUnit,
      globalWarmingPotential: decimalString(
        profile.refrigerant.globalWarmingPotential,
      ),
      hermeticallySealed: profile.refrigerant.hermeticallySealed,
    },
    dangerousGoods: {
      classificationState: profile.dangerousGoods.classificationState as
        "regulated" | "not_regulated" | "undetermined",
      unNumber: profile.dangerousGoods.unNumber,
      properShippingName: profile.dangerousGoods.properShippingName,
      hazardClass: profile.dangerousGoods.hazardClass,
      division: profile.dangerousGoods.division,
      packingGroup: profile.dangerousGoods.packingGroup as
        "I" | "II" | "III" | null,
      marinePollutant: profile.dangerousGoods.marinePollutant,
      flashPointCelsius: decimalString(
        profile.dangerousGoods.flashPointCelsius,
      ),
    },
    inspectionRequirements: profile.inspectionRequirements.map(
      (requirement) => ({
        requirementType: requirement.requirementType as
          | "commodity_inspection"
          | "phytosanitary"
          | "fumigation"
          | "sanitary"
          | "veterinary"
          | "food_safety",
        requirementState: requirement.requirementState as
          "required" | "not_required" | "unknown",
        jurisdictionCountryCode: requirement.jurisdictionCountryCode,
        notes: requirement.notes,
      }),
    ),
    certificates: profile.certificateLinks
      .map((link) => certificateRecord(link.certificateVersion))
      .sort((left, right) =>
        left.certificateKey.localeCompare(right.certificateKey),
      ),
    ingestionChannel: profile.ingestionChannel as
      "api" | "webhook" | "file_import" | "manual_ui",
    sourceSystem: profile.sourceSystem,
    evidenceRefs: jsonStringArray(profile.evidenceRefs),
    verificationState:
      profile.verificationState as ProductComplianceProfileRecord["verificationState"],
    actorId: profile.actorId,
    reasonCode: profile.reasonCode,
    createdAt: profile.createdAt.toISOString(),
  };
}

function certificateRecord(
  input: ProfileWithRelations["certificateLinks"][number]["certificateVersion"],
): ProductCertificateVersionRecord {
  return {
    productCertificateId: input.productCertificateId,
    certificateVersionId: input.id,
    version: input.version,
    certificateKey: input.productCertificate.certificateKey,
    certificateType: input.productCertificate
      .certificateType as ProductCertificateVersionRecord["certificateType"],
    certificateNumber: input.certificateNumber,
    issuerName: input.issuerName,
    coverageScope: input.coverageScope as "global" | "countries",
    coveredCountryCodes: input.countryCoverage.map(
      (coverage) => coverage.countryCode,
    ),
    validFrom: input.validFrom.toISOString().slice(0, 10),
    validUntil: input.validUntil?.toISOString().slice(0, 10) ?? null,
    documentRecordId: input.documentRecordId,
    verificationState:
      input.verificationState as ProductCertificateVersionRecord["verificationState"],
  };
}

function decimalString(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null;
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("PRODUCT_COMPLIANCE_PROFILE_INVALID_EVIDENCE");
  }
  return value as string[];
}
