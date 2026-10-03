# GC-012 G3: Selection-to-NPI Second-Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product-selection→NPI the second GC-012 runtime consumer by separating investment decision, receipt, claim, acceptance, return request/acceptance and supersession while preserving ProductInitiative handoff history.

**Architecture:** `ProductInitiativeHandoffV1` remains the domain payload. A product-selection-owned append-only disposition log and Adapter project GC-012 snapshot/receipts/responsibility. Product-definition writes require current accepted NPI responsibility; return and supersession are transactional domain behavior, not common-platform state.

**Tech Stack:** TypeScript, NestJS 11, Prisma ORM 7, PostgreSQL 16, JSON Schema, Vue 3, Vitest, Playwright, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-10-03-gc12.md`

## Global Constraints

- G0, G1 and G2 must be merged; G3 imports GC-012 generated types unchanged and does not add common fields.
- G3 is Concept handoff/responsibility only; it does not implement full EVT/DVT/PVT/MP workflow.
- Selection `approve` remains the investment decision that creates an immutable ProductInitiative handoff.
- Received, claimed and accepted are distinct; claim does not transfer result responsibility or unlock ProductDefinition work.
- Return is request + acceptance; request does not transfer responsibility.
- Superseded handoff history, claim, acceptance, evidence and ProductDefinition remain read-only; a new handoff requires explicit re-acceptance.
- Resource approval and compliance veto are not inferred from selection or NPI actors.
- Existing V1 queue/claim/read behavior remains available during an explicit compatibility window; direct-return semantics cannot bypass two-step return.
- No universal GC-012 persistence table.

## Review Focus

1. A claimed-only user must not write or release ProductDefinition; only the current accepted NPI result owner may act.
2. A return request rejected or not yet accepted must leave responsibility and write restrictions with NPI.
3. A newly superseding handoff must not inherit old claim/accept; old ProductDefinition remains historical and unwritable.
4. Concurrent accept, reject, return request/accept and supersede writes must produce one winner and stable conflicts without half-state.
5. Historical claims must not be silently backfilled as acceptance; migration keeps them claimed/legacy until explicit attestation or acceptance.

---

## Policy Stop Gate

Task 1 is mandatory. Tasks 2–8 execute only after the owner approves and writes every D1–D7 policy below. If any remains pending, stop after the docs-only commit.

### Proposed D0 Baseline

#### D1 claim/accept/result owner

- claim only names a processing actor;
- only current claimant may accept in V1;
- accepting actor becomes NPI result owner;
- claim and accepted-result-owner remain separate facts/fields;
- future transfer requires a separately approved action.

#### D2 legacy claims

- legacy claim maps only to claimed;
- no automatic acceptance from claim or existing ProductDefinition;
- legacy active work enters “acceptance required” before its next protected write;
- optional controlled attestation is a future management action, not migration backfill.

#### D3 return policy

- only current accepted NPI result owner may request return;
- responsibility remains NPI after request;
- NPI professional writes are frozen while return request is pending;
- selection's current initiative owner or explicit return queue member may accept return;
- selection may reject the return request with reason/gaps/recovery;
- only return acceptance transfers responsibility back and sets initiative to returned_from_npi.

#### D4 supersession

- every re-approved initiative creates a new handoff and supersedes the prior current handoff;
- old acceptance never transfers to the new version;
- old ProductDefinition and evidence remain read-only;
- new handoff starts received and must be claimed/accepted again;
- V1 has no “non-material automatic inheritance” path.

#### D5 roles/capabilities

Proposed codes:

```text
product_selection.initiative.decide
product_npi.handoff.claim
product_npi.handoff.accept
product_npi.handoff.reject
product_npi.handoff.return.request
product_selection.handoff.return.accept
product_selection.handoff.return.reject
```

Every action also enforces tenant and initiative/handoff object scope. Resource approval and compliance veto remain explicit unknowns unless separate actions/sources are approved; do not map them to `responsibleActorId` or `planning.draft`.

#### D6 reject vs return

- before acceptance: `rejected`, selection remains responsible;
- after acceptance: `return_requested`, NPI remains responsible until `return_accepted`;
- ordinary missing information remains waiting, not reject/return.

#### D7 compatibility

- add new acceptance/rejection/return-request/return-accept endpoints and migrate the only Web consumer;
- existing claim endpoint delegates to the new disposition writer;
- old immediate `return-to-selection` endpoint returns stable `PRODUCT_INITIATIVE_RETURN_REQUIRES_V2` after caller migration, then retires under a documented window;
- V1 reads expose a compatibility projection without claiming acceptance where only claim exists.

---

### Task 1: Decide and Write G3 Responsibility Policy

**Files:**

- Modify: `doc/cross-border-supply-chain/08-role-workbenches.md`
- Create: `docs/planning/tasks/product-selection-npi-gc012-reference-v1.md`
- Modify: `docs/INDEX.md`
- Modify: this plan only if owner chooses alternatives

**Interfaces:**

- Produces exact D1–D7 policy consumed by all later tasks.

- [ ] **Step 1: Present D1–D7 as separate owner decisions**

For each, record current evidence, mutually exclusive options, recommendation, cost/risk/reversibility, owner conclusion and authority location.

- [ ] **Step 2: Stop if any policy is pending**

Set brief `blocked`, commit docs only and do not create Schema/migration/API/Web changes.

- [ ] **Step 3: Write approved policy and high-risk task metadata**

Declare schema/migration/public-contract/authz/business-policy locks and exact write scopes. Explicitly exclude complete NPI five-stage implementation.

- [ ] **Step 4: Run docs gates and commit**

```bash
pnpm docs:check
pnpm repo:check
pnpm format:check
git diff --check
git add doc/cross-border-supply-chain/08-role-workbenches.md docs/planning/tasks/product-selection-npi-gc012-reference-v1.md docs/INDEX.md docs/superpowers/plans/2026-10-03-gc012-g3-selection-npi.md
git commit -m "docs(npi): approve GC-012 responsibility policy"
```

---

### Task 2: Define Product-Initiative GC-012 Commands and Adapter

**Files:**

- Modify: `packages/contracts/schemas/v1/product-initiative.schema.json`
- Modify: `packages/contracts/fixtures/v1/schema-instances.json`
- Generate: `packages/contracts/generated/contracts.d.ts`
- Create: `apps/api/src/modules/product-selection/application/product-initiative-handoff.adapter.ts`
- Create: `apps/api/src/modules/product-selection/application/product-initiative-handoff.adapter.test.ts`

**Interfaces:**

- Consumes G1 GC-012 types and Task 1 policy.
- Produces domain V2 command/queue view types and a pure Adapter.

- [ ] **Step 1: Add contract RED fixtures**

Add:

```text
ProductInitiativeHandoffAcceptCommandV1
ProductInitiativeHandoffRejectCommandV1
ProductInitiativeReturnRequestCommandV1
ProductInitiativeReturnAcceptanceCommandV1
ProductInitiativeReturnRejectionCommandV1
ProductInitiativeNpiQueueEntryV2
```

V2 queue entry composes GC-012 snapshot/receipts/responsibility plus `ProductInitiativeHandoffV1`; it must not duplicate common fields.

Negative fixtures cover claim presented as accepted, missing reason/gaps/recovery, return acceptance without request, broad owner/capability fields, and domain state leaking into common snapshot.

- [ ] **Step 2: Run contract check and verify RED**

```bash
pnpm contract:check
```

- [ ] **Step 3: Write Adapter parity RED tests**

Use exact shape:

```ts
export interface ProductInitiativeHandoffAdapterInput {
  initiative: ProductInitiativeRecord;
  handoff: ProductInitiativeHandoffRecord;
  dispositions: readonly ProductInitiativeHandoffDispositionRecord[];
  legacyClaim: ProductInitiativeClaimRecord | null;
  supersededByHandoffId: string | null;
}

