# Full-Chain Sample Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, deterministic, fail-closed compiler that turns the approved warehouse-external `full-chain-workbench-sample-v0.5` workbook into an auditable canonical sample package without connecting to PostgreSQL, MinIO, or Temporal.

**Architecture:** A security scanner validates the XLSX archive before ExcelJS parses it. A versioned policy identifies all 33 sheets and defines six pilot record mappings. A classifier combines the policy with workbook sheets `25_推导依据` and `26_样本构建清单` to keep R/D/S/P distinct. The compiler writes a deterministic package plus a non-hashed run receipt to a new output directory by atomic rename; it never writes business systems.

**Tech Stack:** Node.js 22 ESM, `exceljs`, `jszip`, `ajv` / JSON Schema 2020-12, built-in `node:test`, `node:crypto`, `node:fs`.

**Spec:** `docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md`

## Global Constraints

- Scope is Brief 1 only: scan, classify, compile, report, and fail closed. No adapter, purge, seed, database, object-store, Temporal, API, or UI work.
- The external source is referenced in Git only as `full-chain-workbench-sample-v0.5`; absolute path, exact source hash, byte size, modification time, raw rows, and complete output package stay outside Git and model output.
- R is a source-fact candidate, D keeps source inputs plus algorithm/version, S is explicitly rehearsal-only, and P goes only to `gaps.json`.
- A fixed external source manifest supplies the exact fingerprint at runtime. Fingerprint drift, unknown sheet/header, unclassified cell, broken reference, unauthorized rule, unsafe workbook content, or nondeterministic output makes `publishable=false` and returns non-zero.
- The compiler process must not read database/object-store/workflow environment variables and must not import Prisma, AWS/MinIO, Temporal, API, or Web packages.
- Do not commit the real workbook, external manifest, full records, lineage, gaps, checks, report, source-derived hashes, or sensitive values.
- Use exact dependency versions already in the repository. Add no dependency.
- Every production change follows RED → GREEN → REFACTOR and ends with its focused tests.

## Review Focus

1. **ZIP/XML abuse:** oversized expansion, duplicate ZIP paths, traversal paths, macro/external-link/connection parts, encrypted content, and formulas must be rejected before any canonical record is emitted. Task 2 owns these tests.
2. **Classification leakage:** a `P` or unclassified value must never reach `records`; D without a derivation and S without a scenario label must fail closed. Task 3 owns these tests.
3. **Identity and reference integrity:** duplicate business keys, ambiguous aliases, and missing cross-sheet targets must make the package unpublishable. Task 4 owns these tests.
4. **Determinism and privacy:** Windows/Linux path and line-ending differences must not change `packageHash`; stdout/stderr and committed fixtures must not expose absolute paths, source values, names, contracts, container numbers, or full hashes. Task 5 owns these tests.
5. **Output safety:** existing output directories, partial writes, interrupted compiles, and `publishable=false` packages must never appear as a successful publish. Task 5 owns these tests.

---

## File Structure

### New runtime modules

- `scripts/full-chain-sample/contracts.mjs` — load and validate source manifest, policy, and canonical package schemas.
- `scripts/full-chain-sample/canonical-json.mjs` — stable object ordering, LF normalization, SHA-256 helpers, and package-hash projection.
- `scripts/full-chain-sample/xlsx-security.mjs` — pre-parse ZIP member and workbook-part safety checks.
- `scripts/full-chain-sample/workbook-scan.mjs` — ExcelJS read-only logical scan into a value-neutral workbook model.
- `scripts/full-chain-sample/classification.mjs` — build construction/derivation/pending indexes and classify mapped cells as R/D/S/P.
- `scripts/full-chain-sample/policy.mjs` — load the committed v0.5 structural policy and expose pilot mappings.
- `scripts/full-chain-sample/compile-records.mjs` — compile the six pilot workbench record types.
- `scripts/full-chain-sample/reconcile.mjs` — business-key and cross-sheet reference checks.
- `scripts/full-chain-sample/package-writer.mjs` — build manifest/records/lineage/gaps/checks/report and atomically publish a new output directory.
- `scripts/compile-full-chain-sample.mjs` — CLI parsing, orchestration, stable exit codes, and safe console receipt.

### New schemas and policy

