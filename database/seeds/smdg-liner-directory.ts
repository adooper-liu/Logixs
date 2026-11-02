import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

export const SMDG_SOURCE = {
  authority: "SMDG",
  codeList: "Liner Code List",
  version: "20261028",
  sourceUrl:
    "https://smdg.org/wp-content/uploads/Codelists/lines/SMDG-Liner-codes-list-20261028.xlsx",
  retrievedAt: "2026-10-30",
  license: "public-download; license-not-stated",
};
export interface SmdgLinerRow {
  code: string;
  name: string;
  parent: string | null;
  nvocc: boolean | null;
  vocc: boolean | null;
  validFrom: string | null;
  validUntil: string | null;
  status: "active" | "deprecated" | "not_yet_valid" | "review_required";
  issues: string[];
  sourceRow: number;
  sourceRowHash: string;
}
export async function parseSmdgWorkbook(bytes: Buffer, asOf: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
  const sheet = workbook.getWorksheet(SMDG_SOURCE.version);
  if (
    !sheet ||
    sheet.getRow(9).getCell(1).text.trim() !== "Code" ||
    sheet.getRow(9).getCell(2).text.trim() !== "Line"
  )
    throw new Error("SMDG_HEADER_MISMATCH");
  const rows: SmdgLinerRow[] = [];
  const keys = new Set<string>();
  sheet.eachRow((row, index) => {
    if (index < 10) return;
    const code = row.getCell(1).text.trim();
    if (!code) return;
    if (!/^[A-Z0-9]{3}$/.test(code) || keys.has(code))
      throw new Error(`SMDG_CODE_INVALID_OR_DUPLICATE:${code}`);
    keys.add(code);
    const name = row.getCell(2).text.trim();
    if (!name) throw new Error(`SMDG_NAME_MISSING:${code}`);
    const flag = (column: number): boolean | null => {
      const text = row.getCell(column).text.trim();
      if (text === "") return null;
      if (text.toUpperCase() !== "X")
        throw new Error(`SMDG_FLAG_UNKNOWN:${code}:${text}`);
      return true;
    };
    const issues: string[] = [];
    const date = (column: number): string | null => {
      const value = row.getCell(column).value;
      if (value === null) return null;
      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        issues.push(`column${column}:${row.getCell(column).text}`);
        return null;
      }
      return value.toISOString().slice(0, 10);
    };
    const validFrom = date(7),
      validUntil = date(8);
    const record = {
      code,
      name,
      parent: row.getCell(3).text.trim() || null,
      nvocc: flag(4),
      vocc: flag(5),
      validFrom,
      validUntil,
      status: issues.length
        ? ("review_required" as const)
        : validUntil && validUntil < asOf
          ? ("deprecated" as const)
          : validFrom && validFrom > asOf
            ? ("not_yet_valid" as const)
            : ("active" as const),
      sourceRow: index,
    };
    rows.push({
      ...record,
      issues,
      sourceRowHash: hash(JSON.stringify({ ...record, issues })),
    });
  });
  return { source: { ...SMDG_SOURCE, sourceSha256: hash(bytes), asOf }, rows };
}
function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
