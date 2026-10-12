import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { tempDir } from "./full-chain-sample/test-support.mjs";

const executeFile = promisify(execFile);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const cli = await import("./correct-full-chain-sample-v051.mjs").catch(
  () => ({}),
);

async function correctionFixture() {
  const workbook = new ExcelJS.Workbook();
  const addSheet = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.getRow(6).values = headers;
    rows.forEach((values, index) => {
      sheet.getRow(7 + index).values = values;
    });
  };
  addSheet(
    "09a_订舱",
    ["样本线", "订舱编号", "HBL/AMS"],
    [["B_US", "BOOK-FIXTURE-001", "HBL-FIXTURE-001 / AMS-FIXTURE-001"]],
  );
  addSheet(
    "11_装箱",
    [
      "样本线",
      "柜号",
      "封号",
      "备货单号",
      "SKU",
      "合同号",
      "装载数量",
      "箱数",
      "毛重kg",
      "体积m³",
      "分提单",
    ],
    [
      [
        "B_US",
        "CONT-001",
        "SEAL-001",
        "CR-001",
        "SKU-001",
        "CONTRACT-A",
        "2",
        "2",
        "4",
        "0.5",
        "A",
      ],
      [
        "B_US",
        "CONT-001",
        "SEAL-001",
        "CR-001",
        "SKU-001",
        "CONTRACT-B",
        "3",
        "3",
        "6",
        "0.75",
        "A",
      ],
    ],
  );
  addSheet(
    "11a_出口报关",
    ["样本线", "层级", "报关发票号", "分提单"],
    [["B_US", "报关票", "INV-FIXTURE-001", "A,B"]],
  );
  addSheet(
    "26_样本构建清单",
    ["工作表", "行", "字段", "值", "构建依据"],
    [
      ...[
        ["装载数量", "2", "source-a"],
        ["箱数", "2", "source-a"],
        ["毛重kg", "4", "source-a"],
        ["体积m³", "0.5", "source-a"],
        ["装载数量", "3", "source-b"],
        ["箱数", "3", "source-b"],
        ["毛重kg", "6", "source-b"],
        ["体积m³", "0.75", "source-b"],
      ].map(([field, value, basis]) => [
        "11_装箱",
        "CONT-001 / SEAL-001",
        field,
        value,
        basis,
      ]),
    ],
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const correctionManifest = {
  manifestVersion: "full-chain-business-data-correction.v1",
  sourceWorkbookVersion: "v0.5",
  outputWorkbookVersion: "v0.5.1",
  booking: {
    sampleLine: "B_US",
    bookingNo: "BOOK-FIXTURE-001",
    originalHouseBillCell: "HBL-FIXTURE-001 / AMS-FIXTURE-001",
    houseBillNo: "HBL-FIXTURE-001",
  },
  customs: {
    sampleLine: "B_US",
    invoiceNo: "INV-FIXTURE-001",
    originalHouseBillCell: "A,B",
  },
  stuffing: {
    sampleLine: "B_US",
    containerNo: "CONT-001",
    sealNo: "SEAL-001",
    cargoReadyNo: "CR-001",
    sku: "SKU-001",
    originalHouseBillCell: "A",
    expectedSourceRows: 2,
    provenanceFields: ["合同号"],
  },
};

async function fixtureFiles(directory) {
  const source = path.join(directory, "source.xlsx");
  const manifest = path.join(directory, "correction-manifest.json");
  const sourceBuffer = await correctionFixture();
  const manifestValue = {
    ...correctionManifest,
    sourceSha256: sha256(sourceBuffer),
  };
  await fs.writeFile(source, sourceBuffer);
  await fs.writeFile(manifest, JSON.stringify(manifestValue));
  return { manifest, source, sourceBuffer };
}

function cliArgs(source, output, manifest) {
  return [
    "--source",
    source,
    "--output",
    output,
    "--correction-manifest",
    manifest,
  ];
}

test("post-link staging cleanup failure does not turn a committed output into failure", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const { manifest, source } = await fixtureFiles(directory);
  let rmCalls = 0;

  const code = await cli.run(cliArgs(source, output, manifest), {
    rm: async (target, options) => {
      rmCalls += 1;
      if (rmCalls === 1) throw new Error("injected cleanup failure");
      return fs.rm(target, options);
    },
  });

  assert.equal(code, 0);
  await assert.doesNotReject(() => fs.access(output));
});

