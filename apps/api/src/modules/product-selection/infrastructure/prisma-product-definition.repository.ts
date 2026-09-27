import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ProductDefinitionConflictError,
  ProductDefinitionValidationError,
} from "../domain/product-definition";
import type {
  ProductDefinitionRecord,
  ProductDefinitionRepository,
  ProductDefinitionStageOutcome,
} from "../domain/product-definition.repository";

type Transaction = Prisma.TransactionClient;
type DefinitionRow = Prisma.ProductDefinitionGetPayload<Record<string, never>>;

@Injectable()
export class PrismaProductDefinitionRepository implements ProductDefinitionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByInitiativeHandoffId(
    tenantId: string,
    initiativeHandoffId: string,
  ): Promise<ProductDefinitionRecord | null> {
    const row = await this.prisma.productDefinition.findUnique({
      where: {
        tenantId_initiativeHandoffId: { tenantId, initiativeHandoffId },
      },
    });
    return row ? toRecord(row) : null;
  }

  async findById(
    tenantId: string,
    definitionId: string,
  ): Promise<ProductDefinitionRecord | null> {
    const row = await this.prisma.productDefinition.findFirst({
      where: { id: definitionId, tenantId },
    });
    return row ? toRecord(row) : null;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ProductDefinitionRecord | null> {
    const row = await this.prisma.productDefinition.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    return row ? toRecord(row) : null;
  }

  async list(
    input: Parameters<ProductDefinitionRepository["list"]>[0],
  ): Promise<ProductDefinitionRecord[]> {
    const rows = await this.prisma.productDefinition.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.after
          ? {
              OR: [
                { updatedAt: { lt: input.after.updatedAt } },
                {
                  AND: [
                    { updatedAt: input.after.updatedAt },
                    { id: { lt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
    return rows.map(toRecord);
  }

  persistWrite(
    input: Parameters<ProductDefinitionRepository["persistWrite"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-definition:${input.tenantId}:${input.initiativeHandoffId}`,
      );

      const replay = await tx.productDefinition.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("PRODUCT_DEFINITION_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }

      const existing = await tx.productDefinition.findUnique({
        where: {
          tenantId_initiativeHandoffId: {
            tenantId: input.tenantId,
            initiativeHandoffId: input.initiativeHandoffId,
          },
        },
      });
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== command.expectedDefinitionVersion) {
        conflict("PRODUCT_DEFINITION_VERSION_CONFLICT");
      }
      // 发布是终态：已发布/已终止的产品定义不再接受推进。
      if (existing && existing.releaseState !== "in_progress") {
        conflict("PRODUCT_DEFINITION_ALREADY_CLOSED");
      }

      const outcomes = stageOutcomesOf(existing);
      if (command.conclusion) {
        outcomes.push({
          ...command.conclusion,
          recordedBy: input.actorId,
          recordedAt: new Date(),
        });
      }

      const data = {
        npiStage: command.npiStage,
        version: command.version,
        specification: command.specification,
        complianceAssumptions: command.complianceAssumptions,
        stageOutcomes: outcomes as unknown as Prisma.InputJsonValue,
        productOwnerActorId: input.productOwnerActorId,
        actedBy: input.actorId,
        idempotencyKey: command.idempotencyKey,
        payloadHash: command.payloadHash,
        updatedAt: new Date(),
      };
      const row = existing
        ? await tx.productDefinition.update({
            where: { id: existing.id },
            data,
          })
        : await tx.productDefinition.create({
            data: {
              id: randomUUID(),
              tenantId: input.tenantId,
              initiativeHandoffId: input.initiativeHandoffId,
              releaseState: "in_progress",
              ...data,
            },
          });
      return { record: toRecord(row), duplicate: false };
    });
  }

  persistRelease(
    input: Parameters<ProductDefinitionRepository["persistRelease"]>[0],
  ) {
    const { command } = input;
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(
        tx,
        `product-definition:release:${input.tenantId}:${input.definitionId}`,
      );

      const existing = await tx.productDefinition.findFirst({
        where: { id: input.definitionId, tenantId: input.tenantId },
      });
      if (!existing) {
        throw new ProductDefinitionValidationError(
          "PRODUCT_DEFINITION_NOT_FOUND",
        );
      }
      const replay = await tx.productDefinition.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== command.payloadHash) {
          conflict("PRODUCT_DEFINITION_IDEMPOTENCY_CONFLICT");
        }
        return { record: toRecord(replay), duplicate: true };
      }
      if (existing.version !== command.expectedDefinitionVersion) {
        conflict("PRODUCT_DEFINITION_VERSION_CONFLICT");
      }
      if (existing.releaseState !== "in_progress") {
        conflict("PRODUCT_DEFINITION_ALREADY_CLOSED");
      }

      const row = await tx.productDefinition.update({
        where: { id: existing.id },
        data: {
          version: command.version,
          releaseState: command.releaseState,
          actedBy: input.actorId,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
          updatedAt: new Date(),
        },
      });

      if (command.decision === "release") {
        // 发布：同一事务内追加不可变交接快照，交到主数据侧。
        const snapshotVersion =
          (await tx.productDefinitionRelease.count({
            where: {
              tenantId: input.tenantId,
              definitionId: existing.id,
            },
          })) + 1;
        await tx.productDefinitionRelease.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            definitionId: existing.id,
            version: snapshotVersion,
            npiStage: existing.npiStage,
            specification: existing.specification,
            complianceAssumptions: existing.complianceAssumptions,
            stageOutcomes: existing.stageOutcomes as Prisma.InputJsonValue,
            releasedBy: input.actorId,
            releasedAt: row.updatedAt,
            idempotencyKey: command.idempotencyKey,
            payloadHash: command.payloadHash,
          },
        });
      }

      return { record: toRecord(row), duplicate: false };
    });
  }
}

function stageOutcomesOf(
  row: DefinitionRow | null,
): ProductDefinitionStageOutcome[] {
  if (!row) return [];
  const raw = row.stageOutcomes as unknown as {
    stage: ProductDefinitionStageOutcome["stage"];
    conclusion: string;
    evidenceRefs: string[];
    recordedBy: string;
    recordedAt: string;
  }[];
  return raw.map((outcome) => ({
    ...outcome,
    recordedAt: new Date(outcome.recordedAt),
  }));
}

function toRecord(row: DefinitionRow): ProductDefinitionRecord {
  return {
    definitionId: row.id,
    initiativeHandoffId: row.initiativeHandoffId,
    productOwnerActorId: row.productOwnerActorId,
    npiStage: row.npiStage as ProductDefinitionRecord["npiStage"],
    version: row.version,
    releaseState: row.releaseState as ProductDefinitionRecord["releaseState"],
    specification: row.specification,
    complianceAssumptions: row.complianceAssumptions,
    stageOutcomes: stageOutcomesOf(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function conflict(code: string): never {
  throw new ProductDefinitionConflictError(code);
}
