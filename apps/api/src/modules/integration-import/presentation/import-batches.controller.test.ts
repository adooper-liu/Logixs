import { describe, expect, it } from "vitest";
import {
  normalizeMultipartFileName,
  normalizeReplacementBatchId,
  toBatchDto,
} from "./import-batches.controller";

describe("normalizeMultipartFileName", () => {
  it("恢复被 Latin-1 解读的 UTF-8 中文文件名", () => {
    const expected = "引出列表_备货平台_0916131849.xlsx";
    const mojibake = Buffer.from(expected, "utf8").toString("latin1");

    expect(normalizeMultipartFileName(mojibake)).toBe(expected);
  });

  it("保留 ASCII、原生 Unicode 与合法 Latin-1 文件名", () => {
    expect(normalizeMultipartFileName("import.xlsx")).toBe("import.xlsx");
    expect(normalizeMultipartFileName("货柜导入.xlsx")).toBe("货柜导入.xlsx");
    expect(normalizeMultipartFileName("café.xlsx")).toBe("café.xlsx");
  });
});

describe("normalizeReplacementBatchId", () => {
  it("接受空值或 UUID，拒绝其他输入", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(normalizeReplacementBatchId(undefined)).toBeNull();
    expect(normalizeReplacementBatchId("")).toBeNull();
    expect(normalizeReplacementBatchId(id)).toBe(id);
    expect(() => normalizeReplacementBatchId("batch-1")).toThrow(
      "VALIDATION_FORMAT",
    );
  });
});

describe("toBatchDto", () => {
  it("公开解析版本与替代血缘但不暴露内部幂等键和哈希", () => {
    const dto = toBatchDto({
      id: "new-batch",
      tenantId: "tenant-1",
      operatorId: "operator-1",
      idempotencyKey: "internal-key",
      fileName: "split.csv",
      fileHash: "secret-hash",
      sourceFileStatus: "retained",
      sourceObjectKey: "imports/new-batch/source",
      sourceContentType: "text/csv",
      sourceSizeBytes: 128,
      sourceRetainedAt: new Date("2026-09-16T00:00:00.000Z"),
      parserVersion: "tabular-v2",
      replacesBatchId: "old-batch",
      status: "parsed",
      rowCount: 1,
      columnCount: 3,
      mappingSuggestions: [],
      confirmedQuantityUnit: null,
      createdAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    expect(dto).toMatchObject({
      sourceFileStatus: "retained",
      sourceSizeBytes: 128,
      parserVersion: "tabular-v2",
      replacesBatchId: "old-batch",
    });
    expect(dto).not.toHaveProperty("idempotencyKey");
    expect(dto).not.toHaveProperty("fileHash");
    expect(dto).not.toHaveProperty("sourceObjectKey");
    expect(dto).not.toHaveProperty("sourceContentType");
  });
});
