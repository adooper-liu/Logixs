import JSZip from "jszip";
import ExcelJS from "exceljs";
import { sha256Hex } from "./canonical-json.mjs";
import { fail, validateSourceManifest } from "./contracts.mjs";

export const XLSX_LIMITS = Object.freeze({
  sourceBytes: 5 * 1024 * 1024,
  zipEntries: 512,
  uncompressedBytes: 32 * 1024 * 1024,
  compressionRatio: 100,
  sheets: 64,
  rowsPerSheet: 5000,
  columnsPerSheet: 128,
  cellTextLength: 16 * 1024,
});
const forbiddenPrefixes = ["xl/externallinks/"];
const forbiddenExact = new Set([
  "xl/vbaproject.bin",
  "xl/connections.xml",
  "xl/externalconnections.xml",
]);

function centralDirectoryEntries(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buffer.length)
    unsafe("missing central directory");
  const count = buffer.readUInt16LE(eocd + 10);
  const offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let cursor = offset;
  for (let index = 0; index < count; index += 1) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== 0x02014b50
    )
      unsafe("invalid central directory");
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    entries.push({
      name,
      flags,
      compressedSize,
      uncompressedSize,
      externalAttributes,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function unsafe(reason) {
  throw new Error(`XLSX_UNSAFE: ${reason}`);
}

export async function inspectXlsxArchive(buffer, limits = XLSX_LIMITS) {
  if (!Buffer.isBuffer(buffer) || buffer.length > limits.sourceBytes)
    unsafe("source size");
  const centralEntries = centralDirectoryEntries(buffer);
  if (centralEntries.length > limits.zipEntries) unsafe("entry count");
  const centralNames = new Set();
  let centralUncompressedBytes = 0;
  for (const entry of centralEntries) {
    const normalized = entry.name.replaceAll("\\", "/");
    const lower = normalized.toLowerCase();
    if (
      centralNames.has(lower) ||
      normalized.startsWith("/") ||
      normalized.split("/").includes("..") ||
      [...normalized].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      unsafe("member name");
    if (entry.flags & 0x0001) unsafe("encrypted member");
    if (((entry.externalAttributes >>> 16) & 0xf000) === 0xa000)
      unsafe("symlink");
    if (
      forbiddenExact.has(lower) ||
      forbiddenPrefixes.some((prefix) => lower.startsWith(prefix))
    )
      unsafe("forbidden part");
    centralNames.add(lower);
    centralUncompressedBytes += entry.uncompressedSize;
    if (centralUncompressedBytes > limits.uncompressedBytes)
      unsafe("expanded size");
    if (
      entry.uncompressedSize / Math.max(entry.compressedSize, 1) >
      limits.compressionRatio
    )
      unsafe("compression ratio");
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer, {
      checkCRC32: true,
      createFolders: false,
    });
  } catch {
    unsafe("invalid archive");
  }
  const names = new Set();
  let uncompressedBytes = centralUncompressedBytes;
  for (const entry of Object.values(zip.files)) {
    const normalized = entry.name.replaceAll("\\", "/");
    const lower = normalized.toLowerCase();
    if (
      names.has(lower) ||
      normalized.startsWith("/") ||
      normalized.split("/").includes("..") ||
      [...normalized].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      unsafe("member name");
    if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name)
      unsafe("path normalization");
    if (
      entry.dir === false &&
      entry.unixPermissions &&
      (entry.unixPermissions & 0o170000) === 0o120000
    )
      unsafe("symlink");
    if (
      forbiddenExact.has(lower) ||
      forbiddenPrefixes.some((prefix) => lower.startsWith(prefix))
    )
      unsafe("forbidden part");
    names.add(lower);
    if (!centralNames.has(lower)) unsafe("central directory mismatch");
  }
  if (names.size !== centralEntries.length) unsafe("duplicate member");
  if (uncompressedBytes / Math.max(buffer.length, 1) > limits.compressionRatio)
    unsafe("compression ratio");
  const workbook = zip.file("xl/workbook.xml");
  if (!workbook) unsafe("missing workbook");
  const workbookXml = await workbook.async("string");
  const protectionTags =
    workbookXml.match(/<workbookProtection\b[^>]*>/giu) ?? [];
  if (
    /<fileSharing|encryptedPackage/iu.test(workbookXml) ||
    protectionTags.some((tag) => !/<workbookProtection\b\s*\/>/iu.test(tag))
  )
    unsafe("encrypted workbook");
  return {
    entryCount: names.size,
    uncompressedBytes,
    names: [...names].sort(),
  };
}

function normalizeText(value, limits = XLSX_LIMITS) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date)
    return {
      rawText: value.toISOString(),
      excelSerial: null,
      kind: "datetime",
    };
  const text = String(value).normalize("NFC").replace(/\r\n?/gu, "\n").trim();
  return text.length > limits.cellTextLength
    ? unsafe("cell text length")
    : text;
}

