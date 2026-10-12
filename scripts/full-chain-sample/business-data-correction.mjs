import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import {
  canonicalStringify,
  compareCanonicalStrings,
} from "./canonical-json.mjs";
import {
  assertWorkbookContentSafety,
  inspectXlsxArchive,
} from "./xlsx-security.mjs";

const REQUIRED_SHEETS = [
  "09a_订舱",
  "11_装箱",
  "11a_出口报关",
  "26_样本构建清单",
];
const AGGREGATE_FIELDS = ["装载数量", "箱数", "毛重kg", "体积m³"];
const APPROVED_PROVENANCE_FIELDS = new Set([
  "合同号",
  "合同行号",
  "序号",
  "源行号",
]);

function headerIndex(sheet) {
  return new Map(
    sheet
      .getRow(6)
      .values.slice(1)
      .map((header, index) => [String(header ?? ""), index + 1]),
  );
}

function rows(sheet, headers) {
  const result = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 6) return;
    const values = Object.fromEntries(
      [...headers].map(([header, column]) => [
        header,
        row.getCell(column).value,
      ]),
    );
    if (Object.values(values).some((value) => value !== null && value !== ""))
      result.push({ row, rowNumber, values });
  });
  return result;
}

function text(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim();
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).toSorted(compareCanonicalStrings);
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function validateTarget(target) {
  const rootKeys = [
    "booking",
    "customs",
    "manifestVersion",
    "outputWorkbookVersion",
    "sourceSha256",
    "sourceWorkbookVersion",
    "stuffing",
  ];
  const bookingKeys = [
    "bookingNo",
    "houseBillNo",
    "originalHouseBillCell",
    "sampleLine",
  ];
  const customsKeys = ["invoiceNo", "originalHouseBillCell", "sampleLine"];
  const stuffingKeys = [
    "cargoReadyNo",
    "containerNo",
    "expectedSourceRows",
    "originalHouseBillCell",
    "provenanceFields",
    "sampleLine",
    "sealNo",
    "sku",
  ];
  if (
    !exactKeys(target, rootKeys) ||
    target.manifestVersion !== "full-chain-business-data-correction.v1" ||
    target.sourceWorkbookVersion !== "v0.5" ||
    target.outputWorkbookVersion !== "v0.5.1" ||
    !/^[a-f0-9]{64}$/u.test(target.sourceSha256) ||
    !exactKeys(target.booking, bookingKeys) ||
    !exactKeys(target.customs, customsKeys) ||
    !exactKeys(target.stuffing, stuffingKeys) ||
    target.stuffing.expectedSourceRows !== 2 ||
    !Array.isArray(target.stuffing.provenanceFields) ||
    target.stuffing.provenanceFields.length === 0 ||
    new Set(target.stuffing.provenanceFields).size !==
      target.stuffing.provenanceFields.length ||
    target.stuffing.provenanceFields.some(
      (field) => !APPROVED_PROVENANCE_FIELDS.has(field),
    ) ||
    new Set([
      target.booking?.sampleLine,
      target.customs?.sampleLine,
      target.stuffing?.sampleLine,
    ]).size !== 1
  )
    throw new Error("BUSINESS_DATA_CORRECTION_MANIFEST_INVALID");
  for (const section of [target.booking, target.customs, target.stuffing])
    for (const [key, value] of Object.entries(section))
      if (key !== "expectedSourceRows" && !text(value))
        throw new Error("BUSINESS_DATA_CORRECTION_MANIFEST_INVALID");
  return target;
}

function exactRows(items, selector, expectedCount) {
  const matches = items.filter((item) =>
    Object.entries(selector).every(
      ([field, expected]) => text(item.values[field]) === text(expected),
    ),
  );
  if (matches.length !== expectedCount)
    throw new Error("BUSINESS_DATA_BLOCKER_SHAPE_INVALID");
  return matches;
}

function typedReferences(value) {
  return text(value)
    .split(/\s+\/\s+/u)
    .map(text)
    .filter(Boolean);
}

