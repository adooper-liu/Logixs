# Market Signal Active Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a market operator turn “continue watching” into one durable current validation commitment—owned by the authenticated actor, due on a stated date, focused on one question, and optionally waiting on one input—without creating a general validation platform.

**Architecture:** Keep immutable `MarketSignalDecision` rows as history and add a rebuildable current-validation projection on `MarketSignal` for queue/detail reads. Reuse the existing decision endpoint, transaction, idempotency and optimistic versioning; add destination-scoped pagination so `watching` can sort by review date without hiding `needs_decision`. The Web app renders the server projection and lets only the current session actor reschedule their own commitment.

**Tech Stack:** TypeScript, NestJS 11, Prisma ORM 7, PostgreSQL, Vue 3, Vitest, Playwright, JSON Schema generated contracts, pnpm 10.

**Spec:** `docs/planning/tasks/market-signals-opportunity-radar-v1.md`

## Global Constraints

- The product purpose remains reducing missed/late opportunities while limiting downstream waste from weak signals; this slice delivers only the “current validation commitment” mechanism.
- The two `synthetic_rehearsal` cases are product and automation inputs only. They never become production Seed data, KPI calibration data, WB-B10 evidence, launch acceptance, or proof of business improvement.
- Do not implement trusted-opportunity qualification, dual-axis scoring, opportunity-type classification, GC-012, capability splitting, KPI calculations, transfer/takeover, reopening, or post-handoff withdrawal.
- A completed new `watch` requires both `nextReviewDate` and `watchFocus`; `waitingReason` is optional and does not pause any metric.
- The authenticated actor is the owner. A different actor cannot silently replace an existing active validation owner; the service returns stable conflict `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT`.
- Immutable decision history is authoritative. The columns on `market_signal` are a rebuildable current projection and must be updated or cleared in the same transaction as the decision.
- Review-date ordering applies only to destination `watching`. Existing business groups remain independently reachable through destination-scoped server pagination.
- All database names use `snake_case`; code uses `camelCase`; UTC timestamps and ISO dates follow existing repository rules.
- Migrations are additive and immutable after sharing. No production auto-sync.
- Every behavior change follows RED → GREEN; final PR candidate runs one high-risk full `pnpm validate` plus `pnpm authz:routes` and `pnpm security:audit`.

## Review Focus

1. **Cross-actor takeover:** actor B attempts to reschedule actor A’s active validation and receives `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT`; actor A can reschedule.
2. **Legacy watching rows:** a migrated row with date but no focus remains readable, gets no fabricated focus, and offers a truthful reschedule path.
3. **Queue reachability:** more than 100 `watching` rows never hide a `needs_decision` row because each destination has independent server pagination.
4. **Idempotent replay and projection:** replay returns the same stored projection/history; same key with changed payload conflicts; concurrent writes produce one winner.
5. **Synthetic boundary:** automated copy and fixtures say “演练/候选”, never “已证明/可信机会/经营改善”, and production Seed remains unchanged.

---

## File Structure

### Existing files to modify