export interface ProductInitiativeHandoffView {
  snapshot: WorkbenchHandoffSnapshotV1;
  receipts: readonly HandoffDispositionV1[];
  responsibility: HandoffResponsibilityWindowV1;
  domain: ProductInitiativeHandoffV1;
}

export function adaptProductInitiativeHandoff(
  input: ProductInitiativeHandoffAdapterInput,
): ProductInitiativeHandoffView;
```

Tests prove legacy claim maps claimed only, accepted responsibility uses explicit receipt, old superseded handoff is historical, and no outcome/review point is copied into common fields.

- [ ] **Step 4: Implement Schema and Adapter, generate GREEN**

```bash
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
pnpm --filter @logix/api exec vitest run src/modules/product-selection/application/product-initiative-handoff.adapter.test.ts
```

- [ ] **Step 5: Commit contract and Adapter**

```bash
git add packages/contracts/schemas/v1/product-initiative.schema.json packages/contracts/fixtures/v1/schema-instances.json packages/contracts/generated/contracts.d.ts apps/api/src/modules/product-selection/application/product-initiative-handoff.adapter.ts apps/api/src/modules/product-selection/application/product-initiative-handoff.adapter.test.ts
git commit -m "feat(npi): adapt initiative handoff to GC-012"
```

---

### Task 3: Add Domain Disposition and Additive Data Foundation

**Files:**

- Create: `apps/api/src/modules/product-selection/domain/product-initiative-handoff-disposition.ts`
- Create: `apps/api/src/modules/product-selection/domain/product-initiative-handoff-disposition.test.ts`
- Create: `apps/api/src/modules/product-selection/domain/product-initiative-handoff.repository.ts`
- Create: `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-handoff.repository.ts`
- Create: `database/migrations/20261005100000_add_product_initiative_handoff_dispositions/migration.sql`
- Modify: `database/schema.prisma`
- Modify: `database/dictionary/dictionary.annotations.json`
- Generate: `database/dictionary/DATA_DICTIONARY.generated.md`
- Generate: `database/dictionary/NATIVE_OBJECTS.generated.md`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts`