- `scripts/full-chain-sample/schemas/source-manifest.schema.json`
- `scripts/full-chain-sample/schemas/policy.schema.json`
- `scripts/full-chain-sample/schemas/package-manifest.schema.json`
- `scripts/full-chain-sample/schemas/canonical-record.schema.json`
- `scripts/full-chain-sample/schemas/gap.schema.json`
- `scripts/full-chain-sample/schemas/check.schema.json`
- `scripts/full-chain-sample/policies/v0.5.json`

### New tests

- `scripts/full-chain-sample/test-support.mjs` — create synthetic XLSX buffers and safe, fictional manifests/policies.
- `scripts/full-chain-sample/contracts.test.mjs`
- `scripts/full-chain-sample/xlsx-security.test.mjs`
- `scripts/full-chain-sample/classification.test.mjs`
- `scripts/full-chain-sample/compile-records.test.mjs`
- `scripts/full-chain-sample/package-writer.test.mjs`
- `scripts/compile-full-chain-sample.test.mjs`

### Modified integration points

- `package.json` — add `sample:full-chain:compile` and `test:full-chain-sample`; include the focused suite in root `test`.
- `.gitignore` — ignore only the declared local output root `.sample-output/`; do not add broad workbook or JSON ignores.
- `docs/planning/tasks/full-chain-sample-v05-compiler-v1.md` — main-agent-owned Brief 1, created before implementation dispatch; implementers may append check results only when the brief authorizes it.

---

### Task 1: Canonical Contracts and Deterministic JSON

**Files:**

- Create: `scripts/full-chain-sample/schemas/source-manifest.schema.json`
- Create: `scripts/full-chain-sample/schemas/policy.schema.json`
- Create: `scripts/full-chain-sample/schemas/package-manifest.schema.json`
- Create: `scripts/full-chain-sample/schemas/canonical-record.schema.json`
- Create: `scripts/full-chain-sample/schemas/gap.schema.json`
- Create: `scripts/full-chain-sample/schemas/check.schema.json`
- Create: `scripts/full-chain-sample/contracts.mjs`
- Create: `scripts/full-chain-sample/canonical-json.mjs`
- Create: `scripts/full-chain-sample/contracts.test.mjs`

**Interfaces:**

- Produces:
  - `validateSourceManifest(value: unknown): SourceManifest`
  - `validatePolicy(value: unknown): CompilerPolicy`
  - `validatePackageArtifacts(value: PackageArtifacts): void`
  - `canonicalStringify(value: unknown): string`
  - `sha256Hex(value: Buffer | string): string`
  - `packageHashProjection(artifacts: PackageArtifacts): object`
- Consumes: repository `ajv`, `ajv-formats`, and Node crypto/fs only.

- [ ] **Step 1: Write failing schema-validation tests**

Create `contracts.test.mjs` with literal fictional data:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateSourceManifest,
  validatePackageArtifacts,
} from "./contracts.mjs";

const sourceManifest = {
  manifestVersion: "full-chain-source-manifest.v1",
  sourceAlias: "sample-fixture-v1",
  sha256: "a".repeat(64),
  sizeBytes: 1024,
  workbookVersion: "fixture-v1",
  authorizedUse: "local_demo_rehearsal",
};

test("source manifest rejects paths and unknown authorization", () => {
  assert.throws(
    () =>
      validateSourceManifest({
        ...sourceManifest,
        absolutePath: "C:/private/sample.xlsx",
      }),
    /SOURCE_MANIFEST_INVALID/,
  );
  assert.throws(
    () =>
      validateSourceManifest({
        ...sourceManifest,
        authorizedUse: "production",
      }),
    /SOURCE_MANIFEST_INVALID/,
  );
});

test("package validation rejects P and incomplete D/S records", () => {
  const base = canonicalPackageFixture();
  assert.throws(
    () =>
      validatePackageArtifacts({
        ...base,
        records: [{ ...base.records[0], evidenceClass: "P" }],
      }),
    /PACKAGE_RECORD_INVALID/,
  );
  assert.throws(
    () =>
      validatePackageArtifacts({
        ...base,
        records: [{ ...base.records[0], evidenceClass: "D", derivation: null }],
      }),
    /PACKAGE_RECORD_INVALID/,
  );
});
```

The helper fixture must use fictional values such as `PLAN-DEMO-001`; never copy workbook values.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test scripts/full-chain-sample/contracts.test.mjs
```

Expected: FAIL because `contracts.mjs` and schemas do not exist.

- [ ] **Step 3: Implement exact schema boundaries**

`source-manifest.schema.json` must be `additionalProperties: false` and require exactly:

```json
{
  "manifestVersion": "full-chain-source-manifest.v1",
  "sourceAlias": "sample-fixture-v1",
  "sha256": "64 lowercase hex chars",
  "sizeBytes": 1024,
  "workbookVersion": "fixture-v1",
  "authorizedUse": "local_demo_rehearsal"
}
```

`canonical-record.schema.json` must require:

```js
{
  recordType: string,
  recordVersion: "v1",
  businessKey: string,
  sampleLine: string,
  evidenceClass: "R" | "D" | "S",
  source: {
    sheet: string,
    row: number,
    sourceRef: string,
    originalValueHash: string,
  },
  derivation: null | { code: string, version: string, inputRefs: string[] },
  scenario: null | { label: string, allowedUse: "local_demo_rehearsal" },
  payload: object,
}
```

Cross-field validation in `contracts.mjs` must enforce:

```js
if (record.evidenceClass === "D" && !record.derivation)
  fail("PACKAGE_RECORD_INVALID");
if (record.evidenceClass !== "D" && record.derivation !== null)
  fail("PACKAGE_RECORD_INVALID");
if (record.evidenceClass === "S" && !record.scenario)
  fail("PACKAGE_RECORD_INVALID");
if (record.evidenceClass !== "S" && record.scenario !== null)
  fail("PACKAGE_RECORD_INVALID");
```

`packageHashProjection()` must exclude `compiledAt`, `operator`, output path, and local source path. Include source fingerprint, compiler/policy/mapping versions, sorted records, lineage, gaps, and checks.

- [ ] **Step 4: Add deterministic JSON tests**

```js
test("canonical JSON ignores object insertion order and normalizes CRLF", () => {
  assert.equal(
    canonicalStringify({ b: "x\r\ny", a: 1 }),
    canonicalStringify({ a: 1, b: "x\ny" }),
  );
});

test("volatile receipt fields do not affect package hash projection", () => {
  const first = {
    ...packageFixture(),
    compiledAt: "2026-01-01T00:00:00Z",
    operator: "one",
  };
  const second = {
    ...first,
    compiledAt: "2026-02-01T00:00:00Z",
    operator: "two",
  };
  assert.deepEqual(packageHashProjection(first), packageHashProjection(second));
});
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
node --test scripts/full-chain-sample/contracts.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add scripts/full-chain-sample/schemas scripts/full-chain-sample/contracts.mjs scripts/full-chain-sample/canonical-json.mjs scripts/full-chain-sample/contracts.test.mjs
git commit -m "feat(samples): define canonical package contracts"
```

---

### Task 2: Secure XLSX Scanner

**Files:**

- Create: `scripts/full-chain-sample/xlsx-security.mjs`
- Create: `scripts/full-chain-sample/workbook-scan.mjs`
- Create: `scripts/full-chain-sample/test-support.mjs`
- Create: `scripts/full-chain-sample/xlsx-security.test.mjs`

**Interfaces:**

- Consumes: `validateSourceManifest()`, `sha256Hex()` from Task 1.
- Produces:
  - `inspectXlsxArchive(buffer: Buffer, limits?: ScanLimits): Promise<ArchiveInspection>`
  - `scanWorkbook({ buffer, sourceManifest, policy }: ScanInput): Promise<WorkbookScan>`
  - `createSyntheticWorkbook(options): Promise<Buffer>` for tests only.

Use these fixed limits:

```js
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
```

- [ ] **Step 1: Write archive security tests first**

Test all review-focus cases with synthetic, non-business content:

```js
test("scanner rejects macro, external links, connections, traversal and duplicate members", async () => {
  for (const mutate of [
    addZipEntry("xl/vbaProject.bin", "x"),
    addZipEntry("xl/externalLinks/externalLink1.xml", "<x/>") ,
    addZipEntry("xl/connections.xml", "<x/>") ,
    addZipEntry("../escape.xml", "x"),
    duplicateZipEntry("xl/workbook.xml"),
  ]) {
    await assert.rejects(() => inspectXlsxArchive(await mutate(safeWorkbook())), /XLSX_UNSAFE/);
  }
});

test("scanner rejects formulas even when cached values exist", async () => {
  const buffer = await createSyntheticWorkbook({ formula: "1+1", cachedValue: 2 });
  await assert.rejects(() => scanWorkbook(scanInput(buffer)), /XLSX_FORMULA_FORBIDDEN/);
});
```

