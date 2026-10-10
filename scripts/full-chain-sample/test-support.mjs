import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

export async function createSyntheticWorkbook({
  sheets = [
    {
      name: "09_出运计划",
      headers: ["出运计划编号"],
      rows: [["PLAN-DEMO-001"]],
    },
  ],
  formula = null,
  cachedValue = null,
  formulaCell = "A7",
} = {}) {
  const workbook = new ExcelJS.Workbook();
  for (const definition of sheets) {
    const sheet = workbook.addWorksheet(definition.name);
    sheet.getRow(6).values = definition.headers;
    for (const [index, values] of (definition.rows ?? []).entries())
      sheet.getRow(7 + index).values = values;
    if (formula)
      sheet.getCell(formulaCell).value = { formula, result: cachedValue };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "full-chain-sample-"));
}
export function manifestFor(buffer, overrides = {}) {
  return {
    manifestVersion: "full-chain-source-manifest.v1",
    sourceAlias: "sample-fixture-v1",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sizeBytes: buffer.length,
    workbookVersion: "fixture-v1",
    authorizedUse: "local_demo_rehearsal",
    ...overrides,
  };
}