test("a racing output creation is preserved and publish fails closed", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const { manifest, source } = await fixtureFiles(directory);
  const racingOutput = Buffer.from("racing-output");
  let accessCalls = 0;

  await assert.rejects(
    () =>
      cli.run(cliArgs(source, output, manifest), {
        access: async () => {
          accessCalls += 1;
          const error = new Error("missing");
          error.code = "ENOENT";
          throw error;
        },
        link: async (staging, destination) => {
          await fs.writeFile(destination, racingOutput);
          await fs.link(staging, destination);
        },
      }),
    /OUTPUT_PUBLISH_FAILED/,
  );

  assert.equal(accessCalls, 1);
  assert.deepEqual(await fs.readFile(output), racingOutput);
});

test("output access errors fail closed before any write", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const { manifest, source } = await fixtureFiles(directory);
  let wrote = false;

  await assert.rejects(
    () =>
      cli.run(cliArgs(source, output, manifest), {
        access: async () => {
          const error = new Error("access denied");
          error.code = "EACCES";
          throw error;
        },
        writeFile: async () => {
          wrote = true;
        },
      }),
    /OUTPUT_ACCESS_FAILED/,
  );

  assert.equal(wrote, false);
});

test("link failure removes only this staging file and preserves source and sibling", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const sibling = path.join(directory, "keep.txt");
  const { manifest, source, sourceBuffer } = await fixtureFiles(directory);
  await fs.writeFile(sibling, "keep");

  await assert.rejects(
    () =>
      cli.run(cliArgs(source, output, manifest), {
        link: async () => {
          throw new Error("injected link failure");
        },
      }),
    /OUTPUT_PUBLISH_FAILED/,
  );

  assert.deepEqual(await fs.readFile(source), sourceBuffer);
  assert.equal(await fs.readFile(sibling, "utf8"), "keep");
  await assert.rejects(() => fs.access(output));
  assert.deepEqual(
    (await fs.readdir(directory)).filter((name) => name.includes(".staging-")),
    [],
  );
});

test("write failure removes only this staging file and preserves source and sibling", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const sibling = path.join(directory, "keep.txt");
  const { manifest, source, sourceBuffer } = await fixtureFiles(directory);
  await fs.writeFile(sibling, "keep");

  await assert.rejects(
    () =>
      cli.run(cliArgs(source, output, manifest), {
        writeFile: async () => {
          throw new Error("injected write failure");
        },
      }),
    /OUTPUT_PUBLISH_FAILED/,
  );

  assert.deepEqual(await fs.readFile(source), sourceBuffer);
  assert.equal(await fs.readFile(sibling, "utf8"), "keep");
  await assert.rejects(() => fs.access(output));
  assert.deepEqual(
    (await fs.readdir(directory)).filter((name) => name.includes(".staging-")),
    [],
  );
});

test("existing output fails closed without changing source or output", async () => {
  const directory = await tempDir();
  const output = path.join(directory, "corrected.xlsx");
  const { manifest, source, sourceBuffer } = await fixtureFiles(directory);
  const existing = Buffer.from("existing-output");
  await fs.writeFile(output, existing);

  await assert.rejects(
    () => cli.run(cliArgs(source, output, manifest)),
    /OUTPUT_EXISTS/,
  );

  assert.deepEqual(await fs.readFile(source), sourceBuffer);
  assert.deepEqual(await fs.readFile(output), existing);
});