Also test file size, uncompressed size, ratio, sheet count, row count, column count, and cell length individually. Do not combine them into one opaque assertion.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test scripts/full-chain-sample/xlsx-security.test.mjs
```

Expected: FAIL because scanner modules do not exist.

- [ ] **Step 3: Implement ZIP preflight before ExcelJS**

`inspectXlsxArchive()` must use JSZip only to inspect metadata and raw XML names before ExcelJS sees the buffer. Reject:

```js
const forbiddenPrefixes = ["xl/externalLinks/"];
const forbiddenExact = new Set([
  "xl/vbaProject.bin",
  "xl/connections.xml",
  "xl/externalConnections.xml",
]);
```

Normalize ZIP names to `/`, reject absolute paths, `..` segments, NUL/control characters, case-insensitive duplicates, and symlink-like external attributes. Sum uncompressed sizes and enforce the ratio against `Math.max(buffer.length, 1)`.

The scanner must compare `sha256Hex(buffer)` and `buffer.length` to the external source manifest before parsing.

- [ ] **Step 4: Implement the value-neutral workbook model**

`WorkbookScan` contains only data needed by later classification:

```js
{
  sourceAlias,
  workbookVersion,
  sheets: [{
    name,
    rowCount,
    columnCount,
    headerRow,
    headers,
    headerFingerprint,
    rows: [{ workbookRow, valuesByHeader }],
  }],
}
```

Rules:

- policy supplies `headerRow`; never guess it;
- normalize text to NFC and LF, trim only outer whitespace;
- preserve date precision as `{ rawText, excelSerial, kind: "date" | "datetime" | "text" }`; do not infer timezone in scanner;
- reject formulas by checking ExcelJS cell type/model, not just leading `=`;
- do not log row values;
- do not include absolute source path in the returned model.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
node --test scripts/full-chain-sample/xlsx-security.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/full-chain-sample/xlsx-security.mjs scripts/full-chain-sample/workbook-scan.mjs scripts/full-chain-sample/test-support.mjs scripts/full-chain-sample/xlsx-security.test.mjs
git commit -m "feat(samples): add fail-closed workbook scanner"
```

---

### Task 3: Versioned v0.5 Policy and R/D/S/P Classification

**Files:**

- Create: `scripts/full-chain-sample/policies/v0.5.json`
- Create: `scripts/full-chain-sample/policy.mjs`
- Create: `scripts/full-chain-sample/classification.mjs`
- Create: `scripts/full-chain-sample/classification.test.mjs`

**Interfaces:**

- Consumes: `WorkbookScan`, `validatePolicy()`, canonical hash helpers.
- Produces:
  - `loadCompilerPolicy(path): CompilerPolicy`
  - `buildProvenanceIndexes(scan, policy): ProvenanceIndexes`
  - `classifyMappedValue(input): ClassifiedValue | Gap`
  - `sheetDisposition(sheetName): "records" | "evidence_only" | "gap" | "unsupported"`

- [ ] **Step 1: Commit the exact 33-sheet structural policy without business values**

`v0.5.json` must contain these names exactly, each with `headerRow` and disposition:

```text
00_说明与总览
00b_资料分类
01_市场信号
02_选品立项
03_NPI
04_主数据
05_寻源
06_需求补货
07_采购
08_可出运供给
09_出运计划
09a_订舱
10_备货
11_装箱
11a_出口报关
12_出运
13_海运运营
13a_外部跟踪字段
14_进口清关
15_提柜
16_送仓
17_卸柜
18_还箱
19_费用
19a_费率表
19b_滞港费计算
20_异常中心
21_交接链
22_对账
23_待确认
24_历史实绩
25_推导依据
26_样本构建清单
```

Dispositions:

- `records`: `09_出运计划`, `09a_订舱`, `10_备货`, `11_装箱`, `11a_出口报关`, `12_出运`;
- `evidence_only`: `00_说明与总览`, `00b_资料分类`, `13a_外部跟踪字段`, `22_对账`, `24_历史实绩`, `25_推导依据`, `26_样本构建清单`;
- `gap`: `23_待确认`;
- `unsupported`: every remaining workbench sheet in Brief 1.

Header rows are `6` for workbench/derivation/construction sheets and must be asserted from the structural policy. Metadata sheets that do not compile records may declare their actual header row only when consumed by classification/checks.

- [ ] **Step 2: Write classification tests before implementation**

Use a synthetic workbook with the same structural sheet names but fictional keys:

```js
test("construction index overrides a direct-source candidate to S", () => {
  const indexes = provenanceFixture({
    constructed: [
      {
        sheet: "09_出运计划",
        identity: "PLAN-DEMO-001",
        field: "出运计划编号",
      },
    ],
  });
  assert.deepEqual(classifyMappedValue(classificationInput(indexes)), {
    evidenceClass: "S",
    scenario: {
      label: "constructed-chain",
      allowedUse: "local_demo_rehearsal",
    },
  });
});

test("derived values require an exact derivation reference", () => {
  assert.throws(
    () =>
      classifyMappedValue({
        ...classificationInput(),
        declaredClass: "D",
        derivationRef: null,
      }),
    /DERIVATION_REQUIRED/,
  );
});

test("pending and unclassified values become gaps, never records", () => {
  assert.equal(
    classifyMappedValue({ ...classificationInput(), declaredClass: "P" }).kind,
    "gap",
  );
  assert.equal(
    classifyMappedValue({ ...classificationInput(), declaredClass: null }).kind,
    "gap",
  );
});
```

Add tests for conflicting provenance (same cell classified both D and S), unauthorized conversation-only rules, unknown sheet, and header fingerprint drift.

- [ ] **Step 3: Run tests and verify RED**

```bash
node --test scripts/full-chain-sample/classification.test.mjs
```

Expected: FAIL because policy/classifier modules do not exist.

- [ ] **Step 4: Implement provenance precedence and failure semantics**

Build indexes from:

- `26_样本构建清单`: `(工作表, 行 identity, 字段) -> S`;
- `25_推导依据`: stable derivation ID plus `性质`:
  - `推导` -> D;
  - `候选` -> P;
  - `事实` -> R candidate, still requiring an approved sourceRef in policy;
- `23_待确认`: referenced rules/fields -> P;
- policy: approved direct-source references for pilot fields.

Precedence is not silent override. If indexes disagree, emit `PROVENANCE_CONFLICT` and make package unpublishable. A constructed S cell may override a policy R default only when the policy explicitly sets `constructionOverrideAllowed: true` for that field.

- [ ] **Step 5: Verify all 33 sheet dispositions and tests**

```bash
node --test scripts/full-chain-sample/classification.test.mjs
```

