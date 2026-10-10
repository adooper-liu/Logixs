import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EXPECTED_WORKBENCH_CODES,
  compareWorkbenchPurposeProjection,
  parseWorkbenchPurposeTable,
  renderWorkbenchPurposeProjection,
} from "./generate-workbench-purposes.mjs";

const authorityPath = new URL(
  "../doc/cross-border-supply-chain/08-role-workbenches.md",
  import.meta.url,
);
const authorityMarkdown = readFileSync(authorityPath, "utf8");

test("parses exactly the approved 23 workbench purposes from the authority table", () => {
  const rows = parseWorkbenchPurposeTable(authorityMarkdown);

  assert.equal(rows.length, 23);
  assert.deepEqual(
    rows.map((row) => row.sequence),
    Array.from({ length: 23 }, (_, index) => index + 1),
  );
  assert.equal(rows[0].code, "market_signals");
  assert.equal(rows.at(-1).code, "exceptions");
  assert.equal(rows.find((row) => row.code === "customs").title, "进口清关");
  assert.ok(
    rows.every((row) => row.title.length > 0 && row.businessPurpose.length > 0),
  );
  assert.deepEqual(
    rows.map((row) => row.code),
    EXPECTED_WORKBENCH_CODES,
  );
});

test("rejects duplicate stable codes", () => {
  const duplicate = authorityMarkdown.replace(
    "| 2        | `product_selection`",
    "| 2        | `market_signals`",
  );

  assert.throws(
    () => parseWorkbenchPurposeTable(duplicate),
    /WORKBENCH_PURPOSE_DUPLICATE_CODE:market_signals/,
  );
});

test("rejects a missing approved stable code", () => {
  const withoutBooking = authorityMarkdown.replace(
    /\| 10\s+\| `booking`[^\n]*\n/,
    "",
  );

  assert.throws(
    () => parseWorkbenchPurposeTable(withoutBooking),
    /WORKBENCH_PURPOSE_MISSING_CODE:booking/,
  );
});

test("rejects an unknown stable code", () => {
  const withUnknown = authorityMarkdown.replace(
    "| 1        | `market_signals`",
    "| 1        | `unknown_workbench`",
  );

  assert.throws(
    () => parseWorkbenchPurposeTable(withUnknown),
    /WORKBENCH_PURPOSE_UNKNOWN_CODE:unknown_workbench/,
  );
});

test("renders a deterministic TypeScript projection", async () => {
  const rows = parseWorkbenchPurposeTable(authorityMarkdown);
  const first = await renderWorkbenchPurposeProjection(rows);
  const second = await renderWorkbenchPurposeProjection(rows);

  assert.equal(first, second);
  assert.match(first, /禁止手工修改[\s\S]*export interface WorkbenchPurpose/);
});

test("check mode reports projection drift without writing", async () => {
  const committedText = "old generated content";
  const result = await compareWorkbenchPurposeProjection({
    authorityText: authorityMarkdown,
    committedText,
  });

  assert.equal(result.matches, false);
  assert.equal(
    result.expected,
    await renderWorkbenchPurposeProjection(
      parseWorkbenchPurposeTable(authorityMarkdown),
    ),
  );
  assert.equal(result.actual, committedText);
});
