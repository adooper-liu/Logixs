import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertIsolatedRestoreTarget,
  createBackupArtifacts,
  writeBackupResultAtomically,
} from "./backup-create";

describe("backup target isolation", () => {
  it("rejects source reuse and accepts only rehearsal targets", () => {
    expect(() =>
      assertIsolatedRestoreTarget({
        sourceDatabaseUrl: "postgresql://host/source",
        targetDatabaseName: "logix",
        sourceBucket: "source",
        targetPrefix: "rehearsal/a",
        sourceNamespace: "source",
        targetNamespace: "target",
      }),
    ).toThrow("RESTORE_TARGET_NAME_INVALID");
    expect(() =>
      assertIsolatedRestoreTarget({
        sourceDatabaseUrl:
          "postgresql://host/logix_rehearsal_1_0123456789abcdef",
        targetDatabaseName: "logix_rehearsal_1_0123456789abcdef",
        sourceBucket: "source",
        targetPrefix: "rehearsal/a",
        sourceNamespace: "source",
        targetNamespace: "target",
      }),
    ).toThrow("RESTORE_TARGET_REUSES_SOURCE_DB");
  });

  it("reports incomplete when any mandatory backup evidence is missing or drifts", async () => {
    const parent = await mkdtemp(
      path.join(os.tmpdir(), "backup-evidence-test-"),
    );
    const dumpFile = path.join(parent, "postgres.dump");
    const base = {
      manifest: {
        manifestHash: "a".repeat(64),
        targetTenant: "demo-real-sample-20260921",
      },
      outputDirectory: parent,
      dumpFile,
      pgDump: async () => writeFile(dumpFile, "dump"),
      verifyDump: async () => undefined,
      minioCount: 1,
      minioHash: "b".repeat(64),
      copyMinio: async () => undefined,
      verifyMinio: async () => undefined,
      verifyTemporal: async () => undefined,
      sourceFingerprintBefore: "stable",
      sourceFingerprintAfter: async () => "stable",
    };
    try {
      const cases = [
        { name: "missing copy", value: { ...base, copyMinio: undefined } },
        {
          name: "empty dump",
          value: { ...base, pgDump: async () => writeFile(dumpFile, "") },
        },
        {
          name: "copy failure",
          value: {
            ...base,
            copyMinio: async () => {
              throw new Error("MINIO_COPY_FAILED");
            },
          },
        },
        {
          name: "checksum mismatch",
          value: {
            ...base,
            verifyMinio: async () => {
              throw new Error("MINIO_CHECKSUM_MISMATCH");
            },
          },
        },
        {
          name: "Temporal drift",
          value: {
            ...base,
            verifyTemporal: async () => {
              throw new Error("TEMPORAL_INVENTORY_CHANGED");
            },
          },
        },
        {
          name: "source drift",
          value: { ...base, sourceFingerprintAfter: async () => "changed" },
        },
      ];
      for (const item of cases) {
        const result = await createBackupArtifacts(item.value);
        expect(result.status, item.name).toBe("incomplete");
        expect(result.verified, item.name).toBe(false);
      }
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("atomically writes validated backup result and cleans only its staging on failure", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "backup-result-test-"));
    const outputDirectory = path.join(parent, "backup");
    const unrelated = path.join(parent, "unrelated.keep");
    await writeFile(unrelated, "keep", "utf8");
    const result = {
      manifestVersion: "full-chain-demo-backup-manifest.v1",
      targetTenant: "demo-real-sample-20260921",
      sourceManifestHash: "a".repeat(64),
      backupDirectory: "backup",
      postgres: {
        file: "postgres.dump",
        size: 1,
        sha256: "b".repeat(64),
      },
      minio: { count: 0, hash: "c".repeat(64) },
      temporal: { freezeRequired: true },
      verified: true,
      status: "verified" as const,
    };
    try {
      const receipt = await writeBackupResultAtomically({
        result,
        outputDirectory,
      });
      expect(receipt).toMatchObject({
        result: "verified",
        verified: true,
        backupManifestHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      expect(
        JSON.parse(
          await readFile(
            path.join(outputDirectory, "backup-manifest.json"),
            "utf8",
          ),
        ),
      ).toEqual({ ...result, backupManifestHash: receipt.backupManifestHash });
      expect(
        JSON.parse(
          await readFile(path.join(outputDirectory, "receipt.json"), "utf8"),
        ),
      ).toEqual(receipt);

      const failedOutput = path.join(parent, "failed-backup");
      await expect(
        writeBackupResultAtomically({
          result,
          outputDirectory: failedOutput,
          fsOps: {
            rename: async () => {
              throw new Error("INJECTED_RENAME_FAILURE");
            },
          },
        }),
      ).rejects.toThrow("INJECTED_RENAME_FAILURE");
      expect(await readFile(unrelated, "utf8")).toBe("keep");
      expect(
        (await readdir(parent)).filter((entry) => entry.endsWith(".staging")),
      ).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