- `doc/cross-border-supply-chain/08-role-workbenches.md` — approved narrow business rules and product-claim boundary.
- `docs/planning/tasks/market-signals-opportunity-radar-v1.md` — execution status, slices, checks and evidence.
- `docs/INDEX.md` — task status.
- `packages/contracts/schemas/v1/market-opportunity.schema.json` — current validation, waiting reason, watch-focus pending code, destination query response additions.
- `packages/contracts/fixtures/v1/schema-instances.json` — positive and negative synthetic contract fixtures.
- `packages/contracts/generated/contracts.d.ts` — generated, never hand edited.
- `database/schema.prisma` — current projection and decision waiting reason mappings.
- `database/dictionary/dictionary.annotations.json` — touched market table/column semantics.
- `database/dictionary/DATA_DICTIONARY.generated.md` — generated.
- `database/dictionary/NATIVE_OBJECTS.generated.md` — generated.
- `database/dictionary/database-data-dictionary.xlsx` — generated.
- `apps/api/src/modules/market-intelligence/domain/market-signal.ts` — command normalization, completion, pending fields and waiting reason.
- `apps/api/src/modules/market-intelligence/domain/market-signal.test.ts` — pure rule tests.
- `apps/api/src/modules/market-intelligence/domain/market-signal.repository.ts` — record/projection and destination cursor interfaces.
- `apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts` — transactional projection, ownership conflict, destination-scoped pagination.
- `apps/api/src/modules/market-intelligence/application/market-signal.presenter.ts` — contract projection.
- `apps/api/src/modules/market-intelligence/application/list-market-signals.service.ts` — destination validation and cursor encoding.
- `apps/api/src/modules/market-intelligence/presentation/market-signal.dto.ts` — Swagger DTOs.
- `apps/api/src/modules/market-intelligence/presentation/market-signals.controller.ts` — optional destination query only.
- `apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts` — transaction, actor ownership, destination paging and projection clearing.
- `apps/web/src/api/marketSignals.ts` and `.test.ts` — destination/cursor API client.
- `apps/web/src/data/marketSignalScenarios.ts` — active validation scenario fields and receipt copy.
- `apps/web/src/composables/useMarketSignalWorkbench.ts` — per-destination pages and decision payload.
- `apps/web/src/components/market-signals/MarketSignalQueue.vue` — current validation summary and load-more.
- `apps/web/src/components/market-signals/MarketSignalDecisionPanel.vue` — self-owned validation form.
- `apps/web/src/components/market-signals/MarketSignalOperationReceipt.vue` — server-result receipt.
- `apps/web/src/views/MarketSignalsWorkbench.vue` and `.test.ts` — active-validation card and vertical behavior.
- `apps/web/e2e/workbench-network.spec.ts` — synthetic positive/negative E2E.

### Files to create

- `database/migrations/20261002120000_add_market_signal_active_validation/migration.sql` — additive columns, constraints, backfill and watching index.
- `apps/api/src/infrastructure/integration/market-signal-validation-migration-upgrade.integration.test.ts` — previous-version upgrade with existing rows.
- `apps/api/src/modules/market-intelligence/application/list-market-signals.service.test.ts` — destination cursor validation.
- `apps/api/src/modules/market-intelligence/presentation/market-signals.controller.test.ts` — identity/capability boundary.
- `apps/web/src/components/market-signals/MarketSignalActiveValidation.vue` — focused current-commitment display.

---

### Task 1: Contract and Pure Domain Rules

**Files:**

- Modify: `packages/contracts/schemas/v1/market-opportunity.schema.json`
- Modify: `packages/contracts/fixtures/v1/schema-instances.json`
- Generate: `packages/contracts/generated/contracts.d.ts`
- Modify: `apps/api/src/modules/market-intelligence/domain/market-signal.ts`
- Test: `apps/api/src/modules/market-intelligence/domain/market-signal.test.ts`

**Interfaces:**

- Produces `MarketSignalActiveValidationV1` with `responsibleActorId`, `nextReviewDate`, nullable `watchFocus`, nullable `waitingReason`.
- Extends `MarketSignalV1` with optional `activeValidation` for rolling compatibility.
- Extends `MarketSignalDecisionCommandV1` with optional `waitingReason`.
- Adds pending code `watch_focus`.
- Extends `PreparedMarketSignalDecision` with `waitingReason: string | null`.
- Later tasks consume these exact generated names.

- [ ] **Step 1: Write failing domain tests for a complete watch and missing inputs**

Add tests with these assertions:

