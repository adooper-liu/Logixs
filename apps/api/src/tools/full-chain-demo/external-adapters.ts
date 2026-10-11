import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  Client as TemporalClient,
  Connection as TemporalConnectionClient,
} from "@temporalio/client";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { MinioObject } from "./minio-inventory";
import type { TemporalSchedule, TemporalWorkflow } from "./temporal-inventory";

type TemporalConnection = { close: () => void };

type ObjectDigest = { size: number; sha256: string };

export async function digestObjectBody(body: unknown): Promise<ObjectDigest> {
  if (!(body instanceof Readable)) throw new Error("MINIO_CHECKSUM_MISMATCH");
  const hash = createHash("sha256");
  let size = 0;
  try {
    for await (const chunk of body) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      hash.update(bytes);
    }
  } catch {
    throw new Error("MINIO_CHECKSUM_MISMATCH");
  }
  return { size, sha256: hash.digest("hex") };
}

function optional(names: string[], fallback: string): string {
  for (const name of names) {
    if (process.env[name]) return process.env[name] as string;
  }
  return fallback;
}

export function buildRehearsalObjectKey(
  targetPrefix: string,
  sourceKey: string,
): string {
  if (
    !targetPrefix.startsWith("rehearsal/") ||
    targetPrefix.includes("..") ||
    targetPrefix.includes("\\") ||
    sourceKey.startsWith("/") ||
    sourceKey.includes("..") ||
    sourceKey.includes("\\")
  )
    throw new Error("RESTORE_TARGET_PREFIX_INVALID");
  return `${targetPrefix.replace(/\/+$/u, "")}/${sourceKey.replace(/^\/+/u, "")}`;
}

export async function assertEmptyRehearsalPrefix(
  targetPrefix: string,
  list: (prefix: string) => Promise<string[]>,
): Promise<void> {
  buildRehearsalObjectKey(targetPrefix, "ownership-probe");
  if ((await list(targetPrefix)).length > 0)
    throw new Error("BACKUP_TARGET_NOT_ISOLATED");
}

