import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertIsolatedRestoreTarget } from "./backup-create";
import { operationalFailure } from "./operational-errors";

const root = path.resolve(__dirname, "../../../../..");

export function buildPostgresRestoreConnection(
  sourceDatabaseUrl: string,
  targetDatabaseName: string,
) {
  const source = new URL(sourceDatabaseUrl);
  const target = new URL(source);
  target.pathname = `/${targetDatabaseName}`;
  return {
    commandArgs: [
      "--host",
      source.hostname,
      "--port",
      source.port || "5432",
      "--username",
      decodeURIComponent(source.username),
    ],
    environment: source.password
      ? { PGPASSWORD: decodeURIComponent(source.password) }
      : {},
    targetDatabaseUrl: target.toString(),
  };
}

type RestoreDomainEvidence = { hash: string; candidateCount: number };
type RestoreEvidenceInput = {
  backupManifest: { verified: boolean; sourceManifestHash: string };
  sourceManifest: {
    manifestHash: string;
    postgres: RestoreDomainEvidence;
    minio: RestoreDomainEvidence;
    temporal: RestoreDomainEvidence;
  };
  restored: {
    postgres: RestoreDomainEvidence;
    minio: RestoreDomainEvidence;
    temporal: RestoreDomainEvidence;
  };
  sourceDatabaseFingerprintBefore: string;
  restoredDatabaseFingerprint: string;
  sourceDatabaseFingerprintAfter: string;
  sourceFingerprintBefore: string;
  sourceFingerprintAfter: string;
};

export function assertRestoreEvidence(input: RestoreEvidenceInput): void {
  const domains = ["postgres", "minio", "temporal"] as const;
  if (
    !input.backupManifest.verified ||
    input.backupManifest.sourceManifestHash !==
      input.sourceManifest.manifestHash ||
    input.sourceDatabaseFingerprintBefore !==
      input.restoredDatabaseFingerprint ||
    input.sourceDatabaseFingerprintBefore !==
      input.sourceDatabaseFingerprintAfter ||
    input.sourceFingerprintBefore !== input.sourceFingerprintAfter ||
    domains.some(
      (domain) =>
        input.sourceManifest[domain].hash !== input.restored[domain].hash ||
        input.sourceManifest[domain].candidateCount !==
          input.restored[domain].candidateCount,
    )
  )
    throw new Error("RESTORE_VERIFICATION_FAILED");
}

type CleanupStatus = "removed" | "not_created" | "failed";
type RestoreReceipt = {
  receiptVersion: "full-chain-demo-restore-receipt.v1";
  status: "verified" | "incomplete";
  verified: boolean;
  backupManifestHash: string;
  sourceManifestHash: string;
  cleanup: { database: CleanupStatus; objectPrefix: CleanupStatus };
  errorCode?: string;
  cleanupErrorCodes?: string[];
  traceId: string;
  receiptHash: string;
};

async function canonicalHelpers() {
  const { canonicalStringify } = await import(
    pathToFileURL(path.join(root, "scripts/full-chain-demo/canonical-json.mjs"))
      .href
  );
  const { validateRestoreReceipt } = await import(
    pathToFileURL(path.join(root, "scripts/full-chain-demo/contracts.mjs")).href
  );
  return { canonicalStringify, validateRestoreReceipt };
}

async function withReceiptHash(
  receipt: Omit<RestoreReceipt, "receiptHash">,
): Promise<RestoreReceipt> {
  const { canonicalStringify, validateRestoreReceipt } =
    await canonicalHelpers();
  const completed = {
    ...receipt,
    receiptHash: createHash("sha256")
      .update(canonicalStringify(receipt), "utf8")
      .digest("hex"),
  };
  return validateRestoreReceipt(completed) as RestoreReceipt;
}

export async function rehearseRestore(input: {
  target: Parameters<typeof assertIsolatedRestoreTarget>[0];
  backupManifestHash: string;
  sourceManifestHash: string;
  traceId?: string;
  restore: () => Promise<void>;
  verify: () => Promise<void>;
  cleanupDatabase: () => Promise<void>;
  cleanupObjectPrefix: () => Promise<void>;
}) {
  assertIsolatedRestoreTarget(input.target);
  const traceId = input.traceId ?? randomUUID();
  let failureCode: string | undefined;
  try {
    await input.restore();
    await input.verify();
  } catch (error) {
    failureCode = operationalFailure(
      error,
      "RESTORE_VERIFICATION_FAILED",
      traceId,
    ).errorCode;
  }

  let database: CleanupStatus = "removed";
  let objectPrefix: CleanupStatus = "removed";
  const cleanupErrorCodes: string[] = [];
  try {
    await input.cleanupDatabase();
  } catch {
    database = "failed";
    cleanupErrorCodes.push("RESTORE_CLEANUP_FAILED");
  }
  try {
    await input.cleanupObjectPrefix();
  } catch {
    objectPrefix = "failed";
    cleanupErrorCodes.push("RESTORE_CLEANUP_FAILED");
  }

  const verified =
    !failureCode && database === "removed" && objectPrefix === "removed";
  return withReceiptHash({
    receiptVersion: "full-chain-demo-restore-receipt.v1",
    status: verified ? "verified" : "incomplete",
    verified,
    backupManifestHash: input.backupManifestHash,
    sourceManifestHash: input.sourceManifestHash,
    cleanup: { database, objectPrefix },
    ...(verified ? {} : { errorCode: failureCode ?? "RESTORE_CLEANUP_FAILED" }),
    ...(cleanupErrorCodes.length
      ? { cleanupErrorCodes: [...new Set(cleanupErrorCodes)] }
      : {}),
    traceId,
  });
}

export async function writeRestoreReceiptAtomically(input: {
  receipt: RestoreReceipt;
  output: string;
  fsOps?: Partial<typeof fs>;
  validateStaging?: (stagingPath: string) => Promise<void>;
}) {
  const { canonicalStringify, validateRestoreReceipt } =
    await canonicalHelpers();
  validateRestoreReceipt(input.receipt);
  const fsx = { ...fs, ...input.fsOps };
  try {
    await fsx.access(input.output);
    throw new Error("RESTORE_OUTPUT_EXISTS");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  const staging = path.join(
    path.dirname(input.output),
    `.${path.basename(input.output)}.${randomUUID()}.staging`,
  );
  await fsx.mkdir(staging, { recursive: true });
  try {
    await fsx.writeFile(
      path.join(staging, "receipt.json"),
      `${canonicalStringify(input.receipt)}\n`,
      "utf8",
    );
    await input.validateStaging?.(staging);
    await fsx.rename(staging, input.output);
    return input.receipt;
  } catch (error) {
    await fsx.rm(staging, { recursive: true, force: true });
    throw error;
  }
}
export { assertIsolatedRestoreTarget };
