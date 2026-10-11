import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateBackupManifestIntegrity,
  validatePurgeManifestIntegrity,
} from "./manifest-integrity";

const root = path.resolve(__dirname, "../../../../..");
const hash = "a".repeat(64);
const domain = {
  entries: [],
  count: 0,
  candidateCount: 0,
  hash: "b".repeat(64),
};
const base = {
  manifestVersion: "full-chain-demo-purge-manifest.v1",
  targetTenant: "demo-real-sample-20260921",
  catalogVersion: "full-chain-demo-ownership.v1",
  catalogHash: "c".repeat(64),
  schemaFingerprint: "schema",
  migrationFingerprint: "migration",
  postgres: domain,
  minio: domain,
  temporal: domain,
  blockers: domain,
  deletable: false as const,
  manifestHash: hash,
  allowedProof: [],
  prohibitedProof: [],
};

describe("purge manifest integrity", () => {
  it("rejects schema-invalid, tampered, wrong-tenant, and wrong-version inputs", async () => {
    for (const manifest of [
      { ...base, targetTenant: "other" },
      { ...base, catalogVersion: "other" },
      { ...base, deletable: true },
      { ...base, unknown: "field" },
    ]) {
      await expect(
        validatePurgeManifestIntegrity({
          manifest,
          expectedHash: hash,
          expectedTenant: "demo-real-sample-20260921",
          expectedCatalogVersion: "full-chain-demo-ownership.v1",
          repositoryRoot: root,
        }),
      ).rejects.toThrow(/MANIFEST_INVALID|MANIFEST_HASH_MISMATCH/u);
    }
  });

  it("rejects a self-asserted hash that does not match the canonical projection", async () => {
    await expect(
      validatePurgeManifestIntegrity({
        manifest: base,
        expectedHash: hash,
        expectedTenant: "demo-real-sample-20260921",
        expectedCatalogVersion: "full-chain-demo-ownership.v1",
        repositoryRoot: root,
      }),
    ).rejects.toThrow("MANIFEST_HASH_MISMATCH");
  });

  it("rejects a backup manifest that only self-asserts verified", async () => {
    await expect(
      validateBackupManifestIntegrity({
        manifest: {
          manifestVersion: "full-chain-demo-backup-manifest.v1",
          targetTenant: "demo-real-sample-20260921",
          sourceManifestHash: "a".repeat(64),
          backupManifestHash: "b".repeat(64),
          backupDirectory: "backup",
          postgres: { file: "dump", size: 1, sha256: "c".repeat(64) },
          minio: { count: 0, hash: "d".repeat(64) },
          temporal: { freezeRequired: true },
          verified: true,
          status: "verified",
        },
        expectedHash: "b".repeat(64),
        expectedSourceManifestHash: "a".repeat(64),
        repositoryRoot: root,
      }),
    ).rejects.toThrow("MANIFEST_HASH_MISMATCH");
  });
});
