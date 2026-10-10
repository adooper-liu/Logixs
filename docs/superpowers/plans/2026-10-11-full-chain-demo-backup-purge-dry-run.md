# Full-Chain Demo Backup and Purge Dry-Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fail-closed Brief 2 tooling that separates reference/demo seed data, inventories exact demo ownership across PostgreSQL/MinIO/Temporal, creates deterministic external manifests, proves backup/isolated restore behavior, and offers a rollback-only purge dry-run with no executable delete path.

**Architecture:** Pure catalog, canonical hashing, schemas, and manifest composition live under `scripts/full-chain-demo/`. Infrastructure-aware CLIs and adapters live under `apps/api/src/tools/full-chain-demo/` so they use the repository's existing PostgreSQL, S3, and Temporal dependencies without adding a production HTTP surface. Seed entrypoints are separated under `database/`; every destructive-looking operation is either inventory-only or enclosed in a forced rollback, and `--execute` is always rejected in Brief 2.

**Tech Stack:** Node.js 22 ESM, TypeScript/tsx, Prisma 7 DMMF and generated client, `pg` through existing Prisma/PostgreSQL dependencies, `@aws-sdk/client-s3`, `@temporalio/client`, AJV JSON Schema 2020-12, built-in `node:test`, Vitest, Docker Compose local PostgreSQL/MinIO/Temporal.

**Spec:** `docs/superpowers/specs/2026-10-11-full-chain-demo-backup-purge-dry-run-design.md`

## Global Constraints

- Target tenant is exactly `demo-real-sample-20260921`; no prefix, regex, or demo-like tenant matching.
- Brief 2 exposes no purge execute function, command, route, or capability; any `--execute` input returns `DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2` before connecting to infrastructure.
- Preserve global reference/policy data, `_prisma_migrations`, Schema/migrations, Temporal's database, and every other tenant.
- Every Prisma model has exactly one `preserve_global`, `direct_tenant`, `via_parent`, or `via_logical_ref` ownership rule.
- Unknown, unresolved, multiply-owned, orphaned, stale, or global resources are blockers, never deletion candidates.
- Manifests/backups stay outside Git. Logs and receipts contain counts, stable codes, trace IDs, and manifest hashes only—not IDs, keys, workflow inputs, business values, credentials, or absolute paths.
- Use existing dependency versions; add no new package.
- No production API/controller/Vue work.
- Every production change follows RED → GREEN → REFACTOR and ends with focused tests.
- Real demo backup, pause, delete, restore, package write, adapter execution, and UI switch remain unrun.

## Review Focus

1. **Ownership drift:** a newly added or renamed Prisma model/table must make catalog validation fail before manifest generation. Task 2 owns this test.
2. **Indirect/orphan ownership:** bare logical IDs, missing parents, conflicting tenant chains, nullable tenant identities, and hidden cascades must block rather than be guessed. Task 3 owns these tests.
3. **Object/workflow ambiguity:** missing MinIO objects, duplicate owners, checksum mismatch, global schedules, runtime tenant discovery, and ambiguous workflow input must block. Task 4 owns these tests.
4. **TOCTOU and determinism:** enumeration order/timestamps must not change the manifest hash, while any DB/object/workflow state change must make dry-run stale. Tasks 5 and 6 own these tests.
5. **Source safety and recovery:** backup/restore targets equal to source, partially created backup artifacts, failed verification, or cleanup beyond rehearsal-owned resources must fail closed. Task 7 owns these tests.

---

## File Structure

### Seed entrypoints

- `database/seed.ts` — standard reference-only seed entrypoint.
- `database/seed-legacy-demo.ts` — explicit old demo seed entrypoint.
- `scripts/full-chain-demo/verify-seed-boundaries.mts` — isolated-database behavioral verification.
- `scripts/full-chain-demo/seed-boundaries.test.mjs` — CLI and source-boundary tests.

### Pure ownership and manifest modules

