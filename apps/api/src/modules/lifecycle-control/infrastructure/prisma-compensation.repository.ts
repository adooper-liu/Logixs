import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CompensationRecord,
  CompensationState,
} from "../domain/compensation";
import type { CompensationRepository } from "../domain/compensation.repository";

@Injectable()
export class PrismaCompensationRepository implements CompensationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByIdempotency(input: {
    tenantId: string;
    originalClientOperationId: string;
    idempotencyKey: string;
  }): Promise<CompensationRecord | null> {
    const row = await this.prisma.compensationRecord.findUnique({
      where: {
        tenantId_originalClientOperationId_idempotencyKey: {
          tenantId: input.tenantId,
          originalClientOperationId: input.originalClientOperationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<CompensationRecord | null> {
    const row = await this.prisma.compensationRecord.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async listByOriginal(query: {
    tenantId: string;
    originalClientOperationId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<CompensationRecord[]> {
    const rows = await this.prisma.compensationRecord.findMany({
      where: {
        tenantId: query.tenantId,
        originalClientOperationId: query.originalClientOperationId,
        ...(query.after
          ? {
              OR: [
                { createdAt: { gt: query.after.createdAt } },
                {
                  AND: [
                    { createdAt: query.after.createdAt },
                    { id: { gt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.take,
    });
    return rows.map(toRecord);
  }

  async insert(record: CompensationRecord): Promise<void> {
    await this.prisma.compensationRecord.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        originalClientOperationId: record.originalClientOperationId,
        compensationActionCode: record.compensationActionCode,
        state: record.state,
        reasonCode: record.reasonCode,
        requestedBy: record.requestedBy,
        resultRefs: record.resultRefs,
        idempotencyKey: record.idempotencyKey,
        requestHash: record.requestHash,
        traceId: record.traceId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  }

  async updateState(record: CompensationRecord): Promise<void> {
    await this.prisma.compensationRecord.update({
      where: { id: record.id },
      data: {
        state: record.state,
        resultRefs: record.resultRefs,
        updatedAt: record.updatedAt,
      },
    });
  }
}

function toRecord(row: {
  id: string;
  tenantId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  state: string;
  reasonCode: string;
  requestedBy: string;
  resultRefs: unknown;
  idempotencyKey: string;
  requestHash: string;
  traceId: string;
  createdAt: Date;
  updatedAt: Date;
}): CompensationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    originalClientOperationId: row.originalClientOperationId,
    compensationActionCode: row.compensationActionCode,
    state: row.state as CompensationState,
    reasonCode: row.reasonCode,
    requestedBy: row.requestedBy,
    resultRefs: Array.isArray(row.resultRefs)
      ? (row.resultRefs as Array<{ entityType: string; entityId: string }>)
      : [],
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    traceId: row.traceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