**Interfaces:**

- Produces domain-specific append-only dispositions and repository methods; no universal table.

- [ ] **Step 1: Write domain RED tests**

Pin:

```ts
expect(projectResponsibility(received)).toBe("product_selection");
expect(projectResponsibility(claimed)).toBe("product_selection");
expect(projectResponsibility(accepted)).toBe("product_npi");
expect(projectResponsibility(returnRequested)).toBe("product_npi");
expect(projectResponsibility(returnAccepted)).toBe("product_selection");
```

Add actor legality, pending-return freeze, supersede, expected-version and idempotency tests.

- [ ] **Step 2: Write migration-upgrade RED test**

Seed previous-version handoff + claim + ProductDefinition. Apply migration and assert:

- claim remains claim, no accepted backfill;
- ProductDefinition remains linked/history;
- new disposition constraints reject malformed rows;
- supersedes lineage starts null for legacy;
- migration ledger exactly once.

- [ ] **Step 3: Implement domain types and repository port**

Use:

```ts
export interface ProductInitiativeHandoffRepository {
  findLifecycle(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeHandoffLifecycleRecord | null>;
  listCurrentForNpi(input: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ProductInitiativeHandoffLifecycleRecord[]>;
  appendDisposition(input: {
    tenantId: string;
    handoffId: string;
    command: PreparedProductInitiativeHandoffDisposition;
  }): Promise<{
    record: ProductInitiativeHandoffDispositionRecord;
    duplicate: boolean;
  }>;
  acceptReturnAndReopenSelection(input: {
    tenantId: string;
    initiativeId: string;
    returnRequestId: string;
    actorId: string;
    expectedInitiativeVersion: number;
    command: PreparedProductInitiativeHandoffDisposition;
  }): Promise<ProductInitiativeHandoffLifecycleRecord>;
}
```

- [ ] **Step 4: Implement additive migration and Prisma repository**

