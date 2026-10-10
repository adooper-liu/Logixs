import assert from "node:assert/strict";
import test from "node:test";
import { createSyntheticWorkbook, manifestFor } from "./test-support.mjs";
import JSZip from "jszip";
import {
  XLSX_LIMITS,
  inspectXlsxArchive,
  scanWorkbook,
} from "./xlsx-security.mjs";

const policy = {
  sheets: [{ name: "09_出运计划", headerRow: 6, disposition: "records" }],
};

test("scanner returns a value-neutral sheet model", async () => {
  const buffer = await createSyntheticWorkbook({
    sheets: [
      {
        name: "09_出运计划",
        headers: ["说明", "生成器键一", "生成器键二"],
        rows: [["计划", "ROW-A", "ROW-B"]],
      },
    ],
  });
  const scan = await scanWorkbook({
    buffer,
    sourceManifest: manifestFor(buffer),
    policy,
  });
  assert.equal(scan.sheets[0].rows[0].valuesByHeader["生成器键一"], "ROW-A");
  assert.equal(scan.sheets[0].rows[0].rowKey, "ROW-A / ROW-B");
});

test("scanner rejects formulas", async () => {
  const buffer = await createSyntheticWorkbook({
    formula: "1+1",
    cachedValue: 2,
  });
  await assert.rejects(
    () => scanWorkbook({ buffer, sourceManifest: manifestFor(buffer), policy }),
    /XLSX_FORMULA_FORBIDDEN/,
  );
});
test("scanner rejects formulas in headers and pre-header metadata", async () => {
  for (const formulaCell of ["A6", "A5"]) {
    const buffer = await createSyntheticWorkbook({
      formula: "1+1",
      cachedValue: "出运计划编号",
      formulaCell,
    });
    await assert.rejects(
      () =>
        scanWorkbook({ buffer, sourceManifest: manifestFor(buffer), policy }),
      /XLSX_FORMULA_FORBIDDEN/,
    );
  }
});

test("archive inspection rejects invalid input", async () => {
  await assert.rejects(
    () => inspectXlsxArchive(Buffer.from("not-xlsx")),
    /XLSX_UNSAFE/,
  );
});

async function mutateArchive(mutator, files = []) {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", "<workbook/>\n");
  zip.file("xl/worksheets/sheet1.xml", "<worksheet/>\n");
  for (const [name, options] of files) zip.file(name, "x", options);
  await mutator(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function setCentralFlag(buffer, flag) {
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const offset = buffer.indexOf(signature);
  buffer.writeUInt16LE(buffer.readUInt16LE(offset + 8) | flag, offset + 8);
  return buffer;
}

function setCentralExternalAttributes(buffer, attributes) {
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const offset = buffer.indexOf(signature);
  buffer.writeUInt32LE(attributes, offset + 38);
  return buffer;
}

test("archive preflight rejects forbidden parts and traversal", async () => {
  for (const name of [
    "xl/vbaProject.bin",
    "xl/externalLinks/externalLink1.xml",
    "xl/connections.xml",
    "../escape.xml",
  ]) {
    const buffer = await mutateArchive((zip) => zip.file(name, "x"));
    await assert.rejects(() => inspectXlsxArchive(buffer), /XLSX_UNSAFE/);
  }
});

test("archive preflight rejects central-directory symlinks, case duplicates and encryption", async () => {
  const symlink = setCentralExternalAttributes(
    await mutateArchive(async () => undefined),
    0xa0000000,
  );
  await assert.rejects(() => inspectXlsxArchive(symlink), /XLSX_UNSAFE/);
  const duplicates = await mutateArchive(async (zip) =>
    zip.file("xl/WORKBOOK.XML", "x"),
  );
  await assert.rejects(() => inspectXlsxArchive(duplicates), /XLSX_UNSAFE/);
  const encrypted = setCentralFlag(
    await mutateArchive(async () => undefined),
    0x0001,
  );
  await assert.rejects(() => inspectXlsxArchive(encrypted), /XLSX_UNSAFE/);
  const emptyProtection = await mutateArchive(async (zip) =>
    zip.file("xl/workbook.xml", "<workbookProtection/>"),
  );
  await assert.doesNotReject(() => inspectXlsxArchive(emptyProtection));
});

test("archive preflight rejects workbook protection with any attributes", async () => {
  for (const protection of [
    '<workbookProtection lockStructure="0"/>',
    '<workbookProtection lockWindows="false"/>',
    '<workbookProtection lockRevision="0"/>',
    '<workbookProtection password="" hash="" salt="" spin="0"/>',
  ]) {
    const protectedZip = await mutateArchive(async (zip) =>
      zip.file("xl/workbook.xml", protection),
    );
    await assert.rejects(() => inspectXlsxArchive(protectedZip), /XLSX_UNSAFE/);
  }
});

test("archive preflight enforces each resource limit", async () => {
  const safe = await mutateArchive(async () => undefined);
  await assert.rejects(
    () => inspectXlsxArchive(safe, { ...XLSX_LIMITS, sourceBytes: 1 }),
    /XLSX_UNSAFE/,
  );
  await assert.rejects(
    () => inspectXlsxArchive(safe, { ...XLSX_LIMITS, zipEntries: 1 }),
    /XLSX_UNSAFE/,
  );
  await assert.rejects(
    () => inspectXlsxArchive(safe, { ...XLSX_LIMITS, uncompressedBytes: 1 }),
    /XLSX_UNSAFE/,
  );
  await assert.rejects(
    () => inspectXlsxArchive(safe, { ...XLSX_LIMITS, compressionRatio: 0.01 }),
    /XLSX_UNSAFE/,
  );
});

test("scanner enforces sheet row column and cell limits", async () => {
  const buffer = await createSyntheticWorkbook({
    sheets: [
      {
        name: "09_出运计划",
        headers: ["出运计划编号", "额外列"],
        rows: [["PLAN-DEMO-001", "x"]],
      },
    ],
  });
  const sourceManifest = manifestFor(buffer);
  await assert.rejects(
    () =>
      scanWorkbook(
        { buffer, sourceManifest, policy },
        { ...XLSX_LIMITS, columnsPerSheet: 1 },
      ),
    /XLSX_UNSAFE/,
  );
  await assert.rejects(
    () =>
      scanWorkbook(
        { buffer, sourceManifest, policy },
        { ...XLSX_LIMITS, rowsPerSheet: 0 },
      ),
    /XLSX_UNSAFE/,
  );
  const longBuffer = await createSyntheticWorkbook({
    sheets: [
      { name: "09_出运计划", headers: ["出运计划编号"], rows: [["LONG"]] },
    ],
  });
  await assert.rejects(
    () =>
      scanWorkbook(
        { buffer: longBuffer, sourceManifest: manifestFor(longBuffer), policy },
        { ...XLSX_LIMITS, cellTextLength: 2 },
      ),
    /XLSX_UNSAFE/,
  );
});

test("scanner rejects header fingerprint drift", async () => {
  const buffer = await createSyntheticWorkbook();
  const driftedPolicy = {
    sheets: [
      {
        name: "09_出运计划",
        headerRow: 6,
        headerFingerprint: "a".repeat(64),
        disposition: "records",
      },
    ],
  };
  await assert.rejects(
    () =>
      scanWorkbook({
        buffer,
        sourceManifest: manifestFor(buffer),
        policy: driftedPolicy,
      }),
    /HEADER_FINGERPRINT_DRIFT/,
  );
});
