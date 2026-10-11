import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertIsolatedRestoreTarget,
  assertRestoreEvidence,
  buildPostgresRestoreConnection,
  rehearseRestore,
  writeRestoreReceiptAtomically,
} from "./restore-rehearsal";

describe("restore target isolation", () => {
  it("derives every PostgreSQL command from the source URL without exposing its password", () => {
    const connection = buildPostgresRestoreConnection(
      "postgresql://operator:s3cret@db.internal:6543/source_db?schema=private",
      "logix_rehearsal_42_0123456789abcdef",
    );

    expect(connection.commandArgs).toEqual([
      "--host",
      "db.internal",
      "--port",
      "6543",
      "--username",
      "operator",
    ]);
    expect(connection.environment).toEqual({ PGPASSWORD: "s3cret" });
    expect(connection.targetDatabaseUrl).toBe(
      "postgresql://operator:s3cret@db.internal:6543/logix_rehearsal_42_0123456789abcdef?schema=private",
    );
    expect(JSON.stringify(connection.commandArgs)).not.toContain("s3cret");
    expect(JSON.stringify(connection.commandArgs)).not.toContain("source_db");
  });

  it("requires restored PostgreSQL, MinIO, Temporal, and source fingerprints to match", () => {
    const expected = {
      backupManifest: {
        verified: true,
        sourceManifestHash: "a".repeat(64),
      },
      sourceManifest: {
        manifestHash: "a".repeat(64),
        postgres: { hash: "postgres", candidateCount: 2 },
        minio: { hash: "minio", candidateCount: 1 },
        temporal: { hash: "temporal", candidateCount: 0 },
      },
      restored: {
        postgres: { hash: "postgres", candidateCount: 2 },
        minio: { hash: "minio", candidateCount: 1 },
        temporal: { hash: "temporal", candidateCount: 0 },
      },
      sourceDatabaseFingerprintBefore: "database",
      restoredDatabaseFingerprint: "database",
      sourceDatabaseFingerprintAfter: "database",
      sourceFingerprintBefore: "source",
      sourceFingerprintAfter: "source",
    };

    expect(() => assertRestoreEvidence(expected)).not.toThrow();
    for (const mismatch of [
      {
        ...expected,
        backupManifest: { ...expected.backupManifest, verified: false },
      },
      {
        ...expected,
        sourceManifest: {
          ...expected.sourceManifest,
          manifestHash: "b".repeat(64),
        },
      },
      {
        ...expected,
        restored: {
          ...expected.restored,
          postgres: { hash: "changed", candidateCount: 2 },
        },
      },
      {
        ...expected,
        restored: {
          ...expected.restored,
          minio: { hash: "changed", candidateCount: 1 },
        },
      },
      {
        ...expected,
        restored: {
          ...expected.restored,
          temporal: { hash: "changed", candidateCount: 0 },
        },
      },
      {
        ...expected,
        restoredDatabaseFingerprint: "changed",
      },
      {
        ...expected,
        sourceDatabaseFingerprintAfter: "changed",
      },
      { ...expected, sourceFingerprintAfter: "changed" },
    ]) {
      expect(() => assertRestoreEvidence(mismatch)).toThrow(
        "RESTORE_VERIFICATION_FAILED",
      );
    }
  });

  it("returns a durable incomplete receipt without letting cleanup hide the primary failure", async () => {
    const cleanupDatabase = vi.fn(async () => undefined);
    const cleanupObjectPrefix = vi.fn(async () => {
      throw new Error("SENTINEL_CLEANUP_PATH");
    });
    const receipt = await rehearseRestore({
      target: {
        sourceDatabaseUrl: "postgresql://host/source",
        targetDatabaseName: "logix_rehearsal_1_0123456789abcdef",
        sourceBucket: "source",
        targetPrefix: "rehearsal/run",
        sourceNamespace: "source",
        targetNamespace: "rehearsal-target",
      },
      backupManifestHash: "a".repeat(64),
      sourceManifestHash: "b".repeat(64),
      traceId: "trace",
      restore: async () => {
        throw new Error("SENTINEL_PASSWORD");
      },
      verify: async () => undefined,
      cleanupDatabase,
      cleanupObjectPrefix,
    });

    expect(receipt).toMatchObject({
      status: "incomplete",
      verified: false,
      errorCode: "RESTORE_VERIFICATION_FAILED",
      cleanup: { database: "removed", objectPrefix: "failed" },
      cleanupErrorCodes: ["RESTORE_CLEANUP_FAILED"],
    });
    expect(JSON.stringify(receipt)).not.toContain("SENTINEL_PASSWORD");
    expect(JSON.stringify(receipt)).not.toContain("SENTINEL_CLEANUP_PATH");
  });

  it("atomically writes a schema-valid hashed restore receipt", async () => {
    const parent = await mkdtemp(
      path.join(os.tmpdir(), "restore-receipt-test-"),
    );
    const output = path.join(parent, "receipt");
    try {
      const receipt = await rehearseRestore({
        target: {
          sourceDatabaseUrl: "postgresql://host/source",
          targetDatabaseName: "logix_rehearsal_1_0123456789abcdef",
          sourceBucket: "source",
          targetPrefix: "rehearsal/run",
          sourceNamespace: "source",
          targetNamespace: "rehearsal-target",
        },
        backupManifestHash: "a".repeat(64),
        sourceManifestHash: "b".repeat(64),
        traceId: "trace",
        restore: async () => undefined,
        verify: async () => undefined,
        cleanupDatabase: async () => undefined,
        cleanupObjectPrefix: async () => undefined,
      });
      const stored = await writeRestoreReceiptAtomically({ receipt, output });
      expect(stored.status).toBe("verified");
      expect(stored.receiptHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(
        JSON.parse(await readFile(path.join(output, "receipt.json"), "utf8")),
      ).toEqual(stored);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("rejects non-rehearsal namespace", () => {
    expect(() =>
      assertIsolatedRestoreTarget({
        sourceDatabaseUrl: "postgresql://host/logix",
        targetDatabaseName: "logix_rehearsal_1_0123456789abcdef",
        sourceBucket: "source",
        targetPrefix: "source",
        sourceNamespace: "source",
        targetNamespace: "target",
      }),
    ).toThrow("RESTORE_TARGET_PREFIX_INVALID");
  });
});
