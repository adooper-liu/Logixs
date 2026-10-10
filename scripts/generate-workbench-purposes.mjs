import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const prettier = require("prettier");

export const EXPECTED_WORKBENCH_CODES = [
  "market_signals",
  "product_selection",
  "product_npi",
  "master_data",
  "sourcing",
  "demand_replenishment",
  "procurement",
  "supply_readiness",
  "shipment_planning",
  "booking",
  "cargo_ready",
  "stuffing",
  "export_customs",
  "dispatch",
  "ocean_operations",
  "customs",
  "pickup",
  "delivery",
  "unloading",
  "empty_return",
  "compliance_operations",
  "charges",
  "exceptions",
];

const AUTHORITY_HEADING = "## 三、当前项目定义的全部 23 个工作台";
const SOURCE_PATH = "doc/cross-border-supply-chain/08-role-workbenches.md";
const GENERATED_PATH = "apps/web/src/data/workbenchPurposes.generated.ts";

function unmark(value) {
  return value.replaceAll("`", "").trim();
}

function parseRow(line) {
  if (!line.trim().startsWith("|")) return null;
  const cells = line
    .trim()
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length < 5 || !/^\d+$/.test(cells[0])) return null;

  const [sequenceText, codeText, title, kind, businessPurpose] = cells;
  const code = unmark(codeText);
  return {
    sequence: Number(sequenceText),
    code,
    title: unmark(title),
    kind: unmark(kind),
    businessPurpose: unmark(businessPurpose),
  };
}

export function parseWorkbenchPurposeTable(markdown) {
  const headingIndex = markdown.indexOf(AUTHORITY_HEADING);
  if (headingIndex < 0) {
    throw new Error(`WORKBENCH_PURPOSE_TABLE_MISSING:${AUTHORITY_HEADING}`);
  }

  const section = markdown.slice(headingIndex + AUTHORITY_HEADING.length);
  const rows = section.split(/\r?\n/).map(parseRow).filter(Boolean);
  const seen = new Set();

  for (const row of rows) {
    if (seen.has(row.code)) {
      throw new Error(`WORKBENCH_PURPOSE_DUPLICATE_CODE:${row.code}`);
    }
    seen.add(row.code);
    if (!EXPECTED_WORKBENCH_CODES.includes(row.code)) {
      throw new Error(`WORKBENCH_PURPOSE_UNKNOWN_CODE:${row.code}`);
    }
    if (!row.title || !row.businessPurpose) {
      throw new Error(`WORKBENCH_PURPOSE_EMPTY_FIELD:${row.code}`);
    }
  }

  for (const code of EXPECTED_WORKBENCH_CODES) {
    if (!seen.has(code)) {
      throw new Error(`WORKBENCH_PURPOSE_MISSING_CODE:${code}`);
    }
  }

  for (const [index, row] of rows.entries()) {
    if (row.sequence !== index + 1) {
      throw new Error(`WORKBENCH_PURPOSE_SEQUENCE:${row.sequence}`);
    }
  }

  return rows;
}

function quote(value) {
  return JSON.stringify(value);
}

export async function renderWorkbenchPurposeProjection(rows) {
  const codeUnion = rows.map((row) => `  | ${quote(row.code)}`).join("\n");
  const purposeRows = rows
    .map(
      (row) =>
        `  { code: ${quote(row.code)}, title: ${quote(row.title)}, businessPurpose: ${quote(row.businessPurpose)} },`,
    )
    .join("\n");

  const source = `// Generated from ${SOURCE_PATH}; do not edit by hand.\n// 禁止手工修改：运行 workbench-purposes:generate 更新此文件。\n\nexport type WorkbenchCode =\n${codeUnion};\n\nexport interface WorkbenchPurpose {\n  readonly code: WorkbenchCode;\n  readonly title: string;\n  readonly businessPurpose: string;\n}\n\nexport const workbenchPurposes: readonly WorkbenchPurpose[] = [\n${purposeRows}\n];\n\nexport const workbenchPurposeByCode: Readonly<\n  Record<WorkbenchCode, WorkbenchPurpose>\n> = Object.fromEntries(\n  workbenchPurposes.map((purpose) => [purpose.code, purpose]),\n) as Record<WorkbenchCode, WorkbenchPurpose>;\n`;

  return prettier.format(source, { parser: "typescript" });
}

export async function compareWorkbenchPurposeProjection({
  authorityText,
  committedText,
}) {
  const expected = await renderWorkbenchPurposeProjection(
    parseWorkbenchPurposeTable(authorityText),
  );
  return {
    matches: expected === committedText,
    expected,
    actual: committedText,
  };
}

async function run() {
  const authorityPath = resolve(repositoryRoot, SOURCE_PATH);
  const generatedPath = resolve(repositoryRoot, GENERATED_PATH);
  const authorityText = readFileSync(authorityPath, "utf8");
  const committedText = existsSync(generatedPath)
    ? readFileSync(generatedPath, "utf8")
    : "";
  const projection = await compareWorkbenchPurposeProjection({
    authorityText,
    committedText,
  });

  if (process.argv.includes("--check")) {
    if (!projection.matches) {
      console.error(
        `${GENERATED_PATH}: generated workbench purpose projection is out of date`,
      );
      process.exitCode = 1;
    }
    return;
  }

  writeFileSync(generatedPath, projection.expected, "utf8");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await run();
}
