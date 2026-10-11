export {};

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  assertRestoreEvidence,
  buildPostgresRestoreConnection,
  rehearseRestore,
  writeRestoreReceiptAtomically,
} from "./restore-rehearsal";
import {
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";
import { collectMinioInventory } from "./minio-inventory";
import {
  collectDatabaseContentFingerprint,
  collectPostgresFingerprints,
} from "./postgres-fingerprint";
import { operationalFailure } from "./operational-errors";
import {
  assertExternalArtifactFile,
  prepareNewExternalOutput,
  revalidateExternalStaging,
} from "./output-boundary";
import {
  validateBackupManifestIntegrity,
  validatePurgeManifestIntegrity,
} from "./manifest-integrity";
import { collectPostgresInventory } from "./postgres-inventory";
import { sourceStateFingerprint } from "./source-state-fingerprint";
import { collectTemporalInventory } from "./temporal-inventory";

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "../../../../..");

function required(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value) throw new Error(`RESTORE_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function createRuntime(sourceDatabaseUrl: string) {
  return {
    sourcePrisma: new PrismaClient({
      adapter: createPostgresAdapter(sourceDatabaseUrl, "public"),
    }),
    minio: createMinioInventoryAdapter(),
    temporal: createTemporalInventoryAdapter(),
  };
}

type RestoreCliDependencies = {
  createRuntime?: typeof createRuntime;
};

export async function run(
  argv = process.argv.slice(2),
  dependencies: RestoreCliDependencies = {},
) {
  if (argv.includes("--execute"))
    throw new Error("DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2");
  const manifestPath = required(argv, "--backup-manifest");
  const sourceManifestPath = required(argv, "--source-manifest");
  const expectedBackupManifestHash = required(
    argv,
    "--expected-backup-manifest-hash",
  );
  const expectedSourceManifestHash = required(
    argv,
    "--expected-source-manifest-hash",
  );
  const dumpFile = required(argv, "--dump");
  const output = required(argv, "--output");
  const targetDatabaseName = required(argv, "--target-db");
  const targetPrefix = required(argv, "--target-prefix");
  const targetNamespace = required(argv, "--target-namespace");
  const sourceDatabaseUrl = process.env.DATABASE_URL;
  if (!sourceDatabaseUrl) throw new Error("POSTGRES_DATABASE_REQUIRED");
  const approvedRoot =
    process.env.DEMO_MAINTENANCE_OUTPUT_ROOT ??
    path.join(os.tmpdir(), "logix-demo-maintenance");
  const outputBoundary = await prepareNewExternalOutput({
    outputPath: output,
    repositoryRoot: root,
    approvedRoot,
  });
  const [backupManifestFile, sourceManifestFile, dumpArtifact] =
    await Promise.all([
      assertExternalArtifactFile({
        artifactPath: manifestPath,
        repositoryRoot: root,
        approvedRoot,
      }),
      assertExternalArtifactFile({
        artifactPath: sourceManifestPath,
        repositoryRoot: root,
        approvedRoot,
      }),
      assertExternalArtifactFile({
        artifactPath: dumpFile,
        repositoryRoot: root,
        approvedRoot,
      }),
    ]);
  const backupManifest = JSON.parse(await readFile(backupManifestFile, "utf8"));
  const sourceManifest = JSON.parse(await readFile(sourceManifestFile, "utf8"));
  const catalog = JSON.parse(
    await readFile(
      path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
      "utf8",
    ),
  );
  await validatePurgeManifestIntegrity({
    manifest: sourceManifest,
    expectedHash: expectedSourceManifestHash,
    expectedTenant: "demo-real-sample-20260921",
    expectedCatalogVersion: catalog.catalogVersion,
    repositoryRoot: root,
  });
  await validateBackupManifestIntegrity({
    manifest: backupManifest,
    expectedHash: expectedBackupManifestHash,
    expectedSourceManifestHash,
    repositoryRoot: root,
  });
  const connection = buildPostgresRestoreConnection(
    sourceDatabaseUrl,
    targetDatabaseName,
  );
  const postgresEnvironment = {
    ...process.env,
    ...connection.environment,
  };
  const { sourcePrisma, minio, temporal } = (
    dependencies.createRuntime ?? createRuntime
  )(sourceDatabaseUrl);
  const catalogTables = Object.values(catalog.models).map(
    (rule) => (rule as { table: string }).table,
  );
  const sourceQuery = async (sql: string, params?: unknown[]) => ({
    rows: (await sourcePrisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
      Record<string, unknown>
    >,
  });
  const sourceDatabaseFingerprintBefore =
    await collectDatabaseContentFingerprint(
      { query: sourceQuery },
      catalogTables,
    );
  const sourceFingerprint = async () => {
    const postgres = await collectPostgresInventory({
      client: { query: sourceQuery },
      catalog,
      tenantId: sourceManifest.targetTenant,
    });
    const fingerprints = await collectPostgresFingerprints({
      query: sourceQuery,
    });
    const batches = (await sourcePrisma.$queryRawUnsafe(
      `SELECT "tenant_id" AS "tenantId", "source_object_key" AS "sourceObjectKey", "file_hash" AS "fileSha256", "source_size_bytes" AS "fileSize" FROM "import_batch" WHERE "source_object_key" IS NOT NULL`,
    )) as Array<{
      tenantId: string;
      sourceObjectKey?: string;
      fileSha256?: string;
      fileSize?: number;
    }>;
    const minioInventory = await collectMinioInventory({
      client: minio,
      batches,
      targetTenant: sourceManifest.targetTenant,
    });
    const temporalInventory = await collectTemporalInventory({
      client: temporal,
      targetTenant: sourceManifest.targetTenant,
    });
    return sourceStateFingerprint({
      postgres,
      fingerprints,
      minio: minioInventory,
      temporal: temporalInventory,
    });
  };
  const sourceFingerprintBefore = await sourceFingerprint();
  let targetCreated = false;
  let targetPrisma:
    | {
        $queryRawUnsafe: (
          sql: string,
          ...params: unknown[]
        ) => Promise<unknown[]>;
        $disconnect: () => Promise<void>;
      }
    | undefined;
  const result = await rehearseRestore({
    target: {
      sourceDatabaseUrl,
      targetDatabaseName,
      sourceBucket:
        process.env.MINIO_BUCKET ?? process.env.IMPORT_SOURCE_BUCKET ?? "",
      targetPrefix,
      sourceNamespace: process.env.TEMPORAL_NAMESPACE ?? "",
      targetNamespace,
    },
    backupManifestHash: expectedBackupManifestHash,
    sourceManifestHash: expectedSourceManifestHash,
    traceId: randomUUID(),
    restore: async () => {
      await execFileAsync(
        process.platform === "win32" ? "createdb.exe" : "createdb",
        [
          ...connection.commandArgs,
          "--maintenance-db",
          "postgres",
          targetDatabaseName,
        ],
        { windowsHide: true, env: postgresEnvironment },
      );
      targetCreated = true;
      await execFileAsync(
        process.platform === "win32" ? "pg_restore.exe" : "pg_restore",
        [
          ...connection.commandArgs,
          "--dbname",
          targetDatabaseName,
          dumpArtifact,
        ],
        { windowsHide: true, env: postgresEnvironment },
      );
    },
    verify: async () => {
      targetPrisma = new PrismaClient({
        adapter: createPostgresAdapter(connection.targetDatabaseUrl, "public"),
      });
      const targetQuery = async (sql: string, params?: unknown[]) => ({
        rows: (await targetPrisma!.$queryRawUnsafe(
          sql,
          ...(params ?? []),
        )) as Array<Record<string, unknown>>,
      });
      const restoredPostgres = await collectPostgresInventory({
        client: { query: targetQuery },
        catalog,
        tenantId: sourceManifest.targetTenant,
      });
      const restoredFingerprints = await collectPostgresFingerprints({
        query: targetQuery,
      });
      const restoredDatabaseFingerprint =
        await collectDatabaseContentFingerprint(
          { query: targetQuery },
          catalogTables,
        );
      for (const entry of sourceManifest.minio.entries as Array<{
        key: string;
        size?: number;
        checksum?: string;
      }>)
        await minio.verifyCopy(entry.key, targetPrefix, entry);
      const restoredTemporal = await collectTemporalInventory({
        client: temporal,
        targetTenant: sourceManifest.targetTenant,
      });
      const { composePurgeManifest } = await import(
        pathToFileURL(path.join(root, "scripts/full-chain-demo/manifest.mjs"))
          .href
      );
      const restoredManifest = composePurgeManifest({
        catalog,
        postgres: restoredPostgres,
        minio: {
          entries: sourceManifest.minio.entries,
          candidateCount: sourceManifest.minio.candidateCount,
        },
        temporal: restoredTemporal,
        context: {
          catalogHash: sourceManifest.catalogHash,
          ...restoredFingerprints,
        },
      });
      const sourceDatabaseFingerprintAfter =
        await collectDatabaseContentFingerprint(
          { query: sourceQuery },
          catalogTables,
        );
      assertRestoreEvidence({
        backupManifest,
        sourceManifest,
        restored: {
          postgres: restoredManifest.postgres,
          minio: restoredManifest.minio,
          temporal: restoredManifest.temporal,
        },
        sourceDatabaseFingerprintBefore,
        restoredDatabaseFingerprint,
        sourceDatabaseFingerprintAfter,
        sourceFingerprintBefore,
        sourceFingerprintAfter: await sourceFingerprint(),
      });
    },
    cleanupDatabase: async () => {
      await targetPrisma?.$disconnect();
      targetPrisma = undefined;
      if (targetCreated)
        await execFileAsync(
          process.platform === "win32" ? "dropdb.exe" : "dropdb",
          [
            ...connection.commandArgs,
            "--maintenance-db",
            "postgres",
            targetDatabaseName,
          ],
          { windowsHide: true, env: postgresEnvironment },
        );
      targetCreated = false;
    },
    cleanupObjectPrefix: async () => {
      const targetKeys = (
        sourceManifest.minio.entries as Array<{ key: string }>
      ).map((entry) => `${targetPrefix.replace(/\/+$/u, "")}/${entry.key}`);
      await minio.deleteKeys(targetKeys);
    },
  });
  try {
    const stored = await writeRestoreReceiptAtomically({
      receipt: result,
      output,
      validateStaging: (staging) =>
        revalidateExternalStaging(outputBoundary, staging),
    });
    console.log(JSON.stringify(stored));
    return stored;
  } finally {
    temporal.close();
    await sourcePrisma.$disconnect();
  }
}

if (require.main === module)
  run().catch((error) => {
    const failure = operationalFailure(
      error,
      "RESTORE_VERIFICATION_FAILED",
      randomUUID(),
    );
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  });
