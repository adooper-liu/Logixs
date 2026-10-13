import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "@logix/full-chain-sample-contracts";
import { S3LandingReceiptStore } from "./s3-landing-receipt.store";

const minio = new S3Client({
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "logix", secretAccessKey: "logix-dev-secret" },
});
const bucket = "logix-import-sources";

async function ensureBucket() {
  try {
    await minio.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await minio.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

describe("S3 landing receipt integration", () => {
  const tenantId = `rehearsal-${randomUUID().replaceAll("-", "")}`;
  const runId = randomUUID();
  const key = `rehearsal/${tenantId}/${runId}/receipt.json`;
  const store = new S3LandingReceiptStore(minio, bucket, {
    rehearsalTenantId: tenantId,
    oldDemoTenantId: "demo-real-sample-20260921",
    prefixRoot: "rehearsal",
  });
  const body = '{"receiptVersion":"full-chain-rehearsal-receipt.v1"}\n';
  const digest = sha256Hex(body);

  beforeAll(ensureBucket);
  afterAll(async () => {
    await minio.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    minio.destroy();
  });

  it("puts, replays, conflicts, reads, and deletes one exact receipt", async () => {
    expect(
      await store.putIfAbsent({ tenantId, runId, body, digest }),
    ).toMatchObject({ replayed: false, digest });
    expect(await store.readDigest({ tenantId, runId })).toBe(digest);
    expect(
      await store.putIfAbsent({ tenantId, runId, body, digest }),
    ).toMatchObject({ replayed: true, digest });
    await expect(
      store.putIfAbsent({
        tenantId,
        runId,
        body: "different",
        digest: sha256Hex("different"),
      }),
    ).rejects.toThrow(/FULL_CHAIN_RECEIPT_CONFLICT/);
    await store.deleteOwnedKey({ tenantId, runId, digest });
    expect(await store.readDigest({ tenantId, runId })).toBeNull();
  });
});
