import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manifestStaleError, run } from "./purge-dry-run.cli";

const runtimeRequire = createRequire(__filename);
const tsxCli = runtimeRequire.resolve("tsx/cli");
const temporaryDirectories: string[] = [];
const emptyDomain = {
  entries: [],
  count: 0,
  candidateCount: 0,
  hash: "b".repeat(64),
};
const validManifestShape = {
  manifestVersion: "full-chain-demo-purge-manifest.v1",
  targetTenant: "demo-real-sample-20260921",
  catalogVersion: "full-chain-demo-ownership.v1",
  catalogHash: "c".repeat(64),
  schemaFingerprint: "schema",
  migrationFingerprint: "migration",
  postgres: emptyDomain,
  minio: emptyDomain,
  temporal: emptyDomain,
  blockers: emptyDomain,
  deletable: false,
  manifestHash: "a".repeat(64),
  allowedProof: [],
  prohibitedProof: [],
};

async function manifestFile(overrides: Record<string, unknown> = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "purge-cli-test-"));
  temporaryDirectories.push(directory);
  process.env.DEMO_MAINTENANCE_OUTPUT_ROOT = directory;
  const file = path.join(directory, "manifest.json");
  await writeFile(
    file,
    JSON.stringify({ ...validManifestShape, ...overrides }),
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
});

describe("purge dry-run CLI boundary", () => {
  it.each([
    {
      argv: ["--execute"],
      code: "DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2",
    },
    {
      argv: ["--tenant", "other"],
      code: "DEMO_MAINTENANCE_TENANT_DENIED",
    },
    {
      argv: ["--tenant", "demo-real-sample-20260921"],
      code: "PURGE_MANIFEST_INPUT_REQUIRED",
    },
  ])("rejects $code before client creation", async ({ argv, code }) => {
    const createClients = vi.fn();

    await expect(run(argv, { createClients })).rejects.toThrow(code);
    expect(createClients).not.toHaveBeenCalled();
  });

  it.each([
    {
      override: {},
      expectedHash: "d".repeat(64),
      expectedCode: "MANIFEST_HASH_MISMATCH",
      label: "hash mismatch",
    },
    {
      override: { deletable: true },
      expectedHash: "a".repeat(64),
      expectedCode: "MANIFEST_INVALID",
      label: "deletable manifest",
    },
  ])(
    "rejects $label before client creation",
    async ({ override, expectedHash, expectedCode }) => {
      const createClients = vi.fn();
      const file = await manifestFile(override);

      await expect(
        run(
          [
            "--tenant",
            "demo-real-sample-20260921",
            "--manifest",
            file,
            "--expected-manifest-hash",
            expectedHash,
          ],
          { createClients },
        ),
      ).rejects.toThrow(expectedCode);
      expect(createClients).not.toHaveBeenCalled();
    },
  );

  it("reports only stable stale difference codes", () => {
    const error = manifestStaleError([
      { code: "MANIFEST_POSTGRES_CHANGED", leakedId: "secret-row" },
      { code: "MANIFEST_HASH_CHANGED", path: "secret-path" },
    ]);

    expect(error.message).toBe(
      "MANIFEST_STALE:MANIFEST_POSTGRES_CHANGED,MANIFEST_HASH_CHANGED",
    );
    expect(error.message).not.toContain("secret-row");
    expect(error.message).not.toContain("secret-path");
  });

  it("loads through the explicit tsx CLI and rejects execute within five seconds", () => {
    const result = spawnSync(
      process.execPath,
      [tsxCli, path.resolve(__dirname, "purge-dry-run.cli.ts"), "--execute"],
      { encoding: "utf8", timeout: 5_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2",
    );
  });
});
