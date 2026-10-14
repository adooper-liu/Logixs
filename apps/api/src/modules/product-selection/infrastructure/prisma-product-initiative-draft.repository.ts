import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ProductInitiativeDraftConflictError,
  type PreparedProductInitiativeDecisionDraft,
} from "../domain/product-initiative-draft";
import type {
  ProductInitiativeDecisionDraftRecord,
  ProductInitiativeDraftRepository,
} from "../domain/product-initiative-draft.repository";

type DraftRow = Prisma.ProductInitiativeDecisionDraftGetPayload<
  Record<string, never>
>;

@Injectable()
export class PrismaProductInitiativeDraftRepository implements ProductInitiativeDraftRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByHandoffId(tenantId: string, handoffId: string) {
    const row = await this.prisma.productInitiativeDecisionDraft.findUnique({
      where: { tenantId_handoffId: { tenantId, handoffId } },
    });
    return row ? toRecord(row) : null;
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    const row = await this.prisma.productInitiativeDecisionDraft.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? { record: toRecord(row), payloadHash: row.payloadHash } : null;
  }

  async closeByHandoffId(tenantId: string, handoffId: string): Promise<void> {
    await this.prisma.productInitiativeDecisionDraft.deleteMany({
      where: { tenantId, handoffId },
    });
  }

  persist(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    initiativeId: string | null;
    command: PreparedProductInitiativeDecisionDraft;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const key = `product-initiative-draft:${input.tenantId}:${input.handoffId}`;
      await tx.$queryRaw`
        SELECT 1 AS "lockAcquired"
        FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
      `;
      const replay = await tx.productInitiativeDecisionDraft.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== input.command.payloadHash) {
          conflict("PRODUCT_INITIATIVE_DRAFT_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }
      const existing = await tx.productInitiativeDecisionDraft.findUnique({
        where: {
          tenantId_handoffId: {
            tenantId: input.tenantId,
            handoffId: input.handoffId,
          },
        },
      });
      if ((existing?.draftVersion ?? 0) !== input.command.draftVersion - 1) {
        conflict("PRODUCT_INITIATIVE_DRAFT_VERSION_CONFLICT");
      }
      const now = new Date();
      const data = {
        initiativeId: input.initiativeId,
        draftVersion: input.command.draftVersion,
        initiativeVersionSeen: input.command.initiativeVersionSeen,
        objective: input.command.objective,
        reviewPoints: input.command
          .reviewPoints as unknown as Prisma.InputJsonValue,
        businessCaseDraft: input.command
          .businessCaseDraft as unknown as Prisma.InputJsonValue,
        riskAssessmentDraft: input.command
          .riskAssessmentDraft as unknown as Prisma.InputJsonValue,
        unitEconomicsDraft: nullableJson(input.command.unitEconomicsDraft),
        negativeConservativeReason: input.command.negativeConservativeReason,
        actedBy: input.actorId,
        idempotencyKey: input.command.idempotencyKey,
        payloadHash: input.command.payloadHash,
        updatedAt: now,
      };
      const row = existing
        ? await tx.productInitiativeDecisionDraft.update({
            where: { id: existing.id },
            data,
          })
        : await tx.productInitiativeDecisionDraft.create({
            data: {
              id: randomUUID(),
              tenantId: input.tenantId,
              handoffId: input.handoffId,
              ...data,
            },
          });
      return { record: toRecord(row), duplicate: false };
    });
  }
}

function toRecord(row: DraftRow): ProductInitiativeDecisionDraftRecord {
  return {
    draftId: row.id,
    handoffId: row.handoffId,
    draftVersion: row.draftVersion,
    initiativeVersionSeen: row.initiativeVersionSeen,
    objective: row.objective,
    reviewPoints:
      row.reviewPoints as unknown as ProductInitiativeDecisionDraftRecord["reviewPoints"],
    businessCaseDraft:
      row.businessCaseDraft as unknown as ProductInitiativeDecisionDraftRecord["businessCaseDraft"],
    riskAssessmentDraft:
      row.riskAssessmentDraft as unknown as ProductInitiativeDecisionDraftRecord["riskAssessmentDraft"],
    unitEconomicsDraft:
      row.unitEconomicsDraft as unknown as ProductInitiativeDecisionDraftRecord["unitEconomicsDraft"],
    negativeConservativeReason: row.negativeConservativeReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function nullableJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function conflict(code: string): never {
  throw new ProductInitiativeDraftConflictError(code);
}