- `scripts/full-chain-demo/ownership-catalog.json` — exhaustive model ownership rules.
- `scripts/full-chain-demo/ownership-catalog.mjs` — schema/load/DMMF drift validation.
- `scripts/full-chain-demo/canonical-json.mjs` — deterministic JSON and hash helpers.
- `scripts/full-chain-demo/contracts.mjs` — AJV validation for manifest/receipt/backup artifacts.
- `scripts/full-chain-demo/manifest.mjs` — deterministic manifest composition and stale comparison.
- `scripts/full-chain-demo/manifest-writer.mjs` — external atomic output writer and redacted receipt.
- `scripts/full-chain-demo/schemas/ownership-catalog.schema.json`
- `scripts/full-chain-demo/schemas/purge-manifest.schema.json`
- `scripts/full-chain-demo/schemas/purge-receipt.schema.json`
- `scripts/full-chain-demo/schemas/backup-manifest.schema.json`
- `scripts/full-chain-demo/*.test.mjs` — pure unit/contract tests.

### Infrastructure-aware tools (not imported by production modules)

- `apps/api/src/tools/full-chain-demo/postgres-inventory.ts`
- `apps/api/src/tools/full-chain-demo/postgres-dry-run.ts`
- `apps/api/src/tools/full-chain-demo/minio-inventory.ts`
- `apps/api/src/tools/full-chain-demo/temporal-inventory.ts`
- `apps/api/src/tools/full-chain-demo/generate-manifest.cli.ts`
- `apps/api/src/tools/full-chain-demo/purge-dry-run.cli.ts`
- `apps/api/src/tools/full-chain-demo/backup-create.ts`
- `apps/api/src/tools/full-chain-demo/restore-rehearsal.ts`
- `apps/api/src/tools/full-chain-demo/*.test.ts`
- `apps/api/src/tools/full-chain-demo/*.integration.test.ts`

### Operations and integration points

- `docs/operations/full-chain-demo-backup-restore.md` — exact runbook with approval boundaries.
- `package.json` — seed, manifest, dry-run, backup and rehearsal commands.
- `.gitignore` — ignore only `.demo-maintenance-output/`.
- `docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md` — main-agent-owned Brief 2.

---

### Task 1: Separate Reference and Legacy Demo Seeds

**Files:**

- Modify: `database/seed.ts`
- Create: `database/seed-legacy-demo.ts`
- Create: `scripts/full-chain-demo/verify-seed-boundaries.mts`
- Create: `scripts/full-chain-demo/seed-boundaries.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `pnpm db:seed` — references only.
  - `pnpm db:seed:legacy-demo` — explicit `seedRealReplenishmentSample()`.
  - `verifySeedBoundaries(databaseUrl: string): Promise<SeedBoundaryReceipt>`.
- Consumes: existing reference seed functions and `seedRealReplenishmentSample()`.

- [ ] **Step 1: Write failing source/CLI boundary tests**

Create `seed-boundaries.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("standard seed never calls the legacy demo seed", async () => {
  const source = await read("database/seed.ts");
  assert.doesNotMatch(source, /seedRealReplenishmentSample/u);
});

