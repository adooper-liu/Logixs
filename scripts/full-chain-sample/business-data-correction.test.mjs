import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildProvenanceIndexes } from "./classification.mjs";
import { compilePilotRecords } from "./compile-records.mjs";
import { correctWorkbookV051 } from "./business-data-correction.mjs";
import { loadCompilerPolicy } from "./policy.mjs";

const policy = loadCompilerPolicy(
  fileURLToPath(new URL("./policies/v0.5.json", import.meta.url)),
);

const correctionTarget = {
  manifestVersion: "full-chain-business-data-correction.v1",
  sourceSha256: "a".repeat(64),
  sourceWorkbookVersion: "v0.5",
  outputWorkbookVersion: "v0.5.1",
  booking: {
    sampleLine: "B_US",
    bookingNo: "BOOK-001",
    originalHouseBillCell: "HBL-001 / AMS-001",
    houseBillNo: "HBL-001",
  },
  customs: {
    sampleLine: "B_US",
    invoiceNo: "INV-001",
    originalHouseBillCell: "A,B",
  },
  stuffing: {
    sampleLine: "B_US",
    containerNo: "CONT-001",
    sealNo: "SEAL-001",
    cargoReadyNo: "CR-001",
    sku: "SKU-001",
    originalHouseBillCell: "字母 A",
    expectedSourceRows: 2,
    provenanceFields: ["合同号"],
  },
};

function manifestFor(source, overrides = {}) {
  return {
    ...correctionTarget,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    ...overrides,
  };
}