Add nullable `supersedes_handoff_id` to ProductInitiativeHandoff and a domain-specific disposition table with tenant-aware FKs, version/key uniqueness, action-shape checks and indexes. Do not backfill accepted. Lock tenant+idempotency then tenant+handoff in fixed order.

- [ ] **Step 5: Generate and run GREEN**

```bash
pnpm db:generate
pnpm data-dictionary:generate
pnpm data-dictionary:check
pnpm --filter @logix/api exec vitest run src/modules/product-selection/domain/product-initiative-handoff-disposition.test.ts
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
```

- [ ] **Step 6: Commit data foundation**

```bash
git add apps/api/src/modules/product-selection/domain/product-initiative-handoff-disposition.ts apps/api/src/modules/product-selection/domain/product-initiative-handoff-disposition.test.ts apps/api/src/modules/product-selection/domain/product-initiative-handoff.repository.ts apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-handoff.repository.ts database/schema.prisma database/migrations/20261005100000_add_product_initiative_handoff_dispositions database/dictionary apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
git commit -m "feat(npi): persist handoff disposition history"
```

---

### Task 4: Separate Received, Claim, Accept and Reject

**Files:**

- Create: `apps/api/src/modules/product-selection/application/accept-product-initiative-handoff.service.ts`
- Create: `apps/api/src/modules/product-selection/application/reject-product-initiative-handoff.service.ts`
- Modify: `apps/api/src/modules/product-selection/application/claim-product-initiative.service.ts`
- Modify: `apps/api/src/modules/product-selection/application/list-npi-queue.service.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-npi.controller.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-npi.controller.test.ts`
- Modify: `apps/api/src/modules/product-selection/product-selection.module.ts`
- Modify: `apps/api/src/modules/product-selection/application/advance-product-definition.service.ts`
- Modify: `apps/api/src/modules/product-selection/application/release-product-definition.service.ts`
- Create: `apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts`

**Interfaces:**

- Consumes Task 3 repository.
- Produces accepted-only NPI responsibility and ProductDefinition gate.

- [ ] **Step 1: Write service/controller RED tests**

Assert separate capabilities, authenticated tenant/actor, claim receipt without transfer, claimant-only accept, reject reason/gap/recovery, and cross-tenant invisibility.

- [ ] **Step 2: Write PostgreSQL RED tests**

Cover received on handoff creation, claim responsibility unchanged, accept transfer, concurrent accept one winner, reject before accept, claimed-only ProductDefinition denied and accepted owner allowed.

- [ ] **Step 3: Implement services and endpoints**

Add:

```text
POST /product-initiative-npi/:handoffId/acceptances
POST /product-initiative-npi/:handoffId/rejections
```

Claim delegates to disposition writer; list V2 queue from Adapter. ProductDefinition uses:

```ts
requireAcceptedNpiResponsibility(input: {
  tenantId: string;
  handoffId: string;
  actorId: string;
}): Promise<{ npiResultOwnerActorId: string; handoffVersion: number }>;
```