function decimalParts(value) {
  const normalized = text(value);
  if (!/^-?\d+(?:\.\d+)?$/u.test(normalized))
    throw new Error("BUSINESS_DATA_DECIMAL_INVALID");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer, fraction = ""] = unsigned.split(".");
  return { negative, integer, fraction };
}

function addDecimals(values) {
  const parts = values.map(decimalParts);
  const scale = Math.max(...parts.map((part) => part.fraction.length));
  const sum = parts.reduce((total, part) => {
    const digits = `${part.integer}${part.fraction.padEnd(scale, "0")}`;
    return total + BigInt(`${part.negative ? "-" : ""}${digits}`);
  }, 0n);
  const negative = sum < 0n;
  const absolute = (negative ? -sum : sum).toString().padStart(scale + 1, "0");
  const integer = scale ? absolute.slice(0, -scale) : absolute;
  const fraction = scale ? absolute.slice(-scale).replace(/0+$/u, "") : "";
  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

function rowKey(item) {
  return [item.values["柜号"], item.values["封号"]].map(text).join(" / ");
}

function stuffingKey(item) {
  return ["柜号", "备货单号", "SKU", "分提单"]
    .map((field) => text(item.values[field]))
    .join("|");
}

function existingBases(lineageRows, sourceRows, field) {
  const matches = sourceRows.map((sourceRow) =>
    lineageRows.filter(
      (item) =>
        text(item.values["工作表"]) === "11_装箱" &&
        text(item.values["行"]) === rowKey(sourceRow) &&
        text(item.values["字段"]) === field &&
        text(item.values["值"]) === text(sourceRow.values[field]),
    ),
  );
  if (matches.some((items) => items.length !== 1))
    throw new Error("BUSINESS_DATA_LINEAGE_INVALID");
  return matches.map(([item]) => text(item.values["构建依据"]));
}

function assertAggregateShape(group, headers, provenanceFields) {
  for (const field of provenanceFields)
    if (!headers.has(field) || group.some((item) => !text(item.values[field])))
      throw new Error("BUSINESS_DATA_LINEAGE_INVALID");
  const allowedDifferences = new Set([
    ...AGGREGATE_FIELDS,
    ...provenanceFields,
    "分提单",
  ]);
  for (const field of headers.keys()) {
    if (allowedDifferences.has(field)) continue;
    if (new Set(group.map((item) => text(item.values[field]))).size !== 1)
      throw new Error("BUSINESS_DATA_NON_AGGREGATE_CONFLICT");
  }
}

function appendLineage(sheet, values) {
  sheet.addRow(values);
}

export async function correctWorkbookV051(buffer, correctionManifest) {
  const target = validateTarget(correctionManifest);
  const sourceSha256 = createHash("sha256").update(buffer).digest("hex");
  if (sourceSha256 !== target.sourceSha256)
    throw new Error("BUSINESS_DATA_SOURCE_FINGERPRINT_MISMATCH");
  await inspectXlsxArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, { ignoreNodes: ["extLst"] });
  assertWorkbookContentSafety(workbook);
  const sheets = Object.fromEntries(
    REQUIRED_SHEETS.map((name) => [name, workbook.getWorksheet(name)]),
  );
  if (Object.values(sheets).some((sheet) => !sheet))
    throw new Error("BUSINESS_DATA_BLOCKER_SHAPE_INVALID");

  const bookingHeaders = headerIndex(sheets["09a_订舱"]);
  const stuffingHeaders = headerIndex(sheets["11_装箱"]);
  const customsHeaders = headerIndex(sheets["11a_出口报关"]);
  const lineageHeaders = headerIndex(sheets["26_样本构建清单"]);
  const bookingRows = rows(sheets["09a_订舱"], bookingHeaders);
  const stuffingRows = rows(sheets["11_装箱"], stuffingHeaders);
  const customsRows = rows(sheets["11a_出口报关"], customsHeaders).filter(
    (item) => text(item.values["层级"]) === "报关票",
  );
  const lineageRows = rows(sheets["26_样本构建清单"], lineageHeaders);

  const booking = exactRows(
    bookingRows,
    {
      样本线: target.booking.sampleLine,
      订舱编号: target.booking.bookingNo,
      "HBL/AMS": target.booking.originalHouseBillCell,
    },
    1,
  )[0];
  const targetCustoms = exactRows(
    customsRows,
    {
      样本线: target.customs.sampleLine,
      报关发票号: target.customs.invoiceNo,
      分提单: target.customs.originalHouseBillCell,
    },
    1,
  );
  const targetStuffing = exactRows(
    stuffingRows,
    {
      样本线: target.stuffing.sampleLine,
      柜号: target.stuffing.containerNo,
      封号: target.stuffing.sealNo,
      备货单号: target.stuffing.cargoReadyNo,
      SKU: target.stuffing.sku,
      分提单: target.stuffing.originalHouseBillCell,
    },
    target.stuffing.expectedSourceRows,
  );
  const hbl = text(target.booking.houseBillNo);
  const bookingReferences = typedReferences(booking.values["HBL/AMS"]);
  if (bookingReferences.length !== 2 || bookingReferences[0] !== hbl)
    throw new Error("BUSINESS_DATA_TYPED_HBL_INVALID");

  for (const item of targetStuffing) {
    item.row.getCell(stuffingHeaders.get("分提单")).value = hbl;
    item.values["分提单"] = hbl;
  }
  for (const item of targetCustoms) {
    item.row.getCell(customsHeaders.get("分提单")).value = hbl;
    item.values["分提单"] = hbl;
  }

  const groups = new Map();
  for (const item of targetStuffing) {
    const key = stuffingKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const duplicateGroups = [...groups.values()].filter(
    (group) => group.length > 1,
  );
  if (duplicateGroups.length !== 1 || duplicateGroups[0].length !== 2)
    throw new Error("BUSINESS_DATA_BLOCKER_SHAPE_INVALID");

  const group = duplicateGroups[0].toSorted((left, right) =>
    compareCanonicalStrings(
      canonicalStringify(left.values),
      canonicalStringify(right.values),
    ),
  );
  assertAggregateShape(
    group,
    stuffingHeaders,
    target.stuffing.provenanceFields,
  );
  const keeper = group[0];
  for (const field of AGGREGATE_FIELDS) {
    const bases = [...new Set(existingBases(lineageRows, group, field))];
    const aggregate = addDecimals(group.map((item) => item.values[field]));
    keeper.row.getCell(stuffingHeaders.get(field)).value = aggregate;
    keeper.values[field] = aggregate;
    appendLineage(sheets["26_样本构建清单"], [
      "11_装箱",
      rowKey(keeper),
      field,
      aggregate,
      `v0.5.1 aggregate${bases.length ? `; ${bases.toSorted(compareCanonicalStrings).join("; ")}` : ""}`,
    ]);
  }
  for (const field of target.stuffing.provenanceFields) {
    for (const item of group)
      appendLineage(sheets["26_样本构建清单"], [
        "11_装箱",
        rowKey(item),
        field,
        text(item.values[field]),
        "v0.5.1 provenance-only source value",
      ]);
    keeper.row.getCell(stuffingHeaders.get(field)).value = null;
    keeper.values[field] = null;
  }
  appendLineage(sheets["26_样本构建清单"], [
    "11_装箱",
    rowKey(keeper),
    "分提单",
    hbl,
    "v0.5.1 typed HBL from booking",
  ]);
  appendLineage(sheets["26_样本构建清单"], [
    "11a_出口报关",
    [targetCustoms[0].values["层级"], targetCustoms[0].values["报关发票号"]]
      .map(text)
      .join(" / "),
    "分提单",
    hbl,
    "v0.5.1 typed HBL from booking",
  ]);

  sheets["11_装箱"].spliceRows(group[1].rowNumber, 1);
  const output = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer: output,
    summary: {
      version: "v0.5.1",
      correctedHblGroups: 1,
      aggregatedStuffingGroups: 1,
      removedStuffingRows: 1,
    },
  };
}
