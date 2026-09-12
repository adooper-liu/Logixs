// 导入领域对象（integration-import 拥有）。
// 阶段 A 最小集：只做「上传 → 幂等 → 解析 → 展示」，不落账、不写业务表。

export type ImportBatchStatus = "pending" | "parsed";

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
  createdAt: Date;
}

// 解析出的单行快照：原始列头 -> 单元格显示文本（阶段 A 不做字段映射，保留原始形态）。
export interface ImportRow {
  rowNo: number;
  values: Record<string, string>;
}