async function workbookBuffer({
  reverseStuffing = false,
  includeUnrelated = false,
} = {}) {
  const workbook = new ExcelJS.Workbook();
  const addSheet = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.getRow(6).values = headers;
    rows.forEach((values, index) => {
      sheet.getRow(7 + index).values = values;
    });
  };
  addSheet(
    "09_出运计划",
    ["样本线", "出运计划编号", "合并备货单", "订舱号/SO"],
    [["B_US", "SHIP-001", "CR-001", "BOOK-001"]],
  );
  addSheet(
    "09a_订舱",
    ["样本线", "订舱编号", "HBL/AMS", "主备货单号", "MBL"],
    [
      ["B_US", "BOOK-001", "HBL-001 / AMS-001", "CR-001", "MBL-001"],
      ...(includeUnrelated
        ? [
            ["B_US", "BOOK-KEEP", "HBL-KEEP / AMS-KEEP", "CR-KEEP", "MBL-KEEP"],
            [
              "A_CA",
              "BOOK-OTHER",
              "HBL-OTHER / AMS-OTHER",
              "CR-OTHER",
              "MBL-OTHER",
            ],
          ]
        : []),
    ],
  );
  addSheet(
    "10_备货",
    ["样本线", "备货单号", "主备货单号", "数量合计"],
    [["B_US", "CR-001", "CR-001", "5"]],
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
    reverseStuffing
      ? [
          [
            "B_US",
            "CONT-001",
            "SEAL-001",
            "CR-001",
            "SKU-001",
            "CONTRACT-B",
            "3",
            "3",
            "5.75",
            "0.75",
            "字母 A",
          ],
          [
            "B_US",
            "CONT-001",
            "SEAL-001",
            "CR-001",
            "SKU-001",
            "CONTRACT-A",
            "2",
            "2",
            "4.25",
            "0.50",
            "字母 A",
          ],
        ]
      : [
          [
            "B_US",
            "CONT-001",
            "SEAL-001",
            "CR-001",
            "SKU-001",
            "CONTRACT-A",
            "2",
            "2",
            "4.25",
            "0.50",
            "字母 A",
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
            "5.75",
            "0.75",
            "字母 A",
          ],
        ],
  );
  if (includeUnrelated) {
    const stuffing = workbook.getWorksheet("11_装箱");
    stuffing.addRow([
      "B_US",
      "CONT-KEEP",
      "SEAL-KEEP",
      "CR-KEEP",
      "SKU-KEEP",
      "CONTRACT-KEEP",
      "1",
      "1",
      "1",
      "0.1",
      "HBL-KEEP",
    ]);
  }
  addSheet(
    "11a_出口报关",
    ["样本线", "层级", "报关发票号", "分提单", "报关单号", "报关金额", "币种"],
    [
      ["B_US", "报关票", "INV-001", "A,B", "DECL-001", "10.00", "USD"],
      ...Array.from({ length: 11 }, (_, index) => [
        "B_US",
        "品名行",
        `ITEM-${String(index + 1).padStart(2, "0")}`,
        "A,B",
        `ITEM-DECL-${String(index + 1).padStart(2, "0")}`,
        "1.00",
        "USD",
      ]),
      ...(includeUnrelated
        ? [
            [
              "B_US",
              "报关票",
              "INV-KEEP",
              "HBL-KEEP",
              "DECL-KEEP",
              "1.00",
              "USD",
            ],
          ]
        : []),
    ],
  );
  addSheet(
    "12_出运",
    [
      "样本线",
      "柜号",
      "船名",
      "航次",
      "MBL",
      "HBL",
      "进港日期",
      "ATD/出运日期",
      "日期精度",
    ],
    [
      [
        "B_US",
        "CONT-001",
        "VESSEL FIXTURE",
        "VOYAGE-001",
        "MBL-001",
        "HBL-001",
        "2026-01-01",
        "2026-01-02",
        "date",
      ],
    ],
  );
  addSheet(
    "26_样本构建清单",
    ["工作表", "行", "字段", "值", "构建依据"],
    [
      ...[
        ["装载数量", "2", "source-a"],
        ["箱数", "2", "source-a"],
        ["毛重kg", "4.25", "source-a"],
        ["体积m³", "0.50", "source-a"],
        ["装载数量", "3", "source-b"],
        ["箱数", "3", "source-b"],
        ["毛重kg", "5.75", "source-b"],
        ["体积m³", "0.75", "source-b"],
      ].map(([field, value, basis]) => [
        "11_装箱",
        "CONT-001 / SEAL-001",
        field,
        value,
        basis,
      ]),
      ...(includeUnrelated
        ? [
            [
              "11_装箱",
              "CONT-001 / SEAL-001",
              "毛重kg",
              "99",
              "source-unrelated",
            ],
          ]
        : []),
    ],
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function addArchiveMember(buffer, name, value = "x") {
  const zip = await JSZip.loadAsync(buffer);
  zip.file(name, value);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

async function addFormula(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  workbook.getWorksheet("11_装箱").getCell("A5").value = {
    formula: '"secret"',
    result: "secret",
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function compileWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = workbook.worksheets.map((sheet) => {
    const headers = sheet.getRow(6).values.slice(1).map(String);
    const scanRows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 6) return;
      const valuesByHeader = Object.fromEntries(
        headers.map((header, index) => [header, row.getCell(index + 1).value]),
      );
      if (
        !Object.values(valuesByHeader).some(
          (value) => value !== null && value !== "",
        )
      )
        return;
      scanRows.push({
        workbookRow: rowNumber,
        rowKey: [row.getCell(2).value, row.getCell(3).value]
          .map((value) => String(value ?? "").trim())
          .join(" / "),
        valuesByHeader,
      });
    });
    return { name: sheet.name, headerRow: 6, headers, rows: scanRows };
  });
  for (const definition of policy.sheets) {
    if (!sheets.some((sheet) => sheet.name === definition.name))
      sheets.push({
        name: definition.name,
        headerRow: definition.headerRow,
        headers: [],
        rows: [],
      });
  }
  const scan = {
    sourceAlias: "v051-correction-fixture",
    workbookVersion: "fixture-v051",
    sheets,
  };
  return compilePilotRecords({
    scan,
    policy,
    indexes: buildProvenanceIndexes(scan, policy),
  });
}

function failedChecks(result, code) {
  return result.checks.filter(
    (item) => item.code === code && item.status === "fail",
  );
}

async function rows(buffer, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(sheetName);
  const headers = sheet.getRow(6).values.slice(1);
  const values = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 6) return;
    values.push(
      Object.fromEntries(
        headers.map((header, index) => [header, row.getCell(index + 1).value]),
      ),
    );
  });
  return values;
}

test("correction rejects unsafe archive parts and formulas before mutation", async () => {
  const source = await workbookBuffer();
  const macro = await addArchiveMember(source, "xl/vbaProject.bin");
  await assert.rejects(
    () => correctWorkbookV051(macro, manifestFor(macro)),
    /XLSX_UNSAFE/,
  );

  const formula = await addFormula(source);
  await assert.rejects(
    () => correctWorkbookV051(formula, manifestFor(formula)),
    /XLSX_FORMULA_FORBIDDEN/,
  );
});