export function createMinioInventoryAdapter() {
  const bucket = optional(
    ["MINIO_BUCKET", "IMPORT_SOURCE_BUCKET"],
    "logix-import-sources",
  );
  const client = new S3Client({
    endpoint: optional(
      ["MINIO_ENDPOINT", "OBJECT_STORAGE_ENDPOINT"],
      "http://127.0.0.1:9000",
    ),
    region:
      process.env.MINIO_REGION ??
      process.env.OBJECT_STORAGE_REGION ??
      "us-east-1",
    forcePathStyle:
      (process.env.MINIO_FORCE_PATH_STYLE ??
        process.env.OBJECT_STORAGE_FORCE_PATH_STYLE) !== "false",
    credentials: {
      accessKeyId: optional(
        ["MINIO_ACCESS_KEY", "OBJECT_STORAGE_ACCESS_KEY", "MINIO_ROOT_USER"],
        "logix",
      ),
      secretAccessKey: optional(
        [
          "MINIO_SECRET_KEY",
          "OBJECT_STORAGE_SECRET_KEY",
          "MINIO_ROOT_PASSWORD",
        ],
        "logix-dev-secret",
      ),
    },
  });
  return {
    async listObjects(): Promise<MinioObject[]> {
      const result: MinioObject[] = [];
      let continuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
          }),
        );
        for (const item of page.Contents ?? []) {
          if (item.Key) result.push({ key: item.Key, size: item.Size });
        }
        continuationToken = page.NextContinuationToken;
      } while (continuationToken);
      return result;
    },
    async headObject(key: string): Promise<MinioObject | null> {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const digest = await digestObjectBody(result.Body);
        const metadataChecksum = result.Metadata?.sha256?.toLowerCase();
        if (
          metadataChecksum !== undefined &&
          (!/^[a-f0-9]{64}$/u.test(metadataChecksum) ||
            metadataChecksum !== digest.sha256)
        )
          throw new Error("MINIO_CHECKSUM_MISMATCH");
        return {
          key,
          size: digest.size,
          checksum: digest.sha256,
          metadataChecksum: metadataChecksum ?? null,
        };
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } })
          ?.$metadata?.httpStatusCode;
        if (
          status === 404 ||
          (error as { name?: string })?.name === "NoSuchKey"
        )
          return null;
        throw error;
      }
    },
    async listPrefix(targetPrefix: string): Promise<string[]> {
      buildRehearsalObjectKey(targetPrefix, "ownership-probe");
      const keys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${targetPrefix.replace(/\/+$/u, "")}/`,
            ContinuationToken: continuationToken,
          }),
        );
        for (const item of page.Contents ?? [])
          if (item.Key) keys.push(item.Key);
        continuationToken = page.NextContinuationToken;
      } while (continuationToken);
      return keys;
    },
    async deleteKeys(keys: string[]): Promise<void> {
      if (!keys.length) return;
      if (
        keys.some(
          (key) =>
            !key.startsWith("rehearsal/") ||
            key.includes("..") ||
            key.includes("\\"),
        )
      )
        throw new Error("RESTORE_CLEANUP_SCOPE_INVALID");
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    },
    async copyObject(sourceKey: string, targetPrefix: string): Promise<string> {
      const targetKey = buildRehearsalObjectKey(targetPrefix, sourceKey);
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: targetKey,
          CopySource: `${bucket}/${encodeURIComponent(sourceKey).replace(/%2F/gu, "/")}`,
        }),
      );
      return targetKey;
    },
    async verifyCopy(
      sourceKey: string,
      targetPrefix: string,
      expected: MinioObject,
    ): Promise<void> {
      if (!expected.checksum || !/^[a-f0-9]{64}$/u.test(expected.checksum))
        throw new Error("MINIO_CHECKSUM_MISMATCH");
      const source = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: sourceKey }),
      );
      const target = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: buildRehearsalObjectKey(targetPrefix, sourceKey),
        }),
      );
      const [sourceDigest, targetDigest] = await Promise.all([
        digestObjectBody(source.Body),
        digestObjectBody(target.Body),
      ]);
      if (
        sourceDigest.sha256 !== expected.checksum ||
        targetDigest.sha256 !== sourceDigest.sha256 ||
        (expected.size !== undefined && sourceDigest.size !== expected.size) ||
        targetDigest.size !== sourceDigest.size
      )
        throw new Error("MINIO_CHECKSUM_MISMATCH");
    },
  };
}

export function createTemporalInventoryAdapter() {
  const address = optional(["TEMPORAL_ADDRESS"], "127.0.0.1:7233");
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  let connection: TemporalConnection | undefined;
  const connectionPromise = TemporalConnectionClient.connect({ address });
  const clientPromise = connectionPromise.then((value) => {
    connection = value;
    return new TemporalClient({ connection: value, namespace });
  });
  return {
    async listWorkflows(): Promise<TemporalWorkflow[]> {
      const client = await clientPromise;
      const result: TemporalWorkflow[] = [];
      for await (const workflow of client.workflow.list()) {
        const tenantId = workflow.memo?.tenantId;
        result.push({
          namespace,
          workflowId: workflow.workflowId,
          runId: workflow.runId,
          type: workflow.type,
          status: workflow.status.name,
          tenantId: typeof tenantId === "string" ? tenantId : undefined,
        });
      }
      return result;
    },
    async listSchedules(): Promise<TemporalSchedule[]> {
      const client = await clientPromise;
      const result: TemporalSchedule[] = [];
      for await (const summary of client.schedule.list()) {
        const description = await client.schedule
          .getHandle(summary.scheduleId)
          .describe();
        result.push({
          id: summary.scheduleId,
          state: description.state.paused ? "paused" : "active",
          global: summary.scheduleId === "outbox-publish-due-system",
        });
      }
      return result;
    },
    close(): void {
      void connection?.close();
    },
  };
}
