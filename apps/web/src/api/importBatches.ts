// 导入批次前端只读/上传客户端（P6 阶段 A 读链路）。
// 开发期身份用固定值（正式 OIDC 属 P5-02）。

export interface ImportMappingSuggestion {
  column: string;
  fieldCode: string | null;
  confidence: number;
}

export interface ImportBatchDto {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  columnCount: number;
  mappingSuggestions: ImportMappingSuggestion[];
  createdAt: string;
}

export interface ImportBatchDetailDto {
  batch: ImportBatchDto;
  columns: string[];
  rows: { rowNo: number; values: Record<string, string> }[];
}

const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

export async function uploadImportBatch(
  file: File,
  idempotencyKey: string,
): Promise<ImportBatchDto> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/import-batches", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
      "X-Tenant-Id": DEV_TENANT_ID,
      "X-Operator-Id": DEV_OPERATOR_ID,
    },
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`上传失败（${response.status}）：${text}`);
  }
  return (await response.json()) as ImportBatchDto;
}

export async function getImportBatch(
  id: string,
): Promise<ImportBatchDetailDto> {
  const response = await fetch(`/api/import-batches/${id}`, {
    headers: {
      "X-Tenant-Id": DEV_TENANT_ID,
      "X-Operator-Id": DEV_OPERATOR_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`查询失败（${response.status}）`);
  }
  return (await response.json()) as ImportBatchDetailDto;
}
