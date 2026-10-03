# GC-012 G2: Market-to-Selection Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make market→product-selection the first GC-012 runtime consumer by freezing a qualified new-product-candidate payload and adding truthful received/claim/accept/reject/return/supersede receipts and responsibility transfer while preserving V1 compatibility.

**Architecture:** `MarketOpportunityHandoffV1` remains the immutable domain payload. A market-specific payload version captures A minimum qualification, optional B validation snapshots and frozen uncertainty. Product-selection owns a domain-specific append-only disposition ledger and exposes a GC-012 facade; legacy V1 claim/accept delegates to the same writer.

**Tech Stack:** TypeScript, NestJS 11, Prisma ORM 7, PostgreSQL 16, JSON Schema, Vue 3, Vitest, Playwright, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-10-03-gc12.md`

## Global Constraints

- G0 and G1 must be merged first; use G1 generated GC-012 type names unchanged.
- Start a new task brief; do not reopen or widen the completed active-validation slice.
- Only new-product candidates may form a formal market opportunity in V1.
- A is universal and mandatory; B templates are optional and incomplete B is frozen as uncertainty without blocking qualification.
- No score, auto-qualification, trust tier or AI decision.
- Raw immutable handoff snapshot is the domain payload; `mergeHandoffWithSignalLive` remains display-only and cannot rewrite qualification history.
- `claimed` does not transfer cross-workbench result responsibility; `accepted` does.
- Return is two-step; request does not transfer responsibility, acceptance does.
- Existing V1 list/intake contract remains during an explicit compatibility window.
- Historical handoffs with missing qualification payload remain legacy/unknown; no synthetic backfill.
- Controlled workbook R/D/S/P fields cannot be promoted into real market qualification evidence.

## Review Focus

1. An incomplete B template with evidence/contradiction must remain frozen uncertainty and cannot be deleted, hidden or used as automatic rejection.
2. A V1 client must not turn a rejected/return-requested V2 handoff into a false queued/claimed/accepted state.
3. Claim concurrency and disposition concurrency must share one idempotency/version domain; same-key different-payload races return stable conflicts.
4. A new materially changed market handoff must supersede the old snapshot without mutating old qualification/evidence and without inheriting acceptance.
5. Adapter failure or GC-012 feature disablement must never delete or roll back the underlying market decision/handoff.

---

## Policy Stop Gate

Task 1 is mandatory. Tasks 2–8 execute only if Task 1 adopts the proposed baseline below and writes it into authority and the task brief. If the owner changes fields, capabilities, actors, routes or compatibility semantics, revise this plan before coding; do not “adapt” during implementation.

### Proposed D0 Baseline to Present for Owner Approval

#### A minimum qualification

```ts
interface MarketOpportunityMinimumQualificationV1 {
  policyCode: "new_product_candidate_minimum";
  policyVersion: 1;
  observationScope: {
    marketCode: string;
    channelCode: string | null;
    categoryRef: string;
    observationWindowStart: string; // ISO date
    observationWindowEnd: string; // ISO date
    dataAsOf: string; // ISO datetime
  };
  observedFactSummary: string;
  evidenceRefs: string[]; // at least one currently usable GC-006 ref
  validationQuestion: string;
  validationConclusion: string;
  counterEvidenceOrUncertainty: string;
  opportunityStatement: string;
}
```

Required server rules:

- market, category, observation window, data-as-of, fact, one usable evidence ref, validation question, conclusion, counter-evidence/uncertainty and opportunity statement are mandatory;
- `channelCode` may be null only when the opportunity is explicitly cross-channel and the conclusion states that scope;
- validation conclusion must answer the validation question and cannot equal the fact summary after normalization;
- no profitability, supplier, full compliance or product-combination conclusion is required at market qualification.

#### B template catalog

Proposed V1 codes:

```ts
type MarketOpportunityValidationTemplateCodeV1 =
  | "trend_persistence"
  | "cross_source_consistency"
  | "customer_problem_recurrence"
  | "purchase_behavior"
  | "supply_gap"
  | "contradictory_evidence";

