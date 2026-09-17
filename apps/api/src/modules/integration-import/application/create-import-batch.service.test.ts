import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AiGatewayService } from "../../ai-governance";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { IMPORT_SOURCE_STORAGE } from "../domain/import-source-storage";
import { CreateImportBatchService } from "./create-import-batch.service";

const BUFFER = Buffer.from("备货单号,箱号\nSO-1,MSKU1\n", "utf8");
const FILE_HASH = createHash("sha256").update(BUFFER).digest("hex");

async function buildService(
  repository: {
    findByIdempotencyKey: ReturnType<typeof vi.fn>;
    findById?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
  },
  storage = {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
) {
  const aiGateway = { suggestImportMapping: vi.fn().mockResolvedValue([]) };
  const module = await Test.createTestingModule({
    providers: [
      CreateImportBatchService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
      { provide: IMPORT_SOURCE_STORAGE, useValue: storage },
      { provide: AiGatewayService, useValue: aiGateway },
    ],
  }).compile();
  return module.get(CreateImportBatchService);
}

function baseInput() {
  return {
    fileName: "import.csv",
    buffer: BUFFER,
    idempotencyKey: "key-1",
    tenantId: "t1",
    operatorId: "op1",
  };
}

function csvBuffer(rowCount: number, columnCount: number): Buffer {
  const headers = Array.from(
    { length: columnCount },
    (_, index) => `column_${index + 1}`,
  ).join(",");
  const row = Array.from({ length: columnCount }, () => "value").join(",");
  return Buffer.from(
    [headers, ...Array.from({ length: rowCount }, () => row)].join("\n"),
    "utf8",
  );
}

describe("CreateImportBatchService", () => {
  it(".xls 格式 → 拒绝 VALIDATION_FORMAT", async () => {
    const repository = { findByIdempotencyKey: vi.fn() };
    const service = await buildService(repository);

    await expect(
      service.execute({ ...baseInput(), fileName: "import.xls" }),
    ).rejects.toThrow(HttpException);
    expect(repository.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it("同 key 同 hash → 幂等返回原批次（created=false）", async () => {
    const existing = { id: "b1", fileHash: FILE_HASH, status: "parsed" };
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
    };
    const storage = { put: vi.fn(), delete: vi.fn() };
    const service = await buildService(repository, storage);

    const result = await service.execute(baseInput());

    expect(result.created).toBe(false);
    expect(result.batch.id).toBe("b1");
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith(
      "t1",
      "key-1:parser:tabular-v2",
    );
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("新批次先保存独占原文件，再保存一致的来源元数据", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (batch) => ({
        ...batch,
        id: batch.id,
        confirmedQuantityUnit: null,
        createdAt: new Date("2026-09-17T00:00:00.000Z"),
      })),
    };
    const storage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const service = await buildService(repository, storage);

    const result = await service.execute(baseInput());

    const stored = storage.put.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      contentType: "text/csv",
      contentLength: BUFFER.length,
      sha256: FILE_HASH,
      body: BUFFER,
    });
    expect(stored.objectKey).toMatch(/^imports\/[0-9a-f-]{36}\/source$/);
    expect(stored.objectKey).not.toContain("import.csv");
    expect(stored.objectKey).not.toContain("t1");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.batch.id,
        fileHash: FILE_HASH,
        sourceFileStatus: "retained",
        sourceObjectKey: stored.objectKey,
        sourceContentType: "text/csv",
        sourceSizeBytes: BUFFER.length,
      }),
      expect.any(Array),
    );
    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(
      repository.create.mock.invocationCallOrder[0],
    );
  });

  it("对象存储失败时不创建批次", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    const storageError = new Error("storage unavailable");
    const storage = {
      put: vi.fn().mockRejectedValue(storageError),
      delete: vi.fn(),
    };
    const service = await buildService(repository, storage);

    await expect(service.execute(baseInput())).rejects.toBe(storageError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("批次创建失败时删除本批独占对象并保留原错误", async () => {
    const databaseError = new Error("database unavailable");
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(databaseError),
    };
    const storage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const service = await buildService(repository, storage);

    await expect(service.execute(baseInput())).rejects.toBe(databaseError);
    expect(storage.delete).toHaveBeenCalledOnce();
    expect(storage.delete).toHaveBeenCalledWith(
      storage.put.mock.calls[0][0].objectKey,
    );
  });

  it("替代上传校验同租户旧批次并保存解析版本与血缘", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({ batch: { id: "old-batch" } }),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (batch) => ({
        ...batch,
        id: "new-batch",
        confirmedQuantityUnit: null,
        createdAt: new Date("2026-09-16T00:00:00.000Z"),
      })),
    };
    const service = await buildService(repository);

    const result = await service.execute({
      ...baseInput(),
      replacesBatchId: "old-batch",
    });

    expect(repository.findById).toHaveBeenCalledWith("old-batch", "t1");
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith(
      "t1",
      "key-1:parser:tabular-v2:replaces:old-batch",
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parserVersion: "tabular-v2",
        replacesBatchId: "old-batch",
      }),
      expect.any(Array),
    );
    expect(result.batch.id).toBe("new-batch");
  });

  it("替代目标不存在或不属于当前租户时明确拒绝", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      findByIdempotencyKey: vi.fn(),
      create: vi.fn(),
    };
    const service = await buildService(repository);

    await expect(
      service.execute({ ...baseInput(), replacesBatchId: "other-batch" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(repository.findByIdempotencyKey).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("同一解析版本的替代上传重试返回原新批次", async () => {
    const replacement = {
      id: "new-batch",
      fileHash: FILE_HASH,
      status: "parsed",
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({ batch: { id: "old-batch" } }),
      findByIdempotencyKey: vi.fn().mockResolvedValue(replacement),
      create: vi.fn(),
    };
    const service = await buildService(repository);

    const result = await service.execute({
      ...baseInput(),
      replacesBatchId: "old-batch",
    });

    expect(result).toEqual({ batch: replacement, created: false });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("51 列真实备货单结构可解析", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (batch) => ({
        ...batch,
        id: "b1",
        createdAt: new Date("2026-09-16T00:00:00.000Z"),
      })),
    };
    const service = await buildService(repository);

    const result = await service.execute({
      ...baseInput(),
      buffer: csvBuffer(1, 51),
    });

    expect(result.created).toBe(true);
    expect(result.batch.columnCount).toBe(51);
  });

  it("129 列明确报告实际列数与上限", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    };
    const service = await buildService(repository);

    await expect(
      service.execute({ ...baseInput(), buffer: csvBuffer(1, 129) }),
    ).rejects.toThrow("VALIDATION_RANGE: 文件有 129 列，最多支持 128 列");
  });

  it("5001 数据行明确报告实际行数与上限", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    };
    const service = await buildService(repository);

    await expect(
      service.execute({ ...baseInput(), buffer: csvBuffer(5001, 1) }),
    ).rejects.toThrow(
      "VALIDATION_RANGE: 文件有 5001 个数据行，最多支持 5000 行",
    );
  });

  it("横向明细后混入纵向字段值区块时在持久化前明确阻断", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    const service = await buildService(repository);
    const mixedLayout = Buffer.from(
      [
        "备货单号,货号.产品货号,出运数量,合同号,起运港,目的港",
        "SO-1,SKU-1,10,C-1,宁波,巴塞罗那",
        "是否查验,否,,,,",
        "备货单号,备货单号,SO-1,SO-1,,",
        "备货单状态,集装箱号,已出运,MSKU1,,",
        "出运数量,合同号,10,C-1,,",
      ].join("\n"),
      "utf8",
    );

    await expect(
      service.execute({ ...baseInput(), buffer: mixedLayout }),
    ).rejects.toThrow(
      "VALIDATION_LAYOUT: 疑似混合版式，工作表第 4 行起出现纵向字段值区块",
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("字段较少的正常横向产品行不会被误判为混合版式", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (batch) => ({
        ...batch,
        id: "b1",
        createdAt: new Date("2026-09-16T00:00:00.000Z"),
      })),
    };
    const service = await buildService(repository);
    const sparseProducts = Buffer.from(
      [
        "备货单号,货号.产品货号,出运数量,合同号,起运港,目的港",
        "SO-1,SKU-1,10,C-1,,",
        "SO-1,SKU-2,20,C-2,,",
        "SO-1,SKU-3,30,C-3,,",
      ].join("\n"),
      "utf8",
    );

    const result = await service.execute({
      ...baseInput(),
      buffer: sparseProducts,
    });

    expect(result.created).toBe(true);
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("单行业务值偶然与表头相同不会被误判为混合版式", async () => {
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (batch) => ({
        ...batch,
        id: "b1",
        createdAt: new Date("2026-09-16T00:00:00.000Z"),
      })),
    };
    const service = await buildService(repository);
    const oneCoincidentalRow = Buffer.from(
      [
        "备货单号,货号.产品货号,出运数量,合同号,起运港,目的港",
        "备货单号,合同号,,,,",
        "SO-1,SKU-2,20,C-2,,",
      ].join("\n"),
      "utf8",
    );

    const result = await service.execute({
      ...baseInput(),
      buffer: oneCoincidentalRow,
    });

    expect(result.created).toBe(true);
  });
});
