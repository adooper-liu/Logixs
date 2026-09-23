import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = fileURLToPath(new URL("..", import.meta.url));
const requireFromApi = createRequire(resolve(root, "apps/api/package.json"));
const ExcelJS = requireFromApi("exceljs");
const inventoryPath = resolve(
  root,
  "docs/product/domain/evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json",
);
const fixturePath = resolve(
  root,
  "packages/contracts/fixtures/v1/post-departure-container-operational-source.json",
);

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const sourceRoot = resolve(process.argv[2] ?? inventory.sourceRoot);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const normalizeCellValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "object" && "result" in value) {
    return normalizeCellValue(value.result);
  }
  throw new Error(`unsupported Excel cell value: ${JSON.stringify(value)}`);
};

const detailSources = inventory.sourceFiles.filter(
  ({ role }) => role === "read_only_detail_fixture",
);
const records = [];
let expectedHeaders;

for (const source of detailSources) {
  const sourcePath = resolve(sourceRoot, source.file);
  if (!existsSync(sourcePath)) {
    throw new Error(`source workbook not found: ${sourcePath}`);
  }
  const buffer = readFileSync(sourcePath);
  const observedHash = sha256(buffer);
  if (observedHash !== source.sha256) {
    throw new Error(
      `${source.file}: SHA-256 mismatch (${observedHash} != ${source.sha256})`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length !== 1) {
    throw new Error(`${source.file}: expected exactly one worksheet`);
  }
  const worksheet = workbook.worksheets[0];
  if (worksheet.actualRowCount !== 2 || worksheet.actualColumnCount !== 97) {
    throw new Error(
      `${source.file}: expected actual range 2x97, got ${worksheet.actualRowCount}x${worksheet.actualColumnCount}`,
    );
  }

  const headers = Array.from({ length: 97 }, (_, index) =>
    String(worksheet.getCell(1, index + 1).value ?? "").trim(),
  );
  const headerSignature = sha256(Buffer.from(headers.join("|"), "utf8"));
  if (headerSignature !== source.headerSignature) {
    throw new Error(`${source.file}: header signature mismatch`);
  }
  expectedHeaders ??= headers;
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
    throw new Error(
      `${source.file}: detail headers differ from the first fixture`,
    );
  }

  const values = Object.fromEntries(
    headers.map((header, index) => [
      header,
      normalizeCellValue(worksheet.getCell(2, index + 1).value),
    ]),
  );
  records.push({
    sourceFile: basename(sourcePath),
    sourceSha256: observedHash,
    sourceSheet: worksheet.name,
    declaredRange: source.declaredRange,
    actualRange: source.actualRange,
    containerNumber: values["集装箱号"],
    replenishmentOrderNumber: values["备货单号"],
    billNumber: values["提单号"],
    values,
  });
}

const fixture = {
  schemaVersion: "1.0.0",
  purpose: "read_only_container_operational_view_reconciliation",
  sourceInventoryRef:
    "docs/product/domain/evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json",
  projectionContract: "container_operational_view.v1",
  sourceParser:
    "Excel cell enumeration independent of the incorrect worksheet dimension metadata",
  headerSignature: detailSources[0]?.headerSignature,
  headers: expectedHeaders,
  records,
};

writeFileSync(
  fixturePath,
  await format(JSON.stringify(fixture), { parser: "json" }),
);
console.log(
  `Extracted ${records.length} real detail records with ${expectedHeaders.length} columns to ${fixturePath}`,
);