test("legacy demo seed has a separate package command", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts["db:seed"], "tsx database/seed.ts");
  assert.equal(
    pkg.scripts["db:seed:legacy-demo"],
    "tsx database/seed-legacy-demo.ts",
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test scripts/full-chain-demo/seed-boundaries.test.mjs
```

Expected: FAIL because standard seed still calls the demo seed and the legacy command does not exist.

- [ ] **Step 3: Split entrypoints minimally**

`database/seed.ts` continues to create/disconnect Prisma but calls only:

```ts
await seedAuthoritativeLocationReferenceData(prisma);
await seedCargoOwnerReferenceData(prisma);
```

`database/seed-legacy-demo.ts` creates/disconnects Prisma and calls only:

```ts
const result = await seedRealReplenishmentSample(prisma);
console.log(
  `Seeded legacy demo tenant: orders=${result.replenishmentOrderCount} containers=${result.containerCount} skus=${result.productSkuCount}`,
);
```

Do not print fixture identities or source filenames.

- [ ] **Step 4: Add isolated database behavior verification**

`verify-seed-boundaries.mts` must:

1. create a uniquely named `logix_verify_seed_<pid>_<random>` database;
2. deploy current migrations;
3. snapshot counts/hashes for the nine preserved global tables and all DMMF models with `tenantId`;
4. run `db:seed` twice;
5. prove global snapshots are stable and tenant-owned counts remain 0;
6. run `db:seed:legacy-demo` twice;
7. prove only the exact target tenant changes and replay is idempotent;
8. terminate sessions and drop only the verified temporary database.

Stable receipt:

```ts
interface SeedBoundaryReceipt {
  referenceReplayStable: true;
  standardSeedTenantDelta: 0;
  legacyDemoReplayStable: true;
  otherTenantDelta: 0;
}
```

- [ ] **Step 5: Run RED then GREEN database verification**

Run before implementation completion:

```bash
pnpm infra:up
pnpm exec tsx scripts/full-chain-demo/verify-seed-boundaries.mts
```

Expected: first RED on mixed seed behavior, then GREEN with four boolean/count outcomes and no row IDs.

- [ ] **Step 6: Run focused tests and commit**

```bash
node --test scripts/full-chain-demo/seed-boundaries.test.mjs
pnpm exec tsx scripts/full-chain-demo/verify-seed-boundaries.mts
git add database/seed.ts database/seed-legacy-demo.ts scripts/full-chain-demo/verify-seed-boundaries.mts scripts/full-chain-demo/seed-boundaries.test.mjs package.json
git commit -m "refactor(seed): separate reference and legacy demo data"
```

---

### Task 2: Exhaustive Ownership Catalog and Contracts

**Files:**

- Create: `scripts/full-chain-demo/ownership-catalog.json`
- Create: `scripts/full-chain-demo/ownership-catalog.mjs`
- Create: `scripts/full-chain-demo/canonical-json.mjs`
- Create: `scripts/full-chain-demo/contracts.mjs`
- Create: `scripts/full-chain-demo/schemas/ownership-catalog.schema.json`
- Create: `scripts/full-chain-demo/schemas/purge-manifest.schema.json`
- Create: `scripts/full-chain-demo/schemas/purge-receipt.schema.json`
- Create: `scripts/full-chain-demo/schemas/backup-manifest.schema.json`
- Create: `scripts/full-chain-demo/ownership-catalog.test.mjs`
- Create: `scripts/full-chain-demo/contracts.test.mjs`

**Interfaces:**

- Produces:
  - `loadOwnershipCatalog(path): OwnershipCatalogV1`
  - `validateCatalogAgainstDmmf(catalog, Prisma.dmmf): void`
  - `canonicalStringify(value): string`
  - `sha256Hex(value): string`
  - `manifestHashProjection(manifest): object`
  - `validatePurgeManifest(value): PurgeManifestV1`
  - `validateBackupManifest(value): BackupManifestV1`
- Consumes: generated `Prisma.dmmf` and JSON schemas only.

- [ ] **Step 1: Write failing catalog schema and DMMF drift tests**

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  loadOwnershipCatalog,
  validateCatalogAgainstDmmf,
} from "./ownership-catalog.mjs";

const require = createRequire(import.meta.url);
const { Prisma } = require("../../generated/prisma");

test("every Prisma model has exactly one ownership rule", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  assert.doesNotThrow(() => validateCatalogAgainstDmmf(catalog, Prisma.dmmf));
});

test("catalog drift fails closed", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  const missing = structuredClone(catalog);
  delete missing.models.Product;
  assert.throws(
    () => validateCatalogAgainstDmmf(missing, Prisma.dmmf),
    /OWNERSHIP_CATALOG_DRIFT/,
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test scripts/full-chain-demo/ownership-catalog.test.mjs
```

Expected: FAIL because catalog/modules do not exist.

- [ ] **Step 3: Implement strict catalog schema**

Catalog rules:

```ts
type OwnershipRule =
  | { rule: "preserve_global"; table: string }
  | {
      rule: "direct_tenant";
      table: string;
      tenantField: "tenantId";
      deleteRank: number;
    }
  | {
      rule: "via_parent";
      table: string;
      parentModel: string;
      foreignKey: string;
      parentKey: string;
      deleteRank: number;
    }
  | {
      rule: "via_logical_ref";
      table: string;
      resolver: string;
      deleteRank: number;
    };
```

`additionalProperties: false` at every schema level. Exact preserved models:

```text
ReferenceDataRelease
CurrencyCodeReference
CountryCodeReference
CargoOwnerReference
UnlocodeAreaReference
PortCodeReference
PortCodeEntry
PortNameAlias
SourceAuthorityPolicy
```

Exact indirect rules are the 13 rows in design §5.3. Every other current DMMF model with `tenantId` is generated into the checked-in JSON as `direct_tenant`; generation is mechanical, but the committed catalog is reviewed and the drift test is authoritative.

- [ ] **Step 4: Implement deterministic manifest contracts**

`PurgeManifestV1` requires:

```js
{
  manifestVersion: "full-chain-demo-purge-manifest.v1",
  targetTenant: "demo-real-sample-20260921",
  catalogVersion,
  catalogHash,
  schemaFingerprint,
  migrationFingerprint,
  postgres: { entries, count, hash },
  minio: { entries, count, hash },
  temporal: { entries, count, hash },
  blockers: { entries, count, hash },
  deletable: false,
  manifestHash,
  allowedProof: ["demo ownership inventory", "purge dry-run input"],
  prohibitedProof: ["deletion authorization", "backup complete", "demo switched"]
}
```

Hash projection excludes `generatedAt`, operator, trace ID and output path; includes every ownership/result field and `deletable=false`.

- [ ] **Step 5: Add tamper/determinism/privacy tests**

Cover:

- same entries in different order → same hash;
- timestamps/operators differ → same hash;
- candidate count/hash/blocker change → different hash;
- `deletable=true` rejected;
- unknown manifest/copy/restore fields rejected;
- paths, object keys, row IDs, workflow inputs absent from redacted receipt fixture.

- [ ] **Step 6: Run tests and commit**

```bash
node --test scripts/full-chain-demo/ownership-catalog.test.mjs scripts/full-chain-demo/contracts.test.mjs
git add scripts/full-chain-demo/ownership-catalog.json scripts/full-chain-demo/ownership-catalog.mjs scripts/full-chain-demo/canonical-json.mjs scripts/full-chain-demo/contracts.mjs scripts/full-chain-demo/schemas scripts/full-chain-demo/ownership-catalog.test.mjs scripts/full-chain-demo/contracts.test.mjs
git commit -m "feat(demo): define exhaustive ownership manifest contracts"
```

---

### Task 3: PostgreSQL Ownership Inventory

**Files:**

- Create: `apps/api/src/tools/full-chain-demo/postgres-inventory.ts`
- Create: `apps/api/src/tools/full-chain-demo/postgres-inventory.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/postgres-inventory.integration.test.ts`
- Create: `scripts/full-chain-demo/postgres-fixtures.mjs`

**Interfaces:**

- Consumes: `OwnershipCatalogV1`, target tenant, Prisma client.
- Produces:
  - `collectPostgresInventory(input): Promise<PostgresInventoryResult>`
  - `buildDeletePlan(entries): DeletePlanEntry[]`
  - `PostgresManifestEntry[]`

```ts
interface PostgresManifestEntry {
  model: string;
  table: string;
  ownershipRule: string;
  deleteRank: number | null;
  candidateCount: number;
  primaryKeyHash: string;
  unresolvedCount: number;
  status: "preserved" | "candidate" | "blocked";
  blockerCodes: string[];
}
```

- [ ] **Step 1: Write failing direct/preserve inventory tests**

Use a fake Prisma executor with literal UUIDs. Assert:

- direct tenant selects only exact target tenant;
- nullable `CanonicalEvent.tenantId=null` is not candidate;
- preserve_global performs count/hash only and never candidate selection;
- other-tenant rows remain excluded.

Expected initial failure: `collectPostgresInventory` missing.

- [ ] **Step 2: Write failing indirect ownership tests**

Cover every design §5.3 chain. Required cases:

```text
one parent → target tenant → candidate
one parent → other tenant → excluded
missing parent → OWNERSHIP_UNRESOLVED
parent chains disagree → OWNERSHIP_AMBIGUOUS
NodeApplicabilityDecision bare flowInstanceId missing → blocker
NodeEventApplication event tenant differs from node tenant → blocker
```

- [ ] **Step 3: Implement inventory with parameterized SQL/Prisma only**

Rules:

- never concatenate tenant IDs or row IDs into SQL;
- select primary keys in stable byte order;
- primary key lists remain only in returned external manifest data;
- redacted summary exposes model/table code, count, hash and blocker codes;
- no delete methods in this module.

- [ ] **Step 4: Implement child-first delete plan derivation**

`buildDeletePlan()` sorts candidate entries by explicit `deleteRank` descending and rejects duplicate/missing rank. Every FK/cascade model still appears. `preserve_global` cannot appear in the plan.

- [ ] **Step 5: Run real PostgreSQL integration in isolated database**

Integration test creates a unique temporary database, migrates it, inserts two tenants plus indirect/orphan rows, then asserts:

- all target candidates accounted for;
- other tenant count/hash unchanged;
- nine preserved global tables never candidates;
- orphan/ambiguous rows block;
- actual database/schema/migrations are dropped only for the temporary database.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @logix/api test -- src/tools/full-chain-demo/postgres-inventory.test.ts
pnpm --filter @logix/api test:integration -- src/tools/full-chain-demo/postgres-inventory.integration.test.ts
git add apps/api/src/tools/full-chain-demo/postgres-inventory.ts apps/api/src/tools/full-chain-demo/postgres-inventory.test.ts apps/api/src/tools/full-chain-demo/postgres-inventory.integration.test.ts scripts/full-chain-demo/postgres-fixtures.mjs
git commit -m "feat(demo): inventory tenant-owned postgres data"
```

---

### Task 4: MinIO and Temporal Inventory

**Files:**

- Create: `apps/api/src/tools/full-chain-demo/minio-inventory.ts`
- Create: `apps/api/src/tools/full-chain-demo/minio-inventory.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/temporal-inventory.ts`
- Create: `apps/api/src/tools/full-chain-demo/temporal-inventory.test.ts`

**Interfaces:**

- Produces:
  - `collectMinioInventory(input): Promise<MinioInventoryResult>`
  - `collectTemporalInventory(input): Promise<TemporalInventoryResult>`
- Consumes: tenant-owned `ImportBatch` projections, injected S3 client, injected Temporal client.

- [ ] **Step 1: Write MinIO failure-first tests**

Use injected fake S3 client. Cover:

- one DB-owned key + matching object/checksum → candidate;
- DB key missing in bucket → `MINIO_OBJECT_MISSING`;
- one key referenced by two batches/tenants → `MINIO_OWNERSHIP_AMBIGUOUS`;
- checksum mismatch → `MINIO_CHECKSUM_MISMATCH`;
- bucket object with no DB owner → blocker/orphan, never target candidate;
- `EvidenceRecord.contentRef` resembling a key is not ownership proof.

- [ ] **Step 2: Implement read-only S3 inventory**

Allowed S3 commands: `ListBuckets`, `ListObjectsV2`, `HeadObject`. No `Put`, `Copy`, or `Delete` in inventory module. Return external entries with keys, but receipt/log helpers only expose counts/hashes/codes.

- [ ] **Step 3: Write Temporal failure-first tests**

Injected fake Temporal handles:

- tenant-scoped legacy workflow with exact target tenant input → target;
- other tenant → other;
- global system workflow/schedule → global blocker;
- missing/redacted input or continue-as-new ambiguity → `TEMPORAL_OWNERSHIP_AMBIGUOUS`;
- active global `outbox-publish-due-system` schedule always records `TEMPORAL_GLOBAL_SCHEDULE_BLOCKER`;
- inventory never calls pause/unpause/terminate/cancel.

- [ ] **Step 4: Implement read-only Temporal inventory**

Use list/describe only. Hash a redacted normalized input projection; never return raw workflow args in receipt. Global schedule remains a blocker/freeze requirement even if no demo workflow currently runs.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @logix/api test -- src/tools/full-chain-demo/minio-inventory.test.ts src/tools/full-chain-demo/temporal-inventory.test.ts
git add apps/api/src/tools/full-chain-demo/minio-inventory.ts apps/api/src/tools/full-chain-demo/minio-inventory.test.ts apps/api/src/tools/full-chain-demo/temporal-inventory.ts apps/api/src/tools/full-chain-demo/temporal-inventory.test.ts
git commit -m "feat(demo): inventory object and workflow ownership"
```

---

### Task 5: Deterministic Three-Domain Manifest CLI

**Files:**

- Create: `scripts/full-chain-demo/manifest.mjs`
- Create: `scripts/full-chain-demo/manifest-writer.mjs`
- Create: `scripts/full-chain-demo/manifest.test.mjs`
- Create: `scripts/full-chain-demo/manifest-writer.test.mjs`
- Create: `apps/api/src/tools/full-chain-demo/generate-manifest.cli.ts`
- Create: `apps/api/src/tools/full-chain-demo/generate-manifest.cli.test.ts`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `composePurgeManifest({ catalog, postgres, minio, temporal, context })`
  - `compareManifestState(expected, current): ManifestDifference[]`
  - `writeManifestAtomically({ manifest, outputDir })`
  - CLI `pnpm demo:purge:manifest -- --tenant ... --output ...`

- [ ] **Step 1: Write failing composition/hash tests**

Fixtures provide identical inventories in different orders. Assert identical manifest hash. Change one count/hash/state and assert different hash plus stable difference code.

- [ ] **Step 2: Implement deterministic composition**

Sort entries by UTF-8 byte order, reuse canonical JSON approach from Brief 1, set `deletable=false`, and include blockers from all domains. `manifestHash` covers immutable projection only.

- [ ] **Step 3: Write atomic output/privacy tests**

Cover:

- new output directory succeeds;
- existing output refused;
- write/rename failure removes only own staging;
- manifest files contain controlled external details;
- stdout receipt contains only result, counts, blocker count, trace ID and hash prefix-free token—not paths/keys/IDs/inputs.

- [ ] **Step 4: Implement CLI default denial**

Arguments required:

```text
--tenant demo-real-sample-20260921
--output <new external directory>
```

If `--execute` appears, fail before creating clients:

```text
DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2
```

Invalid tenant fails `DEMO_MAINTENANCE_TENANT_DENIED`. CLI must not create output if any infrastructure inventory throws.

- [ ] **Step 5: Add package commands and ignore root**

```json
{
  "demo:purge:manifest": "pnpm --filter @logix/api exec tsx src/tools/full-chain-demo/generate-manifest.cli.ts",
  "test:full-chain-demo": "node --test scripts/full-chain-demo/*.test.mjs && pnpm --filter @logix/api test -- src/tools/full-chain-demo"
}
```

Add only `.demo-maintenance-output/` to `.gitignore`.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm test:full-chain-demo
pnpm lint
pnpm repo:check
git diff --check
git add scripts/full-chain-demo/manifest.mjs scripts/full-chain-demo/manifest-writer.mjs scripts/full-chain-demo/manifest.test.mjs scripts/full-chain-demo/manifest-writer.test.mjs apps/api/src/tools/full-chain-demo/generate-manifest.cli.ts apps/api/src/tools/full-chain-demo/generate-manifest.cli.test.ts package.json .gitignore
git commit -m "feat(demo): generate deterministic purge manifests"
```

---

### Task 6: Rollback-Only Purge Dry-Run

**Files:**

- Create: `apps/api/src/tools/full-chain-demo/postgres-dry-run.ts`
- Create: `apps/api/src/tools/full-chain-demo/postgres-dry-run.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/postgres-dry-run.integration.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/purge-dry-run.cli.ts`
- Create: `apps/api/src/tools/full-chain-demo/purge-dry-run.cli.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `rehearseDeletePlan({ client, manifest }): Promise<DryRunResult>`
  - `assertManifestFresh(expected, current): void`
  - CLI `pnpm demo:purge:dry-run -- ...`
- Consumes: valid manifest, expected hash, current inventories.

- [ ] **Step 1: Write argument and execute-denial tests**

Assert `--execute` rejects before any mocked DB/S3/Temporal constructor is called. Assert wrong tenant, missing expected hash, manifest hash mismatch and `deletable=true` all fail closed.

- [ ] **Step 2: Write stale-manifest tests**

Mutate each domain independently:

```text
PostgreSQL candidate count/hash
MinIO object metadata/checksum
Temporal schedule/workflow state
catalog/schema/migration fingerprint
blocker set
```

Each produces `MANIFEST_STALE` with stable difference codes and no IDs.

- [ ] **Step 3: Implement rollback-only PostgreSQL rehearsal**

Use one connection:

```text
BEGIN
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
DELETE child-first ... RETURNING primary_key
compare actual counts/hashes to manifest
ROLLBACK
```

Always rollback in `finally`; a rollback failure is fatal. Delete SQL is built only from validated catalog table/column identifiers, never user text. The tenant remains a bound parameter. No MinIO/Temporal mutation.

- [ ] **Step 4: Integration-test zero persistence**

In an isolated database with two tenants and indirect rows:

- capture all-table counts/hashes;
- dry-run target tenant;
- confirm planned/actual counts match;
- confirm source counts/hashes byte-identical after rollback;
- confirm preserved references and other tenant unchanged;
- inject a hidden cascade/count mismatch and require failure;
- create one unresolved indirect row and require blocker before transaction.

- [ ] **Step 5: Implement redacted CLI receipt**

Success means only:

```json
{
  "result": "dry_run_complete",
  "postgresCandidateCount": 0,
  "minioCandidateCount": 0,
  "temporalTargetCount": 0,
  "blockerCount": 0,
  "manifestHash": "<external-only; CLI prints stable receipt token, not full hash>"
}
```

Do not print delete statements, table row IDs, keys, workflow IDs/inputs, tenant business data, or paths.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @logix/api test -- src/tools/full-chain-demo/postgres-dry-run.test.ts src/tools/full-chain-demo/purge-dry-run.cli.test.ts
pnpm --filter @logix/api test:integration -- src/tools/full-chain-demo/postgres-dry-run.integration.test.ts
pnpm test:full-chain-demo
git add apps/api/src/tools/full-chain-demo/postgres-dry-run.ts apps/api/src/tools/full-chain-demo/postgres-dry-run.test.ts apps/api/src/tools/full-chain-demo/postgres-dry-run.integration.test.ts apps/api/src/tools/full-chain-demo/purge-dry-run.cli.ts apps/api/src/tools/full-chain-demo/purge-dry-run.cli.test.ts package.json
git commit -m "feat(demo): rehearse purge plans with forced rollback"
```

---

### Task 7: Backup Creation and Isolated Restore Rehearsal

**Files:**

- Create: `apps/api/src/tools/full-chain-demo/backup-create.ts`
- Create: `apps/api/src/tools/full-chain-demo/backup-create.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/restore-rehearsal.ts`
- Create: `apps/api/src/tools/full-chain-demo/restore-rehearsal.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/backup-create.integration.test.ts`
- Create: `apps/api/src/tools/full-chain-demo/restore-rehearsal.integration.test.ts`
- Create: `docs/operations/full-chain-demo-backup-restore.md`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `createBackupArtifacts(input): Promise<BackupManifestV1>`
  - `assertIsolatedRestoreTarget(input): void`
  - `rehearseRestore(input): Promise<RestoreReceipt>`
  - `pnpm demo:backup:create`
  - `pnpm demo:restore:rehearse`

- [ ] **Step 1: Write target-isolation tests first**

Reject:

- source DB name/URL reused;
- database name outside `logix_rehearsal_<pid>_<16 hex>`;
- existing non-empty target DB;
- source bucket/prefix reused;
- target prefix not marked rehearsal-owned;
- source Temporal namespace reused;
- cleanup request for resources not created by current run.

- [ ] **Step 2: Implement backup artifact orchestration**

PostgreSQL:

- invoke `pg_dump` with argument array, not shell interpolation;
- target external new directory only;
- calculate backup file hash/size;
- verify dump can be listed by `pg_restore --list`;
- never print URL/password/path.

MinIO:

- copy only manifest candidate keys to a new rehearsal prefix;
- stream bytes and verify SHA-256/size against manifest metadata;
- no source delete.

Temporal:

- write inventory/freeze requirements only;
- no Temporal DB dump/reset;
- no pause/unpause in Brief 2.

- [ ] **Step 3: Implement isolated restore rehearsal**

- create uniquely named database;
- restore PostgreSQL dump;
- run migration status and manifest count/hash verification;
- verify nine preserved global table snapshots;
- verify target/other tenant isolation;
- verify copied MinIO bytes/checksums;
- verify Temporal inventory assumptions remain unchanged;
- compare source before/after fingerprints;
- cleanup only created rehearsal DB/prefix/namespace inventory.

- [ ] **Step 4: Integration tests with injected failures**

Cover failure at:

```text
pg_dump
pg_restore
DB verification
MinIO copy
MinIO checksum verification
Temporal inventory verification
source before/after comparison
cleanup
```

Every failure produces incomplete receipt, never `backup_verified`/`restore_verified`. Existing source and unrelated target resources remain unchanged.

- [ ] **Step 5: Write operational runbook**

Runbook sections:

1. Purpose and exact target tenant.
2. Prerequisites and local-only constraints.
3. Manifest generation.
4. Backup artifact creation.
5. Isolated restore rehearsal.
6. Dry-run.
7. Evidence to record: counts, hashes, blocker codes, receipt IDs.
8. Explicitly prohibited: real purge, demo write, global schedule pause, Temporal DB reset, reference deletion.
9. Future Brief 4 authorization gate: exact manifest hash, backup/restore receipts, maintenance/freeze plan, owner confirmation.

Do not include credentials, absolute local paths, object keys, row IDs or workflow inputs.

- [ ] **Step 6: Add package commands**

```json
{
  "demo:backup:create": "pnpm --filter @logix/api exec tsx src/tools/full-chain-demo/backup-create.ts",
  "demo:restore:rehearse": "pnpm --filter @logix/api exec tsx src/tools/full-chain-demo/restore-rehearsal.ts"
}
```

Both commands require explicit source manifest/hash and isolated target arguments. Neither performs purge or adapter writes.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @logix/api test -- src/tools/full-chain-demo/backup-create.test.ts src/tools/full-chain-demo/restore-rehearsal.test.ts
pnpm --filter @logix/api test:integration -- src/tools/full-chain-demo/backup-create.integration.test.ts src/tools/full-chain-demo/restore-rehearsal.integration.test.ts
pnpm test:full-chain-demo
pnpm docs:check
pnpm repo:check
git diff --check
git add apps/api/src/tools/full-chain-demo/backup-create.ts apps/api/src/tools/full-chain-demo/backup-create.test.ts apps/api/src/tools/full-chain-demo/restore-rehearsal.ts apps/api/src/tools/full-chain-demo/restore-rehearsal.test.ts apps/api/src/tools/full-chain-demo/backup-create.integration.test.ts apps/api/src/tools/full-chain-demo/restore-rehearsal.integration.test.ts docs/operations/full-chain-demo-backup-restore.md package.json
git commit -m "feat(demo): verify isolated backup and restore rehearsal"
```

---

## Final Main-Agent Verification

After Tasks 1–7:

```bash
pnpm test:full-chain-demo
pnpm --filter @logix/api test -- src/tools/full-chain-demo
pnpm test:integration
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm docs:check
pnpm repo:check
git diff --check
```

Main agent additionally runs read-only/local evidence:

1. generate a real local demo manifest twice and compare hashes;
2. confirm all DMMF models classified;
3. confirm target candidate counts are stable;
4. confirm nine preserved global tables and other tenants absent from candidates;
5. confirm MinIO ownership uses DB proof only;
6. confirm global Temporal schedule appears as blocker;
7. run purge dry-run and verify all three domains unchanged;
8. run backup/restore only against isolated rehearsal targets, not the real demo switch;
9. dispatch fresh Codex security/data-integrity review.

The task may be `done` with blockers recorded, because blockers correctly prevent future purge. It must not claim backup of the real demo, deletion readiness, package write readiness, or UI switch completion unless those external actions were separately authorized and executed.

## Plan Self-Review

### Spec coverage

- Seed separation: Task 1.
- Complete ownership catalog and drift: Task 2.
- Direct/indirect PostgreSQL inventory: Task 3.
- MinIO/Temporal ownership and global schedule blocker: Task 4.
- Deterministic atomic manifest: Task 5.
- Default-zero purge rehearsal and stale manifest: Task 6.
- Backup and isolated restore rehearsal: Task 7.
- No execute path/API/UI: Global constraints plus Tasks 5–7.
- Reference/other-tenant preservation: Tasks 1–3, 6–7.

### Placeholder scan

No TBD/TODO, “similar to”, unspecified validation, or undefined consumer interface remains. Real infrastructure paths and credentials are runtime arguments and never committed.

### Type consistency

`OwnershipCatalogV1 → Postgres/Minio/TemporalInventoryResult → PurgeManifestV1 → DryRunResult/BackupManifestV1` is defined in producer-to-consumer order. CLI commands consume the exact functions listed in each task interface.

### Review-focus coverage

All five review focus items have explicit tests: catalog drift (Task 2), indirect ownership (Task 3), object/workflow ambiguity (Task 4), TOCTOU/determinism (Tasks 5–6), and isolated recovery (Task 7).