test("explicit target changes only the intended booking, stuffing group, and customs ticket", async () => {
  const source = await workbookBuffer({ includeUnrelated: true });
  const { buffer } = await correctWorkbookV051(source, manifestFor(source));
  const booking = await rows(buffer, "09a_订舱");
  const stuffing = await rows(buffer, "11_装箱");
  const customs = await rows(buffer, "11a_出口报关");
  const lineage = await rows(buffer, "26_样本构建清单");

  assert.equal(
    booking.find((item) => item["订舱编号"] === "BOOK-KEEP")["HBL/AMS"],
    "HBL-KEEP / AMS-KEEP",
  );
  assert.equal(
    stuffing.find((item) => item["柜号"] === "CONT-KEEP")["分提单"],
    "HBL-KEEP",
  );
  assert.equal(
    customs.find((item) => item["报关发票号"] === "INV-KEEP")["分提单"],
    "HBL-KEEP",
  );
  assert.equal(
    stuffing.find((item) => item["柜号"] === "CONT-001")["分提单"],
    "HBL-001",
  );
  assert.equal(
    customs.find((item) => item["报关发票号"] === "INV-001")["分提单"],
    "HBL-001",
  );
  const targetWeightLineage = lineage.find(
    (item) =>
      item["工作表"] === "11_装箱" &&
      item["字段"] === "毛重kg" &&
      String(item["构建依据"]).startsWith("v0.5.1 aggregate"),
  );
  assert.equal(
    targetWeightLineage["构建依据"].includes("source-unrelated"),
    false,
  );
});

test("unexpected non-aggregate source differences fail closed", async () => {
  const source = await workbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source);
  const stuffing = workbook.getWorksheet("11_装箱");
  const extraColumn = stuffing.getRow(6).cellCount + 1;
  stuffing.getRow(6).getCell(extraColumn).value = "未批准业务字段";
  stuffing.getRow(7).getCell(extraColumn).value = "VALUE-A";
  stuffing.getRow(8).getCell(extraColumn).value = "VALUE-B";
  const conflicted = Buffer.from(await workbook.xlsx.writeBuffer());

  await assert.rejects(
    () => correctWorkbookV051(conflicted, manifestFor(conflicted)),
    /BUSINESS_DATA_NON_AGGREGATE_CONFLICT/,
  );
});

test("correction manifest cannot target a different source workbook", async () => {
  const source = await workbookBuffer();
  await assert.rejects(
    () =>
      correctWorkbookV051(source, {
        ...correctionTarget,
        sourceSha256: "b".repeat(64),
      }),
    /BUSINESS_DATA_SOURCE_FINGERPRINT_MISMATCH/,
  );
});

test("typed HBL rejects the AMS token from the booking reference cell", async () => {
  const source = await workbookBuffer();
  await assert.rejects(
    () =>
      correctWorkbookV051(
        source,
        manifestFor(source, {
          booking: {
            ...correctionTarget.booking,
            houseBillNo: "AMS-001",
          },
        }),
      ),
    /BUSINESS_DATA_TYPED_HBL_INVALID/,
  );
});

test("correction manifest cannot splice different sample lines", async () => {
  const source = await workbookBuffer();
  await assert.rejects(
    () =>
      correctWorkbookV051(
        source,
        manifestFor(source, {
          customs: {
            ...correctionTarget.customs,
            sampleLine: "A_CA",
          },
        }),
      ),
    /BUSINESS_DATA_CORRECTION_MANIFEST_INVALID/,
  );
});

test("typed HBL must exactly match one booking reference token", async () => {
  const source = await workbookBuffer();
  await assert.rejects(
    () =>
      correctWorkbookV051(
        source,
        manifestFor(source, {
          booking: {
            ...correctionTarget.booking,
            houseBillNo: "HBL-00",
          },
        }),
      ),
    /BUSINESS_DATA_TYPED_HBL_INVALID/,
  );
});

