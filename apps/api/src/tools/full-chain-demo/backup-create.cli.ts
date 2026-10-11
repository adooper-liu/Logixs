export {};

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  assertIsolatedRestoreTarget,
  createBackupArtifacts,
  writeBackupResultAtomically,
} from "./backup-create";
import {
  assertEmptyRehearsalPrefix,
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "./external-adapters";
import os from "node:os";
import { validatePurgeManifestIntegrity } from "./manifest-integrity";
import { operationalFailure } from "./operational-errors";
import {
  assertExternalArtifactFile,
  prepareNewExternalOutput,
  revalidateExternalStaging,
} from "./output-boundary";
import { buildPostgresRestoreConnection } from "./restore-rehearsal";
import { collectTemporalInventory } from "./temporal-inventory";
import { collectMinioInventory } from "./minio-inventory";
import { collectPostgresFingerprints } from "./postgres-fingerprint";
import { collectPostgresInventory } from "./postgres-inventory";
import { sourceStateFingerprint } from "./source-state-fingerprint";

const execFileAsync = promisify(execFile);

function required(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value) throw new Error(`BACKUP_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function createRuntime(sourceDatabaseUrl: string) {
  return {
    minio: createMinioInventoryAdapter(),
    temporal: createTemporalInventoryAdapter(),
    prisma: new PrismaClient({
      adapter: createPostgresAdapter(sourceDatabaseUrl, "public"),
    }),
  };
}

type BackupCliDependencies = {
  createRuntime?: typeof createRuntime;
};

export async function run(
  argv = process.argv.slice(2),
  dependencies: BackupCliDependencies = {},
) {
  if (argv.includes("--execute"))
    throw new Error("DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2");
  const manifestPath = required(argv, "--source-manifest");
  const expectedManifestHash = required(argv, "--expected-manifest-hash");
  const targetDatabaseName = required(argv, "--target-db");
  const targetPrefix = required(argv, "--target-prefix");
  const targetNamespace = required(argv, "--target-namespace");
  const outputDirectory = required(argv, "--output");
  const repositoryRoot = path.resolve(__dirname, "../../../../..");
  const approvedRoot =
    process.env.DEMO_MAINTENANCE_OUTPUT_ROOT ??
    path.join(os.tmpdir(), "logix-demo-maintenance");
  const outputBoundary = await prepareNewExternalOutput({
    outputPath: outputDirectory,
    repositoryRoot,
    approvedRoot,
  });
  const sourceManifestFile = await assertExternalArtifactFile({
    artifactPath: manifestPath,
    repositoryRoot,
    approvedRoot,
  });
  const sourceDatabaseUrl = process.env.DATABASE_URL;
  if (!sourceDatabaseUrl) throw new Error("POSTGRES_DATABASE_REQUIRED");
  const sourceUrl = new URL(sourceDatabaseUrl);
  const postgresConnection = buildPostgresRestoreConnection(
    sourceDatabaseUrl,
    sourceUrl.pathname.replace(/^\//u, ""),
  );
  const postgresEnvironment = {
    ...process.env,
    ...postgresConnection.environment,
  };
  assertIsolatedRestoreTarget({
    sourceDatabaseUrl,
    targetDatabaseName,
    sourceBucket:
      process.env.MINIO_BUCKET ?? process.env.IMPORT_SOURCE_BUCKET ?? "",
    targetPrefix,
    sourceNamespace: process.env.TEMPORAL_NAMESPACE ?? "",
    targetNamespace,
  });
  const manifest = JSON.parse(await readFile(sourceManifestFile, "utf8"));
  const catalog = JSON.parse(
    await readFile(
      path.join(
        __dirname,
        "../../../../..",
        "scripts/full-chain-demo/ownership-catalog.json",
      ),
      "utf8",
    ),
  );
  await validatePurgeManifestIntegrity({
    manifest,
    expectedHash: expectedManifestHash,
    expectedTenant: "demo-real-sample-20260921",
    expectedCatalogVersion: catalog.catalogVersion,
    repositoryRoot,
  });
  try {
    await access(outputDirectory);
    throw new Error("BACKUP_OUTPUT_EXISTS");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  const stagingDirectory = path.join(
    path.dirname(outputDirectory),
    `.${path.basename(outputDirectory)}.${randomUUID()}.staging`,
  );
  await mkdir(stagingDirectory, { recursive: true });
  const { minio, temporal, prisma } = (
    dependencies.createRuntime ?? createRuntime
  )(sourceDatabaseUrl);
  await assertEmptyRehearsalPrefix(targetPrefix, (prefix) =>
    minio.listPrefix(prefix),
  );
  const createdObjectKeys: string[] = [];
  const collectSourceState = async () => {
    const query = async (sql: string, params?: unknown[]) => ({
      rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
        Record<string, unknown>
      >,
    });
    const postgres = await collectPostgresInventory({
      client: { query },
      catalog,
      tenantId: manifest.targetTenant,
    });
    const fingerprints = await collectPostgresFingerprints({ query });
    const batches = (await prisma.$queryRawUnsafe(
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
      targetTenant: manifest.targetTenant,
    });
    const temporalInventory = await collectTemporalInventory({
      client: temporal,
      targetTenant: manifest.targetTenant,
    });
    return { postgres, fingerprints, minioInventory, temporalInventory };
  };
  const sourceFingerprint = async () => {
    const state = await collectSourceState();
    return sourceStateFingerprint({
      postgres: state.postgres,
      fingerprints: state.fingerprints,
      minio: state.minioInventory,
      temporal: state.temporalInventory,
    });
  };
  const initialState = await collectSourceState();
  const { composePurgeManifest, compareManifestState } = await import(
    pathToFileURL(
      path.join(repositoryRoot, "scripts/full-chain-demo/manifest.mjs"),
    ).href
  );
  const currentManifest = composePurgeManifest({
    catalog,
    postgres: initialState.postgres,
    minio: initialState.minioInventory,
    temporal: initialState.temporalInventory,
    context: {
      catalogHash: manifest.catalogHash,
      ...initialState.fingerprints,
    },
  });
  if (compareManifestState(manifest, currentManifest).length)
    throw new Error("MANIFEST_STALE");
  const sourceFingerprintBefore = sourceStateFingerprint({
    postgres: initialState.postgres,
    fingerprints: initialState.fingerprints,
    minio: initialState.minioInventory,
    temporal: initialState.temporalInventory,
  });
  const dumpFile = path.join(stagingDirectory, "postgres.dump");
  const result = await createBackupArtifacts({
    manifest,
    outputDirectory,
    dumpFile,
    pgDump: async (args) => {
      const safeArgs = args.map((value) =>
        value === dumpFile ? path.basename(dumpFile) : value,
      );
      await execFileAsync(
        process.platform === "win32" ? "pg_dump.exe" : "pg_dump",
        [
          ...postgresConnection.commandArgs,
          "--dbname",
          sourceUrl.pathname.replace(/^\//u, ""),
          ...safeArgs,
        ],
        {
          cwd: stagingDirectory,
          windowsHide: true,
          env: postgresEnvironment,
        },
      );
    },
    verifyDump: async (file) => {
      await execFileAsync(
        process.platform === "win32" ? "pg_restore.exe" : "pg_restore",
        ["--list", path.basename(file)],
        { cwd: stagingDirectory, windowsHide: true },
      );
    },
    minioCount: manifest.minio.count,
    minioHash: manifest.minio.hash,
    copyMinio: async () => {
      for (const entry of manifest.minio.entries as Array<{ key: string }>)
        createdObjectKeys.push(await minio.copyObject(entry.key, targetPrefix));
    },
    verifyMinio: async () => {
      for (const entry of manifest.minio.entries as Array<{
        key: string;
        size?: number;
        checksum?: string;
      }>)
        await minio.verifyCopy(entry.key, targetPrefix, entry);
    },
    verifyTemporal: async () => {
      const inventory = await collectTemporalInventory({
        client: temporal,
        targetTenant: manifest.targetTenant,
      });
      if (
        JSON.stringify(inventory.entries) !==
        JSON.stringify(manifest.temporal.entries)
      )
        throw new Error("TEMPORAL_INVENTORY_CHANGED");
    },
    sourceFingerprintBefore,
    sourceFingerprintAfter: sourceFingerprint,
    cleanup: async () => {
      await minio.deleteKeys(createdObjectKeys);
      await rm(stagingDirectory, { recursive: true, force: true });
    },
  });
  try {
    const receipt = await writeBackupResultAtomically({
      result,
      outputDirectory,
      artifactDirectory: stagingDirectory,
      validateStaging: (staging) =>
        revalidateExternalStaging(outputBoundary, staging),
    });
    console.log(JSON.stringify(receipt));
  } finally {
    temporal.close();
    await prisma.$disconnect();
  }
}

if (require.main === module)
  run().catch((error) => {
    const failure = operationalFailure(
      error,
      "BACKUP_VERIFICATION_FAILED",
      randomUUID(),
    );
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  });
