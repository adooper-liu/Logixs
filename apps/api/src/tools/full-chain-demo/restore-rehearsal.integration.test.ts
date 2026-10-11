import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import {
  buildRehearsalObjectKey,
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";
import {
  collectDatabaseContentFingerprint,
  collectPostgresFingerprints,
} from "./postgres-fingerprint";
import { collectPostgresInventory } from "./postgres-inventory";
import { assertRestoreEvidence, rehearseRestore } from "./restore-rehearsal";
import { collectTemporalInventory } from "./temporal-inventory";
import {
  createIntegrationPrismaClient,
  databaseUrl,
  REPOSITORY_ROOT,
  withTemporaryDatabase,
} from "./integration-support";

const execFileAsync = promisify(execFile);
const minio = new S3Client({
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "logix", secretAccessKey: "logix-dev-secret" },
});
const bucket = "logix-import-sources";

async function docker(...args: string[]) {
  await execFileAsync("docker", args, { windowsHide: true });
}

async function ensureBucket() {
  try {
    await minio.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await minio.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

describe("restore isolated integration", () => {
  it("restores PostgreSQL and verifies MinIO, Temporal, and source stability before cleaning only its targets", async () => {
    await ensureBucket();
    await withTemporaryDatabase(async ({ databaseName, prisma }) => {
      const run = randomUUID().replaceAll("-", "");
      const targetDatabaseName = `logix_rehearsal_${process.pid}_${run.slice(0, 16)}`;
      const targetPrefix = `rehearsal/restore-${run}`;
      const sourceKey = `rehearsal/source-${run}`;
      const containerDump = `/tmp/demo-restore-${run}.dump`;
      const body = Buffer.from("isolated-restore-fixture", "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");
      const catalog = JSON.parse(
        readFileSync(
          path.join(
            REPOSITORY_ROOT,
            "scripts/full-chain-demo/ownership-catalog.json",
          ),
          "utf8",
        ),
      );
      const catalogTables = Object.values(catalog.models).map(
        (rule) => (rule as { table: string }).table,
      );
      const sourceQuery = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const adapter = createMinioInventoryAdapter();
      const temporal = createTemporalInventoryAdapter();
      const temporalBefore = await collectTemporalInventory({
        client: temporal,
        targetTenant: "demo-real-sample-20260921",
      });
      const sourceDatabaseFingerprintBefore =
        await collectDatabaseContentFingerprint(
          { query: sourceQuery },
          catalogTables,
        );
      const sourcePostgres = await collectPostgresInventory({
        client: { query: sourceQuery },
        catalog,
        tenantId: "demo-real-sample-20260921",
      });
      const sourceFingerprints = await collectPostgresFingerprints({
        query: sourceQuery,
      });
      const sourceFingerprintBefore = createHash("sha256")
        .update(
          JSON.stringify({
            sourcePostgres,
            sourceFingerprints,
            temporalBefore,
          }),
        )
        .digest("hex");
      let targetCreated = false;
      let target:
        | {
            $queryRawUnsafe: (
              sql: string,
              ...params: unknown[]
            ) => Promise<unknown[]>;
            $disconnect: () => Promise<void>;
          }
        | undefined;
      await minio.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: sourceKey,
          Body: body,
          Metadata: { sha256: checksum },
        }),
      );
      await adapter.copyObject(sourceKey, targetPrefix);
      try {
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
        const result = await rehearseRestore({
          target: {
            sourceDatabaseUrl: databaseUrl(databaseName),
            targetDatabaseName,
            sourceBucket: bucket,
            targetPrefix,
            sourceNamespace: "default",
            targetNamespace: `rehearsal-${run}`,
          },
          backupManifestHash: "b".repeat(64),
          sourceManifestHash: "a".repeat(64),
          traceId: "integration-trace",
          restore: async () => {
            await docker(
              "exec",
              "logixs-postgres-1",
              "createdb",
              "-U",
              "logix",
              targetDatabaseName,
            );
            targetCreated = true;
            await docker(
              "exec",
              "logixs-postgres-1",
              "pg_restore",
              "-U",
              "logix",
              "-d",
              targetDatabaseName,
              containerDump,
            );
          },
          verify: async () => {
            target = createIntegrationPrismaClient(targetDatabaseName);
            const targetQuery = async (sql: string, params?: unknown[]) => ({
              rows: (await target!.$queryRawUnsafe(
                sql,
                ...(params ?? []),
              )) as Array<Record<string, unknown>>,
            });
            const restoredDatabaseFingerprint =
              await collectDatabaseContentFingerprint(
                { query: targetQuery },
                catalogTables,
              );
            await adapter.verifyCopy(sourceKey, targetPrefix, {
              key: sourceKey,
              size: body.length,
              checksum,
            });
            const temporalAfter = await collectTemporalInventory({
              client: temporal,
              targetTenant: "demo-real-sample-20260921",
            });
            const sourceDatabaseFingerprintAfter =
              await collectDatabaseContentFingerprint(
                { query: sourceQuery },
                catalogTables,
              );
            const sourcePostgresAfter = await collectPostgresInventory({
              client: { query: sourceQuery },
              catalog,
              tenantId: "demo-real-sample-20260921",
            });
            const sourceFingerprintsAfter = await collectPostgresFingerprints({
              query: sourceQuery,
            });
            const sourceFingerprintAfter = createHash("sha256")
              .update(
                JSON.stringify({
                  sourcePostgres: sourcePostgresAfter,
                  sourceFingerprints: sourceFingerprintsAfter,
                  temporalBefore: temporalAfter,
                }),
              )
              .digest("hex");
            assertRestoreEvidence({
              backupManifest: {
                verified: true,
                sourceManifestHash: "a".repeat(64),
              },
              sourceManifest: {
                manifestHash: "a".repeat(64),
                postgres: {
                  hash: sourceDatabaseFingerprintBefore,
                  candidateCount: sourcePostgres.candidateCount,
                },
                minio: { hash: checksum, candidateCount: 1 },
                temporal: {
                  hash: createHash("sha256")
                    .update(JSON.stringify(temporalBefore.entries))
                    .digest("hex"),
                  candidateCount: temporalBefore.targetCount,
                },
              },
              restored: {
                postgres: {
                  hash: restoredDatabaseFingerprint,
                  candidateCount: sourcePostgres.candidateCount,
                },
                minio: { hash: checksum, candidateCount: 1 },
                temporal: {
                  hash: createHash("sha256")
                    .update(JSON.stringify(temporalAfter.entries))
                    .digest("hex"),
                  candidateCount: temporalAfter.targetCount,
                },
              },
              sourceDatabaseFingerprintBefore,
              restoredDatabaseFingerprint,
              sourceDatabaseFingerprintAfter,
              sourceFingerprintBefore,
              sourceFingerprintAfter,
            });
          },
          cleanupDatabase: async () => {
            await target?.$disconnect();
            target = undefined;
            if (targetCreated) {
              await docker(
                "exec",
                "logixs-postgres-1",
                "dropdb",
                "-U",
                "logix",
                targetDatabaseName,
              );
              targetCreated = false;
            }
          },
          cleanupObjectPrefix: async () => {
            await adapter.deleteKeys([
              buildRehearsalObjectKey(targetPrefix, sourceKey),
            ]);
          },
        });
        expect(result).toMatchObject({
          status: "verified",
          verified: true,
          cleanup: { database: "removed", objectPrefix: "removed" },
        });
        const databases = (await prisma.$queryRawUnsafe(
          "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
          targetDatabaseName,
        )) as Array<{ exists: boolean }>;
        expect(databases[0]?.exists).toBe(false);
      } finally {
        await target?.$disconnect();
        if (targetCreated)
          await docker(
            "exec",
            "logixs-postgres-1",
            "dropdb",
            "-U",
            "logix",
            "--if-exists",
            targetDatabaseName,
          );
        await adapter.deleteKeys([
          buildRehearsalObjectKey(targetPrefix, sourceKey),
        ]);
        await minio.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }),
        );
        temporal.close();
        await docker("exec", "logixs-postgres-1", "rm", "-f", containerDump);
      }
    });
  }, 180_000);
});
