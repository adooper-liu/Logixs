import type {
  ImportFieldCode,
  ImportFieldScope,
  QuantityUnitCode,
} from "@logix/contracts/import-fields.json";

// 导入批次前端只读/上传客户端（P6 阶段 A 读链路）。
// 开发期身份用固定值（正式 OIDC 属 P5-02）。

export interface ImportMappingSuggestion {
  column: string;
  fieldCode: ImportFieldCode | null;
  confidence: number;
}

export interface ImportBatchDto {
  id: string;
  fileName: string;
  sourceFileStatus: "not_retained" | "retained";
  sourceSizeBytes: number | null;
  parserVersion: string;
  replacesBatchId: string | null;
  status: string;
  rowCount: number;
  columnCount: number;
  mappingSuggestions: ImportMappingSuggestion[];
  confirmedQuantityUnit: QuantityUnitCode | null;
  createdAt: string;
}

export interface ImportFieldDefinition {
  code: ImportFieldCode;
  label: string;
  scope: ImportFieldScope;
  required: boolean;
}

export interface QuantityUnitDefinition {
  code: QuantityUnitCode;
  label: string;
}

export interface ImportFieldCatalog {
  version: string;
  fields: ImportFieldDefinition[];
  quantityUnits: QuantityUnitDefinition[];
}

export interface ImportBatchDetailDto {
  batch: ImportBatchDto;
  columns: string[];
  rows: { rowNo: number; values: Record<string, string> }[];
  effectiveMappings: ImportMappingSuggestion[];
  fieldCatalog: ImportFieldCatalog;
}

const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

export async function uploadImportBatch(
  file: File,
  replacesBatchId?: string,
): Promise<ImportBatchDto> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const contentHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const idempotencyKey = `import:sha256:${contentHash}`;
  const formData = new FormData();
  formData.append("file", file);
  if (replacesBatchId) formData.append("replacesBatchId", replacesBatchId);
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

export interface PrecheckBlocker {
  ruleCode: string;
  rowNo: number | null;
  message: string;
}

export interface ReconciliationResult {
  results: {
    rowId: string;
    outcome: string;
    containerRecordId: string | null;
    detail: string | null;
  }[];
  success: number;
  failed: number;
  duplicate: number;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": DEV_TENANT_ID,
      "X-Operator-Id": DEV_OPERATOR_ID,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`请求失败（${response.status}）：${text}`);
  }
  return (await response.json()) as T;
}

export function confirmMappings(
  batchId: string,
  reviews: { column: string; fieldCode: ImportFieldCode | null }[],
  quantityUnit: QuantityUnitCode | null,
): Promise<ImportBatchDto> {
  return postJson(`/api/import-batches/${batchId}/mapping-reviews`, {
    reviews,
    quantityUnit,
  });
}

export type { ImportFieldCode, QuantityUnitCode };

export function runPrecheck(
  batchId: string,
): Promise<{ blockers: PrecheckBlocker[] }> {
  return postJson(`/api/import-batches/${batchId}/precheck`);
}

export function executeImport(batchId: string): Promise<ReconciliationResult> {
  return postJson(`/api/import-batches/${batchId}/execute`);
}

export async function getReconciliation(
  batchId: string,
): Promise<ReconciliationResult> {
  const response = await fetch(
    `/api/import-batches/${batchId}/reconciliation`,
    {
      headers: {
        "X-Tenant-Id": DEV_TENANT_ID,
        "X-Operator-Id": DEV_OPERATOR_ID,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`对账查询失败（${response.status}）`);
  }
  return (await response.json()) as ReconciliationResult;
}