```ts
it("requires date and focus before watch becomes a current validation commitment", () => {
  const complete = prepareMarketSignalDecision(facts(), {
    contractVersion: "market-signal-decision.v1",
    expectedSignalVersion: 1,
    decisionType: "watch",
    nextReviewDate: "2026-02-12",
    watchFocus: "确认趋势是否持续两周",
    waitingReason: "等待第二客服队列",
    idempotencyKey: "watch-complete",
  });
  expect(complete).toMatchObject({
    completion: "completed",
    nextDestination: "watching",
    nextReviewDate: "2026-02-12",
    watchFocus: "确认趋势是否持续两周",
    waitingReason: "等待第二客服队列",
  });
  expect(complete.pendingFieldCodes).not.toContain("watch_focus");

  const missingFocus = prepareMarketSignalDecision(facts(), {
    contractVersion: "market-signal-decision.v1",
    expectedSignalVersion: 1,
    decisionType: "watch",
    nextReviewDate: "2026-02-12",
    idempotencyKey: "watch-no-focus",
  });
  expect(missingFocus.completion).toBe("pending_completion");
  expect(missingFocus.pendingFieldCodes).toContain("watch_focus");
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run:

```bash
pnpm --filter @logix/api exec vitest run src/modules/market-intelligence/domain/market-signal.test.ts
```

Expected: FAIL because `waitingReason` and `watch_focus` do not exist and date alone currently completes watch.

- [ ] **Step 3: Add failing validation-boundary tests**

Add table cases:

```ts
it.each([
  ["blank waiting reason", "   "],
  ["control character", "等待\u0007审批"],
  ["over 500", "x".repeat(501)],
])("rejects %s", (_name, waitingReason) => {
  expect(() =>
    prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      nextReviewDate: "2026-02-12",
      watchFocus: "验证持续性",
      waitingReason,
      idempotencyKey: `watch-${_name}`,
    }),
  ).toThrow(MarketSignalValidationError);
});

it("drops waiting reason from non-watch decisions", () => {
  const decision = prepareMarketSignalDecision(facts(), {
    contractVersion: "market-signal-decision.v1",
    expectedSignalVersion: 1,
    decisionType: "handoff",
    waitingReason: "不得保存",
    idempotencyKey: "handoff-waiting",
  });
  expect(decision.waitingReason).toBeNull();
});
```

- [ ] **Step 4: Implement minimal domain behavior**

Apply this shape:

```ts
export interface PreparedMarketSignalDecision {
  // existing fields
  waitingReason: string | null;
}

const waitingReason = optionalText(command.waitingReason, "waitingReason", 500);
const completion = decisionCompletion(
  command.decisionType,
  nextReviewDate,
  watchFocus,
  dismissReason,
  judgmentNote,
);

waitingReason: command.decisionType === "watch" ? waitingReason : null,
```

Update `decisionCompletion` so watch completes only when date and focus are both present. Add `watch_focus` to `pendingFieldCodes` and `PENDING_FIELD_ORDER`. `prepareSelectionReturnDecision` returns `waitingReason: null`.

- [ ] **Step 5: Run domain tests and verify GREEN**

Run the Task 1 domain command again. Expected: all market-signal domain tests pass.

- [ ] **Step 6: Write failing contract fixture checks**

Add two schema instances:

```json
{
  "contractId": "MS-SYN-POS-001",
  "name": "synthetic positive active validation rehearsal",
  "schemaRef": "market-opportunity.schema.json#/$defs/MarketSignalV1",
  "data": {
    "signalId": "77100000-0000-4000-8000-000000000001",
    "title": "[合成演练] 春季户外收纳窗口提前",
    "currentDestination": "watching",
    "ownerTeamCode": "market_intelligence",
    "version": 2,
    "evidenceRefs": [],
    "pendingFieldCodes": [],
    "activeValidation": {
      "responsibleActorId": "demo_market_analyst_01",
      "nextReviewDate": "2026-02-12",
      "watchFocus": "确认趋势是否持续两周",
      "waitingReason": "等待第二客服队列"
    },
    "createdAt": "2026-02-02T10:00:00Z",
    "updatedAt": "2026-02-02T10:05:00Z"
  }
}
```

Add a negative invalid fixture in schema-validation tests (not the valid manifest): active validation missing `responsibleActorId` must fail.

Run:

```bash
pnpm contract:check
```

Expected RED: schema rejects `activeValidation` and command `waitingReason`.

- [ ] **Step 7: Extend JSON Schema minimally**

Add:

```json
"MarketSignalActiveValidationV1": {
  "type": "object",
  "additionalProperties": false,
  "required": ["responsibleActorId", "nextReviewDate", "watchFocus", "waitingReason"],
  "properties": {
    "responsibleActorId": { "type": "string", "minLength": 1, "maxLength": 200 },
    "nextReviewDate": { "type": "string", "format": "date" },
    "watchFocus": { "type": ["string", "null"], "maxLength": 4000 },
    "waitingReason": { "type": ["string", "null"], "maxLength": 500 }
  }
}
```

Add optional `activeValidation` to `MarketSignalV1`; optional `waitingReason` to the decision command; and enum `watch_focus`.

- [ ] **Step 8: Generate and verify contracts**

Run:

```bash
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
pnpm --filter @logix/api exec vitest run src/modules/market-intelligence/domain/market-signal.test.ts
```

Expected: all commands exit 0; generated `MarketSignalActiveValidationV1` and optional fields match schema.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/contracts/schemas/v1/market-opportunity.schema.json packages/contracts/fixtures/v1/schema-instances.json packages/contracts/generated/contracts.d.ts apps/api/src/modules/market-intelligence/domain/market-signal.ts apps/api/src/modules/market-intelligence/domain/market-signal.test.ts
git commit -m "feat(market): define active validation contract"
```