function generatorRowKey(row, limits = XLSX_LIMITS) {
  const parts = [2, 3].map((columnNumber) => {
    const value = normalizeText(row.getCell(columnNumber).value, limits);
    return value && typeof value === "object" && "rawText" in value
      ? value.rawText.trim()
      : String(value ?? "").trim();
  });
  return parts.some(Boolean) ? parts.join(" / ") : null;
}

export async function scanWorkbook(
  { buffer, sourceManifest, policy },
  limits = XLSX_LIMITS,
) {
  validateSourceManifest(sourceManifest);
  await inspectXlsxArchive(buffer, limits);
  if (
    sha256Hex(buffer) !== sourceManifest.sha256 ||
    buffer.length !== sourceManifest.sizeBytes
  )
    fail("SOURCE_FINGERPRINT_MISMATCH");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, { ignoreNodes: ["extLst"] });
  if (workbook.worksheets.length > limits.sheets) unsafe("sheet count");
  const sheets = [];
  for (const sheet of workbook.worksheets) {
    const rule = policy?.sheets?.find((item) => item.name === sheet.name);
    if (!rule) fail("UNKNOWN_SHEET");
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (
          cell.type === ExcelJS.ValueType.Formula ||
          cell.model?.formula ||
          cell.formula
        )
          throw new Error("XLSX_FORMULA_FORBIDDEN");
      });
    });
    const headerRow = rule.headerRow;
    const header = sheet.getRow(headerRow);
    const headers = header.values
      .slice(1)
      .map((value) => normalizeText(value, limits));
    if (sheet.columnCount > limits.columnsPerSheet) unsafe("column count");
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      if (rows.length >= limits.rowsPerSheet) unsafe("row count");
      const valuesByHeader = {};
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const name = headers[columnNumber - 1];
        if (name) valuesByHeader[name] = normalizeText(cell.value, limits);
      });
      if (
        Object.values(valuesByHeader).some(
          (value) =>
            value !== null &&
            typeof value === "string" &&
            value.length > limits.cellTextLength,
        )
      )
        unsafe("cell text length");
      if (Object.keys(valuesByHeader).length)
        rows.push({
          workbookRow: rowNumber,
          rowKey: generatorRowKey(row, limits),
          valuesByHeader,
        });
    });
    sheets.push({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      headerRow,
      headers,
      headerFingerprint: sha256Hex(JSON.stringify(headers)),
      rows,
    });
  }
  if (
    sheets.length !== policy.sheets.length ||
    sheets.some(
      (sheet) => !policy.sheets.some((rule) => rule.name === sheet.name),
    )
  )
    fail("SHEET_SET_INVALID");
  for (const sheet of sheets) {
    const rule = policy.sheets.find(
      (candidate) => candidate.name === sheet.name,
    );
    if (
      rule.headerFingerprint &&
      rule.headerFingerprint !== sheet.headerFingerprint
    )
      fail("HEADER_FINGERPRINT_DRIFT");
  }
  return {
    sourceAlias: sourceManifest.sourceAlias,
    workbookVersion: sourceManifest.workbookVersion,
    sheets,
  };
}