Expected: PASS and assert exactly 33 unique sheet names with no unclassified disposition.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/full-chain-sample/policies/v0.5.json scripts/full-chain-sample/policy.mjs scripts/full-chain-sample/classification.mjs scripts/full-chain-sample/classification.test.mjs
git commit -m "feat(samples): classify full-chain workbook evidence"
```

---

### Task 4: Pilot Record Compilation and Cross-Sheet Reconciliation

**Files:**

- Create: `scripts/full-chain-sample/compile-records.mjs`
- Create: `scripts/full-chain-sample/reconcile.mjs`
- Create: `scripts/full-chain-sample/compile-records.test.mjs`
- Modify: `scripts/full-chain-sample/policies/v0.5.json`

**Interfaces:**

- Consumes: `WorkbookScan`, `CompilerPolicy`, `ProvenanceIndexes`, `classifyMappedValue()`.
- Produces:
  - `compilePilotRecords({ scan, policy, indexes }): CompileResult`
  - `runPackageChecks({ records, scan, policy }): CheckResult[]`

- [ ] **Step 1: Define exact pilot record types and keys in policy**

Use only these record types:

| Record type              | Source sheet                                  | Business key                   | Cross references                    |
| ------------------------ | --------------------------------------------- | ------------------------------ | ----------------------------------- |
| `shipment_plan`          | `09_出运计划`                                 | 出运计划编号                   | cargo-ready refs, booking ref       |
| `booking_commitment`     | `09a_订舱`                                    | 订舱编号                       | cargo-ready refs, MBL/HBL           |
| `cargo_ready_release`    | `10_备货`                                     | 备货单号                       | parent cargo-ready ref              |
| `stuffing_snapshot_line` | `11_装箱`                                     | 柜号 + 备货单号 + SKU + 分提单 | cargo-ready ref, container ref, HBL |
| `export_customs_case`    | `11a_出口报关`, only rows where 层级=`报关票` | 报关发票号                     | HBL, declaration number             |
| `dispatch_fact`          | `12_出运`                                     | 柜号                           | MBL, HBL, container ref             |

Rows with `层级=品名行` are `evidence_only` in Brief 1 because the sheet lacks a stable declaration-line identity independent of source row. Emit a gap explaining that decision; never use source row as a business key.

For each record type, the policy must list exact allowed payload fields. For example:

```json
{
  "recordType": "dispatch_fact",
  "sheet": "12_出运",
  "identity": ["柜号"],
  "payload": {
    "containerNo": "柜号",
    "vesselName": "船名",
    "voyageNo": "航次",
    "masterBillNo": "MBL",
    "houseBillRefs": "HBL",
    "gateInDate": "进港日期",
    "departedAt": "ATD/出运日期",
    "departedPrecision": "日期精度",
    "motherVesselDepartedAt": "母船出运日期"
  }
}
```

Repeat this explicit mapping for the other five record types. Do not map narrative `说明` text into payload.

- [ ] **Step 2: Write compiler tests with fictional values**

```js
test("compiler emits stable pilot keys and preserves provenance class", () => {
  const result = compilePilotRecords(pilotWorkbookFixture());
  assert.deepEqual(
    result.records.map(({ recordType, businessKey }) => [
      recordType,
      businessKey,
    ]),
    [
      ["shipment_plan", "PLAN-DEMO-001"],
      ["booking_commitment", "BOOK-DEMO-001"],
      ["cargo_ready_release", "CR-DEMO-001"],
      [
        "stuffing_snapshot_line",
        "CONT-DEMO-001|CR-DEMO-001|SKU-DEMO-001|HBL-DEMO-001",
      ],
      ["export_customs_case", "INV-DEMO-001"],
      ["dispatch_fact", "CONT-DEMO-001"],
    ],
  );
  assert.equal(
    result.records.find((r) => r.recordType === "shipment_plan").evidenceClass,
    "S",
  );
});
```

Add focused tests for:

- duplicate business key;
- cargo-ready ref missing;
- stuffing line pointing to unknown cargo-ready order;
- booking/dispatch MBL mismatch;
- customs HBL not found in stuffing/booking;
- invalid date precision/timezone;
- amount without currency;
- customs `品名行` emitted as gap and never a record;
- D value with mismatched recomputation;
- P value excluded from payload and record publishability.

- [ ] **Step 3: Run tests and verify RED**

```bash
node --test scripts/full-chain-sample/compile-records.test.mjs
```

Expected: FAIL because compiler/reconciliation modules do not exist.

- [ ] **Step 4: Implement field normalization without business inference**

Normalization helpers must be explicit:

```js
normalizeDate(value, { precision, timezone });
normalizeDecimal(value, { scale, allowNegative });
normalizeList(value, { separator: /\s*[+,/]\s*/u });
normalizeCode(value, { pattern });
```

Do not infer timezone from the machine. Timezone/precision must come from a mapped workbook field or policy. Preserve source text hash in lineage. Never turn empty text into `0`, `false`, current date, or default currency.

A record’s `evidenceClass` is the strongest restriction among its payload values: S dominates D, D dominates R. If any required field is P/unclassified/invalid, emit a gap and do not emit that record.

- [ ] **Step 5: Implement deterministic reconciliation checks**

Checks use stable codes:

```text
CHECK_UNIQUE_BUSINESS_KEY
CHECK_REFERENCE_EXISTS
CHECK_MBL_MATCH
CHECK_HBL_SCOPE
CHECK_DATE_ORDER
CHECK_QUANTITY_RECONCILIATION
CHECK_WEIGHT_RECONCILIATION
CHECK_VOLUME_RECONCILIATION
CHECK_DERIVATION_RECOMPUTED
```

Each check record contains only code, status, record refs, and redacted reason. No source values in logs.

- [ ] **Step 6: Run tests and verify GREEN**

```bash
node --test scripts/full-chain-sample/compile-records.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add scripts/full-chain-sample/compile-records.mjs scripts/full-chain-sample/reconcile.mjs scripts/full-chain-sample/compile-records.test.mjs scripts/full-chain-sample/policies/v0.5.json
git commit -m "feat(samples): compile pilot full-chain records"
```

---

### Task 5: Atomic Package Writer, Safe Report, and CLI

**Files:**

- Create: `scripts/full-chain-sample/package-writer.mjs`
- Create: `scripts/full-chain-sample/package-writer.test.mjs`
- Create: `scripts/compile-full-chain-sample.mjs`
- Create: `scripts/compile-full-chain-sample.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes all Task 1–4 interfaces.
- Produces:
  - `buildPackageArtifacts(compileResult): PackageArtifacts`
  - `writePackageAtomically({ artifacts, outputDir }): Promise<void>`
  - CLI:

```text
pnpm sample:full-chain:compile -- \
  --source <external-xlsx> \
  --source-manifest <external-json> \
  --policy scripts/full-chain-sample/policies/v0.5.json \
  --output <new-external-directory>
```

Stable exits:

- `0`: publishable package written;
- `2`: diagnostic package written with `publishable=false`;
- `3`: unsafe/invalid source rejected before package write;
- `4`: output path already exists or atomic publish cannot complete.

- [ ] **Step 1: Write atomic writer tests first**

```js
test("writer refuses an existing output and leaves no partial package", async () => {
  const output = fixturePath("existing");
  mkdirSync(output);
  await assert.rejects(
    () =>
      writePackageAtomically({
        artifacts: packageFixture(),
        outputDir: output,
      }),
    /OUTPUT_EXISTS/,
  );
  assert.deepEqual(readdirSync(output), []);
});

test("failed publish removes only its own staging directory", async () => {
  const sibling = fixturePath("keep-me");
  mkdirSync(sibling);
  await assert.rejects(
    () => writeWithInjectedRenameFailure(),
    /OUTPUT_PUBLISH_FAILED/,
  );
  assert.equal(existsSync(sibling), true);
  assert.deepEqual(findCompilerStagingDirs(), []);
});
```

- [ ] **Step 2: Write CLI privacy and exit-code tests**

Spawn the real CLI with a synthetic workbook. Assert:

- absolute input/output paths do not appear in stdout/stderr;
- raw cell values do not appear;
- exact source/package hashes do not appear;
- output includes only alias, publishable flag, counts, and receipt code;
- unsafe workbook exits 3 and writes no output;
- validation gap exits 2 and writes diagnostics with `publishable=false`;
- existing output exits 4;
- valid fixture exits 0.

- [ ] **Step 3: Run tests and verify RED**

```bash
node --test scripts/full-chain-sample/package-writer.test.mjs scripts/compile-full-chain-sample.test.mjs
```

Expected: FAIL because writer/CLI do not exist.

- [ ] **Step 4: Implement deterministic package assembly**

Output files:

```text
manifest.json
records/<record-type>.json
lineage.jsonl
gaps.json
checks.json
report.html
receipt.json
```

Rules:

- records sorted by `recordType`, then `businessKey`;
- lineage sorted by canonical record ref, then payload pointer;
- gaps/checks sorted by stable code and record ref;
- all text is NFC + LF and ends with one LF;
- `packageHash` covers canonical manifest projection, records, lineage, gaps, and checks; excludes `compiledAt`, `operator`, receipt, report formatting, and local paths;
- `report.html` contains only counts, dispositions, check/gap codes, and redacted references; no raw cell values;
- write to a sibling staging directory created by this invocation, validate the staged package, then rename once;
- never overwrite an output directory.

- [ ] **Step 5: Add package scripts and ignore only local outputs**

Modify `package.json`:

```json
{
  "scripts": {
    "sample:full-chain:compile": "node scripts/compile-full-chain-sample.mjs",
    "test:full-chain-sample": "node --test scripts/full-chain-sample/contracts.test.mjs scripts/full-chain-sample/xlsx-security.test.mjs scripts/full-chain-sample/classification.test.mjs scripts/full-chain-sample/compile-records.test.mjs scripts/full-chain-sample/package-writer.test.mjs scripts/compile-full-chain-sample.test.mjs"
  }
}
```

Append `pnpm test:full-chain-sample` to the root `test` chain so CI always runs it. Add only:

```gitignore
.sample-output/
```

Do not ignore `*.xlsx`, `*.json`, `manifest*`, or arbitrary output paths.

- [ ] **Step 6: Run tests and verify GREEN**

```bash
pnpm test:full-chain-sample
pnpm lint
pnpm format:check
pnpm repo:check
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add package.json .gitignore scripts/full-chain-sample/package-writer.mjs scripts/full-chain-sample/package-writer.test.mjs scripts/compile-full-chain-sample.mjs scripts/compile-full-chain-sample.test.mjs
git commit -m "feat(samples): publish deterministic diagnostic packages"
```

---

### Task 6: Real-Input Dry Run Without Repository Leakage

**Files:**

- Modify only if tests reveal a defect: files under `scripts/full-chain-sample/**` and `scripts/compile-full-chain-sample.mjs`.
- Do not add the real source manifest, workbook, output package, screenshots, or reports to Git.
- Update main-agent-owned brief: `docs/planning/tasks/full-chain-sample-v05-compiler-v1.md` with counts/check results only, never fingerprints or business values.