---

### Task 2: Additive Migration and Transactional Projection

**Files:**

- Create: `database/migrations/20261002120000_add_market_signal_active_validation/migration.sql`
- Modify: `database/schema.prisma`
- Modify: `database/dictionary/dictionary.annotations.json`
- Generate: `database/dictionary/DATA_DICTIONARY.generated.md`
- Generate: `database/dictionary/NATIVE_OBJECTS.generated.md`
- Generate: `database/dictionary/database-data-dictionary.xlsx`
- Modify: `apps/api/src/modules/market-intelligence/domain/market-signal.repository.ts`
- Modify: `apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts`
- Test: `apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts`
- Create: `apps/api/src/infrastructure/integration/market-signal-validation-migration-upgrade.integration.test.ts`

**Interfaces:**

- Produces `MarketSignalRecord.activeValidation` as `null | { responsibleActorId; nextReviewDate; watchFocus; waitingReason }`.
- Produces destination-scoped repository listing with a discriminated opaque cursor input.
- Enforces `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT` when a different actor reschedules a live commitment.
- Task 3 consumes the repository query and projection.

- [ ] **Step 1: Write failing integration tests for projection, replay, ownership and clearing**

Extend `market-opportunity-flow.integration.test.ts` with helpers that create a signal and submit a completed watch. Assert:

```ts
expect(first.signal.activeValidation).toEqual({
  responsibleActorId: "market-owner-a",
  nextReviewDate: "2026-02-12",
  watchFocus: "确认趋势是否持续",
  waitingReason: "等待客服导出",
});
expect(replay.duplicate).toBe(true);
expect(
  await prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
).toBe(1);
```

Then assert actor B’s completed watch rejects with `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT`, actor A can reschedule, two decisions remain, and handoff/dismiss/void/archive paths clear `activeValidation` without deleting history. Add selection-return clearing to the existing product-initiative integration path if needed; do not duplicate that transaction in a new service.

- [ ] **Step 2: Run integration test and verify RED**

```bash
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/market-opportunity-flow.integration.test.ts
```

Expected: FAIL because columns, projection and owner conflict do not exist.

- [ ] **Step 3: Write the migration-upgrade test before migration SQL**

Copy the repository’s previous-version pattern from `product-initiative-migration-upgrade.integration.test.ts`. The test must:

1. Deploy all migrations.
2. Remove only `20261002120000_add_market_signal_active_validation` objects and migration ledger row.
3. Seed two previous-version rows: one completed watching decision with focus and one legacy watching decision with `watch_focus = NULL`.
4. Re-run `pnpm db:migrate`.
5. Assert owner/date/focus are backfilled from the latest completed watch, legacy focus remains null, handoffs remain unchanged, migration ledger has one finished row, and DB checks reject blank/oversized waiting data.

Run it and expect RED because the migration file is absent.

- [ ] **Step 4: Add Prisma fields**

Use exact mappings:

```prisma
model MarketSignal {
  activeValidationOwnerActorId String?   @map("active_validation_owner_actor_id")
  activeValidationDueDate      DateTime? @map("active_validation_due_date") @db.Date
  activeValidationFocus        String?   @map("active_validation_focus")
  activeValidationWaitingReason String?  @map("active_validation_waiting_reason")
  // existing fields
  @@index([tenantId, currentDestination, activeValidationDueDate, updatedAt, id], map: "market_signal_validation_queue_idx")
}

model MarketSignalDecision {
  waitingReason String? @map("waiting_reason")
}
```

