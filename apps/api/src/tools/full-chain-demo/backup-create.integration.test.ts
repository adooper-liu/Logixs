import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { createBackupArtifacts } from "./backup-create";
import {
  assertEmptyRehearsalPrefix,
  buildRehearsalObjectKey,
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";
import { collectTemporalInventory } from "./temporal-inventory";
import { withTemporaryDatabase } from "./integration-support";

const execFileAsync = promisify(execFile);
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
async function docker(...args: string[]) {
  await execFileAsync("docker", args, { windowsHide: true });
}

describe("backup isolated integration", () => {
  it("rejects and preserves objects under a pre-existing rehearsal prefix", async () => {
    await ensureBucket();
    const run = randomUUID().replaceAll("-", "");
    const prefix = `rehearsal/preexisting-${run}`;
    const existingKey = `${prefix}/keep`;
    const adapter = createMinioInventoryAdapter();
    await minio.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: existingKey,
        Body: Buffer.from("keep", "utf8"),
      }),
    );
    try {
      await expect(
        assertEmptyRehearsalPrefix(prefix, (value) =>
          adapter.listPrefix(value),
        ),
      ).rejects.toThrow("BACKUP_TARGET_NOT_ISOLATED");
      await adapter.deleteKeys([]);
      await expect(
        minio.send(new HeadObjectCommand({ Bucket: bucket, Key: existingKey })),
      ).resolves.toBeDefined();
    } finally {
      await minio.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: existingKey }),
      );
    }
  });

  it("creates a real dump, copies an isolated object and keeps Temporal/source stable", async () => {
    await ensureBucket();
    await withTemporaryDatabase(async ({ databaseName, prisma }) => {
      const run = randomUUID().replaceAll("-", "");
      const sourceKey = `rehearsal/source-${run}`;
      const targetPrefix = `rehearsal/backup-${run}`;
      const body = Buffer.from("isolated-backup-fixture", "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");
      await minio.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: sourceKey,
          Body: body,
        }),
      );
      const dir = await mkdtemp(path.join(os.tmpdir(), "demo-backup-it-"));
      const dump = path.join(dir, "postgres.dump");
      const containerDump = `/tmp/demo-backup-${run}.dump`;
      const adapter = createMinioInventoryAdapter();
      const temporal = createTemporalInventoryAdapter();
      const beforeInventory = await collectTemporalInventory({
        client: temporal,
        targetTenant: "demo-real-sample-20260921",
      });
      const sourceFingerprint = async () => {
        const count = await prisma.importBatch.count();
        const currentTemporal = await collectTemporalInventory({
          client: temporal,
          targetTenant: "demo-real-sample-20260921",
        });
        return createHash("sha256")
          .update(JSON.stringify({ count, currentTemporal }))
          .digest("hex");
      };
      const before = await sourceFingerprint();
      try {
        const result = await createBackupArtifacts({
          manifest: {
            manifestHash: "a".repeat(64),
            targetTenant: "demo-real-sample-20260921",
          },
          outputDirectory: dir,
          dumpFile: dump,
          pgDump: async () => {
            await docker(
              "exec",
              "logixs-postgres-1",
              "pg_dump",
              "-U",
              "logix",
              "-d",
              databaseName,
              "-Fc",
              "-f",
              containerDump,
            );
            await docker("cp", `logixs-postgres-1:${containerDump}`, dump);
          },
          verifyDump: async (file) => {
            const copy = `/tmp/demo-verify-${run}.dump`;
            await docker("cp", file, `logixs-postgres-1:${copy}`);
            await docker(
              "exec",
              "logixs-postgres-1",
              "pg_restore",
              "--list",
              copy,
            );
            await docker("exec", "logixs-postgres-1", "rm", "-f", copy);
          },
          minioCount: 1,
          minioHash: checksum,
          copyMinio: async () => {
            await adapter.copyObject(sourceKey, targetPrefix);
            await adapter.verifyCopy(sourceKey, targetPrefix, {
              key: sourceKey,
              size: body.length,
              checksum,
            });
            await minio.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: `${targetPrefix}/${sourceKey}`,
                Body: Buffer.alloc(body.length, 0x42),
                Metadata: { sha256: checksum },
              }),
            );
            await expect(
              adapter.verifyCopy(sourceKey, targetPrefix, {
                key: sourceKey,
                size: body.length,
                checksum,
              }),
            ).rejects.toThrow("MINIO_CHECKSUM_MISMATCH");
            await adapter.copyObject(sourceKey, targetPrefix);
          },
          verifyMinio: async () =>
            adapter.verifyCopy(sourceKey, targetPrefix, {
              key: sourceKey,
              size: body.length,
              checksum,
            }),
          verifyTemporal: async () => {
            const current = await collectTemporalInventory({
              client: temporal,
              targetTenant: "demo-real-sample-20260921",
            });
            expect(current).toEqual(beforeInventory);
          },
          sourceFingerprintBefore: before,
          sourceFingerprintAfter: sourceFingerprint,
        });
        expect(result.verified).toBe(true);
        expect(result.status).toBe("verified");
        expect((await readFile(dump)).length).toBeGreaterThan(0);
      } finally {
        temporal.close();
        await adapter.deleteKeys([
          buildRehearsalObjectKey(targetPrefix, sourceKey),
        ]);
        await minio.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }),
        );
        await docker("exec", "logixs-postgres-1", "rm", "-f", containerDump);
        await rm(dir, { recursive: true, force: true });
      }
    });
  }, 180_000);
});