Reject claimed-only, rejected, returned, superseded and non-owner writes.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @logix/api exec vitest run src/modules/product-selection/application/product-npi.services.test.ts src/modules/product-selection/presentation/product-npi.controller.test.ts
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts src/infrastructure/integration/product-definition-flow.integration.test.ts
pnpm authz:routes
```

- [ ] **Step 5: Commit accept/reject path**

```bash
git add apps/api/src/modules/product-selection/application apps/api/src/modules/product-selection/presentation/product-npi.controller.ts apps/api/src/modules/product-selection/presentation/product-npi.controller.test.ts apps/api/src/modules/product-selection/product-selection.module.ts apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts
git commit -m "feat(npi): require explicit handoff acceptance"
```

---

### Task 5: Implement Two-Step Return

**Files:**

- Create: `apps/api/src/modules/product-selection/application/request-product-initiative-return.service.ts`
- Create: `apps/api/src/modules/product-selection/application/accept-product-initiative-return.service.ts`
- Create: `apps/api/src/modules/product-selection/application/reject-product-initiative-return.service.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-npi.controller.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-initiatives.controller.ts`
- Modify: `apps/api/src/modules/product-selection/product-selection.module.ts`
- Modify: `apps/api/src/modules/product-selection/application/return-product-initiative-from-npi.service.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts`

**Interfaces:**

- Request freezes NPI writes and leaves NPI responsibility.
- Acceptance atomically transfers responsibility and updates initiative projection.

- [ ] **Step 1: Write RED tests**

Cover NPI-owner-only request, responsibility unchanged after request, write freeze, selection accept/reject, rejected return keeps NPI owner, concurrent request/accept conflicts and atomic initiative reopen.

- [ ] **Step 2: Implement endpoints**

```text
POST /product-initiative-npi/:handoffId/return-requests
POST /product-initiatives/:initiativeId/return-acceptances
POST /product-initiatives/:initiativeId/return-rejections
```

Old direct return endpoint returns Task 1 stable retirement error after Web migration; it never silently auto-accepts.

- [ ] **Step 3: Run GREEN**

```bash
pnpm --filter @logix/api exec vitest run src/modules/product-selection/application/product-npi.services.test.ts src/modules/product-selection/presentation/product-npi.controller.test.ts src/modules/product-selection/presentation/product-initiatives.controller.test.ts
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts
```

- [ ] **Step 4: Commit two-step return**

```bash
git add apps/api/src/modules/product-selection/application apps/api/src/modules/product-selection/presentation apps/api/src/modules/product-selection/product-selection.module.ts apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts
git commit -m "feat(npi): add two-step return responsibility"
```

---

### Task 6: Add Supersession and Re-Acceptance

**Files:**

- Modify: `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts`
- Modify: `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-handoff.repository.ts`
- Modify: `apps/api/src/modules/product-selection/application/list-npi-queue.service.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts`
- Modify: `apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts`

**Interfaces:**

- Re-approve atomically appends old superseded, creates new handoff, appends new received.
- Only latest nonsuperseded handoff is active.

- [ ] **Step 1: Write RED transactional tests**

Cover one active queue item, old history preserved, no acceptance inheritance, old ProductDefinition read-only, old write/release denied, new explicit acceptance required, and transaction rollback on any failed step.

- [ ] **Step 2: Implement atomic supersession**

Use one transaction and fixed advisory lock order. Add lineage; do not mutate/delete old snapshots/receipts/definitions.

- [ ] **Step 3: Run GREEN**

```bash
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/product-initiative-flow.integration.test.ts src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts src/infrastructure/integration/product-definition-flow.integration.test.ts
```

- [ ] **Step 4: Commit supersession**

```bash
git add apps/api/src/modules/product-selection/infrastructure apps/api/src/modules/product-selection/application/list-npi-queue.service.ts apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts apps/api/src/infrastructure/integration/product-initiative-gc012-flow.integration.test.ts apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts
git commit -m "feat(npi): require reacceptance after supersession"
```

---

### Task 7: Migrate Selection and NPI Web Workbenches

**Files:**

- Modify: `apps/web/src/api/marketSignals.ts`
- Modify: `apps/web/src/composables/useProductNpiWorkbench.ts`
- Modify: `apps/web/src/views/ProductNpiWorkbench.vue`
- Modify: `apps/web/src/views/ProductNpiWorkbench.test.ts`
- Modify: `apps/web/src/components/product-npi/ProductNpiQueue.vue`
- Modify: `apps/web/src/components/product-npi/ProductNpiClaimAction.vue`
- Modify: `apps/web/src/components/product-npi/ProductNpiReturnAction.vue`
- Create: `apps/web/src/components/product-npi/ProductNpiAcceptanceAction.vue`
- Create: `apps/web/src/components/product-selection/ProductInitiativeReturnAcceptancePanel.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.test.ts`
- Modify: `apps/web/src/data/productInitiativeQueue.ts`
- Modify: `apps/web/e2e/product-npi-workbench.spec.ts`

**Interfaces:**

- Consumes service responsibility projection and actions; no client responsibility inference.

- [ ] **Step 1: Write Web RED tests**

Pin copy and behavior:

- claim says processing started and selection still owns result;
- ProductDefinition hidden/disabled until accept;
- accept makes actor NPI result owner;
- return request says NPI remains owner pending selection;
- selection accept/reject panel uses server actions;
- superseded old handoff read-only, new version acceptance required;
- 409 reload/preserve input;
- loading/empty/error/recovery and keyboard behavior.

- [ ] **Step 2: Implement API/composable/components**

Group queue from server responsibility projection, not claim/destination. Add named regions and stable action feedback. Old V1 fallback shows explicit legacy/acceptance-required state.

- [ ] **Step 3: Write E2E**

Flow 1:

```text
selection approve → received → claim → ProductDefinition still blocked
→ accept → ProductDefinition opens
```

Flow 2:

```text
accepted → return request → NPI still owner/frozen
→ selection accepts return → selection re-decides
→ new handoff supersedes old → NPI must accept again
```

Cover desktop/375/320, long reason text, keyboard, 409 and failure recovery.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @logix/web exec vitest run src/views/ProductNpiWorkbench.test.ts src/views/ProductSelectionWorkbench.test.ts
pnpm --filter @logix/web exec playwright test e2e/product-npi-workbench.spec.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web build
```