- [ ] **Step 5: Implement additive migration**

The SQL must add nullable columns and named checks:

```sql
ALTER TABLE "market_signal_decision"
  ADD COLUMN "waiting_reason" TEXT;
ALTER TABLE "market_signal"
  ADD COLUMN "active_validation_owner_actor_id" TEXT,
  ADD COLUMN "active_validation_due_date" DATE,
  ADD COLUMN "active_validation_focus" TEXT,
  ADD COLUMN "active_validation_waiting_reason" TEXT;

ALTER TABLE "market_signal_decision"
  ADD CONSTRAINT "market_signal_decision_waiting_reason_check"
  CHECK ("waiting_reason" IS NULL OR (length(btrim("waiting_reason")) BETWEEN 1 AND 500));
```

Add analogous owner/focus/waiting checks. Backfill from the latest completed `watch` per current `watching` signal with `ROW_NUMBER() OVER (PARTITION BY signal_id ORDER BY decision_version DESC)`. Never derive focus from judgment note.

- [ ] **Step 6: Generate Prisma and implement repository mapping**

Run `pnpm db:generate`, then extend `MarketSignalRecord` and `mapSignal`. Add `waitingReason` persistence. In `decide`:

```ts
if (
  input.prepared.decisionType === "watch" &&
  input.prepared.completion === "completed" &&
  signal.activeValidationOwnerActorId &&
  signal.activeValidationOwnerActorId !== input.actorId
) {
  conflict("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");
}
```

Set projection for completed watch; clear it for completed non-watch decisions and in `applySelectionReturnWithin`. Pending watch does not create a current projection. Replay maps persisted projection without mutation.

- [ ] **Step 7: Add destination-scoped listing repository interface**

Use a discriminated cursor:

```ts
export type MarketSignalListCursor =
  | { sort: "updated"; updatedAt: Date; id: string }
  | {
      sort: "watching_due";
      activeValidationDueDate: Date | null;
      updatedAt: Date;
      id: string;
    };

export interface MarketSignalListQuery {
  tenantId: string;
  destination: MarketSignalDestinationV1;
  after?: MarketSignalListCursor;
  take: number;
}
```

For `watching`, sort `activeValidationDueDate ASC NULLS LAST`, then `updatedAt DESC`, `id DESC`. For every other destination, preserve updated/id ordering. Add repository `count({ tenantId, destination })` for accurate filter counts.

- [ ] **Step 8: Add the >100 watching reachability test**

Seed 101 watching rows and one needs-decision row. Query each destination independently. Assert:

- needs-decision returns its row immediately;
- watching pages traverse all 101 rows without duplicates or omissions;
- null due dates follow dated rows;
- cursor from one destination is rejected by another in Task 3.

- [ ] **Step 9: Run migration and integration GREEN checks**

```bash
pnpm db:generate
pnpm --filter @logix/api exec vitest run --config vitest.integration.config.mts src/infrastructure/integration/market-opportunity-flow.integration.test.ts src/infrastructure/integration/market-signal-validation-migration-upgrade.integration.test.ts
```

Expected: both integration files pass; temporary schemas are dropped.

- [ ] **Step 10: Update and regenerate the database dictionary**

Add exact Chinese semantics for the five new columns and correct touched market table ownership if existing annotations are wrong. Run:

```bash
pnpm data-dictionary:generate
pnpm data-dictionary:check
```

Expected: generated Markdown/native-object inventory/Excel match annotations and schema.

- [ ] **Step 11: Commit Task 2**

```bash
git add database/schema.prisma database/migrations/20261002120000_add_market_signal_active_validation database/dictionary apps/api/src/modules/market-intelligence/domain/market-signal.repository.ts apps/api/src/modules/market-intelligence/infrastructure/prisma-market-signal.repository.ts apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts apps/api/src/infrastructure/integration/market-signal-validation-migration-upgrade.integration.test.ts
git commit -m "feat(market): persist current validation commitment"
```

---

### Task 3: Application, Cursor and HTTP Contract

**Files:**

