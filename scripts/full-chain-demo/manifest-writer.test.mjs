import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { composePurgeManifest } from "./manifest.mjs";
import { writeManifestAtomically } from "./manifest-writer.mjs";

function manifest() {
  return composePurgeManifest({
    catalog: {
      catalogVersion: "full-chain-demo-ownership.v1",
      targetTenant: "demo-real-sample-20260921",
      models: {},
    },
    postgres: {
      entries: [{ model: "Product", primaryKeys: ["controlled-id"] }],
      candidateCount: 1,
    },
    context: {
      catalogHash: "a".repeat(64),
      schemaFingerprint: "schema",
      migrationFingerprint: "migration",
      generatedAt: "2026-10-11T00:00:00.000Z",
      traceId: "trace",
    },
  });
}

async function stagingEntries(parent, output) {
  const prefix = `.${path.basename(output)}.`;
  return (await fs.readdir(parent)).filter(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".staging"),
  );
}

test("manifest writer creates a new output only", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "demo-manifest-"));
  const output = path.join(parent, "manifest");
  try {
    await writeManifestAtomically({ manifest: manifest(), outputDir: output });
    await assert.rejects(
      () =>
        writeManifestAtomically({ manifest: manifest(), outputDir: output }),
      /MANIFEST_OUTPUT_EXISTS/,
    );
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("manifest writer produces byte-identical canonical files", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "demo-manifest-"));
  const first = path.join(parent, "first");
  const second = path.join(parent, "second");
  try {
    await writeManifestAtomically({ manifest: manifest(), outputDir: first });
    await writeManifestAtomically({ manifest: manifest(), outputDir: second });
    for (const file of [
      "manifest.json",
      "postgres.json",
      "minio.json",
      "temporal.json",
      "blockers.json",
      "receipt.json",
    ]) {
      assert.deepEqual(
        await fs.readFile(path.join(first, file)),
        await fs.readFile(path.join(second, file)),
      );
    }
    const external = await fs.readFile(
      path.join(first, "manifest.json"),
      "utf8",
    );
    assert.match(external, /controlled-id/);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

for (const failure of ["write", "rename"]) {
  test(`${failure} failure removes only its own staging directory`, async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "demo-manifest-"));
    const output = path.join(parent, "manifest");
    const unrelated = path.join(parent, "unrelated.keep");
    await fs.writeFile(unrelated, "keep", "utf8");
    try {
      await assert.rejects(
        () =>
          writeManifestAtomically({
            manifest: manifest(),
            outputDir: output,
            fsOps:
              failure === "write"
                ? {
                    writeFile: async () => {
                      throw new Error("INJECTED_WRITE_FAILURE");
                    },
                  }
                : {
                    rename: async () => {
                      throw new Error("INJECTED_RENAME_FAILURE");
                    },
                  },
          }),
        new RegExp(`INJECTED_${failure.toUpperCase()}_FAILURE`),
      );
      assert.equal(await fs.readFile(unrelated, "utf8"), "keep");
      assert.deepEqual(await stagingEntries(parent, output), []);
      await assert.rejects(() => fs.access(output), { code: "ENOENT" });
    } finally {
      await fs.rm(parent, { recursive: true, force: true });
    }
  });
}
