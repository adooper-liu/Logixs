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
  NewPostDepartureSourcePackageReview,
  NewPostDepartureSourceCandidateCorrection,
  PostDepartureSourceCandidateCorrectionRecord,
  PostDepartureSourcePackageReviewRecord,
  SavePostDepartureSourceCandidateCorrectionResult,
  SavePostDepartureSourcePackageReviewResult,
} from "../domain/import.repository";
import {
  PostDepartureCorrectionIdempotencyConflictError,
  PostDepartureCorrectionVersionConflictError,
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

  async savePostDepartureSourcePackageReview(
    input: NewPostDepartureSourcePackageReview,
  ): Promise<SavePostDepartureSourcePackageReviewResult> {
    const row = await this.prisma.postDepartureSourcePackageReview.upsert({
      where: {
        tenantId_packageHash: {
          tenantId: input.tenantId,
          packageHash: input.packageHash,
        },
      },
      update: {},
      create: {
        id: input.id,
        tenantId: input.tenantId,
        packageHash: input.packageHash,
        contractVersion: input.contractVersion,
        decision: input.decision,
        candidateCount: input.candidateCount,
        reviewRequiredCount: input.reviewRequiredCount,
        snapshot: input.snapshot as never,
        snapshotHash: input.snapshotHash,
        operatorId: input.operatorId,
        traceId: input.traceId,
        sources: {
          create: input.sources.map((source) => ({
            sourceKind: source.kind,
            importBatchId: source.batchId,
          })),
        },
      },
    });
    return {
      created: row.id === input.id,
      review: toPostDepartureSourcePackageReview(row),
    };
  }

  async findPostDepartureSourcePackageReviewById(
    reviewId: string,
    tenantId: string,
  ): Promise<PostDepartureSourcePackageReviewRecord | null> {
    const row = await this.prisma.postDepartureSourcePackageReview.findUnique({
      where: { id_tenantId: { id: reviewId, tenantId } },
    });
    return row ? toPostDepartureSourcePackageReview(row) : null;
  }

  async findPostDepartureSourcePackageReviewByPackage(
    tenantId: string,
    packageHash: string,
  ): Promise<PostDepartureSourcePackageReviewRecord | null> {
    const row = await this.prisma.postDepartureSourcePackageReview.findUnique({
      where: { tenantId_packageHash: { tenantId, packageHash } },
    });
    return row ? toPostDepartureSourcePackageReview(row) : null;
  }

  async listLatestPostDepartureSourceCandidateCorrections(
    reviewId: string,
    tenantId: string,
  ): Promise<PostDepartureSourceCandidateCorrectionRecord[]> {
    const rows =
      await this.prisma.postDepartureSourceCandidateCorrection.findMany({
        where: { reviewId, tenantId },
        orderBy: [{ candidateRef: "asc" }, { version: "desc" }],
        include: { cargoLines: { orderBy: { lineNumber: "asc" } } },
      });
    const latest = new Map<
      string,
      PostDepartureSourceCandidateCorrectionRecord
    >();
    for (const row of rows) {
      if (!latest.has(row.candidateRef)) {
        latest.set(
          row.candidateRef,
          toPostDepartureSourceCandidateCorrection(row),
        );
      }
    }
    return [...latest.values()];
  }

  savePostDepartureSourceCandidateCorrection(
    input: NewPostDepartureSourceCandidateCorrection,
  ): Promise<SavePostDepartureSourceCandidateCorrectionResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT 1 AS "lockAcquired"
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`post-departure-correction:${input.tenantId}:${input.reviewId}:${input.candidateRef}`}, 0)
          )
        ) AS acquired
      `;
      const replay =
        await transaction.postDepartureSourceCandidateCorrection.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { cargoLines: { orderBy: { lineNumber: "asc" } } },
        });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) {
          throw new PostDepartureCorrectionIdempotencyConflictError();
        }
        return {
          created: false,
          correction: toPostDepartureSourceCandidateCorrection(replay),
        };
      }

      const current =
        await transaction.postDepartureSourceCandidateCorrection.findFirst({
          where: {
            tenantId: input.tenantId,
            reviewId: input.reviewId,
            candidateRef: input.candidateRef,
          },
          orderBy: { version: "desc" },
          include: { cargoLines: { orderBy: { lineNumber: "asc" } } },
        });
      if ((current?.version ?? 0) !== input.expectedVersion) {
        throw new PostDepartureCorrectionVersionConflictError();
      }
      const correction =
        await transaction.postDepartureSourceCandidateCorrection.create({
          data: {
            id: input.id,
            tenantId: input.tenantId,
            reviewId: input.reviewId,
            candidateRef: input.candidateRef,
            version: input.expectedVersion + 1,
            supersedesCorrectionId: current?.id ?? null,
            shipmentGroupingKind: input.shipmentGroupingKind,
            shipmentNumber: input.shipmentNumber,
            targetShipmentId: input.targetShipmentId,
            targetRelationshipVersion: input.targetRelationshipVersion,
            originPortId: input.originPortId,
            originUnlocode: input.originUnlocode,
            destinationPortId: input.destinationPortId,
            destinationUnlocode: input.destinationUnlocode,
            departureLocal: input.departureLocal,
            departureOccurredAt: input.departureOccurredAt,
            departureSourceTimezone: input.departureSourceTimezone,
            departureEvidenceId: input.departureEvidenceId,
            operatorId: input.operatorId,
            reasonCode: input.reasonCode,
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
            ...(input.cargoLines?.length
              ? {
                  cargoLines: {
                    create: input.cargoLines.map((line) => ({
                      id: line.id,
                      lineNumber: line.lineNumber,
                      sourceLineId: line.sourceLineId,
                      replenishmentOrderNumber: line.replenishmentOrderNumber,
                      productSkuId: line.productSkuId,
                      productNumber: line.productNumber,
                      quantity: line.quantity,
                      quantityUnit: line.quantityUnit,
                      replenishmentOrderLineId: line.replenishmentOrderLineId,
                    })),
                  },
                }
              : {}),
          },
          include: { cargoLines: { orderBy: { lineNumber: "asc" } } },
        });
      return {
        created: true,
        correction: toPostDepartureSourceCandidateCorrection(correction),
      };
    });
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

function toPostDepartureSourcePackageReview(row: {
  id: string;
  tenantId: string;
  packageHash: string;
  contractVersion: string;
  decision: string;
  candidateCount: number;
  reviewRequiredCount: number;
  snapshot: unknown;
  snapshotHash: string;
  operatorId: string;
  traceId: string;
  createdAt: Date;
}): PostDepartureSourcePackageReviewRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    packageHash: row.packageHash,
    contractVersion:
      row.contractVersion as PostDepartureSourcePackageReviewRecord["contractVersion"],
    decision:
      row.decision as PostDepartureSourcePackageReviewRecord["decision"],
    candidateCount: row.candidateCount,
    reviewRequiredCount: row.reviewRequiredCount,
    snapshot:
      row.snapshot as PostDepartureSourcePackageReviewRecord["snapshot"],
    snapshotHash: row.snapshotHash,
    operatorId: row.operatorId,
    traceId: row.traceId,
    createdAt: row.createdAt,
  };
}

function toPostDepartureSourceCandidateCorrection(row: {
  id: string;
  tenantId: string;
  reviewId: string;
  candidateRef: string;
  version: number;
  supersedesCorrectionId: string | null;
  shipmentGroupingKind: string | null;
  shipmentNumber: string | null;
  targetShipmentId: string | null;
  targetRelationshipVersion: number | null;
  originPortId: string | null;
  originUnlocode: string | null;
  destinationPortId: string | null;
  destinationUnlocode: string | null;
  departureLocal: string | null;
  departureOccurredAt: Date | null;
  departureSourceTimezone: string | null;
  departureEvidenceId: string | null;
  operatorId: string;
  reasonCode: string;
  idempotencyKey: string;
  payloadHash: string;
  createdAt: Date;
  cargoLines?: Array<{
    id: string;
    lineNumber: number;
    sourceLineId: string;
    replenishmentOrderNumber: string;
    productSkuId: string;
    productNumber: string;
    quantity: { toString(): string };
    quantityUnit: string;
    replenishmentOrderLineId: string | null;
  }>;
}): PostDepartureSourceCandidateCorrectionRecord {
  return {
    ...row,
    shipmentGroupingKind:
      row.shipmentGroupingKind as PostDepartureSourceCandidateCorrectionRecord["shipmentGroupingKind"],
    cargoLines: (row.cargoLines ?? []).map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      quantityUnit:
        line.quantityUnit as PostDepartureSourceCandidateCorrectionRecord["cargoLines"][number]["quantityUnit"],
    })),
  };
}