- Modify: `apps/api/src/modules/market-intelligence/application/market-signal.presenter.ts`
- Modify: `apps/api/src/modules/market-intelligence/application/list-market-signals.service.ts`
- Create: `apps/api/src/modules/market-intelligence/application/list-market-signals.service.test.ts`
- Modify: `apps/api/src/modules/market-intelligence/presentation/market-signal.dto.ts`
- Modify: `apps/api/src/modules/market-intelligence/presentation/market-signals.controller.ts`
- Create: `apps/api/src/modules/market-intelligence/presentation/market-signals.controller.test.ts`

**Interfaces:**

- HTTP `GET /api/market-signals?destination=<code>&pageSize=<n>&cursor=<opaque>` requires a valid destination.
- `MarketSignalPageV1.totalCount` is optional in schema for rolling compatibility but always emitted by the new API.
- Cursor binds tenant, destination and sort mode; callers cannot reuse it across groups.
- No endpoint or capability changes.

- [ ] **Step 1: Write failing presenter tests**

Create focused assertions that `presentMarketSignal` returns:

```ts
activeValidation: {
  responsibleActorId: "actor-a",
  nextReviewDate: "2026-02-12",
  watchFocus: null,
  waitingReason: null,
}
```

for a legacy current projection and `activeValidation: null` when no owner/date exists. Assert team owner is never substituted as actor owner.

- [ ] **Step 2: Write failing list-service cursor tests**

Test updated and watching cursor round trips, wrong tenant, wrong destination, invalid date, missing id, and incompatible sort. Use public service behavior, not private helper mocks.

Run:

```bash
pnpm --filter @logix/api exec vitest run src/modules/market-intelligence/application/list-market-signals.service.test.ts
```

Expected RED because destination and due cursor do not exist.

- [ ] **Step 3: Implement destination validation and opaque cursor**

`execute` input becomes:

```ts
{
  tenantId: string;
  destination?: string;
  pageSize?: string;
  cursor?: string;
}
```

Reject missing/unknown destination with `VALIDATION_FORMAT: destination`. Encode `{ tenantId, destination, sort, dueDate, updatedAt, id }`; decode checks all fields and returns the discriminated repository cursor. Return `totalCount`.

- [ ] **Step 4: Write controller boundary tests**

Use Nest testing module or direct controller/service spies to assert:

- list forwards identity tenant and destination;
- decision forwards identity actor and ignores any unknown body owner (JSON Schema/DTO additional-property rejection is covered by contract boundary);
- decorators remain `planning.read` for GET and `planning.draft` for create/update/decision;
- no new capability appears.

- [ ] **Step 5: Extend DTO/controller/presenter**

Add `destination` `@ApiQuery`, `MarketSignalActiveValidationResponseDto`, optional/nullable `activeValidation`, `waitingReason`, and optional `totalCount`. Do not add owner fields to decision request.

- [ ] **Step 6: Run API unit, lint, type and build checks**

```bash
pnpm --filter @logix/api exec vitest run src/modules/market-intelligence/domain/market-signal.test.ts src/modules/market-intelligence/application/list-market-signals.service.test.ts src/modules/market-intelligence/presentation/market-signals.controller.test.ts
pnpm --filter @logix/api lint
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api build
pnpm authz:routes
```

