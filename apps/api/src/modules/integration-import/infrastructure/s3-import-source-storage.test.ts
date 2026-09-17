import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ObjectStorageConfig } from "../../../config/env";
import { S3ImportSourceStorage } from "./s3-import-source-storage";

const BODY = Buffer.from("order_number\nSO-1\n", "utf8");
const SHA256 = createHash("sha256").update(BODY).digest("hex");

function storageConfig(
  overrides: Partial<ObjectStorageConfig> = {},
): ObjectStorageConfig {
  return {
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    bucket: "logix-import-sources",
    accessKey: "test-access",
    secretKey: "test-secret",
    forcePathStyle: true,
    allowBucketCreation: true,
    timeoutMs: 10_000,
    ...overrides,
  };
}

function sourceInput() {
  return {
    objectKey: "imports/11111111-1111-4111-8111-111111111111/source",
    contentType: "text/csv",
    contentLength: BODY.length,
    sha256: SHA256,
    body: BODY,
  };
}

describe("S3ImportSourceStorage", () => {
  it("确认 bucket 后上传文件、checksum 和审计哈希", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ImportSourceStorage(storageConfig(), {
      send,
    } as never);

    await storage.put(sourceInput());

    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1][0].input).toMatchObject({
      Bucket: "logix-import-sources",
      Key: sourceInput().objectKey,
      Body: BODY,
      ContentType: "text/csv",
      ContentLength: BODY.length,
      ChecksumSHA256: Buffer.from(SHA256, "hex").toString("base64"),
      Metadata: { sha256: SHA256 },
    });
  });

  it("开发环境可在 bucket 不存在时创建后上传", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValue({});
    const storage = new S3ImportSourceStorage(storageConfig(), {
      send,
    } as never);

    await storage.put(sourceInput());

    expect(send.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
    expect(send.mock.calls[2][0]).toBeInstanceOf(PutObjectCommand);
  });

  it("禁止自动建 bucket 时明确保留 404", async () => {
    const missing = { $metadata: { httpStatusCode: 404 } };
    const send = vi.fn().mockRejectedValue(missing);
    const storage = new S3ImportSourceStorage(
      storageConfig({ allowBucketCreation: false }),
      { send } as never,
    );

    await expect(storage.put(sourceInput())).rejects.toBe(missing);
    expect(send).toHaveBeenCalledOnce();
  });

  it("删除只携带固定 bucket 与调用方提供的对象键", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ImportSourceStorage(storageConfig(), {
      send,
    } as never);

    await storage.delete(sourceInput().objectKey);

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "logix-import-sources",
      Key: sourceInput().objectKey,
    });
  });

  it("缺失生产配置时在发请求前失败", () => {
    expect(
      () =>
        new S3ImportSourceStorage(storageConfig({ secretKey: "" }), {
          send: vi.fn(),
        } as never),
    ).toThrow("OBJECT_STORAGE_CONFIG_INVALID");
  });
});
