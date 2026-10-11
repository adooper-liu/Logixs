import assert from "node:assert/strict";
import test from "node:test";
import { validatePurgeManifest, validateRestoreReceipt } from "./contracts.mjs";

const domain = {
  entries: [],
  count: 0,
  candidateCount: 0,
  hash: "a".repeat(64),
};
const manifest = {
  manifestVersion: "full-chain-demo-purge-manifest.v1",
  targetTenant: "demo-real-sample-20260921",
  catalogVersion: "v1",
  catalogHash: "a".repeat(64),
  schemaFingerprint: "schema",
  migrationFingerprint: "migration",
  postgres: domain,
  minio: domain,
  temporal: domain,
  blockers: domain,
  deletable: false,
  manifestHash: "b".repeat(64),
  allowedProof: ["demo ownership inventory"],
  prohibitedProof: ["deletion authorization"],
};

test("purge manifest contract is deterministic and deletion-disabled", () => {
  assert.equal(validatePurgeManifest(manifest), manifest);
  assert.throws(
    () => validatePurgeManifest({ ...manifest, deletable: true }),
    /PURGE_MANIFEST_INVALID/,
  );
  assert.throws(
    () => validatePurgeManifest({ ...manifest, unknown: "x" }),
    /PURGE_MANIFEST_INVALID/,
  );
});

test("restore receipt ties verified status to successful cleanup", () => {
  const receipt = {
    receiptVersion: "full-chain-demo-restore-receipt.v1",
    status: "verified",
    verified: true,
    backupManifestHash: "a".repeat(64),
    sourceManifestHash: "b".repeat(64),
    cleanup: { database: "removed", objectPrefix: "removed" },
    traceId: "trace",
    receiptHash: "c".repeat(64),
  };
  assert.equal(validateRestoreReceipt(receipt), receipt);
  assert.throws(
    () =>
      validateRestoreReceipt({
        ...receipt,
        verified: false,
      }),
    /RESTORE_RECEIPT_INVALID/,
  );
  assert.throws(
    () =>
      validateRestoreReceipt({
        ...receipt,
        cleanup: { database: "failed", objectPrefix: "removed" },
      }),
    /RESTORE_RECEIPT_INVALID/,
  );
  assert.doesNotThrow(() =>
    validateRestoreReceipt({
      ...receipt,
      status: "incomplete",
      verified: false,
      cleanup: { database: "failed", objectPrefix: "removed" },
      errorCode: "RESTORE_VERIFICATION_FAILED",
      cleanupErrorCodes: ["RESTORE_CLEANUP_FAILED"],
    }),
  );
});
