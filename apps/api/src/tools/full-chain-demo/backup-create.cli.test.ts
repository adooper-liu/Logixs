import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "./backup-create.cli";

const temporaryDirectories: string[] = [];

async function invalidManifestFile(root: string) {
  const file = path.join(root, "source-manifest.json");
  const domain = {
    entries: [],
    count: 0,
    candidateCount: 0,
    hash: "b".repeat(64),
  };
  await writeFile(
    file,
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
  return file;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
  delete process.env.DEMO_MAINTENANCE_OUTPUT_ROOT;
  delete process.env.DATABASE_URL;
});

describe("backup CLI manifest boundary", () => {
  it("rejects a self-asserted source manifest hash before creating runtime clients", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "backup-cli-test-"));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, "external");
    await mkdir(outputRoot);
    const manifest = await invalidManifestFile(outputRoot);
    process.env.DEMO_MAINTENANCE_OUTPUT_ROOT = outputRoot;
    process.env.DATABASE_URL =
      "postgresql://operator:secret@localhost:5433/logix?schema=public";
    const createRuntime = vi.fn();

    await expect(
      run(
        [
          "--source-manifest",
          manifest,
          "--expected-manifest-hash",
          "a".repeat(64),
          "--target-db",
          "logix_rehearsal_1_0123456789abcdef",
          "--target-prefix",
          "rehearsal/backup-cli-test",
          "--target-namespace",
          "rehearsal-backup-cli-test",
          "--output",
          path.join(outputRoot, "run-1"),
        ],
        { createRuntime },
      ),
    ).rejects.toThrow("MANIFEST_HASH_MISMATCH");
    expect(createRuntime).not.toHaveBeenCalled();
  });
});
