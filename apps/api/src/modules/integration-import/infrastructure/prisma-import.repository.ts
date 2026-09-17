import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ImportBatch,
  ImportMappingSuggestion,
  NewImportRow,
} from "../domain/import-batch";
import type {
  ImportRepository,
  ImportBatchWithRows,
  ImportReviewInput,
  ImportRowResultInput,
  NewImportBatch,
} from "../domain/import.repository";

@Injectable()
export class PrismaImportRepository implements ImportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(
    tenantId: string,
    key: string,
  ): Promise<ImportBatch | null> {
    const row = await this.prisma.importBatch.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey: key },
      },
    });
    return row ? toBatch(row) : null;
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<ImportBatchWithRows | null> {
    const batch = await this.prisma.importBatch.findFirst({
      where: { id, tenantId },
      include: {
        rows: { orderBy: { rowNo: "asc" } },
        reviews: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!batch) return null;
    return {
      batch: toBatch(batch),
      rows: batch.rows.map((row) => ({
        id: row.id,
        rowNo: row.rowNo,
        values: row.snapshot as Record<string, string>,
      })),
      reviews: batch.reviews.map((review) => ({
        column: review.column,
        fieldCode: review.fieldCode,
        operatorId: review.operatorId,
        createdAt: review.createdAt,
      })),
    };
  }

  async create(
    input: NewImportBatch,
    rows: NewImportRow[],
  ): Promise<ImportBatch> {
    // nested create 单语句，Prisma 内部原子，batch 与 rows 同生共死。
    const batch = await this.prisma.importBatch.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        operatorId: input.operatorId,
        idempotencyKey: input.idempotencyKey,
        fileName: input.fileName,
        fileHash: input.fileHash,
        sourceFileStatus: input.sourceFileStatus,
        sourceObjectKey: input.sourceObjectKey,
        sourceContentType: input.sourceContentType,
        sourceSizeBytes: input.sourceSizeBytes,
        sourceRetainedAt: input.sourceRetainedAt,
        parserVersion: input.parserVersion,
        replacesBatchId: input.replacesBatchId,
        status: input.status,
        rowCount: input.rowCount,
        columnCount: input.columnCount,
        // Prisma Json 字段类型不接受 interface 数组，断言为可序列化值（运行时正确）
        mappingSuggestions: input.mappingSuggestions as never,
        rows: {
          create: rows.map((row) => ({
            rowNo: row.rowNo,
            snapshot: row.values,
          })),
        },
      },
    });
    return toBatch(batch);
  }

  async saveReviewDecision(
    batchId: string,
    confirmedQuantityUnit: string | null,
    reviews: ImportReviewInput[],
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.importReview.createMany({
        data: reviews.map((review) => ({
          batchId,
          column: review.column,
          fieldCode: review.fieldCode,
          operatorId: review.operatorId,
        })),
      });
      await transaction.importBatch.update({
        where: { id: batchId },
        data: { confirmedQuantityUnit, status: "confirmed" },
      });
    });
  }

  async updateStatus(batchId: string, status: string): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status },
    });
  }

  async saveRowResults(
    batchId: string,
    results: ImportRowResultInput[],
  ): Promise<void> {
    await this.prisma.importRowResult.createMany({
      data: results.map((result) => ({
        batchId,
        rowId: result.rowId,
        outcome: result.outcome,
        containerRecordId: result.containerRecordId,
        detail: result.detail,
      })),
    });
  }

  async getRowResults(batchId: string): Promise<ImportRowResultInput[]> {
    const results = await this.prisma.importRowResult.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" },
    });
    return results.map((result) => ({
      rowId: result.rowId,
      outcome: result.outcome as ImportRowResultInput["outcome"],
      containerRecordId: result.containerRecordId,
      detail: result.detail,
    }));
  }
}

function toBatch(row: {
  id: string;
  tenantId: string;
  operatorId: string;
  idempotencyKey: string;
  fileName: string;
  fileHash: string;
  sourceFileStatus: string;
  sourceObjectKey: string | null;
  sourceContentType: string | null;
  sourceSizeBytes: number | null;
  sourceRetainedAt: Date | null;
  parserVersion: string;
  replacesBatchId: string | null;
  status: string;
  rowCount: number;
  columnCount: number;
  mappingSuggestions: unknown;
  confirmedQuantityUnit: string | null;
  createdAt: Date;
}): ImportBatch {
  return {
    id: row.id,
    tenantId: row.tenantId,
    operatorId: row.operatorId,
    idempotencyKey: row.idempotencyKey,
    fileName: row.fileName,
    fileHash: row.fileHash,
    sourceFileStatus: row.sourceFileStatus as ImportBatch["sourceFileStatus"],
    sourceObjectKey: row.sourceObjectKey,
    sourceContentType: row.sourceContentType,
    sourceSizeBytes: row.sourceSizeBytes,
    sourceRetainedAt: row.sourceRetainedAt,
    parserVersion: row.parserVersion,
    replacesBatchId: row.replacesBatchId,
    status: row.status as ImportBatch["status"],
    rowCount: row.rowCount,
    columnCount: row.columnCount,
    mappingSuggestions: row.mappingSuggestions as ImportMappingSuggestion[],
    confirmedQuantityUnit: row.confirmedQuantityUnit,
    createdAt: row.createdAt,
  };
}