test("unfixed workbook reproduces both failed checks and v0.5.1 clears them through compiler", async () => {
  const source = await workbookBuffer();
  const before = await compileWorkbook(source);

  assert.equal(failedChecks(before, "CHECK_HBL_SCOPE").length, 1);
  assert.equal(failedChecks(before, "CHECK_UNIQUE_BUSINESS_KEY").length, 1);
  assert.equal(before.records.length, 7);
  assert.equal(
    before.gaps.filter((item) => item.status === "informational").length,
    11,
  );
  assert.equal(before.publishable, false);

  const corrected = await correctWorkbookV051(source, manifestFor(source));
  const after = await compileWorkbook(corrected.buffer);

  assert.equal(failedChecks(after, "CHECK_HBL_SCOPE").length, 0);
  assert.equal(failedChecks(after, "CHECK_UNIQUE_BUSINESS_KEY").length, 0);
  assert.equal(
    after.checks.some((item) => item.status === "fail"),
    false,
  );
  assert.equal(after.records.length, 6);
  assert.equal(
    after.gaps.filter((item) => item.status === "informational").length,
    11,
  );
  assert.equal(
    new Set(after.records.map((record) => record.recordType)).size,
    6,
  );
  assert.equal(after.publishable, true);
  assert.equal(
    after.records.filter(
      (record) => record.recordType === "stuffing_snapshot_line",
    ).length,
    1,
  );
  const stuffingRecord = after.records.find(
    (record) => record.recordType === "stuffing_snapshot_line",
  );
  assert.equal(stuffingRecord.aggregation.code, "FC-D07");
  assert.equal(stuffingRecord.aggregation.contributorRefs.length, 2);
  assert.equal(new Set(stuffingRecord.aggregation.contributorRefs).size, 2);
  assert.equal(
    stuffingRecord.aggregation.contributorRefs.every((ref) =>
      /^fc-d07:[a-f0-9]{64}$/u.test(ref),
    ),
    true,
  );
  assert.deepEqual(
    after.lineage
      .filter((entry) => entry.recordRef.startsWith("stuffing_snapshot_line:"))
      .map((entry) => entry.sourceRef),
    stuffingRecord.aggregation.contributorRefs,
  );
});

test("v0.5.1 uses the booking HBL and aggregates duplicate stuffing facts with lineage", async () => {
  const source = await workbookBuffer();
  const { buffer: corrected, summary } = await correctWorkbookV051(
    source,
    manifestFor(source),
  );
  const stuffing = await rows(corrected, "11_装箱");
  const customs = await rows(corrected, "11a_出口报关");
  const lineage = await rows(corrected, "26_样本构建清单");

  assert.equal(stuffing.length, 1);
  assert.equal(stuffing[0]["分提单"], "HBL-001");
  assert.equal(stuffing[0]["装载数量"], "5");
  assert.equal(stuffing[0]["箱数"], "5");
  assert.equal(stuffing[0]["毛重kg"], "10");
  assert.equal(stuffing[0]["体积m³"], "1.25");
  assert.equal(stuffing[0]["合同号"], null);
  assert.equal(customs[0]["分提单"], "HBL-001");
  const correctionLineage = lineage.filter(
    (item) =>
      item["工作表"] === "11_装箱" &&
      String(item["构建依据"]).startsWith("v0.5.1 aggregate"),
  );
  assert.equal(correctionLineage.length, 4);
  assert.deepEqual(
    correctionLineage.map((item) => item["字段"]).sort(),
    [...["装载数量", "箱数", "毛重kg", "体积m³"]].sort(),
  );
  for (const item of correctionLineage) {
    assert.match(item["构建依据"], /source-a/);
    assert.match(item["构建依据"], /source-b/);
  }
  const contractLineage = lineage.filter(
    (item) =>
      item["工作表"] === "11_装箱" &&
      item["字段"] === "合同号" &&
      item["构建依据"] === "v0.5.1 provenance-only source value",
  );
  assert.deepEqual(contractLineage.map((item) => item["值"]).sort(), [
    "CONTRACT-A",
    "CONTRACT-B",
  ]);
  assert.deepEqual(summary, {
    version: "v0.5.1",
    correctedHblGroups: 1,
    aggregatedStuffingGroups: 1,
    removedStuffingRows: 1,
  });
});

test("reversing duplicate stuffing source rows does not change corrected business content", async () => {
  const forwardSource = await workbookBuffer();
  const reversedSource = await workbookBuffer({ reverseStuffing: true });
  const forward = await correctWorkbookV051(
    forwardSource,
    manifestFor(forwardSource),
  );
  const reversed = await correctWorkbookV051(
    reversedSource,
    manifestFor(reversedSource),
  );

  assert.deepEqual(
    await rows(forward.buffer, "11_装箱"),
    await rows(reversed.buffer, "11_装箱"),
  );
  assert.deepEqual(
    await compileWorkbook(forward.buffer),
    await compileWorkbook(reversed.buffer),
  );
});

test("v0.5.1 correction fails closed when the approved blocker shape drifts", async () => {
  const workbook = new ExcelJS.Workbook();
  for (const name of [
    "09a_订舱",
    "11_装箱",
    "11a_出口报关",
    "26_样本构建清单",
  ]) {
    const sheet = workbook.addWorksheet(name);
    sheet.getRow(6).values = ["样本线"];
  }
  const invalidBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(
    () => correctWorkbookV051(invalidBuffer, manifestFor(invalidBuffer)),
    /BUSINESS_DATA_BLOCKER_SHAPE_INVALID/,
  );
});
