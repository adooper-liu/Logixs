import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { SourcingConflictError } from "../domain/supplier-nomination";
import type {
  NominationRecord,
  QuotationRecord,
  SourcingQueueEntryRecord,
  SupplierNominationRepository,
  SupplierRecord,
} from "../domain/supplier-nomination.repository";

type SupplierRow = Prisma.SupplierGetPayload<Record<string, never>>;
type QuotationRow = Prisma.SupplierQuotationGetPayload<Record<string, never>>;
type NominationRow = Prisma.SupplierNominationReleaseGetPayload<
  Record<string, never>
>;

export class SourcingNotFoundError extends Error {}

/**
 * 供应商准入、报价与定点的仓储。
 *
 * **候选供应商是"报出来的"**：没有一张"候选名单"表 —— 供应商只要对这份发布报过价，
 * 就是这票的候选。少一张表，就少一处会与报价对不上的状态。
 */
@Injectable()
export class PrismaSupplierNominationRepository implements SupplierNominationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listQueue(
    input: Parameters<SupplierNominationRepository["listQueue"]>[0],
  ): Promise<SourcingQueueEntryRecord[]> {
    const releases = await this.prisma.productIdentityRelease.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { releasedAt: { lt: input.after.releasedAt } },
                {
                  AND: [
                    { releasedAt: input.after.releasedAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
    if (releases.length === 0) return [];
    const releaseIds = releases.map((release) => release.id);

    const [quotations, nominations] = await Promise.all([
      this.prisma.supplierQuotation.findMany({
        where: { tenantId: input.tenantId, skuReleaseId: { in: releaseIds } },
        include: { supplier: true },
        orderBy: [{ quotedAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.supplierNominationRelease.findMany({
        where: { tenantId: input.tenantId, skuReleaseId: { in: releaseIds } },
        orderBy: [{ version: "desc" }],
      }),
    ]);

    return releases.flatMap((release) =>
      skusOf(release.skus).map(({ skuId, skuCode }) => {
        const mine = quotations.filter(
          (row) => row.skuReleaseId === release.id && row.skuId === skuId,
        );
        // 同一供应商只留最新一版（表上已是"一条当前版"，这里只是再稳一道）。
        const bySupplier = new Map<string, (typeof mine)[number]>();
        for (const row of mine) bySupplier.set(row.supplierId, row);
        const latest = [...bySupplier.values()];
        const nominated = nominations.find(
          (row) => row.skuReleaseId === release.id && row.skuId === skuId,
        );
        return {
          skuReleaseId: release.id,
          skuId,
          skuCode,
          productNumber: release.productNumber,
          suppliers: dedupeSuppliers(latest).map(toSupplierRecord),
          quotations: latest.map(toQuotationRecord),
          nominated: nominated ? toNominationRecord(nominated) : null,
        };
      }),
    );
  }

  async listSuppliers(
    tenantId: string,
    take: number,
  ): Promise<SupplierRecord[]> {
    const rows = await this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: [{ name: "asc" }],
      take,
    });
    return rows.map(toSupplierRecord);
  }

  async findSupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierRecord | null> {
    const row = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    return row ? toSupplierRecord(row) : null;
  }

  async findSupplierByName(
    tenantId: string,
    name: string,
  ): Promise<SupplierRecord | null> {
    const row = await this.prisma.supplier.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    return row ? toSupplierRecord(row) : null;
  }

  async findQuotation(
    tenantId: string,
    supplierId: string,
    skuReleaseId: string,
  ): Promise<QuotationRecord | null> {
    const row = await this.prisma.supplierQuotation.findUnique({
      where: {
        tenantId_supplierId_skuReleaseId: {
          tenantId,
          supplierId,
          skuReleaseId,
        },
      },
    });
    return row ? toQuotationRecord(row) : null;
  }

  async findQuotationById(
    tenantId: string,
    quotationId: string,
  ): Promise<QuotationRecord | null> {
    const row = await this.prisma.supplierQuotation.findFirst({
      where: { id: quotationId, tenantId },
    });
    return row ? toQuotationRecord(row) : null;
  }

  async findNomination(
    tenantId: string,
    skuReleaseId: string,
    skuId: string,
  ): Promise<NominationRecord | null> {
    const row = await this.prisma.supplierNominationRelease.findFirst({
      where: { tenantId, skuReleaseId, skuId },
      orderBy: { version: "desc" },
    });
    return row ? toNominationRecord(row) : null;
  }

  async findSupplierByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    const row = await this.prisma.supplier.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? toSupplierRecord(row) : null;
  }

  async findQuotationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const row = await this.prisma.supplierQuotation.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? toQuotationRecord(row) : null;
  }

  async findNominationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const row = await this.prisma.supplierNominationRelease.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? toNominationRecord(row) : null;
  }

  registerSupplier(
    input: Parameters<SupplierNominationRepository["registerSupplier"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.supplier.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("SOURCING_IDEMPOTENCY_CONFLICT");
        }
        return { record: toSupplierRecord(replay), duplicate: true };
      }
      try {
        const row = await tx.supplier.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            name: command.name,
            countryCode: command.countryCode,
            contactName: command.contactName,
            contactEmail: command.contactEmail,
            admissionState: command.admissionState,
            version: command.version,
            actedBy: input.actorId,
            idempotencyKey: command.idempotencyKey,
            payloadHash: command.payloadHash,
          },
        });
        return { record: toSupplierRecord(row), duplicate: false };
      } catch (error) {
        // 名称租户内唯一：重名是业务冲突，翻成明确的话。
        if (isUniqueViolation(error)) {
          throw new SourcingConflictError("SUPPLIER_NAME_TAKEN");
        }
        throw error;
      }
    });
  }

  persistQuotation(
    input: Parameters<SupplierNominationRepository["persistQuotation"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `supplier-quotation:${input.tenantId}:${input.supplierId}:${input.skuReleaseId}`,
      );
      const replay = await tx.supplierQuotation.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("SOURCING_IDEMPOTENCY_CONFLICT");
        }
        return { record: toQuotationRecord(replay), duplicate: true };
      }

      const existing = await tx.supplierQuotation.findUnique({
        where: {
          tenantId_supplierId_skuReleaseId: {
            tenantId: input.tenantId,
            supplierId: input.supplierId,
            skuReleaseId: input.skuReleaseId,
          },
        },
      });
      if ((existing?.version ?? 0) !== command.expectedQuotationVersion) {
        conflict("SOURCING_VERSION_CONFLICT");
      }

      const quotedAt = new Date();
      const data = {
        version: command.version,
        priceTiers: command.priceTiers as unknown as Prisma.InputJsonValue,
        incoterms: command.incoterms,
        minimumOrderQuantity: jsonOrNull(command.minimumOrderQuantity),
        toolingCost: jsonOrNull(command.toolingCost),
        sampleCost: jsonOrNull(command.sampleCost),
        sampleRefundable: command.sampleRefundable,
        leadTimeDays: command.leadTimeDays,
        packagingSpec: command.packagingSpec,
        paymentTerms: command.paymentTerms,
        qualityTerms: command.qualityTerms,
        validUntil: command.validUntil,
        keyMaterials: command.keyMaterials as unknown as Prisma.InputJsonValue,
        exclusions: command.exclusions,
        quotedBy: input.actorId,
        quotedAt,
        actedBy: input.actorId,
        idempotencyKey: command.idempotencyKey,
        payloadHash: command.payloadHash,
        updatedAt: quotedAt,
      };
      const row = existing
        ? await tx.supplierQuotation.update({
            where: { id: existing.id },
            data,
          })
        : await tx.supplierQuotation.create({
            data: {
              id: randomUUID(),
              tenantId: input.tenantId,
              supplierId: input.supplierId,
              skuReleaseId: input.skuReleaseId,
              skuId: input.skuId,
              ...data,
            },
          });
      return { record: toQuotationRecord(row), duplicate: false };
    });
  }

  recordNomination(
    input: Parameters<SupplierNominationRepository["recordNomination"]>[0],
  ) {
    const { command, supplier, quotation } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `supplier-nomination:${input.tenantId}:${quotation.skuReleaseId}:${quotation.skuId}`,
      );
      const replay = await tx.supplierNominationRelease.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("SOURCING_IDEMPOTENCY_CONFLICT");
        }
        return { record: toNominationRecord(replay), duplicate: true };
      }
      if (quotation.version !== command.expectedQuotationVersion) {
        conflict("SOURCING_VERSION_CONFLICT");
      }

      const nominatedAt = new Date();
      const snapshotVersion =
        (await tx.supplierNominationRelease.count({
          where: {
            tenantId: input.tenantId,
            skuReleaseId: quotation.skuReleaseId,
          },
        })) + 1;
      const row = await tx.supplierNominationRelease.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          skuReleaseId: quotation.skuReleaseId,
          skuId: quotation.skuId,
          supplierId: supplier.supplierId,
          // 名称与国别**随快照冻结**：主数据后来改名，不影响当时定的是什么。
          supplierName: supplier.name,
          supplierCountryCode: supplier.countryCode,
          quotationId: quotation.quotationId,
          quotationVersion: quotation.version,
          incoterms: quotation.incoterms,
          priceTiers: quotation.priceTiers as unknown as Prisma.InputJsonValue,
          leadTimeDays: quotation.leadTimeDays,
          minimumOrderQuantity: jsonOrNull(quotation.minimumOrderQuantity),
          sampleConclusion: command.sampleConclusion,
          capacityConstraint: command.capacityConstraint,
          version: snapshotVersion,
          nominatedBy: input.actorId,
          nominatedAt,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
      });
      return { record: toNominationRecord(row), duplicate: false };
    });
  }
}

