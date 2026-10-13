# Full-Chain Rehearsal Domain Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository governance requires the current Claude Code main agent to implement all tasks directly; do not delegate implementation to subagents.

**Goal:** Land one valid six-record canonical package into an isolated rehearsal tenant as typed, queryable, idempotent facts with exact cross-record references, a recoverable MinIO receipt, gated publication, and no lifecycle invention or cross-tenant effects.

**Architecture:** A dual-runtime public workspace package owns canonical parsing, strict schemas, compatibility checks, deterministic hashing, and rehearsal receipt contracts. A new Nest module performs pure typed-graph preflight, stages all six fact types in one PostgreSQL Serializable transaction, writes one idempotent receipt object, reconciles database/object/isolation facts, then atomically marks the run published with one landing-only Outbox event. Read APIs expose only published runs; the existing compiler remains a producer facade and existing operational aggregates are not coerced into meanings their contracts cannot represent.

**Tech Stack:** Node.js 20+, pnpm 10, JavaScript ESM/CommonJS dual exports, TypeScript 5.6 strict mode, NestJS 11, Prisma ORM 7 with `@prisma/adapter-pg`, PostgreSQL advisory locks and Serializable transactions, AWS SDK S3 client for MinIO, AJV 8 / JSON Schema 2020-12, Vitest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-13-full-chain-rehearsal-domain-adapter-design.md`

## Global Constraints

- The only active carrier is `docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md`; use its exact `writeScopes`, locks, dependency list, and one final PR.
- The current Claude Code main agent is the only writer. Read-only investigation and the one final fresh Claude whole-branch review are the only delegated work.
- Never read, clean, stage, delete, or commit `.tmp/` or `apps/api/.tmp/`; never use `git add .` or `git add -A`.
- Do not change FC-D07, FC-D08, compiler fail-closed checks, or the stuffing business key `container + cargo-ready + SKU + HBL`.
- Do not read Excel or write an Excel-to-database path. The adapter consumes only a canonical package.
- Accept only `full-chain-package.v1` / `full-chain-source-manifest.v1` / workbook `v0.5.1` / compiler `full-chain-compiler.v1` / mapping `full-chain-mapping.v0.5` / policy `full-chain-policy.v0.5` / record `v1`.
- Reject `publishable=false`, unknown versions, count/hash/package-hash mismatch, missing/extra record files, malformed payloads, orphan or ambiguous references, and any relation requiring fuzzy matching or defaults.
- Preserve exact typed HBL/MBL references. The display-only main cargo-ready number never becomes a relation; contract/source-row fields never become stuffing identity.
- New records are neutral facts. They do not assert internal cargo-ready acceptance, stuffing/VGM completion, export release, `loaded`, `departed`, responsibility acceptance, or workbench closure.
- Target only the configured independent rehearsal tenant and `rehearsal/<tenant>/<run>/` prefix. Reject `demo-real-sample-20260921`, every other tenant, and global-reference writes.
- Do not call legacy demo seed, purge, real demo backup/restore, or Temporal mutation. Temporal evidence is read-only before/after inventory.
- Use exact decimal strings/Prisma Decimal; never pass business decimal values through JavaScript `Number`.
- All write behavior is RED before GREEN. Real database/transaction/idempotency behavior must use migrated PostgreSQL integration tests.
- Code completion and actual external rehearsal execution remain separate. Missing external package/path evidence blocks only the actual execution gate.

## File Structure

### Public package contract

- Create `packages/full-chain-sample-contracts/package.json` — dual `import`/`require` exports and package-local test command.
- Create `packages/full-chain-sample-contracts/index.cjs` — AJV validators, compatibility matrix, directory reader, canonical hashing, strict landing validation, and receipt validation.
- Create `packages/full-chain-sample-contracts/index.mjs` — named ESM facade over `index.cjs`.
- Create `packages/full-chain-sample-contracts/index.d.ts` — canonical record, typed payload, validated package, and rehearsal receipt types.
- Create `packages/full-chain-sample-contracts/schemas/*.schema.json` — one manifest, one discriminated record envelope, six strict payloads, gap/check, and rehearsal receipt schemas.
- Create `packages/full-chain-sample-contracts/contracts.test.mjs` — compatibility, tamper, file-boundary, payload, and parity tests.
- Modify `scripts/full-chain-sample/contracts.mjs` — retain policy/source-manifest producer validation; re-export package validation from the public package.
- Modify `scripts/full-chain-sample/canonical-json.mjs` — compatibility facade over the public package.
- Delete moved package-facing schemas from `scripts/full-chain-sample/schemas/`; keep producer-only source-manifest/policy schemas there.

### Landing module

- Create `apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.ts` — typed graph and pure six-adapter preflight.
- Create `apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.test.ts` — business-key, exact-reference, lineage, date-precision, and conflict tests.
- Create `apps/api/src/modules/full-chain-sample-landing/domain/full-chain-landing.repository.ts` — stage/read/reconcile/publish state port.
- Create `apps/api/src/modules/full-chain-sample-landing/domain/landing-receipt-store.port.ts` — object receipt put/read/delete port.
- Create `apps/api/src/modules/full-chain-sample-landing/domain/landing-isolation-probe.port.ts` — old-demo/other/global/MinIO/Temporal snapshot port.
- Create `apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.ts` — capability, rehearsal tenant, old-demo, and prefix policy.
- Create `apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.ts` — preflight → stage → receipt → reconcile → publish orchestration.
- Create `apps/api/src/modules/full-chain-sample-landing/application/get-full-chain-landing.service.ts` — redacted run status.
- Create `apps/api/src/modules/full-chain-sample-landing/application/get-full-chain-chain.service.ts` — published plan-chain query.
- Create focused Application tests beside each service.
- Create `apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts` — one Serializable stage transaction and atomic publish.
- Create `apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts` — migrated PostgreSQL stage/replay/concurrency/rollback tests.
- Create `apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.ts` — idempotent MinIO receipt implementation.
- Create `apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.integration.test.ts` — real isolated-prefix tests.
- Create `apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-landing-isolation.probe.ts` — read-only PostgreSQL/MinIO/Temporal fingerprints using Brief 2 primitives.
- Create `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.dto.ts` — redacted request/response DTOs.
- Create `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.controller.ts` — apply/status/chain routes.
- Create `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.controller.test.ts` — route identity/capability/tenant forwarding.
- Create `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.cli.ts` — external package reader and authenticated HTTP client.
- Create `apps/api/src/modules/full-chain-sample-landing/full-chain-sample-landing.module.ts`, `module.manifest.ts`, and `index.ts` — composition root and public ports.
- Modify `apps/api/src/app.module.ts` — register the module.

### Database and closeout

- Modify `database/schema.prisma` — landing run/receipt/gap, six typed facts, document and relation tables.
- Create `database/migrations/20261013120000_add_full_chain_sample_landing/migration.sql` — additive tables, composite tenant/run FKs, checks, indexes, and uniqueness.
- Regenerate `database/dictionary/**` and update sparse annotations through the existing generator.
- Modify `scripts/full-chain-demo/ownership-catalog.json` — classify every new landing model as `direct_tenant` with child-first ranks; do not change the fixed old-demo target or purge behavior.
- Modify `scripts/full-chain-demo/ownership-catalog.test.mjs` — prove exhaustive DMMF coverage and new parent edges/ranks after the migration.
- Regenerate `docs/planning/progress-board.html` whenever the active brief/status changes make `pnpm board:check` stale.
- Create `apps/api/src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts` — non-mock HTTP/Application/PostgreSQL/MinIO/read-back closeout.
- Modify root `package.json` and `pnpm-lock.yaml` — focused contract/landing commands and workspace package registration metadata only.
- Update the unique Brief 3 task brief after each accepted slice with exact changed files, checks, and remaining work.

## Review Focus

1. **Valid package, insufficient FC-D07 contributor lineage:** code may merge, but actual apply must reject before writes with `FULL_CHAIN_LINEAGE_INCOMPLETE`; it must not reopen Excel or invent contributors. Covered in Task 2.
2. **Two concurrent requests with the same package but different Idempotency-Key values:** the tenant+package advisory lock and unique package identity must still yield one run and no duplicate facts/events/objects. Covered in Tasks 4 and 8.
3. **Database stage succeeds, MinIO put times out after the server stored the object:** retry must compare the existing object digest, resume the same run, and publish once rather than create a second object or run. Covered in Tasks 5 and 8.
4. **Same business key appears in a later package with a different canonical payload:** until correction/version semantics exist, reject with `FULL_CHAIN_BUSINESS_KEY_CONFLICT`; never supersede silently. Covered in Tasks 3 and 4.
5. **A valid rehearsal identity submits a package while the configured target is the old demo tenant, a different tenant, or a prefix escape:** reject before PostgreSQL/S3/Temporal I/O and do not disclose configured IDs or paths. Covered in Tasks 5–7.

---

### Task 1: Public Canonical Package Contract and Compiler Parity

**Files:**

- Create: `packages/full-chain-sample-contracts/package.json`
- Create: `packages/full-chain-sample-contracts/index.cjs`
- Create: `packages/full-chain-sample-contracts/index.mjs`
- Create: `packages/full-chain-sample-contracts/index.d.ts`
- Create: `packages/full-chain-sample-contracts/schemas/package-manifest.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/canonical-record.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/shipment-plan.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/booking-commitment.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/cargo-ready-release.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/stuffing-snapshot-line.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/export-customs-case.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/dispatch-fact.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/gap.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/check.schema.json`
- Create: `packages/full-chain-sample-contracts/schemas/rehearsal-receipt.schema.json`
- Create: `packages/full-chain-sample-contracts/contracts.test.mjs`
- Modify: `scripts/full-chain-sample/contracts.mjs`
- Modify: `scripts/full-chain-sample/canonical-json.mjs`
- Delete: `scripts/full-chain-sample/schemas/package-manifest.schema.json`
- Delete: `scripts/full-chain-sample/schemas/canonical-record.schema.json`
- Delete: `scripts/full-chain-sample/schemas/gap.schema.json`
- Delete: `scripts/full-chain-sample/schemas/check.schema.json`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: the existing manifest/record/gap/check shapes and exact canonical hash projection from Brief 1.
- Produces:

```ts
export const FULL_CHAIN_COMPATIBILITY_V1: Readonly<{
  manifestVersion: "full-chain-package.v1";
  sourceManifestVersion: "full-chain-source-manifest.v1";
  workbookVersion: "v0.5.1";
  compilerVersion: "full-chain-compiler.v1";
  mappingVersion: "full-chain-mapping.v0.5";
  policyVersion: "full-chain-policy.v0.5";
  recordVersion: "v1";
}>;

export function validatePackageArtifacts(
  artifacts: FullChainPackageArtifacts,
): void;
export function validateFullChainPackageForLanding(
  artifacts: FullChainPackageArtifacts,
): ValidatedFullChainPackage;
export function readFullChainPackageDirectory(input: {
  packagePath: string;
  approvedRoot: string;
  repositoryRoot: string;
}): Promise<FullChainPackageArtifacts>;
export function canonicalStringify(value: unknown): string;
export function canonicalText(value: unknown): string;
export function sha256Hex(value: string | Buffer): string;
export function packageHash(artifacts: FullChainPackageArtifacts): string;
export function validateRehearsalReceipt(
  value: unknown,
): FullChainRehearsalReceipt;
```

- [ ] **Step 1: Add RED tests for the compatibility matrix and strict six-record payloads**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  FULL_CHAIN_COMPATIBILITY_V1,
  validateFullChainPackageForLanding,
} from "./index.mjs";

for (const [field, wrong] of [
  ["manifestVersion", "full-chain-package.v2"],
  ["compilerVersion", "full-chain-compiler.v2"],
  ["mappingVersion", "full-chain-mapping.v0.6"],
  ["policyVersion", "full-chain-policy.v0.6"],
]) {
  test(`rejects unsupported ${field}`, () => {
    const artifacts = validArtifacts();
    artifacts.manifest[field] = wrong;
    assert.throws(
      () => validateFullChainPackageForLanding(rehash(artifacts)),
      /PACKAGE_VERSION_UNSUPPORTED/,
    );
  });
}

test("rejects a stuffing record missing the exact HBL", () => {
  const artifacts = validArtifacts();
  delete artifacts.records.find(
    ({ recordType }) => recordType === "stuffing_snapshot_line",
  ).payload.houseBillNo;
  assert.throws(
    () => validateFullChainPackageForLanding(rehash(artifacts)),
    /PACKAGE_RECORD_INVALID/,
  );
});
```

- [ ] **Step 2: Run the new package tests and observe RED**

Run: `node --test packages/full-chain-sample-contracts/contracts.test.mjs`

Expected: FAIL because the workspace package and exported validator do not exist.

- [ ] **Step 3: Implement dual-runtime exports and move the package-facing schemas**

Use a CommonJS implementation with an explicit ESM facade so the CommonJS API build and ESM compiler resolve the same code:

```json
{
  "name": "@logix/full-chain-sample-contracts",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "types": "./index.d.ts",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  },
  "scripts": {
    "test": "node --test contracts.test.mjs"
  },
  "dependencies": {
    "ajv": "8.17.1",
    "ajv-formats": "3.0.1"
  }
}
```

`index.mjs` must explicitly name every export; do not rely on Node’s inferred CJS named exports:

```js
import contracts from "./index.cjs";

export const {
  FULL_CHAIN_COMPATIBILITY_V1,
  validatePackageArtifacts,
  validateFullChainPackageForLanding,
  readFullChainPackageDirectory,
  validateRehearsalReceipt,
  canonicalStringify,
  canonicalText,
  sha256Hex,
  packageHash,
  packageHashProjection,
  compareCanonicalStrings,
} = contracts;
```

The canonical-record schema must use a `oneOf` keyed by `recordType`, with `additionalProperties: false` and the exact required payload keys for all six records. `cargo_ready_release.planNo` remains the existing payload field for byte compatibility, but its TypeScript comment must call it a display grouping, not a ShipmentPlan FK.

- [ ] **Step 4: Implement the external-directory reader with exact file and path boundaries**

The reader must:

```js
const REQUIRED_FILES = [
  "manifest.json",
  "records/shipment_plan.json",
  "records/booking_commitment.json",
  "records/cargo_ready_release.json",
  "records/stuffing_snapshot_line.json",
  "records/export_customs_case.json",
  "records/dispatch_fact.json",
  "lineage.jsonl",
  "gaps.json",
  "checks.json",
  "report.html",
  "receipt.json",
];
```

- require absolute `packagePath`, `approvedRoot`, and `repositoryRoot`;
- resolve physical paths with `realpath` and reject repository-contained, symlink/junction-escaped, missing, non-regular, extra, or duplicate-type files;
- parse `lineage.jsonl` one non-empty line at a time;
- concatenate the six record arrays, then call `validateFullChainPackageForLanding`;
- never log the package path, record values, or complete hashes.

Add RED/GREEN tests for repository-contained input, a symlink escape, missing `dispatch_fact.json`, extra `records/unknown.json`, malformed JSONL, and a valid external package.

- [ ] **Step 5: Convert compiler modules to compatibility facades**

`scripts/full-chain-sample/canonical-json.mjs` becomes only named re-exports:

```js
export {
  canonicalStringify,
  canonicalText,
  compareCanonicalStrings,
  packageHash,
  packageHashProjection,
  sha256Hex,
} from "@logix/full-chain-sample-contracts";
```

`scripts/full-chain-sample/contracts.mjs` retains `validateSourceManifest` and `validatePolicy`, but imports and re-exports public package validation. Delete only the four moved package-facing schemas; source-manifest and policy remain producer-owned.

- [ ] **Step 6: Prove compiler parity and GREEN**

Add an existing-fixture parity test that builds artifacts through `buildPackageArtifacts`, validates them through both the facade and public package, and asserts identical `canonicalText(manifest)` and `packageHash`.

Run:

```text
node --test packages/full-chain-sample-contracts/contracts.test.mjs
node --test scripts/full-chain-sample/contracts.test.mjs scripts/full-chain-sample/package-writer.test.mjs
pnpm test:full-chain-sample
pnpm --filter @logix/api typecheck
pnpm exec prettier --check packages/full-chain-sample-contracts scripts/full-chain-sample package.json --ignore-unknown
git diff --check
```

Expected: all pass; existing compiler package bytes/hash assertions remain unchanged.

- [ ] **Step 7: Record the slice and commit exact paths**

Append one Brief 3 progress row with RED/GREEN evidence and exact diff scope. Then:

```text
git add -- packages/full-chain-sample-contracts scripts/full-chain-sample/contracts.mjs scripts/full-chain-sample/canonical-json.mjs scripts/full-chain-sample/schemas package.json pnpm-lock.yaml docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
git diff --cached --check
git commit -m "feat(samples): publish canonical package contract"
```

### Task 2: Typed Graph Preflight and Six Pure Adapters

**Files:**

- Create: `apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/domain/landing-graph.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/domain/landing-errors.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/test-support/full-chain-package.fixture.ts`

**Interfaces:**

- Consumes: `ValidatedFullChainPackage` from Task 1.
- Produces:

```ts
export type TypedDocumentRef = {
  type: "mbl" | "hbl";
  number: string;
};

export type FullChainLandingGraph = {
  packageHash: string;
  plans: ShipmentPlanFactInput[];
  bookings: BookingCommitmentFactInput[];
  documents: BookingDocumentInput[];
  cargoReadyReleases: CargoReadyReleaseFactInput[];
  planCargoReadyLinks: PlanCargoReadyLinkInput[];
  stuffingLines: StuffingLineFactInput[];
  exportCustomsCases: ExportCustomsCaseFactInput[];
  dispatchFacts: DispatchFactInput[];
  dispatchHouseBillLinks: DispatchHouseBillLinkInput[];
  recordReceipts: LandingRecordReceiptInput[];
  gaps: LandingGapInput[];
};

export function buildFullChainLandingGraph(
  packageArtifacts: ValidatedFullChainPackage,
): FullChainLandingGraph;
```

- [ ] **Step 1: Write RED tests for all exact relationships and display-only fields**

```ts
it("builds exact typed HBL and MBL links without using display groups", () => {
  const graph = buildFullChainLandingGraph(validPackage());
  expect(graph.documents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ documentType: "mbl", number: "MBL-1" }),
      expect.objectContaining({
        documentType: "hbl",
        number: "HBL-1",
        parentMasterBillNumber: "MBL-1",
      }),
    ]),
  );
  expect(graph.planCargoReadyLinks).toContainEqual({
    planNumber: "PLAN-1",
    cargoReadyNumber: "CR-1",
  });
  expect(graph.planCargoReadyLinks).not.toContainEqual(
    expect.objectContaining({ cargoReadyNumber: "DISPLAY-GROUP-1" }),
  );
});

it.each(["HBL", "BL-1", "HBL-1A"])(
  "rejects fuzzy customs HBL %s",
  (houseBillNo) => {
    expect(() =>
      buildFullChainLandingGraph(packageWithCustomsHouseBill(houseBillNo)),
    ).toThrowError(/FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/);
  },
);
```

Also pin missing booking parent, orphan cargo-ready, dispatch MBL mismatch, dispatch HBL mismatch, duplicate business key, and HBL/AMS wrong-type cases.

- [ ] **Step 2: Run the graph tests and observe RED**

Run: `pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/domain/landing-graph.test.ts`

Expected: FAIL because the graph builder does not exist.

- [ ] **Step 3: Implement one pure adapter per record type in `landing-graph.ts`**

Keep each adapter small and deterministic:

```ts
function adaptShipmentPlans(
  records: ShipmentPlanRecord[],
): ShipmentPlanFactInput[];
function adaptBookings(records: BookingCommitmentRecord[]): {
  bookings: BookingCommitmentFactInput[];
  documents: BookingDocumentInput[];
};
function adaptCargoReady(
  records: CargoReadyReleaseRecord[],
): CargoReadyReleaseFactInput[];
function adaptStuffing(
  records: StuffingSnapshotLineRecord[],
): StuffingLineFactInput[];
function adaptExportCustoms(
  records: ExportCustomsCaseRecord[],
): ExportCustomsCaseFactInput[];
function adaptDispatch(records: DispatchFactRecord[]): {
  dispatchFacts: DispatchFactInput[];
  dispatchHouseBillLinks: DispatchHouseBillLinkInput[];
};
```

The outer builder creates exact maps keyed by canonical business identities, validates all references before returning, and sorts every array with UTF-8 canonical ordering. It must not generate database IDs, states, current timestamps, currency, units, timezones, VGM, evidence UUIDs, carrier, broker, or lifecycle facts.

- [ ] **Step 4: Add RED lineage completeness tests, including Review Focus #1**

The graph builder must require every emitted record to have exactly one package lineage record matching its canonical `recordRef` and sourceRef. For a record carrying an FC-D07 derivation with multiple `inputRefs`, require every inputRef to be represented in the package lineage set; otherwise throw:

```ts
expect(() =>
  buildFullChainLandingGraph(incompleteDerivedLineagePackage()),
).toThrowError(/FULL_CHAIN_LINEAGE_INCOMPLETE/);
```

Do not reopen Excel and do not infer missing contributors. A package that lacks this proof can still be validated as a compiler artifact, but it cannot become a landing graph.

- [ ] **Step 5: Add date-precision and decimal tests**

Pin these behaviors:

```ts
expect(graph.dispatchFacts[0]).toMatchObject({
  departedAt: "2026-09-18",
  departedPrecision: "date",
});
expect(graph.dispatchFacts[0]).not.toHaveProperty("departedInstant");
expect(graph.stuffingLines[0].quantity).toBe("9007199254740993.000");
```

The adapter preserves normalized strings and explicit precision. It never constructs `Date` for date-only facts and never calls `Number()` for decimals.

- [ ] **Step 6: Run focused GREEN and quality checks**

Run:

```text
pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/domain/landing-graph.test.ts
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
pnpm exec prettier --check apps/api/src/modules/full-chain-sample-landing --ignore-unknown
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Record and commit the graph slice**

```text
git add -- apps/api/src/modules/full-chain-sample-landing/domain apps/api/src/modules/full-chain-sample-landing/test-support docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
git diff --cached --check
git commit -m "feat(samples): validate rehearsal landing graph"
```

### Task 3: Additive Typed-Fact Schema and Migration

**Files:**

- Modify: `database/schema.prisma`
- Create: `database/migrations/20261013120000_add_full_chain_sample_landing/migration.sql`
- Modify: `database/dictionary/dictionary.annotations.json`
- Regenerate: `database/dictionary/DATA_DICTIONARY.generated.md`
- Regenerate: `database/dictionary/NATIVE_OBJECTS.generated.md`
- Regenerate: `database/dictionary/database-data-dictionary.xlsx`
- Modify: `scripts/full-chain-demo/ownership-catalog.json`
- Modify: `scripts/full-chain-demo/ownership-catalog.test.mjs`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-schema.integration.test.ts`

**Interfaces:**

- Consumes: `FullChainLandingGraph` names and fields from Task 2.
- Produces: Prisma delegates for `fullChainLandingRun`, `fullChainShipmentPlan`, `fullChainBookingCommitment`, `fullChainBookingDocument`, `fullChainCargoReadyRelease`, `fullChainShipmentPlanCargoReady`, `fullChainStuffingLine`, `fullChainExportCustomsCase`, `fullChainDispatchFact`, `fullChainDispatchHouseBill`, `fullChainLandingRecordReceipt`, and `fullChainLandingGap`.

- [ ] **Step 1: Write a real migration RED test**

Create a migrated temporary PostgreSQL schema using the established integration pattern, then assert all tenant/run constraints through Prisma:

```ts
it("rejects a stuffing line whose cargo-ready or HBL belongs to another run", async () => {
  const first = await seedTypedChain(prisma, { tenantId, packageHash: HASH_A });
  const second = await seedTypedChain(prisma, {
    tenantId,
    packageHash: HASH_B,
  });
  await expect(
    prisma.fullChainStuffingLine.create({
      data: stuffingData({
        runId: first.runId,
        cargoReadyReleaseId: second.cargoReadyId,
        houseBillDocumentId: second.hblId,
      }),
    }),
  ).rejects.toThrow();
});
```

Also assert tenant mismatch, duplicate six business keys, duplicate booking document, duplicate plan/cargo-ready join, duplicate dispatch/HBL join, and one tenant+package run.

- [ ] **Step 2: Run the schema integration test and observe RED**

Run: `pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-schema.integration.test.ts`

Expected: FAIL because the models and migration do not exist.

- [ ] **Step 3: Add the Prisma models with composite scope keys**

Use these exact identity constraints:

```prisma
@@unique([tenantId, packageHash], map: "full_chain_landing_run_tenant_package_key")
@@unique([tenantId, idempotencyKey], map: "full_chain_landing_run_tenant_idempotency_key")

@@unique([tenantId, planNumber], map: "full_chain_shipment_plan_business_key")
@@unique([tenantId, bookingNumber], map: "full_chain_booking_commitment_business_key")
@@unique([tenantId, cargoReadyNumber], map: "full_chain_cargo_ready_release_business_key")
@@unique([tenantId, containerNumber, cargoReadyNumber, sku, houseBillNumber], map: "full_chain_stuffing_line_business_key")
@@unique([tenantId, invoiceNumber], map: "full_chain_export_customs_case_business_key")
@@unique([tenantId, containerNumber], map: "full_chain_dispatch_fact_business_key")
```

Every typed fact also gets `@@unique([id, tenantId, landingRunId], ...)`; every relation FK includes `tenant_id` and `landing_run_id`. Store business decimals as `Decimal(24, 6)` or narrower where the canonical contract is narrower. Store date-only values as text plus explicit precision; do not use `timestamptz` without an instant.

The run stores only digests/redacted identifiers:

```prisma
model FullChainLandingRun {
  id                    String   @id @default(uuid()) @db.Uuid
  tenantId              String
  packageHash            String
  manifestVersion        String
  workbookVersion        String
  compilerVersion        String
  mappingVersion         String
  policyVersion          String
  sourceFingerprintHash  String
  state                   String
  inputCounts             Json
  appliedCounts           Json
  replayedCounts          Json
  rejectedCounts          Json
  gapCount                Int
  checkCount              Int
  receiptKeyHash          String?
  receiptDigest           String?
  reconciliationHash      String?
  actorId                 String
  traceId                 String
  idempotencyKey          String
  publishedAt             DateTime? @db.Timestamptz
  createdAt               DateTime @default(now()) @db.Timestamptz
  updatedAt               DateTime @updatedAt @db.Timestamptz
  // relations omitted here are all declared explicitly in the file
}
```

Record receipt and gap rows store digests and stable codes, not business values or paths.

- [ ] **Step 4: Write SQL checks that Prisma cannot express**

The migration must add stable checks for:

```sql
CHECK (state IN ('applying','staged','receipt_pending','reconciling','published','failed'));
CHECK (document_type IN ('mbl','hbl'));
CHECK (date_precision IN ('date','datetime') OR date_precision IS NULL);
CHECK (length(package_hash) = 64);
CHECK (length(payload_hash) = 64);
```

Add a deferred constraint trigger or equivalent migration check that enforces `hbl.parent_document_id` points to an `mbl` in the same tenant/run/booking. The Application layer still validates this first; the database is the final invariant.

- [ ] **Step 5: Generate Prisma and make the migration tests GREEN**

Run:

```text
pnpm db:generate
pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-schema.integration.test.ts
pnpm db:migrate:status
```

Expected: generated client includes all delegates; integration constraints pass.

- [ ] **Step 6: Update the exhaustive ownership catalog, then regenerate the data dictionary**

Add every new Prisma model to `scripts/full-chain-demo/ownership-catalog.json` as `direct_tenant`. Derive child-first delete ranks from the new run/fact/join foreign keys; do not change `targetTenant`, `catalogVersion`, existing model rules, purge execution boundaries, or Brief 2 CLIs. Extend `ownership-catalog.test.mjs` so every new model is present and each new child rank is greater than its declared parent.

Run:

```text
pnpm db:generate
node --test scripts/full-chain-demo/ownership-catalog.test.mjs
pnpm data-dictionary:bootstrap
pnpm data-dictionary:generate
pnpm data-dictionary:check
node --test scripts/generate-data-dictionary.test.mjs
```

Review sparse annotations so the new tables describe their neutral-fact and rehearsal-only boundaries; do not mark lifecycle completion semantics as confirmed.

- [ ] **Step 7: Run schema-slice gates and commit**

Run:

```text
pnpm db:generate
pnpm --filter @logix/api typecheck
pnpm data-dictionary:check
node --test scripts/full-chain-demo/ownership-catalog.test.mjs
pnpm repo:check
pnpm exec prettier --check database/schema.prisma database/migrations/20261013120000_add_full_chain_sample_landing database/dictionary scripts/full-chain-demo/ownership-catalog.json scripts/full-chain-demo/ownership-catalog.test.mjs apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-schema.integration.test.ts --ignore-unknown
git diff --check
```

Commit exact paths:

```text
git add -- database/schema.prisma database/migrations/20261013120000_add_full_chain_sample_landing database/dictionary scripts/full-chain-demo/ownership-catalog.json scripts/full-chain-demo/ownership-catalog.test.mjs apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-schema.integration.test.ts docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
git diff --cached --check
git commit -m "feat(samples): add rehearsal landing facts"
```

### Task 4: Serializable Stage Repository, Replay, and Conflict Semantics

**Files:**

- Create: `apps/api/src/modules/full-chain-sample-landing/domain/full-chain-landing.repository.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts`

**Interfaces:**

- Consumes: `FullChainLandingGraph` and Task 3 Prisma models.
- Produces:

```ts
export const FULL_CHAIN_LANDING_REPOSITORY = Symbol(
  "FULL_CHAIN_LANDING_REPOSITORY",
);

export interface FullChainLandingRepository {
  stage(input: StageFullChainLandingInput): Promise<{
    runId: string;
    state: "staged" | "receipt_pending" | "reconciling" | "published";
    replayed: boolean;
  }>;
  markReceiptPending(input: {
    runId: string;
    tenantId: string;
    errorCode: string;
  }): Promise<void>;
  markReconciling(input: {
    runId: string;
    tenantId: string;
    receiptKeyHash: string;
    receiptDigest: string;
  }): Promise<void>;
  reconcile(input: {
    runId: string;
    tenantId: string;
  }): Promise<LandingReconciliation>;
  publish(input: {
    runId: string;
    tenantId: string;
    reconciliation: LandingReconciliation;
    traceId: string;
  }): Promise<void>;
  getStatus(input: {
    runId: string;
    tenantId: string;
  }): Promise<FullChainLandingStatus | null>;
  getChain(input: {
    runId: string;
    tenantId: string;
    planNumber: string;
  }): Promise<PublishedFullChain | null>;
}
```

- [ ] **Step 1: Write RED real-PostgreSQL tests for stage, replay, and rollback**

Test all six row sets and joins after one stage. Inject a failure after customs but before dispatch and assert every new table remains unchanged.

```ts
await expect(
  repository.stage({ ...input, failAfterRecordType: "export_customs_case" }),
).rejects.toThrow(/FULL_CHAIN_STAGE_INJECTED_FAILURE/);
expect(await countAllLandingRows(prisma, tenantId)).toEqual(zeroCounts());
```

The failure hook is accepted only by the repository constructor in tests; it is not part of the production port.

- [ ] **Step 2: Run the repository integration test and observe RED**

Run: `pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 3: Implement one Serializable stage transaction**

Use:

```ts
return this.prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`full-chain:${tenantId}:${packageHash}`}, 0))`;
    // Re-read tenant+package and tenant+idempotency only after the lock.
    // Reject idempotency/payload conflicts.
    // Create run as applying, insert every typed fact/join/receipt/gap,
    // verify counts, then mark staged in this same transaction.
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
);
```

Insert in dependency order and resolve internal IDs from exact tenant/run business-key maps. Never query by fuzzy or global container number.

- [ ] **Step 4: Add RED tests for business-key conflict and Review Focus #4**

Stage package A, then attempt package B with the same plan/booking/cargo/stuffing/customs/dispatch business keys but one changed canonical payload. Expect `FULL_CHAIN_BUSINESS_KEY_CONFLICT` and no second run/fact/outbox/object.

- [ ] **Step 5: Add RED concurrent replay tests, including Review Focus #2**

Run two `stage()` calls concurrently with the same package and different client Idempotency-Key values. Assert:

```ts
expect(new Set(results.map(({ runId }) => runId)).size).toBe(1);
expect(await countTypedFacts(prisma, tenantId)).toEqual(expectedCounts);
expect(await prisma.fullChainLandingRun.count({ where: { tenantId } })).toBe(1);
```

The run’s canonical package identity wins over caller key differences; a caller key already bound to a different package still conflicts.

- [ ] **Step 6: Implement read and reconciliation queries**

`getStatus` returns only redacted counts/states. `getChain` returns `null` unless the run is `published`. `reconcile` canonical-hashes sorted database projections of the six facts, typed joins, record receipts, and gaps; it also returns current landing Outbox and business-task counts.

- [ ] **Step 7: Run repository GREEN and commit**

Run:

```text
pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
pnpm exec prettier --check apps/api/src/modules/full-chain-sample-landing --ignore-unknown
git diff --check
```

Then append Brief evidence and commit:

```text
git add -- apps/api/src/modules/full-chain-sample-landing/domain/full-chain-landing.repository.ts apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
git diff --cached --check
git commit -m "feat(samples): stage rehearsal package atomically"
```

### Task 5: MinIO Receipt, Isolation Probe, and Gated Publish

**Files:**

- Create: `apps/api/src/modules/full-chain-sample-landing/domain/landing-receipt-store.port.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/domain/landing-isolation-probe.port.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.integration.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-landing-isolation.probe.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/infrastructure/full-chain-landing-isolation.probe.test.ts`

**Interfaces:**

- Consumes: staged run IDs/counts, public receipt validator, and Brief 2 read-only/safe primitives.
- Produces:

```ts
export const LANDING_RECEIPT_STORE = Symbol("LANDING_RECEIPT_STORE");
export interface LandingReceiptStore {
  putIfAbsent(input: {
    tenantId: string;
    runId: string;
    body: string;
    digest: string;
  }): Promise<{ keyHash: string; digest: string; replayed: boolean }>;
  readDigest(input: {
    tenantId: string;
    runId: string;
  }): Promise<string | null>;
  deleteOwnedKey(input: {
    tenantId: string;
    runId: string;
    digest: string;
  }): Promise<void>;
}

export const LANDING_ISOLATION_PROBE = Symbol("LANDING_ISOLATION_PROBE");
export interface LandingIsolationProbe {
  capture(input: {
    targetTenantId: string;
    oldDemoTenantId: string;
    controlTenantId: string;
    targetPrefix: string;
  }): Promise<LandingIsolationSnapshot>;
  compare(
    before: LandingIsolationSnapshot,
    after: LandingIsolationSnapshot,
  ): LandingIsolationComparison;
}
```

- [ ] **Step 1: Write RED unit tests for key safety and no-I/O rejection**

Inject an S3 sender that counts calls. Assert old demo tenant, tenant mismatch, `..`, backslash, absolute path, and non-`rehearsal/` prefixes throw before the sender is invoked. Import and reuse Brief 2’s `buildRehearsalObjectKey`; do not modify or duplicate its rules.

- [ ] **Step 2: Run receipt store unit tests and observe RED**

Run: `pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.test.ts`

Expected: FAIL because the port/store do not exist.

- [ ] **Step 3: Implement idempotent receipt storage**

Use `PutObjectCommand` with `IfNoneMatch: "*"`, `ContentType: "application/json"`, and metadata containing only the digest prefix needed for server-side comparison. The object key is always built as:

```ts
buildRehearsalObjectKey(`rehearsal/${tenantId}/${runId}`, "receipt.json");
```

On precondition failure, stream and hash the existing object. Same digest returns `{ replayed: true }`; different digest throws `FULL_CHAIN_RECEIPT_CONFLICT`. Never expose the raw key in errors or responses.

- [ ] **Step 4: Pin Review Focus #3 with a timeout-after-put test**

Inject a sender that stores the object and then throws a timeout on the first call. On retry, the store reads the existing bytes, matches the digest, and reports replay. Assert one key and no delete/re-put cycle.

- [ ] **Step 5: Implement the read-only isolation probe**

Reuse Brief 2’s ownership catalog, PostgreSQL content fingerprint, MinIO byte/list inventory, source-state canonical hash, and Temporal list/describe adapter through this new port. The comparison must allow changes only in:

- target rehearsal tenant landing tables for this run;
- the one exact target receipt key;
- one landing Outbox row after publish.

It must require unchanged:

- old demo tenant;
- control/other tenant;
- nine preserved global model projections and `_prisma_migrations`;
- Temporal workflows/schedules;
- all MinIO keys outside the exact target key.

- [ ] **Step 6: Write real MinIO integration tests**

Create a unique `rehearsal/<tenant>/<run>/` prefix, ensure it is empty, put a receipt, replay, conflict with a different digest, read digest, and delete only the exact owned key. Always clean only keys created by this test.

Run: `pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.integration.test.ts`

- [ ] **Step 7: Add atomic publish behavior to the repository**

`publish()` runs a short Serializable transaction that locks the run, rechecks `reconciling`, inserts exactly one `OutboxMessage` with:

```ts
{
  ownerModule: "full-chain-sample-landing",
  eventType: "full_chain_sample_landing.published",
  eventVersion: 1,
  aggregateType: "full_chain_landing_run",
  aggregateId: runId,
  payloadRef: `full-chain-landing/${runId}/v1`,
  idempotencyKey: `full-chain-landing:${runId}:published`,
}
```

and marks the run `published` in the same transaction. No canonical lifecycle event, Inbox message, NodeTask, WorkOrder, or workflow is created.

- [ ] **Step 8: Run focused GREEN and commit**

Run:

```text
pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.test.ts src/modules/full-chain-sample-landing/infrastructure/full-chain-landing-isolation.probe.test.ts
pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store.integration.test.ts src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.integration.test.ts
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
git diff --check
```

Commit exact landing infrastructure and brief paths with message:

```text
git commit -m "feat(samples): gate rehearsal package publication"
```

### Task 6: Application Orchestration and Rehearsal-Only Authorization

**Files:**

- Create: `apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/application/full-chain-landing-policy.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/application/apply-full-chain-package.service.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/application/get-full-chain-landing.service.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/application/get-full-chain-chain.service.ts`
- Create focused tests beside read services.

**Interfaces:**

- Consumes: package validator, graph builder, repository, receipt store, isolation probe, and `AuthenticatedUserIdentity`.
- Produces:

```ts
export type ApplyFullChainPackageCommand = {
  identity: AuthenticatedUserIdentity;
  artifacts: FullChainPackageArtifacts;
  idempotencyKey: string;
  traceId: string;
};

export class ApplyFullChainPackageService {
  execute(command: ApplyFullChainPackageCommand): Promise<{
    runId: string;
    state: "published" | "replayed";
    counts: Record<FullChainRecordType, number>;
    gapCount: number;
  }>;
}
```

- [ ] **Step 1: Write RED policy tests, including Review Focus #5**

```ts
it.each([
  { tenantId: OLD_DEMO_TENANT, capabilities: ["import.execute"] },
  { tenantId: "another-tenant", capabilities: ["import.execute"] },
  { tenantId: REHEARSAL_TENANT, capabilities: [] },
])("rejects before dependencies are called", async (identity) => {
  await expect(service.execute(command({ identity }))).rejects.toThrow(
    /FULL_CHAIN_REHEARSAL_ACCESS_DENIED/,
  );
  expect(repository.stage).not.toHaveBeenCalled();
  expect(receiptStore.putIfAbsent).not.toHaveBeenCalled();
  expect(isolationProbe.capture).not.toHaveBeenCalled();
});
```

The policy reads `FULL_CHAIN_REHEARSAL_TENANT_ID` and optional prefix root through an injected configuration object created inside the new module; do not edit global config files outside the brief scope.

- [ ] **Step 2: Run Application tests and observe RED**

Run: `pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/application`

Expected: FAIL because services do not exist.

- [ ] **Step 3: Implement the exact orchestration state machine**

`execute()` order is fixed:

```ts
this.policy.assertCanApply(command.identity);
const validated = validateFullChainPackageForLanding(command.artifacts);
const graph = buildFullChainLandingGraph(validated);
const before = await this.isolationProbe.capture(scope);
const staged = await this.repository.stage({ ...command, graph, before });
const receipt = buildValidatedRedactedReceipt(staged, graph);
try {
  const stored = await this.receiptStore.putIfAbsent(receipt);
  await this.repository.markReconciling({ ...stored, runId: staged.runId });
} catch (error) {
  await this.repository.markReceiptPending({
    runId: staged.runId,
    tenantId: command.identity.tenantId,
    errorCode: publicErrorCode(error),
  });
  throw error;
}
const after = await this.isolationProbe.capture(scope);
this.isolationProbe.compare(before, after);
const reconciliation = await this.repository.reconcile(scope);
assertLandingReconciliation(reconciliation, graph, stored);
await this.repository.publish({ ...scope, reconciliation, traceId });
return redactedPublishedResult;
```

If `stage()` returns an existing `published` run, return replay without calling S3. If it returns `staged`, `receipt_pending`, or `reconciling`, resume from the earliest incomplete external step.

- [ ] **Step 4: Write RED recovery and exactly-once tests**

Mock the receipt store to fail once, then replay. Assert `stage` is invoked twice but returns one run, receipt is written once/replayed once, publish once, and returned state is published. Also assert a publish failure re-runs reconciliation before retry.

- [ ] **Step 5: Implement redacted receipt construction**

The receipt contains only:

```ts
{
  receiptVersion: "full-chain-rehearsal-receipt.v1",
  runId,
  packageId: sha256Hex(packageHash).slice(0, 16),
  tenantRef: sha256Hex(tenantId).slice(0, 16),
  state: "staged",
  counts,
  gapCounts,
  reconciliationDigest,
  createdAt,
}
```

`createdAt` is operational metadata excluded from the receipt digest projection. Do not include business keys, raw source refs, paths, full hashes, database IDs besides public runId, object keys, or credentials.

- [ ] **Step 6: Implement read services and visibility gate**

`GetFullChainLandingService` returns redacted status for the authenticated tenant. `GetFullChainChainService` returns only a published chain and exact typed references; unpublished and cross-tenant IDs return not-found semantics.

- [ ] **Step 7: Run Application GREEN and commit**

Run:

```text
pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/application
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
pnpm exec prettier --check apps/api/src/modules/full-chain-sample-landing/application --ignore-unknown
git diff --check
```

Append Brief evidence and commit exact Application files:

```text
git commit -m "feat(samples): orchestrate rehearsal landing"
```

### Task 7: Protected HTTP API, CLI, and Module Composition

**Files:**

- Create: `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.dto.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.controller.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.controller.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.cli.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.cli.test.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/full-chain-sample-landing.module.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/module.manifest.ts`
- Create: `apps/api/src/modules/full-chain-sample-landing/index.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 6 services.
- Produces:

```text
POST /full-chain-sample-landings
GET  /full-chain-sample-landings/:runId
GET  /full-chain-sample-landings/:runId/chains/:planNumber
```

All three routes require authentication. POST requires `import.execute`; GET routes require `import.read`.

- [ ] **Step 1: Write RED controller tests for route metadata and identity forwarding**

```ts
expect(getRequiredCapabilities(controller, "apply")).toEqual([
  "import.execute",
]);
await controller.apply(request(identity), {
  artifacts,
  idempotencyKey: "req-1",
  traceId: "trace-1",
});
expect(applyService.execute).toHaveBeenCalledWith({
  identity,
  artifacts,
  idempotencyKey: "req-1",
  traceId: "trace-1",
});
```

Assert body tenant fields are absent/ignored and cross-tenant input cannot override the identity.

- [ ] **Step 2: Run controller tests and observe RED**

Run: `pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/presentation/full-chain-sample-landing.controller.test.ts`

Expected: FAIL because the controller is absent.

- [ ] **Step 3: Implement DTOs and routes**

The POST DTO accepts only `artifacts`, `idempotencyKey`, and `traceId`; AJV package validation remains the boundary authority. Status and chain response DTOs expose codes, counts, typed refs, and redacted run state only.

- [ ] **Step 4: Compose the module and manifest**

```ts
export const moduleManifest = defineModuleManifest({
  id: "full-chain-sample-landing",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["import.read", "import.execute"],
  publicPorts: ["FULL_CHAIN_LANDING_STATUS", "FULL_CHAIN_LANDING_CHAIN"],
});
```

Register controller, services, Prisma repository, S3 receipt store, and isolation probe. Apply `DevIdentityMiddleware` only through the same test/development pattern used by existing protected controllers. Register the module in `app.module.ts`.

- [ ] **Step 5: Write RED CLI tests and implement fail-before-network behavior**

CLI contract:

```text
pnpm sample:full-chain:rehearse -- \
  --package <external-directory> \
  --approved-root <external-root> \
  --api-url <https-url> \
  --idempotency-key <key>
```

Token comes only from `FULL_CHAIN_LANDING_TOKEN`. The CLI calls `readFullChainPackageDirectory`, then POSTs the artifact bundle. Missing args, repository-contained paths, missing token, non-HTTPS remote URL (except loopback development), and invalid package all reject before `fetch`. Stdout contains only stable state, runId, counts, gapCount, and traceId.

- [ ] **Step 6: Run route/CLI/module gates**

Run:

```text
pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing/presentation
pnpm authz:routes
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
pnpm --filter @logix/api build
pnpm repo:check
pnpm exec prettier --check apps/api/src/modules/full-chain-sample-landing apps/api/src/app.module.ts package.json --ignore-unknown
git diff --check
```

- [ ] **Step 7: Commit exact route/composition paths**

Append Brief evidence, stage only the files listed in this task plus `package.json`, and commit:

```text
git commit -m "feat(samples): expose rehearsal landing API"
```

### Task 8: Real PostgreSQL + MinIO + HTTP Closeout

**Files:**

- Create: `apps/api/src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts`
- Modify focused landing fixtures/tests only if this closeout exposes a reproducible defect.

**Interfaces:**

- Consumes: the complete module and local PostgreSQL/MinIO/Temporal infrastructure.
- Produces: one non-mock proof covering package → protected HTTP → Application → PostgreSQL → MinIO receipt → published read APIs.

- [ ] **Step 1: Write the closeout test and observe RED**

Create a unique migrated PostgreSQL schema, unique rehearsal tenant, control tenant, old-demo control rows, and unique MinIO prefix. Start a real Nest HTTP server on an ephemeral port with `FullChainSampleLandingModule`, real Prisma adapter, real S3 receipt store, and development identity headers.

The first test must:

```ts
const applied = await postPackage(validArtifacts, identityHeaders);
expect(applied.status).toBe(201);
expect(applied.body.state).toBe("published");
const status = await getStatus(applied.body.runId, identityHeaders);
expect(status.body.counts).toEqual(SIX_TYPE_COUNTS);
const chain = await getChain(applied.body.runId, "PLAN-1", identityHeaders);
expect(chain.body.booking.documents).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ type: "mbl", number: "MBL-1" }),
    expect.objectContaining({ type: "hbl", number: "HBL-1" }),
  ]),
);
```

Run and expect RED on the first real integration mismatch.

- [ ] **Step 2: Add success/replay/concurrency assertions**

- six typed fact counts and all joins are exact;
- same HTTP request replays one run;
- two concurrent POSTs with different client keys return one run;
- one receipt object exists;
- one landing Outbox row exists;
- zero NodeTask/WorkOrder/CanonicalEvent/Inbox rows are created.

- [ ] **Step 3: Add malformed and cross-reference rejection assertions**

For each of these, capture DB/S3 counts before and assert zero delta after response:

- `publishable=false`;
- version/hash tamper;
- missing parent cargo-ready;
- orphan/AMS/customs HBL;
- dispatch MBL mismatch;
- display group used as relation;
- insufficient FC-D07 contributor lineage;
- cross-tenant identity;
- old demo target configuration;
- prefix escape.

- [ ] **Step 4: Add rollback and recovery assertions**

Inject a repository failure after customs and assert total rollback. Then inject timeout-after-MinIO-put, assert run is not published and no Outbox exists, retry, and assert the same run/object publishes once.

- [ ] **Step 5: Prove before/after isolation**

Use the ownership catalog and read-only adapters to compare:

- old demo tenant unchanged;
- control tenant unchanged;
- nine preserved globals and `_prisma_migrations` unchanged;
- Temporal workflow/schedule inventory unchanged;
- MinIO outside the exact receipt key unchanged.

Do not print raw row values, object keys, workflow input, paths, or complete hashes in test output.

- [ ] **Step 6: Run the full focused landing suite**

Run:

```text
pnpm infra:up
pnpm --filter @logix/api test -- src/modules/full-chain-sample-landing
pnpm --filter @logix/api test:integration -- src/modules/full-chain-sample-landing src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api lint
pnpm --filter @logix/api build
pnpm test:full-chain-sample
pnpm contract:check
pnpm contract:drift
pnpm data-dictionary:check
pnpm repo:check
pnpm board:check
git diff --check
```

Expected: all pass. Record actual file/test counts and durations in the brief; do not substitute the full API suite for focused evidence.

- [ ] **Step 7: Commit closeout and accepted defect fixes**

Stage exact closeout paths and any narrowly reproduced landing defects, review staged diff, and commit:

```text
git commit -m "test(samples): prove rehearsal landing closeout"
```

### Task 9: Final High-Risk Gates, Fresh Claude Review, PR, CI, and Merge

**Files:**

- Modify: `docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md`
- Modify only accepted finding paths already inside the brief `writeScopes`.

**Interfaces:**

- Consumes: completed Tasks 1–8 and all commit/check evidence.
- Produces: final disposition, one PR, green CI, merged Brief 3, and synchronized local `main`; no Brief 4 work.

- [ ] **Step 1: Audit actual diff against declared scope**

Run:

```text
git status --short --branch
git diff origin/main...HEAD --name-only
git log --oneline --decorate origin/main..HEAD
pnpm worktrees:check -- --primary D:/Logixs --json
```

Because the calibration script requires the declared primary to be on `main`, separately record its `activeTasks` and conflict arrays plus the expected `WORKTREE_PRIMARY_INVALID` when invoked from this feature-branch primary. Confirm every changed file is in Brief 3 scope and `.tmp/` trees remain untouched/untracked.

- [ ] **Step 2: Run the final high-risk local gate once**

Run:

```text
pnpm infra:up
pnpm validate
pnpm test:full-chain-sample
pnpm test:full-chain-demo
pnpm data-dictionary:check
pnpm repo:check
pnpm board:check
git diff --check
```

Record every command and actual result. If a command fails, invoke `superpowers:systematic-debugging`, reproduce the root cause, add a RED regression, and fix only the current risk surface. Do not skip, weaken, or relabel a failure.

- [ ] **Step 3: Update the brief to `review` and commit the PR candidate**

Set frontmatter `status: review`; keep `verification` factual and distinguish code-complete from actual external rehearsal execution. Append checks, commit IDs, changed-file summary, and `actual rehearsal: run | not-run`.

```text
git add -- docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
git diff --cached --check
git commit -m "docs(planning): prepare Brief 3 review"
```

- [ ] **Step 4: Invoke the required review skill and launch one fresh read-only Claude review**

Invoke `superpowers:requesting-code-review`, then start one new `claude` agent with this exact boundary:

```text
Review origin/main...HEAD for docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md.
Read AGENTS.md, ENGINEERING_RULES.md, the brief, its spec and plan.
Read-only: do not edit files, run destructive commands, access .tmp/ or apps/api/.tmp/, or initiate Brief 4.
Verify spec and standards, especially package compatibility/hash parity, typed identities/FKs, FC-D07 lineage fail-closed behavior, Serializable atomicity, idempotent/concurrent replay, receipt recovery, gated Outbox, zero business tasks/lifecycle invention, rehearsal tenant/prefix isolation, other/global zero change, API authorization, and log/receipt privacy.
Return logix-review/v1 with evidence, failure scenario, acceptance probe, current-slice necessity, unknowns, verification gaps, non-blocking suggestions, and writes:none.
```

Do not launch a second whole-branch reviewer.

- [ ] **Step 5: Reproduce and disposition every finding**

For every review finding:

- reproduce against the current branch;
- mark `accepted`, `rejected`, or `pending-owner` with evidence in the brief;
- for accepted defects, invoke `superpowers:receiving-code-review`, add a RED regression, apply the minimum fix, rerun focused gates, and commit;
- reject future-platform abstractions, unrelated refactors, or policy changes without current failure evidence;
- stop only for a real owner decision, unresolvable blocker, or safety boundary.

Use the `logix-disposition/v1` format in the brief; do not create a separate review document.

- [ ] **Step 6: Re-run only risk-changed gates and verify completion evidence**

If review fixes changed production risk, rerun the relevant focused tests and high-risk gate. If only brief text changed, do not mechanically rerun unrelated full gates. Invoke `superpowers:verification-before-completion` before any completion claim.

- [ ] **Step 7: Push one branch and create one final PR**

```text
git push -u origin feat/full-chain-rehearsal-domain-adapter
gh pr create --base main --head feat/full-chain-rehearsal-domain-adapter --title "feat(samples): land full-chain package in rehearsal" --body-file <generated-pr-body>
```

The PR body must state problem, solution, data impact, migration, tenant/prefix isolation, security/privacy, verification, actual rehearsal execution status, rollback, review disposition, and the explicit statement that Brief 4/demo deletion is not authorized.

- [ ] **Step 8: Monitor CI, fix real failures, and merge**

Use `gh pr checks --watch` or equivalent. For a real failure, diagnose, add a regression when product behavior is implicated, commit, push, and let CI rerun. Do not bypass hooks/checks or force-push.

After all required checks are green:

```text
gh pr merge --merge --delete-branch=false
git switch main
git pull --ff-only origin main
git status --short --branch
git log -3 --oneline --decorate
```

Do not remove any worktree or local branch without separate authorization.

- [ ] **Step 9: Mark the brief done only with truthful execution status**

On the feature branch before final merge, or in a follow-up docs commit within the same PR if CI timing allows, set `status: done` only when code gates, review, PR and CI satisfy the brief. `verification` must say either:

```text
code-complete; actual rehearsal execution verified: <evidence>
```

or:

```text
code-complete; actual rehearsal execution not-run: external package/tenant/prefix evidence remains a deployment gate only
```

Never state that the data was re-authenticated, the old demo was deleted, production was written, the UI switched, or a workbench closed.
