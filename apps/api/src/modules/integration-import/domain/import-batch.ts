// 导入领域对象（integration-import 拥有）。
// 阶段 A 最小集：只做「上传 → 幂等 → 解析 → 展示」，不落账、不写业务表。

export type ImportBatchStatus =
  "parsed" | "confirmed" | "approved" | "executing" | "completed";

// AI 字段映射建议（阶段 B）：哪一列对应哪个标准字段。
export interface ImportMappingSuggestion {
  column: string;
  fieldCode: string | null; // null = 未识别，待人工
  confidence: number;
}

export interface ImportBatch {
  id: string;
  tenantId: string;
  operatorId: string;
  idempotencyKey: string;
  fileName: string;
  fileHash: string;
  status: ImportBatchStatus;
  rowCount: number;
  columnCount: number;
  mappingSuggestions: ImportMappingSuggestion[];
  createdAt: Date;
}

// 解析出的单行快照：原始列头 -> 单元格显示文本（阶段 A 不做字段映射，保留原始形态）。
export interface ImportRow {
  id: string;
  rowNo: number;
  values: Record<string, string>;
}

// 建批时的行输入（id 由 DB 生成）。
export type NewImportRow = Omit<ImportRow, "id">;