function skusOf(value: Prisma.JsonValue): { skuId: string; skuCode: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sku) => {
    const row = sku as { skuId?: unknown; skuCode?: unknown };
    return typeof row.skuId === "string" && typeof row.skuCode === "string"
      ? [{ skuId: row.skuId, skuCode: row.skuCode }]
      : [];
  });
}

function dedupeSuppliers(rows: { supplier: SupplierRow }[]): SupplierRow[] {
  const byId = new Map<string, SupplierRow>();
  for (const row of rows) byId.set(row.supplier.id, row.supplier);
  return [...byId.values()];
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | undefined {
  return value === null || value === undefined
    ? undefined
    : (value as Prisma.InputJsonValue);
}

function toSupplierRecord(row: SupplierRow): SupplierRecord {
  return {
    supplierId: row.id,
    name: row.name,
    countryCode: row.countryCode,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    admissionState: row.admissionState as SupplierRecord["admissionState"],
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toQuotationRecord(row: QuotationRow): QuotationRecord {
  return {
    quotationId: row.id,
    supplierId: row.supplierId,
    skuReleaseId: row.skuReleaseId,
    skuId: row.skuId,
    version: row.version,
    priceTiers: row.priceTiers as unknown as QuotationRecord["priceTiers"],
    incoterms: row.incoterms,
    minimumOrderQuantity:
      row.minimumOrderQuantity as unknown as QuotationRecord["minimumOrderQuantity"],
    toolingCost: row.toolingCost as unknown as QuotationRecord["toolingCost"],
    sampleCost: row.sampleCost as unknown as QuotationRecord["sampleCost"],
    sampleRefundable: row.sampleRefundable,
    leadTimeDays: row.leadTimeDays,
    packagingSpec: row.packagingSpec,
    paymentTerms: row.paymentTerms,
    qualityTerms: row.qualityTerms,
    validUntil: row.validUntil,
    keyMaterials:
      row.keyMaterials as unknown as QuotationRecord["keyMaterials"],
    exclusions: row.exclusions,
    quotedBy: row.quotedBy,
    quotedAt: row.quotedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toNominationRecord(row: NominationRow): NominationRecord {
  return {
    handoffId: row.id,
    version: row.version,
    skuReleaseId: row.skuReleaseId,
    skuId: row.skuId,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierCountryCode: row.supplierCountryCode,
    quotationId: row.quotationId,
    quotationVersion: row.quotationVersion,
    incoterms: row.incoterms,
    priceTiers: row.priceTiers as unknown as NominationRecord["priceTiers"],
    leadTimeDays: row.leadTimeDays,
    minimumOrderQuantity:
      row.minimumOrderQuantity as unknown as NominationRecord["minimumOrderQuantity"],
    sampleConclusion: row.sampleConclusion,
    capacityConstraint: row.capacityConstraint,
    nominatedBy: row.nominatedBy,
    nominatedAt: row.nominatedAt,
    idempotencyKey: row.idempotencyKey,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function advisoryLock(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new SourcingConflictError(code);
}
