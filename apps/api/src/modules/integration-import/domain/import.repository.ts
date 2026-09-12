import type { ImportBatch, ImportRow } from "./import-batch";

// 导入持久化端口（Port/Adapter）：Application 依赖此抽象，Infrastructure 用 Prisma 实现。
export const IMPORT_REPOSITORY = Symbol("ImportRepository");

export interface NewImportBatch {
  tenantId: string;
  operatorId: string;
  idempotencyKey: string;
  fileName: string;
  fileHash: string;
  status: ImportBatch["status"];
  rowCount: number;
  columnCount: number;
}

export interface ImportBatchWithRows {
  batch: ImportBatch;
  rows: ImportRow[];
}

export interface ImportRepository {
  findByIdempotencyKey(key: string): Promise<ImportBatch | null>;
  findById(id: string): Promise<ImportBatchWithRows | null>;
  create(input: NewImportBatch, rows: ImportRow[]): Promise<ImportBatch>;
}