test("real CLI creates a new output without changing source and keeps receipt redacted", async () => {
  const directory = await tempDir();
  const privateSource = path.join(directory, "private-source.xlsx");
  const output = path.join(directory, "private-output-v051.xlsx");
  const manifest = path.join(directory, "private-correction-manifest.json");
  const sourceBuffer = await correctionFixture();
  const sourceHash = sha256(sourceBuffer);
  const manifestValue = {
    ...correctionManifest,
    sourceSha256: sourceHash,
  };
  await fs.writeFile(privateSource, sourceBuffer);
  await fs.writeFile(manifest, JSON.stringify(manifestValue));

  const { stdout, stderr } = await executeFile(process.execPath, [
    path.resolve("scripts/correct-full-chain-sample-v051.mjs"),
    ...cliArgs(privateSource, output, manifest),
  ]);

  assert.equal(sha256(await fs.readFile(privateSource)), sourceHash);
  assert.notEqual(sha256(await fs.readFile(output)), sourceHash);
  for (const secret of [
    privateSource,
    output,
    manifest,
    sourceHash,
    "HBL-FIXTURE-001",
  ]) {
    assert.equal(stdout.includes(secret), false);
    assert.equal(stderr.includes(secret), false);
  }
  assert.match(stdout, /version=v0\.5\.1/);
  assert.equal(stderr, "");
});

test("malformed correction manifest returns a stable redacted error code", async () => {
  const directory = await tempDir();
  const source = path.join(directory, "source.xlsx");
  const output = path.join(directory, "output.xlsx");
  const manifest = path.join(directory, "malformed.json");
  await fs.writeFile(source, await correctionFixture());
  await fs.writeFile(manifest, '{"secret":"RAW-BUSINESS-VALUE", invalid');

  await assert.rejects(
    () =>
      executeFile(process.execPath, [
        path.resolve("scripts/correct-full-chain-sample-v051.mjs"),
        ...cliArgs(source, output, manifest),
      ]),
    (error) => {
      const outputText = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      assert.match(
        outputText,
        /code=BUSINESS_DATA_CORRECTION_MANIFEST_INVALID/,
      );
      assert.equal(outputText.includes("RAW-BUSINESS-VALUE"), false);
      assert.equal(outputText.includes(manifest), false);
      return true;
    },
  );
});

test("failure receipt redacts paths, business values, and complete hashes", async () => {
  const directory = await tempDir();
  const source = path.join(directory, "private-source.xlsx");
  const output = path.join(directory, "private-output-v051.xlsx");
  const manifest = path.join(directory, "private-correction-manifest.json");
  const sourceBuffer = await correctionFixture();
  const sourceHash = sha256(sourceBuffer);
  const wrongHash = "b".repeat(64);
  await fs.writeFile(source, sourceBuffer);
  await fs.writeFile(
    manifest,
    JSON.stringify({ ...correctionManifest, sourceSha256: wrongHash }),
  );

  await assert.rejects(
    () =>
      executeFile(process.execPath, [
        path.resolve("scripts/correct-full-chain-sample-v051.mjs"),
        ...cliArgs(source, output, manifest),
      ]),
    (error) => {
      const outputText = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      assert.match(
        outputText,
        /code=BUSINESS_DATA_SOURCE_FINGERPRINT_MISMATCH/,
      );
      for (const secret of [
        source,
        output,
        manifest,
        sourceHash,
        wrongHash,
        "HBL-FIXTURE-001",
      ])
        assert.equal(outputText.includes(secret), false);
      return true;
    },
  );
  await assert.rejects(() => fs.access(output));
});

test("correction CLI requires an external correction manifest", async () => {
  const directory = await tempDir();
  const source = path.join(directory, "source.xlsx");
  const output = path.join(directory, "corrected.xlsx");
  await fs.writeFile(source, await correctionFixture());

  await assert.rejects(
    () => cli.run(["--source", source, "--output", output]),
    /ARGUMENTS_INVALID/,
  );
});

test("correction CLI requires explicit source and output", async () => {
  assert.equal(typeof cli.run, "function");
  await assert.rejects(() => cli.run([]), /ARGUMENTS_INVALID/);
});