- [ ] **Step 5: Commit Web consumer**

```bash
git add apps/web/src/api/marketSignals.ts apps/web/src/composables/useProductNpiWorkbench.ts apps/web/src/views/ProductNpiWorkbench.vue apps/web/src/views/ProductNpiWorkbench.test.ts apps/web/src/components/product-npi apps/web/src/components/product-selection/ProductInitiativeReturnAcceptancePanel.vue apps/web/src/views/ProductSelectionWorkbench.vue apps/web/src/views/ProductSelectionWorkbench.test.ts apps/web/src/data/productInitiativeQueue.ts apps/web/e2e/product-npi-workbench.spec.ts
git commit -m "feat(web): separate NPI claim and acceptance"
```

---

### Task 8: Compatibility and Final G3 Gate

**Files:**

- Modify: `docs/planning/tasks/product-selection-npi-gc012-reference-v1.md`
- Modify: `docs/INDEX.md`
- Modify/add compatibility tests discovered above

- [ ] **Step 1: Audit old claim/return consumers**

Record callers and retirement evidence. Verify old claim delegates without transferring responsibility; old return endpoint returns the approved stable retirement response after Web migration.

- [ ] **Step 2: Run complete G3 gates**

```bash
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
pnpm db:generate
pnpm data-dictionary:check
pnpm --filter @logix/api lint
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api test
pnpm --filter @logix/api test:integration
pnpm --filter @logix/api build
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web test
pnpm --filter @logix/web test:e2e
pnpm --filter @logix/web build
pnpm authz:routes
pnpm repo:check
pnpm format:check
git diff --check
pnpm validate
```

- [ ] **Step 3: Fresh read-only review**

Review claim/accept separation, two-step return, old history, supersession, ProductDefinition gate, capabilities/object scope, migration upgrade, concurrency and compatibility.

- [ ] **Step 4: Record evidence and commit**

```bash
git add docs/planning/tasks/product-selection-npi-gc012-reference-v1.md docs/INDEX.md
git commit -m "docs(npi): record GC-012 second-consumer verification"
```

## G3 Completion Contract

- Exact D1–D7 policies are approved and authoritative.
- Product investment decision remains separate from received/claim/accept.
- Claim never transfers responsibility or unlocks ProductDefinition.
- Accept transfers to one NPI result owner.
- Return request leaves NPI responsible/frozen; selection acceptance transfers back.
- Superseding version preserves history and requires re-acceptance.
- Four role categories are not inferred from one actor/capability.
- Old consumers follow a documented compatibility/retirement path.
- No GC-012 field expansion or universal persistence table is introduced.
- Full gates and fresh review pass.
- Stable-V1 eligibility remains blocked until both G2 and G3 have controlled real/de-identified role receipts.
