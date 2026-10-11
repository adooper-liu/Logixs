import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "./restore-rehearsal.cli";

const roots: string[] = [];
const domain = {
  entries: [],
  count: 0,
  candidateCount: 0,
  hash: "b".repeat(64),
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
  delete process.env.DEMO_MAINTENANCE_OUTPUT_ROOT;
  delete process.env.DATABASE_URL;
});

describe("restore CLI manifest boundary", () => {
  it("rejects a self-asserted source manifest before creating runtime clients", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "restore-cli-test-"));
    roots.push(parent);
    const approvedRoot = path.join(parent, "external");
    await mkdir(approvedRoot);
    process.env.DEMO_MAINTENANCE_OUTPUT_ROOT = approvedRoot;
    process.env.DATABASE_URL =
      "postgresql://operator:SENTINEL_PASSWORD@localhost:5433/logix?schema=public";
    const source = path.join(approvedRoot, "source.json");
    const backup = path.join(approvedRoot, "backup.json");
    const dump = path.join(approvedRoot, "postgres.dump");
    await writeFile(
      source,
      JSON.stringify({
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
        deletable: false,
        manifestHash: "a".repeat(64),
        allowedProof: [],
        prohibitedProof: [],
      }),
      "utf8",
    );
    await writeFile(backup, "{}", "utf8");
    await writeFile(dump, "dump", "utf8");
    const createRuntime = vi.fn();

    await expect(
      run(
        [
          "--backup-manifest",
          backup,
          "--expected-backup-manifest-hash",
          "d".repeat(64),
          "--source-manifest",
          source,
          "--expected-source-manifest-hash",
          "a".repeat(64),
          "--dump",
          dump,
          "--output",
          path.join(approvedRoot, "receipt"),
          "--target-db",
          "logix_rehearsal_1_0123456789abcdef",
          "--target-prefix",
          "rehearsal/restore-cli",
          "--target-namespace",
          "rehearsal-restore-cli",
        ],
        { createRuntime },
      ),
    ).rejects.toThrow("MANIFEST_HASH_MISMATCH");
    expect(createRuntime).not.toHaveBeenCalled();
  });
});