type MarketOpportunityValidationTemplateStateV1 =
  "completed" | "incomplete" | "not_applicable";

interface MarketOpportunityValidationTemplateSnapshotV1 {
  templateCode: MarketOpportunityValidationTemplateCodeV1;
  templateVersion: 1;
  state: MarketOpportunityValidationTemplateStateV1;
  question: string;
  conclusion: string | null;
  evidenceRefs: string[];
  remainingUncertainty: string | null;
  notApplicableReason: string | null;
}
```

Rules:

- completed requires conclusion;
- incomplete requires remainingUncertainty and is frozen into handoff;
- not_applicable requires reason;
- a selected template with any evidence, conclusion, contradiction or uncertainty cannot be removed from the snapshot;
- template count is not a score and does not change qualification.

#### Handoff reject/return policy

- Before `accepted`, selection may `rejected` only with stable reason, at least one gap and recovery action; responsibility remains market.
- After `accepted`, selection may `return_requested`; responsibility remains selection.
- Market owner or market return queue may `return_accepted`; responsibility transfers back atomically.
- Ordinary B incompleteness is not by itself a legal rejection reason.
- A new material market decision produces a new handoff version, appends `superseded` for the old handoff and requires new acceptance.

#### Capabilities

Proposed minimum codes:

```text
product_selection.opportunity.claim
product_selection.opportunity.accept
product_selection.opportunity.reject
product_selection.opportunity.return.request
market_signals.opportunity.return.accept
```

Every action also requires tenant and handoff/signal object scope. Do not reuse broad `planning.draft` unless the owner explicitly accepts that temporary least-privilege gap in the brief.

#### Compatibility

- Keep V1 GET/list and claim/accept input/output byte-compatible.
- Add `/api/product-opportunities-v2` list/detail and `/:handoffId/dispositions` action endpoint.
- V1 claim/accept delegates to V2 writer.
- V1 cannot represent reject/return states: hide such entries from V1 and return stable `PRODUCT_OPPORTUNITY_REQUIRES_V2` for a direct V1 action against them.
- Existing `return_to_market` becomes a return request after Web migration; market-side explicit accept completes return. No auto-accept compatibility shortcut.

---

### Task 1: Decide and Write G2 Business Policy

**Files:**

- Modify: `doc/cross-border-supply-chain/08-role-workbenches.md`
- Create: `docs/planning/tasks/market-product-selection-gc012-reference-v1.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/superpowers/plans/2026-10-03-gc012-g2-market-selection.md` only if owner changes the proposed baseline

**Interfaces:**

- Produces exact A/B types, reason/action catalogs, actors, capabilities, responsibility and compatibility semantics used by Tasks 2–8.

- [ ] **Step 1: Present the D0 baseline as explicit owner decisions**

Record separate decisions for:

1. A exact fields/requiredness/evidence freshness/requalification trigger;
2. B code directory, states and removal/freeze rules;
3. reject actors/reasons/gaps/recovery;
4. return request/accept actors and responsibility;
5. superseded responsibility and material-change trigger;
6. sender/recipient queues and any deadline or explicit no-deadline policy;
7. five capabilities and object scopes;
8. received service identity;
9. V1 hiding/error/retirement policy;
10. V2 route and public type names.

- [ ] **Step 2: Stop unless every decision has an owner conclusion**

Expected output is a complete decision table in the new brief with `approved`, `rejected` or a concrete alternate value. Unresolved placeholders, silent defaults and generic fallback JSON are forbidden. If any decision remains pending, set brief `status: blocked`, commit only docs, and stop G2.

- [ ] **Step 3: Write approved policy to business authority and task metadata**

Update market/selection sections in `08-role-workbenches.md`; declare writer, risk high, schema/migration/public-contract/authz locks, exact write scopes and authority refs in the brief.

- [ ] **Step 4: Run docs gates**

```bash
pnpm docs:check
pnpm repo:check
pnpm format:check
git diff --check
```

- [ ] **Step 5: Commit policy authority**

```bash
git add doc/cross-border-supply-chain/08-role-workbenches.md docs/planning/tasks/market-product-selection-gc012-reference-v1.md docs/INDEX.md docs/superpowers/plans/2026-10-03-gc012-g2-market-selection.md
git commit -m "docs(market): approve GC-012 qualification policy"
```

---

### Task 2: Define the Immutable Market Qualification Payload

**Files:**

- Modify: `packages/contracts/schemas/v1/market-opportunity.schema.json`
- Modify: `packages/contracts/fixtures/v1/schema-instances.json`
- Generate: `packages/contracts/generated/contracts.d.ts`
- Modify: `apps/api/src/modules/market-intelligence/domain/market-signal.ts`
- Modify: `apps/api/src/modules/market-intelligence/domain/market-signal.test.ts`

**Interfaces:**

- Consumes Task 1 exact policy.
- Produces `MarketOpportunityDomainPayloadV1`, `MarketProductSelectionDispositionCommandV1` and their nested generated types.
- Task 3 persists the payload and command facts; Task 4 adapter/facade references them.

- [ ] **Step 1: Add failing contract fixtures for A and B**

Positive fixture: new-product candidate, complete A, one completed B and one incomplete B frozen as uncertainty.

Negative fixtures:

- opportunity kind other than `new_product_candidate`;
- no usable evidence;
- conclusion equals fact summary;
- incomplete B without uncertainty;
- completed B without conclusion;
- not-applicable B without reason;
- duplicate template code/version;
- score/trustLevel/automaticDecision extra fields.

Use synthetic values only.

- [ ] **Step 2: Run contract check and verify RED**

```bash
pnpm contract:check
```

Expected: FAIL because payload types do not exist.

- [ ] **Step 3: Add domain RED tests**

```ts
it("blocks handoff when mandatory A qualification is incomplete", () => {
  expect(() =>
    prepareMarketSignalDecision(facts(), incompleteHandoffCommand()),
  ).toThrow("MARKET_OPPORTUNITY_MINIMUM_QUALIFICATION_INCOMPLETE");
});

