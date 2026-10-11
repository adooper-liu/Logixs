import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { operationalFailure } from "./operational-errors";

const root = path.resolve(__dirname, "../../../../..");

type BackupResult = Awaited<ReturnType<typeof createBackupArtifacts>>;

export async function writeBackupResultAtomically(input: {
  result: BackupResult;
  outputDirectory: string;
  artifactDirectory?: string;
  fsOps?: Partial<typeof fs>;
  validateStaging?: (stagingPath: string) => Promise<void>;
}) {
  const { validateBackupManifest } = await import(
    pathToFileURL(path.join(root, "scripts/full-chain-demo/contracts.mjs")).href
  );
  const { canonicalStringify } = await import(
    pathToFileURL(path.join(root, "scripts/full-chain-demo/canonical-json.mjs"))
      .href
  );
  const publishedResult = {
    ...input.result,
    backupManifestHash: createHash("sha256")
      .update(canonicalStringify(input.result), "utf8")
      .digest("hex"),
  };
  validateBackupManifest(publishedResult);
  const fsx = { ...fs, ...input.fsOps };
  try {
    await fsx.access(input.outputDirectory);
    throw new Error("BACKUP_OUTPUT_EXISTS");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  const artifactDirectory =
    input.artifactDirectory ??
    path.join(
      path.dirname(input.outputDirectory),
      `.${path.basename(input.outputDirectory)}.${randomUUID()}.staging`,
    );
  await fsx.mkdir(artifactDirectory, { recursive: true });
  const receipt = {
    result: publishedResult.status,
    verified: publishedResult.verified,
    backupManifestHash: publishedResult.backupManifestHash,
    ...("errorCode" in publishedResult
      ? { errorCode: publishedResult.errorCode }
      : {}),
  };
  try {
    await fsx.writeFile(
      path.join(artifactDirectory, "backup-manifest.json"),
      `${canonicalStringify(publishedResult)}\n`,
      "utf8",
    );
    await fsx.writeFile(
      path.join(artifactDirectory, "receipt.json"),
      `${canonicalStringify(receipt)}\n`,
      "utf8",
    );
    await input.validateStaging?.(artifactDirectory);
    await fsx.rename(artifactDirectory, input.outputDirectory);
    return receipt;
  } catch (error) {
    await fsx.rm(artifactDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function assertIsolatedRestoreTarget(input: {
  sourceDatabaseUrl: string;
  targetDatabaseName: string;
  sourceBucket: string;
  targetPrefix: string;
  sourceNamespace: string;
  targetNamespace: string;
  existingTargetObjectCount?: number;
  createdResources?: string[];
}) {
  if (input.sourceDatabaseUrl.includes(input.targetDatabaseName))
    throw new Error("RESTORE_TARGET_REUSES_SOURCE_DB");
  if (!/^logix_rehearsal_[0-9]+_[0-9a-f]{16}$/u.test(input.targetDatabaseName))
    throw new Error("RESTORE_TARGET_NAME_INVALID");
  if ((input.existingTargetObjectCount ?? 0) !== 0)
    throw new Error("RESTORE_TARGET_NOT_EMPTY");
  if (!input.targetPrefix.startsWith("rehearsal/"))
    throw new Error("RESTORE_TARGET_PREFIX_INVALID");
  if (input.sourceBucket === input.targetPrefix)
    throw new Error("RESTORE_TARGET_REUSES_SOURCE_BUCKET");
  if (input.sourceNamespace === input.targetNamespace)
    throw new Error("RESTORE_TARGET_REUSES_SOURCE_NAMESPACE");
  if (
    (input.createdResources ?? []).some(
      (resource) => !resource.startsWith("rehearsal/"),
    )
  )
    throw new Error("RESTORE_CLEANUP_SCOPE_INVALID");
}
export async function createBackupArtifacts(input: {
  manifest: { manifestHash: string; targetTenant: string };
  outputDirectory: string;
  dumpFile: string;
  pgDump: (args: string[]) => Promise<void>;
  verifyDump: (file: string) => Promise<void>;
  minioCount?: number;
  minioHash?: string;
  copyMinio?: () => Promise<void>;
  verifyMinio?: () => Promise<void>;
  verifyTemporal?: () => Promise<void>;
  sourceFingerprintBefore?: string;
  sourceFingerprintAfter?: () => Promise<string>;
  cleanup?: () => Promise<void>;
  traceId?: string;
}) {
  if (input.manifest.targetTenant !== "demo-real-sample-20260921")
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  const base = {
    manifestVersion: "full-chain-demo-backup-manifest.v1",
    targetTenant: input.manifest.targetTenant,
    sourceManifestHash: input.manifest.manifestHash,
    backupDirectory: path.basename(input.outputDirectory),
    postgres: {
      file: path.basename(input.dumpFile),
      size: 0,
      sha256: createHash("sha256").update("").digest("hex"),
    },
    minio: {
      count: input.minioCount ?? 0,
      hash: input.minioHash ?? createHash("sha256").update("").digest("hex"),
    },
    temporal: { freezeRequired: true },
    verified: false,
  };
  try {
    if (
      !input.copyMinio ||
      !input.verifyMinio ||
      !input.verifyTemporal ||
      !input.sourceFingerprintBefore ||
      !input.sourceFingerprintAfter
    )
      throw new Error("BACKUP_VERIFICATION_REQUIRED");
    await input.pgDump(["--format=custom", "--file", input.dumpFile]);
    await input.verifyDump(input.dumpFile);
    const file = await stat(input.dumpFile);
    if (file.size === 0) throw new Error("BACKUP_DUMP_EMPTY");
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(input.dumpFile);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    await input.copyMinio();
    await input.verifyMinio();
    await input.verifyTemporal();
    if (
      input.sourceFingerprintBefore !== (await input.sourceFingerprintAfter())
    )
      throw new Error("BACKUP_SOURCE_CHANGED");
    return {
      ...base,
      postgres: {
        file: path.basename(input.dumpFile),
        size: file.size,
        sha256: hash.digest("hex"),
      },
      verified: true,
      status: "verified" as const,
    };
  } catch (error) {
    await input.cleanup?.();
    const failure = operationalFailure(
      error,
      "BACKUP_VERIFICATION_FAILED",
      input.traceId ?? randomUUID(),
    );
    return {
      ...base,
      status: "incomplete" as const,
      errorCode: failure.errorCode,
      traceId: failure.traceId,
    };
  }
}
