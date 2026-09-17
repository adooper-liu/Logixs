import type {
  ImportBatch,
  ImportMappingSuggestion,
  ImportReview,
  ImportRow,
  NewImportRow,
} from "./import-batch";

// 导入持久化端口（Port/Adapter）：Application 依赖此抽象，Infrastructure 用 Prisma 实现。
export const IMPORT_REPOSITORY = Symbol("ImportRepository");

export interface NewImportBatch {
  id: string;
  tenantId: string;
  operatorId: string;
  idempotencyKey: string;
  fileName: string;
  fileHash: string;
  sourceFileStatus: "retained";
  sourceObjectKey: string;
  sourceContentType: string;
  sourceSizeBytes: number;
  sourceRetainedAt: Date;
  parserVersion: string;
  replacesBatchId: string | null;
  status: ImportBatch["status"];
  rowCount: number;
  columnCount: number;
  mappingSuggestions: ImportMappingSuggestion[];
}

export interface ImportBatchWithRows {
  batch: ImportBatch;
  rows: ImportRow[];
  reviews: ImportReview[];
}

// 阶段 C：映射审核（人确认/修正列→字段）。
export interface ImportReviewInput {
  column: string;
  fieldCode: string | null;
  operatorId: string;
}

// 阶段 C：逐行落账结果。
export interface ImportRowResultInput {
  rowId: string;
  outcome: "success" | "failed" | "duplicate";
  containerRecordId: string | null;
  detail: string | null;
}

export interface ImportRepository {
  findByIdempotencyKey(
    tenantId: string,
    key: string,
  ): Promise<ImportBatch | null>;
  findById(id: string, tenantId: string): Promise<ImportBatchWithRows | null>;
  create(input: NewImportBatch, rows: NewImportRow[]): Promise<ImportBatch>;
  saveReviewDecision(
    batchId: string,
    confirmedQuantityUnit: string | null,
    reviews: ImportReviewInput[],
  ): Promise<void>;
  updateStatus(batchId: string, status: string): Promise<void>;
  saveRowResults(
    batchId: string,
    results: ImportRowResultInput[],
  ): Promise<void>;
  getRowResults(batchId: string): Promise<ImportRowResultInput[]>;
}