it("freezes incomplete B as uncertainty without blocking handoff", () => {
  const prepared = prepareMarketSignalDecision(
    facts(),
    commandWithIncompleteB(),
  );
  expect(prepared.domainPayload.optionalValidation[0]).toMatchObject({
    state: "incomplete",
    remainingUncertainty: "等待第二来源",
  });
  expect(prepared.completion).toBe("completed");
});
```

Add evidence freshness/unusable-ref tests using the existing evidence reader/application boundary; domain receives already validated evidence availability, not raw DB calls.

- [ ] **Step 4: Implement minimal Schema and domain normalization**

Add these exact command/view `$defs` in the same domain Schema, using Task 1 approved reason/action catalogs and G1 refs:

```ts
interface MarketProductSelectionDispositionCommandV1 {
  contractVersion: "market-product-selection-disposition.v1";
  dispositionType:
    | "claimed"
    | "accepted"
    | "rejected"
    | "return_requested"
    | "return_accepted";
  expectedDispositionVersion: number;
  reasonCode?: string;
  gapCodes: string[];
  recoveryActionCode?: string;
  returnTargetQueueCode?: string;
  relatedDispositionId?: string;
  idempotencyKey: string;
}

interface MarketProductSelectionHandoffViewV1 {
  snapshot: WorkbenchHandoffSnapshotV1;
  receipts: HandoffDispositionV1[];
  responsibility: HandoffResponsibilityWindowV1;
  domain: MarketOpportunityHandoffV1;
}
```

`rejected`, return and conditional fields follow G1/Task 1 action-shape rules; no free-form fallback object is allowed.

Add exact Task 1 approved qualification `$defs` and optional `domainPayload` to new handoff result versions while keeping legacy fields. Return a stable validation error; do not encode a score.

- [ ] **Step 5: Generate and verify GREEN**

```bash
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
pnpm --filter @logix/api exec vitest run src/modules/market-intelligence/domain/market-signal.test.ts
```

- [ ] **Step 6: Commit payload and domain gate**

```bash
git add packages/contracts/schemas/v1/market-opportunity.schema.json packages/contracts/fixtures/v1/schema-instances.json packages/contracts/generated/contracts.d.ts apps/api/src/modules/market-intelligence/domain/market-signal.ts apps/api/src/modules/market-intelligence/domain/market-signal.test.ts
git commit -m "feat(market): define qualified opportunity payload"
```

---

### Task 3: Persist Qualification Snapshot and Domain Dispositions

**Files:**

- Create: `database/migrations/20261004100000_add_market_opportunity_gc012/migration.sql`
- Modify: `database/schema.prisma`
- Modify: `database/dictionary/dictionary.annotations.json`
- Generate: `database/dictionary/DATA_DICTIONARY.generated.md`
- Generate: `database/dictionary/NATIVE_OBJECTS.generated.md`
- Modify: `apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts`
- Modify: `apps/api/src/modules/product-selection/domain/product-opportunity.repository.ts`
- Modify: `apps/api/src/modules/product-selection/domain/product-opportunity.ts`
- Modify: `apps/api/src/modules/product-selection/domain/product-opportunity.test.ts`
- Modify: `apps/api/src/modules/product-selection/infrastructure/prisma-product-opportunity.repository.ts`
- Create: `apps/api/src/infrastructure/integration/market-opportunity-gc012-migration-upgrade.integration.test.ts`

**Interfaces:**

- Persists immutable `domainPayload` on new handoffs; legacy rows remain null.
- Extends the domain-owned intake ledger to seven dispositions with reason/gap/recovery/related refs and version/idempotency fields.
- Produces repository append/read methods consumed by Task 4.

- [ ] **Step 1: Write migration-upgrade RED test**

Test previous-version rows containing handoff + queued/claimed/accepted intake. After migration assert:

- domain payload remains null/legacy; no fabricated qualification;
- existing claimed/accepted rows preserve meaning;
- new constraints reject closed, malformed reject/return/supersede, cross-tenant refs and duplicate versions/keys;
- old API rows remain queryable.

Run and expect RED because migration is absent.

- [ ] **Step 2: Write domain disposition RED tests**

Pin all seven facts and responsibility mapping:

```ts
expect(projectMarketOpportunityResponsibility(received)).toBe("market_signals");
expect(projectMarketOpportunityResponsibility(claimed)).toBe("market_signals");
expect(projectMarketOpportunityResponsibility(accepted)).toBe(
  "product_selection",
);
expect(projectMarketOpportunityResponsibility(returnRequested)).toBe(
  "product_selection",
);
expect(projectMarketOpportunityResponsibility(returnAccepted)).toBe(
  "market_signals",
);
```

Add idempotency, expected-version, actor legality and Task 1 reason/gap/recovery tests.

- [ ] **Step 3: Implement additive DB shape**

Add nullable handoff `domain_payload JSONB` and explicit handoff lineage if approved. Extend `product_opportunity_intake` or add a type-specific disposition table exactly as Task 1 approves; do not add a universal GC-012 table. Constraints enforce action-specific shape, tenant-aware refs, append-only version uniqueness and tenant-wide idempotency.

- [ ] **Step 4: Implement repository persistence and mapping**

- market transaction freezes domain payload and snapshot hash;
- selection repository serializes by tenant+handoff and tenant+idempotency key in fixed order;
- replay occurs before mutable-current-state checks;
- same key/different payload returns stable conflict;
- received/claimed never transfer responsibility;
- legacy rows project explicit legacy/unknown metadata.

- [ ] **Step 5: Generate DB artifacts and run GREEN**

```bash
pnpm db:generate
pnpm data-dictionary:generate
pnpm data-dictionary:check
pnpm --filter @logix/api exec vitest run src/modules/product-selection/domain/product-opportunity.test.ts
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/market-opportunity-gc012-migration-upgrade.integration.test.ts
```

- [ ] **Step 6: Commit data foundation**

```bash
git add database/schema.prisma database/migrations/20261004100000_add_market_opportunity_gc012 database/dictionary apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts apps/api/src/modules/product-selection/domain/product-opportunity.repository.ts apps/api/src/modules/product-selection/domain/product-opportunity.ts apps/api/src/modules/product-selection/domain/product-opportunity.test.ts apps/api/src/modules/product-selection/infrastructure/prisma-product-opportunity.repository.ts apps/api/src/infrastructure/integration/market-opportunity-gc012-migration-upgrade.integration.test.ts
git commit -m "feat(market): persist opportunity handoff receipts"
```

---

### Task 4: Build the GC-012 Market Adapter and V2 API

**Files:**

- Create: `apps/api/src/modules/product-selection/domain/market-product-selection-handoff-adapter.ts`
- Test: `apps/api/src/modules/product-selection/domain/market-product-selection-handoff-adapter.test.ts`
- Create: `apps/api/src/modules/product-selection/application/market-product-selection-handoff.facade.ts`
- Create: `apps/api/src/modules/product-selection/application/append-market-opportunity-disposition.service.ts`
- Create: `apps/api/src/modules/product-selection/presentation/product-opportunities-v2.controller.ts`
- Create: `apps/api/src/modules/product-selection/presentation/product-opportunity-v2.dto.ts`
- Create: `apps/api/src/modules/product-selection/presentation/product-opportunities-v2.controller.test.ts`
- Modify: `apps/api/src/modules/product-selection/product-selection.module.ts`
- Modify: `apps/api/src/modules/product-selection/module.manifest.ts`
- Modify: `apps/api/src/modules/product-selection/application/intake-product-opportunity.service.ts`

**Interfaces:**

- Consumes G1 generated GC-012 types and Task 3 repository.
- Produces V2 list/detail/disposition API plus V1 wrappers.

- [ ] **Step 1: Write Adapter parity RED tests**

Assert:

- raw frozen payload hash/ref preserved;
- live-supplemented projection never enters `domainPayloadRef`;
- legacy claim maps only to claimed;
- received/claimed responsibility remains market;
- accepted maps selection responsibility;
- no domain state/amount/evidence body appears in common snapshot;
- missing legacy metadata stays explicit unknown/legacy, never fabricated.

- [ ] **Step 2: Implement exact facade signatures**

```ts
export interface MarketProductSelectionHandoffFacade {
  list(input: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<MarketProductSelectionHandoffViewV1[]>;
  find(
    tenantId: string,
    handoffId: string,
  ): Promise<MarketProductSelectionHandoffViewV1 | null>;
  appendDisposition(input: {
    tenantId: string;
    handoffId: string;
    actorId: string;
    command: MarketProductSelectionDispositionCommandV1;
  }): Promise<{
    view: MarketProductSelectionHandoffViewV1;
    duplicate: boolean;
  }>;
}
```

Use final Task 1 command names. Adapter constants: producer market_signals, consumer product_selection, payload schema ref market opportunity handoff.

- [ ] **Step 3: Write Controller/HTTP RED tests**

Test authenticated tenant/actor forwarding, capability split, unknown fields rejected, V1 byte-compatible shapes and V1 stable error against nonrepresentable V2 states.

- [ ] **Step 4: Implement V2 endpoints and V1 delegation**

Recommended routes if Task 1 approves:

```text
GET /api/product-opportunities-v2
GET /api/product-opportunities-v2/:handoffId
POST /api/product-opportunities-v2/:handoffId/dispositions
```

V1 claim/accept delegates to the same writer; there is one lock/idempotency/state machine.

- [ ] **Step 5: Run focused API checks**

```bash
pnpm --filter @logix/api exec vitest run src/modules/product-selection/domain/market-product-selection-handoff-adapter.test.ts src/modules/product-selection/application/list-product-opportunities.service.test.ts src/modules/product-selection/presentation/product-opportunities-v2.controller.test.ts
pnpm authz:routes
pnpm --filter @logix/api lint
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api build
```

- [ ] **Step 6: Commit facade and API**

```bash
git add apps/api/src/modules/product-selection/domain/market-product-selection-handoff-adapter.ts apps/api/src/modules/product-selection/domain/market-product-selection-handoff-adapter.test.ts apps/api/src/modules/product-selection/application/market-product-selection-handoff.facade.ts apps/api/src/modules/product-selection/application/append-market-opportunity-disposition.service.ts apps/api/src/modules/product-selection/presentation/product-opportunities-v2.controller.ts apps/api/src/modules/product-selection/presentation/product-opportunity-v2.dto.ts apps/api/src/modules/product-selection/presentation/product-opportunities-v2.controller.test.ts apps/api/src/modules/product-selection/product-selection.module.ts apps/api/src/modules/product-selection/module.manifest.ts apps/api/src/modules/product-selection/application/intake-product-opportunity.service.ts
git commit -m "feat(selection): expose GC-012 opportunity facade"
```

---

### Task 5: Implement Reject, Two-Step Return and Supersession

**Files:**

- Modify: `apps/api/src/modules/product-selection/infrastructure/prisma-product-opportunity.repository.ts`
- Modify: `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts`
- Modify: `apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts`
- Modify/Create application services and controller tests from Task 4
- Modify: `apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`

**Interfaces:**

- Consumes Task 1 return/supersession policy.
- Produces atomic responsibility transfer and recovery semantics.

- [ ] **Step 1: Write PostgreSQL RED scenarios**

Cover:

- reject before acceptance keeps market responsibility and records reason/gap/recovery;
- incomplete B alone cannot be auto-rejected;
- return request leaves selection responsible and does not update signal destination;
- market return acceptance atomically appends receipt and reopens signal;
- rejected/unaccepted return leaves selection responsible;
- new material handoff appends old superseded + new received without mutating old payload;
- new version does not inherit claim/accept;
- concurrent accept/reject and request/accept produce one winner/stable conflict;
- adapter disabled/failure does not delete market decision/handoff.

- [ ] **Step 2: Implement minimal transactional behavior**

Use domain-specific repositories and existing transaction/Outbox patterns. Do not map product-initiative business reject to handoff rejected. Change existing immediate `return_to_market` only according to Task 1 approved compatibility behavior.

- [ ] **Step 3: Run integration GREEN**

```bash
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/market-opportunity-flow.integration.test.ts src/infrastructure/integration/product-initiative-flow.integration.test.ts src/infrastructure/integration/market-opportunity-gc012-migration-upgrade.integration.test.ts
```

- [ ] **Step 4: Commit transactional recovery**

```bash
git add apps/api/src/modules/product-selection apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
git commit -m "feat(market): add opportunity handoff recovery"
```

---

### Task 6: Migrate the Product-Selection Web Experience

**Files:**

- Modify: `apps/web/src/api/marketSignals.ts`
- Modify: `apps/web/src/composables/useProductOpportunityWorkbench.ts`
- Modify: `apps/web/src/components/product-selection/ProductOpportunityActions.vue`
- Modify: `apps/web/src/components/product-selection/ProductOpportunityQueue.vue`
- Modify: `apps/web/src/components/product-selection/ProductOpportunityDetail.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.test.ts`
- Modify: `apps/web/e2e/workbench-network.spec.ts`

**Interfaces:**

- Consumes V2 service projection; does not calculate responsibility or qualification.
- Preserves V1 fallback during compatibility window.

- [ ] **Step 1: Write Web RED tests**

Assert:

- received/claimed still show market as cross-workbench result owner;
- accepted changes responsibility to selection;
- claim copy says processing started, not responsibility transferred;
- rejection requires/display reason, gaps and recovery;
- B incomplete uncertainty is visible and does not disable accept;
- return request keeps selection owner until market acceptance;
- superseded old version is history/read-only; new version says re-accept required;
- 409 reloads server responsibility and preserves recoverable input;
- legacy V1 fallback never invents V2 state.

- [ ] **Step 2: Implement V2 API client and composable**

All action availability comes from service projection/capability response. UI emits commands only; it does not derive legality from intake state strings.

- [ ] **Step 3: Implement accessible components**

Use the approved visual order. Add named regions for responsibility, frozen uncertainty, actions and receipt. Ensure 320/375/desktop wrapping and keyboard access.

- [ ] **Step 4: Run Web GREEN and E2E**

```bash
pnpm --filter @logix/web exec vitest run src/views/ProductSelectionWorkbench.test.ts src/api/marketSignals.test.ts
pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts --grep "market|opportunity|return|superseded"
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web build
```

- [ ] **Step 5: Commit Web migration**

```bash
git add apps/web/src/api/marketSignals.ts apps/web/src/composables/useProductOpportunityWorkbench.ts apps/web/src/components/product-selection apps/web/src/views/ProductSelectionWorkbench.vue apps/web/src/views/ProductSelectionWorkbench.test.ts apps/web/e2e/workbench-network.spec.ts
git commit -m "feat(web): show opportunity handoff responsibility"
```

---

### Task 7: Compatibility, Evidence and Final G2 Gate

**Files:**

- Modify: `docs/planning/tasks/market-product-selection-gc012-reference-v1.md`
- Modify: `docs/INDEX.md`
- Add/modify focused compatibility tests and migration upgrade tests as discovered in Tasks 2–6

**Interfaces:**

- Produces the G2 review candidate consumed by G3.

- [ ] **Step 1: Audit legacy consumers**

Use repository search and API logs/known consumers. Record V1 callers, retirement condition and rollback. Verify V1 exact response tests and V2 nonrepresentable-state behavior.

- [ ] **Step 2: Record sample evidence honestly**

The controlled sample workbook may support payload field and mid-chain Adapter parity, but it does not supply real market observation, real negative opportunity or real role receipts. Mark GC-012 provisional and market workbench at most operational; leave KPI/WB-B10/validated unchecked.

- [ ] **Step 3: Run all G2 gates**

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

- [ ] **Step 4: Fresh read-only review**

Review A/B qualification, no score/auto-decision, immutable payload, accepted-only responsibility transfer, return atomicity, supersession, migration upgrade, capability/object scope, V1 compatibility and R/D/S/P evidence honesty.

- [ ] **Step 5: Update brief and commit evidence**

```bash
git add docs/planning/tasks/market-product-selection-gc012-reference-v1.md docs/INDEX.md
git commit -m "docs(market): record GC-012 reference verification"
```

## G2 Completion Contract

- Exact D0 policies are approved and authoritative.
- New-product A qualification is server-enforced; optional B incompleteness is frozen uncertainty and not a score/blocker.
- V2 facade exposes truthful receipts/responsibility; V1 remains compatible within its documented limits.
- Claim does not transfer responsibility; accept does.
- Reject/return/supersede preserve history and responsibility under concurrency.
- No generic GC-012 persistence table or domain-state leakage exists.
- Mechanism tests and full gates pass.
- GC-012 remains provisional and market remains below validated until controlled real/de-identified market cases and real-role receipts are accepted.