**Interfaces:**

- Consumes the real external workbook and its external source manifest.
- Produces only a warehouse-external diagnostic package and a redacted terminal receipt.

- [ ] **Step 1: Run the real source in diagnostic mode**

Use external paths supplied at runtime. The command must not echo them:

```bash
pnpm sample:full-chain:compile -- \
  --source "$FULL_CHAIN_SOURCE" \
  --source-manifest "$FULL_CHAIN_SOURCE_MANIFEST" \
  --policy scripts/full-chain-sample/policies/v0.5.json \
  --output "$FULL_CHAIN_OUTPUT"
```

Expected first-run result is either:

- exit `0` with `publishable=true`, or
- exit `2` with a complete diagnostic package.

Exit `3` means the source security/fingerprint contract failed and blocks the task. Do not weaken safety checks to get past it.

- [ ] **Step 2: Inspect only redacted package summaries**

Verify:

- 33 sheet dispositions are present;
- only six pilot record types appear;
- every record is R/D/S, never P;
- D and S envelopes are complete;
- all gaps/checks have stable codes;
- no absolute path is present;
- no unsupported Sheet is reported as imported;
- `publishable=true` only when all blocking checks pass.

Do not paste records, lineage, exact hashes, or sensitive values into the brief or chat.

- [ ] **Step 3: Repeat into a second new output directory**

Run with the same source/manifest/policy and compare only the declared `packageHash` values inside the two external manifests. They must match. Do not compare `compiledAt` or receipt bytes.

- [ ] **Step 4: Prove no external system was touched**

Before and after counts must be identical for:

- PostgreSQL connections and demo tenant rows;
- MinIO object inventory;
- Temporal schedules/workflows.

The compiler has no credentials and should make no calls. Record only “unchanged” plus count deltas (`0`), not object keys or business values.

- [ ] **Step 5: Run complete Brief 1 verification**

```bash
pnpm test:full-chain-sample
pnpm test
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm repo:check
git diff --check
```

`test:integration` and Web E2E are not required because Brief 1 must not connect to business systems or add UI. If implementation imports Prisma/API/MinIO/Temporal modules, treat that as a scope violation, not a reason to add integration tests.

- [ ] **Step 6: Independent review**

Fresh reviewer focus:

- external data does not leak into Git/logs/tests;
- every source value is classified and traceable;
- fail-closed cases cannot return exit 0;
- deterministic hash excludes volatile/local fields;
- no DB/object-store/workflow dependency exists;
- package claims do not exceed the spec’s allowed proof boundary.

- [ ] **Step 7: Commit verification-only fixes, if any**

If Task 6 reveals production defects, fix them with a failing regression test and commit only those exact files:

```bash
git add <exact compiler and test paths>
git commit -m "fix(samples): close full-chain compiler verification gaps"
```

If no defects are found, do not create an empty verification commit.

---

## Plan Self-Review

### Spec coverage

- Four-stage architecture: Brief 1 implements only scan/compile; Tasks 1–6 explicitly prohibit rehearsal adapters and demo switch.
- R/D/S/P: Task 3 owns classification and Task 1 enforces record envelopes.
- Canonical package: Tasks 1 and 5 define and publish it.
- Fail-closed safety: Tasks 2, 3, 4, and 5 cover source, classification, references, and output safety.
- Sensitive-data boundary: Global constraints, Tasks 2/5/6, and review focus cover paths, values, hashes, logs, and Git.
- Determinism: Tasks 1 and 5 define the hash projection; Task 6 repeats the real compile.
- 33-sheet disposition: Task 3 requires an exact complete policy.
- Pilot chain: Task 4 compiles only the approved six sheets.
- Zero external writes: Task 6 proves DB/MinIO/Temporal deltas are zero.
- Brief 2–4 are intentionally excluded.

### Placeholder scan

No TBD/TODO, “similar to”, generic error-handling step, or undefined implementation task remains. Runtime external paths are explicit CLI inputs rather than plan placeholders and are never committed.

### Type consistency

`SourceManifest`, `CompilerPolicy`, `WorkbookScan`, `ProvenanceIndexes`, `CompileResult`, and `PackageArtifacts` are introduced in dependency order. Later tasks consume the exact function names produced by earlier tasks.

### Review-focus coverage

All five focus areas have named tests in their owning tasks: Task 2 security, Task 3 classification, Task 4 identity/references, Task 5 determinism/privacy/output atomicity.