Expected: all exit 0; route audit still sees the same capabilities.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/api/src/modules/market-intelligence/application apps/api/src/modules/market-intelligence/presentation
git commit -m "feat(market): expose current validation queue"
```

---

### Task 4: Web Queue and Current Validation Experience

**Files:**

- Modify: `apps/web/src/api/marketSignals.ts`
- Modify: `apps/web/src/api/marketSignals.test.ts`
- Modify: `apps/web/src/data/marketSignalScenarios.ts`
- Modify: `apps/web/src/composables/useMarketSignalWorkbench.ts`
- Modify: `apps/web/src/components/market-signals/MarketSignalQueue.vue`
- Modify: `apps/web/src/components/market-signals/MarketSignalDecisionPanel.vue`
- Create: `apps/web/src/components/market-signals/MarketSignalActiveValidation.vue`
- Modify: `apps/web/src/components/market-signals/MarketSignalOperationReceipt.vue`
- Modify: `apps/web/src/views/MarketSignalsWorkbench.vue`
- Test: `apps/web/src/views/MarketSignalsWorkbench.test.ts`

**Interfaces:**

- API client `listMarketSignals(input: { destination; cursor?; pageSize? })` returns one destination page.
- Composable stores pages by all seven `MarketSignalWorkflowState` values; `loadMore(destination)` appends safely.
- Draft adds `waitingReason` only; it never carries owner actor ID.
- New component receives `activeValidation` and current session actor ID, and emits no business decisions.

- [ ] **Step 1: Write failing API-client destination tests**

Assert exact URL encoding:

```ts
await listMarketSignals({
  destination: "watching",
  cursor: "a/b",
  pageSize: 50,
});
expect(fetchMock).toHaveBeenCalledWith(
  "/api/market-signals?destination=watching&pageSize=50&cursor=a%2Fb",
  expect.objectContaining({ method: "GET" }),
);
```

Run `pnpm --filter @logix/web exec vitest run src/api/marketSignals.test.ts` and expect RED.

- [ ] **Step 2: Write failing component tests from both synthetic rehearsals**

Add assertions:

- positive rehearsal shows owner/date/focus/waiting and never says “机会已证明”;
- negative rehearsal labels similar-product conversion as neighboring evidence and never renders a total score or automatic rejection;
- old response with absent/null `activeValidation` renders “尚未安排下一项验证”;
- current actor displays “我”; another actor displays stable ID, never a fabricated name;
- watch submit omits any owner field and includes date/focus/waitingReason;
- missing date or focus keeps the action incomplete and names the missing input;
- 409 reloads detail and preserves recoverable feedback;
- closed mode tests remain green.

- [ ] **Step 3: Implement destination-scoped API pages**

Build URL with `URLSearchParams`. In the composable maintain:

```ts
interface QueuePageState {
  items: readonly MarketSignalScenario[];
  nextCursor: string | null;
  totalCount: number;
  loading: boolean;
}
```

Load the first page for all seven destinations concurrently; later pages load only for the active filter. Deduplicate by signal id. `needs_decision` is fetched independently from `watching`, satisfying the >100 counterexample.

- [ ] **Step 4: Extend Web scenario and draft types**

Add:

```ts
activeValidation: null | {
  responsibleActorId: string;
  nextReviewDate: string;
  watchFocus: string | null;
  waitingReason: string | null;
};
```

and `waitingReason: string` on `MarketSignalDecisionDraft`. Pending label mapping includes `watch_focus`.

- [ ] **Step 5: Implement the self-owned form**

For watch:

- label radio as “安排下一项验证”;
- require date and focus in UI;
- add optional “当前在等什么” textarea;
- button copy “由我负责并安排验证” or “更新我的验证承诺” when session actor owns it;
- when another actor owns it, disable watch submit and show stable conflict-oriented copy; do not invent takeover.

Use `useAuthSession()` from the existing auth session facade to compare current actor.

- [ ] **Step 6: Implement `MarketSignalActiveValidation.vue`**

Show exactly four facts: responsible actor (`我` or stable id), validation focus (or “旧记录未填写，需重新安排”), review date, and waiting reason. Use existing tokens only. No progress percentage, score, trusted label or overdue KPI.

- [ ] **Step 7: Update queue and receipt**

Watching rows show check date, owner, focus and waiting reason. The filter count uses `totalCount`, not loaded item count. Add a “加载更多” control for current filter when cursor exists. Receipt uses server-returned projection after save.

- [ ] **Step 8: Run Web RED→GREEN suite**

```bash
pnpm --filter @logix/web exec vitest run src/api/marketSignals.test.ts src/views/MarketSignalsWorkbench.test.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web build
```

Expected: all pass with no warnings.

- [ ] **Step 9: Commit Task 4**

```bash
git add apps/web/src/api/marketSignals.ts apps/web/src/api/marketSignals.test.ts apps/web/src/data/marketSignalScenarios.ts apps/web/src/composables/useMarketSignalWorkbench.ts apps/web/src/components/market-signals apps/web/src/views/MarketSignalsWorkbench.vue apps/web/src/views/MarketSignalsWorkbench.test.ts
git commit -m "feat(web): make market validation resumable"
```

---

### Task 5: Synthetic Vertical E2E and Final High-Risk Gate

**Files:**

- Modify: `apps/web/e2e/workbench-network.spec.ts`
- Modify: `docs/planning/tasks/market-signals-opportunity-radar-v1.md`
- Modify: `docs/INDEX.md`

**Interfaces:**

- Consumes all prior tasks.
- Produces final evidence for this coding slice only; task remains not `done` until real business gates are met.

- [ ] **Step 1: Write failing positive rehearsal E2E**

Flow:

1. Open `needs_decision` synthetic positive signal.
2. Choose “安排下一项验证”.
3. Fill focus/date/waiting reason.
4. Assert command has date/focus/waitingReason and no owner actor.
5. Mock server response with authenticated actor projection.
6. Assert watching queue/card and receipt show owner/date/focus/waiting.
7. Update same actor commitment and confirm old-history count in mock state increments.
8. Handoff and assert current validation disappears; copy says “交给选品评估”, never “可信机会/已证明”.

- [ ] **Step 2: Write failing negative rehearsal and cross-actor E2E**

Flow:

1. Open negative synthetic signal with another actor’s commitment.
2. Assert form explains that takeover is unavailable and cannot submit watch.
3. Mock 409 `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT`; assert stable feedback and detail reload.
4. With current actor’s signal, wait on persistence data and then dismiss; assert projection clears and no total score appears.

- [ ] **Step 3: Add narrow-screen and pagination checks**

At 680px assert no horizontal overflow. Mock 101 watching rows over two pages plus one needs-decision page. Assert needs-decision remains reachable and “加载更多” traverses watching without duplicate ids.

- [ ] **Step 4: Run focused E2E GREEN**

```bash
pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts --grep "market validation"
```

Expected: positive, negative, pagination and viewport cases pass.

- [ ] **Step 5: Run all slice-level checks**

```bash
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
pnpm data-dictionary:generate
pnpm data-dictionary:check
pnpm db:generate
pnpm --filter @logix/api lint
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api test
pnpm --filter @logix/api test:integration -- market-opportunity-flow.integration.test.ts market-signal-validation-migration-upgrade.integration.test.ts
pnpm --filter @logix/api build
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web test
pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts --grep "market validation"
pnpm --filter @logix/web build
pnpm authz:routes
pnpm security:audit
pnpm repo:check
pnpm format:check
git diff --check
```

Expected: every command exits 0. Record exact counts and any repository-existing skips in the brief; do not convert synthetic passes into business acceptance.

- [ ] **Step 6: Run the final high-risk gate once**

Start required infrastructure first:

```bash
pnpm infra:up
pnpm playwright:install
pnpm validate
```

Expected: `validate` exits 0 on the final PR candidate. If an unrelated failure occurs, record the exact failing test and follow systematic debugging; do not weaken or skip it.

- [ ] **Step 7: Update task evidence without marking full task done**

Set the coding slice evidence in `verification`, check only the current coding-slice acceptance items, and leave KPI/WB-B10/launch/business-effect gates unchecked. Keep task status `review` until independent review and PR integration; after merge, use `blocked` if no next approved coding slice exists, not `done`.

- [ ] **Step 8: Commit Task 5**

```bash
git add apps/web/e2e/workbench-network.spec.ts docs/planning/tasks/market-signals-opportunity-radar-v1.md docs/INDEX.md
git commit -m "test(market): verify resumable validation flow"
```

---

## Plan Self-Review Results

- **Spec coverage:** Current responsibility, date, focus, waiting, self-owner conflict, immutable history, projection clearing, destination-scoped reachability, legacy rows, Web flow and synthetic boundaries each map to a task and test.
- **Deliberate exclusions:** trusted qualification, scoring, capability split, transfer, reopen, KPI and shared control plane appear only in Global Constraints and are not implemented by any task.
- **Type consistency:** `MarketSignalActiveValidationV1`, `activeValidation`, `waitingReason`, `watch_focus`, `responsibleActorId`, `nextReviewDate`, `watchFocus`, and `MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT` are used consistently across tasks.
- **Review Focus coverage:** cross-actor ownership (Tasks 2/5), legacy focus (Task 2/4), >100 reachability (Tasks 2/4/5), replay/concurrency (Task 2), synthetic boundary (Tasks 1/4/5).
- **No placeholder implementation steps:** every task names concrete files, interfaces, test behavior, commands and expected outcomes.
