import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildPackageArtifacts,
  writePackageAtomically,
} from "./package-writer.mjs";
import {
  createSyntheticWorkbook,
  manifestFor,
  tempDir,
} from "./test-support.mjs";

const result = {
  records: [],
  lineage: [],
  gaps: [{ code: "PENDING", status: "blocking", reason: "redacted" }],
  checks: [],
  publishable: false,
};
const context = {
  sourceManifest: {
    manifestVersion: "full-chain-source-manifest.v1",
    sourceAlias: "fixture-v1",
    sha256: "a".repeat(64),
    sizeBytes: 1,
    workbookVersion: "fixture-v1",
  },
  sheetCount: 1,
};
test("writer publishes a diagnostic package atomically", async () => {
  const dir = await tempDir();
  const output = path.join(dir, "package");
  const artifacts = buildPackageArtifacts(result, context);
  await writePackageAtomically({ artifacts, outputDir: output });
  assert.equal(
    JSON.parse(await fs.readFile(path.join(output, "manifest.json"), "utf8"))
      .publishable,
    false,
  );
});
test("writer refuses an existing output", async () => {
  const dir = await tempDir();
  const output = path.join(dir, "existing");
  await fs.mkdir(output);
  await assert.rejects(
    () =>
      writePackageAtomically({
        artifacts: buildPackageArtifacts(result, context),
        outputDir: output,
      }),
    /OUTPUT_EXISTS/,
  );
});

test("injected rename failure preserves sibling and removes its staging directory", async () => {
  const dir = await tempDir();
  const output = path.join(dir, "failed-output");
  const sibling = path.join(dir, "keep-me");
  await fs.mkdir(sibling);
  await assert.rejects(
    () =>
      writePackageAtomically({
        artifacts: buildPackageArtifacts(result, context),
        outputDir: output,
        fsOps: {
          rename: async () => {
            throw new Error("INJECTED_RENAME_FAILURE");
          },
        },
      }),
    /OUTPUT_PUBLISH_FAILED/,
  );
  assert.equal((await fs.readdir(dir)).includes("keep-me"), true);
  assert.equal(
    (await fs.readdir(dir)).some((name) => name.includes("staging-")),
    false,
  );
  assert.equal((await fs.readdir(dir)).includes("failed-output"), false);
});

test("injected write failure preserves sibling and removes its staging directory", async () => {
  const dir = await tempDir();
  const output = path.join(dir, "failed-write-output");
  const sibling = path.join(dir, "keep-me-write");
  await fs.mkdir(sibling);
  await assert.rejects(
    () =>
      writePackageAtomically({
        artifacts: buildPackageArtifacts(result, context),
        outputDir: output,
        fsOps: {
          writeFile: async (file, ...args) => {
            if (String(file).endsWith("gaps.json"))
              throw new Error("INJECTED_WRITE_FAILURE");
            return fs.writeFile(file, ...args);
          },
        },
      }),
    /OUTPUT_PUBLISH_FAILED/,
  );
  assert.equal((await fs.readdir(dir)).includes("keep-me-write"), true);
  assert.equal(
    (await fs.readdir(dir)).some((name) => name.includes("staging-")),
    false,
  );
  assert.equal((await fs.readdir(dir)).includes("failed-write-output"), false);
});

test("package hash is stable across receipt timestamps", () => {
  const first = buildPackageArtifacts(result, {
    ...context,
    compiledAt: "2026-01-01T00:00:00.000Z",
  });
  const second = buildPackageArtifacts(result, {
    ...context,
    compiledAt: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(first.manifest.packageHash, second.manifest.packageHash);
});

test("CLI emits only a redacted receipt and stable exit codes", async () => {
  const dir = await tempDir();
  const sourcePath = path.join(dir, "source.xlsx");
  const manifestPath = path.join(dir, "source-manifest.json");
  const policyPath = path.join(dir, "policy.json");
  const outputPath = path.join(dir, "output");
  const secret = "SECRET-CELL-DEMO-001";
  const buffer = await createSyntheticWorkbook({
    sheets: [
      {
        name: "09_出运计划",
        headers: ["出运计划编号", "证据等级"],
        rows: [[secret, "R"]],
      },
    ],
  });
  const manifest = manifestFor(buffer);
  const policy = {
    policyVersion: "fixture-policy.v1",
    mappingVersion: "fixture-mapping.v1",
    sheets: [{ name: "09_出运计划", headerRow: 6, disposition: "records" }],
    pilotMappings: [
      {
        recordType: "shipment_plan",
        sheet: "09_出运计划",
        identity: ["出运计划编号"],
        payload: { planNo: "出运计划编号" },
        fieldPolicy: {
          planNo: { directSource: true, constructionOverrideAllowed: true },
        },
      },
    ],
  };
  await fs.writeFile(sourcePath, buffer);
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await fs.writeFile(policyPath, JSON.stringify(policy));
  const cli = path.resolve("scripts/compile-full-chain-sample.mjs");
  const run = (output) =>
    spawnSync(
      process.execPath,
      [
        cli,
        "--source",
        sourcePath,
        "--source-manifest",
        manifestPath,
        "--policy",
        policyPath,
        "--output",
        output,
      ],
      { cwd: path.resolve("."), encoding: "utf8" },
    );
  const valid = run(outputPath);
  assert.equal(valid.status, 0);
  assert.doesNotMatch(`${valid.stdout}${valid.stderr}`, new RegExp(secret));
  assert.doesNotMatch(`${valid.stdout}${valid.stderr}`, /[a-f0-9]{64}/u);
  const diagnosticOutput = path.join(dir, "diagnostic");
  const diagnosticBuffer = await createSyntheticWorkbook({
    sheets: [
      { name: "09_出运计划", headers: ["出运计划编号"], rows: [[secret]] },
    ],
  });
  await fs.writeFile(sourcePath, diagnosticBuffer);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifestFor(diagnosticBuffer)),
  );
  const diagnostic = run(diagnosticOutput);
  assert.equal(diagnostic.status, 2);
  assert.equal(
    JSON.parse(
      await fs.readFile(path.join(diagnosticOutput, "manifest.json"), "utf8"),
    ).publishable,
    false,
  );
  assert.doesNotMatch(diagnostic.stdout, /published/iu);
  const unsafeOutput = path.join(dir, "unsafe");
  const unsafeBuffer = Buffer.from("unsafe-source");
  await fs.writeFile(sourcePath, unsafeBuffer);
  await fs.writeFile(manifestPath, JSON.stringify(manifestFor(unsafeBuffer)));
  const unsafe = run(unsafeOutput);
  assert.equal(unsafe.status, 3);
  await assert.rejects(() => fs.access(unsafeOutput));
  await fs.writeFile(sourcePath, buffer);
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await fs.mkdir(path.join(dir, "existing"));
  const conflict = run(path.join(dir, "existing"));
  assert.equal(conflict.status, 4);
});
