# Recoverable Work Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in operator keep multiple bounded workbench contexts, settle unsaved input safely, and resume a target only after server reauthorization, reread, and version validation, without changing domain responsibility or business state.

**Architecture:** Add a small actor-owned `WorkSession` aggregate that stores only reconstructable pointers and UI anchors. A frontend orchestrator coordinates domain-specific adapters: Product Selection can save a typed neutral server draft, while Stuffing intentionally has no draft and therefore offers discard/stay/new-tab handling. The source route remains current until target validation succeeds and the server atomically activates the target session.

**Tech Stack:** TypeScript, NestJS 11, Prisma 7/PostgreSQL, Vue 3, Vue Router 4, Vitest, Playwright, JSON Schema Draft 2020-12, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md` §4.3, §11, §18.2, §19.3

## Global Constraints

- Node.js must remain `>=20.19 <25`; pnpm must remain `>=10 <11`.
- Preserve the existing theme, typography, token, PageHeader, responsibility-band, decision-strip, and three-pane contracts.
- A WorkSession stores pointers only: no arbitrary form JSON, Vue state, free URL, token, evidence body, PII, permission projection, responsibility, SLA, or business status.
- Pausing or closing a WorkSession never calls domain `defer`, `block`, `wait`, `partial`, `complete`, claim-release, or responsibility-transfer actions.
- Product Selection draft persistence is typed and domain-owned; it must not alter outcome, destination, responsibility, dates, immutable handoff snapshots, or Outbox.
- Stuffing keeps no general draft. Dirty input may be discarded, retained in the original browser tab, or left in place; it must never be labeled server-saved.
- Switch order is fixed: settle source dirty input → reauthorize/reread target → compare domain version → atomically activate target → navigate → restore bounded UI anchors.
- All server queries are scoped by authenticated `tenantId + actorId`; body fields cannot spoof either value.
- Implement only Product Selection and Stuffing adapters. Do not migrate the other 21 workbenches.
- Do not touch `doc/cross-border-supply-chain/wisdom-baseline/市场与经营信号.md`, `.tmp/**`, or `apps/api/.tmp/**`.
- Do not start UI units 3–5, ocean operations, full-chain sample Brief 4, demo deletion, production writes, or page switching.

## Review Focus

1. **Concurrent target activation:** two tabs activate different sessions simultaneously; expect exactly one current session and one stable 409, never two or zero current sessions.
2. **Dirty source plus target denial:** Product Selection save, target reread, or WorkSession activation returns 403/404/409; expect route/current marker/local input to remain on the source.
3. **No-draft Stuffing input:** a changed form is switched away from; expect no “saved” claim and only discard/stay/new-tab choices.
4. **Stale target domain version:** session `versionSeen` differs from the latest Product Initiative or Stuffing snapshot; expect a conflict state with reread/compare recovery, not restored write controls.
5. **Cross-actor or cross-tenant lookup:** another identity guesses a session ID or canonical context; expect not-found behavior with no label, route, subject, or status leakage.

---

## File Structure

### New public and persistence files

- `packages/contracts/schemas/v1/work-session.schema.json` — wire contract for bounded route contexts, work-session commands, list/read models, and stable result statuses.
- `database/migrations/20261014120000_add_recoverable_work_sessions/migration.sql` — `work_session` and `product_initiative_decision_draft` tables, checks, partial unique indexes, and tenant/actor indexes.
- `apps/api/src/modules/work-session/` — WorkSession domain, application services, Prisma repository, DTO/controller/module, and focused tests.
- `apps/api/src/modules/product-selection/domain/product-initiative-draft.ts` — typed neutral draft normalization, hashing, and optimistic-version rules.
- `apps/api/src/modules/product-selection/domain/product-initiative-draft.repository.ts` — repository port for one current typed draft per tenant/handoff.
- `apps/api/src/modules/product-selection/application/save-product-initiative-draft.service.ts` — actor/tenant/evidence-aware neutral save use case.
- `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-draft.repository.ts` — transactional typed-draft persistence.
- `apps/web/src/work-session/routeContext.ts` — closed RouteContext union and canonical context key.
- `apps/web/src/work-session/workSessionAdapter.ts` — consumer adapter protocol.
- `apps/web/src/work-session/useWorkSessions.ts` — source-settlement, target-validation, activation, navigation, and restoration orchestration.
- `apps/web/src/api/workSessions.ts` — typed API client.
- `apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue` — PageHeader menu, status copy, confirmation flows, and keyboard/focus behavior.
- `apps/web/e2e/recoverable-work-sessions.spec.ts` — real Product Selection and Stuffing browser acceptance.

### Modified seams

- Product Initiative contract/schema/API/composable/view — neutral typed draft save and adapter wiring.
- Workbench shared shell/reference — production switcher contract and synthetic API-free reference rendering.
- Stuffing view/form/frame — dirty-state adapter only; no domain draft.
- Prisma schema/dictionary/generated contracts — authoritative model and generated projections.

---

### Task 1: Freeze WorkSession and Product Initiative Draft Contracts

**Files:**

- Create: `packages/contracts/schemas/v1/work-session.schema.json`
- Modify: `packages/contracts/schemas/v1/product-initiative.schema.json`
- Modify: `packages/contracts/schemas/v1/index.json`
- Modify: `packages/contracts/fixtures/v1/schema-instances.json`
- Modify: `scripts/generate-contracts.mjs`
- Generate: `packages/contracts/generated/contracts.d.ts`

**Interfaces:**

- Produces: `WorkSessionV1`, `WorkSessionRouteContextV1`, `WorkSessionOpenCommandV1`, `WorkSessionUpdateCommandV1`, `WorkSessionActivateCommandV1`, `WorkSessionPageV1`, `ProductInitiativeDecisionDraftV1`, `SaveProductInitiativeDecisionDraftCommandV1`.
- Consumes: existing `WorkbenchCode` values and Product Initiative nested draft definitions.

- [ ] **Step 1: Add failing schema fixture coverage**

Add valid instances for Product Selection and Stuffing plus invalid instances that contain a free URL, arbitrary `formState`, spoofed `tenantId`, and an unknown route-context kind. The valid Product Selection shape must be:

```json
{
  "contractVersion": "work-session.v1",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "status": "current",
  "workbenchCode": "product_selection",
  "contextKey": "product_selection|product_initiative_handoff:22222222-2222-4222-8222-222222222222",
  "routeContext": {
    "kind": "product_selection.v1",
    "handoffId": "22222222-2222-4222-8222-222222222222"
  },
  "subjectRef": {
    "kind": "product_initiative_handoff",
    "id": "22222222-2222-4222-8222-222222222222"
  },
  "domainVersionSeen": 3,
  "activeItemKey": "risk:compliance",
  "contextMode": "risk_assessment",
  "displaySummary": "选品 · 加拿大户外储物柜",
  "lastOpenedAt": "2026-10-14T08:00:00.000Z",
  "createdAt": "2026-10-14T08:00:00.000Z",
  "updatedAt": "2026-10-14T08:00:00.000Z"
}
```

- [ ] **Step 2: Run contract validation to verify failure**

Run: `pnpm contract:check`

Expected: FAIL because `work-session.schema.json` and the referenced definitions are absent.

- [ ] **Step 3: Define the closed WorkSession schema**

Use a discriminated `oneOf` for exactly these first adapters:

```json
"WorkSessionRouteContextV1": {
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "handoffId"],
      "properties": {
        "kind": { "const": "product_selection.v1" },
        "handoffId": { "$ref": "common.schema.json#/$defs/Uuid" }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "containerId", "taskId"],
      "properties": {
        "kind": { "const": "stuffing.v1" },
        "containerId": { "$ref": "common.schema.json#/$defs/Uuid" },
        "taskId": { "$ref": "common.schema.json#/$defs/Uuid" }
      }
    }
  ]
}
```

Define statuses as `current | resumable | draft_saved | browser_held | conflict | closed`. Keep session commands free of `tenantId` and `ownerActorId`. `WorkSessionActivateCommandV1` must carry `expectedSourceSessionVersion`, `expectedTargetSessionVersion`, and the target `domainVersionSeen` validated immediately before activation.

- [ ] **Step 4: Add the typed neutral Product Initiative draft contract**

Reference the existing nested business-case, risk, unit-economics, and review-point definitions. The save command must contain only draft content, `expectedDraftVersion`, `initiativeVersionSeen`, and `idempotencyKey`; it must not contain `outcome`, `currentDestination`, responsibility, target/reconsideration dates, handoff, or completion fields.

```json
"SaveProductInitiativeDecisionDraftCommandV1": {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "contractVersion",
    "expectedDraftVersion",
    "initiativeVersionSeen",
    "objective",
    "reviewPoints",
    "businessCaseDraft",
    "riskAssessmentDraft",
    "unitEconomicsDraft",
    "idempotencyKey"
  ],
  "properties": {
    "contractVersion": { "const": "product-initiative-decision-draft-save.v1" },
    "expectedDraftVersion": { "type": "integer", "minimum": 0 },
    "initiativeVersionSeen": { "type": "integer", "minimum": 0 },
    "objective": { "type": ["string", "null"], "maxLength": 4000 },
    "reviewPoints": { "type": "array", "items": { "$ref": "#/$defs/ProductInitiativeReviewPointV1" } },
    "businessCaseDraft": { "type": "array", "items": { "$ref": "#/$defs/ProductInitiativeBusinessCaseDimensionDraftV1" } },
    "riskAssessmentDraft": { "type": "array", "items": { "$ref": "#/$defs/ProductInitiativeRiskAssessmentDraftV1" } },
    "unitEconomicsDraft": { "oneOf": [{ "$ref": "#/$defs/ProductInitiativeUnitEconomicsDraftV1" }, { "type": "null" }] },
    "negativeConservativeReason": { "type": ["string", "null"], "maxLength": 4000 },
    "idempotencyKey": { "type": "string", "minLength": 1, "maxLength": 200 }
  }
}
```

- [ ] **Step 5: Register and generate types**

Add `work-session.schema.json` to `CONTRACT_FILES`, `index.json` under GC-007, then run:

```powershell
pnpm contract:generate
pnpm contract:check
pnpm contract:drift
```

Expected: all PASS; generated TypeScript contains the exact interfaces above and no `any`-shaped form state.

- [ ] **Step 6: Commit the contract slice**

```powershell
git add -- packages/contracts/schemas/v1/work-session.schema.json packages/contracts/schemas/v1/product-initiative.schema.json packages/contracts/schemas/v1/index.json packages/contracts/fixtures/v1/schema-instances.json packages/contracts/generated/contracts.d.ts scripts/generate-contracts.mjs
git commit -m "feat(contracts): define recoverable work sessions"
```

---

### Task 2: Add WorkSession and Typed Draft Persistence

**Files:**

- Modify: `database/schema.prisma`
- Create: `database/migrations/20261014120000_add_recoverable_work_sessions/migration.sql`
- Modify: `database/dictionary/dictionary.annotations.json`
- Generate: `database/dictionary/DATA_DICTIONARY.generated.md`
- Generate: `database/dictionary/NATIVE_OBJECTS.generated.md`
- Create: `apps/api/src/modules/work-session/domain/work-session.ts`
- Create: `apps/api/src/modules/work-session/domain/work-session.test.ts`
- Create: `apps/api/src/modules/work-session/domain/work-session.repository.ts`
- Create: `apps/api/src/modules/product-selection/domain/product-initiative-draft.ts`
- Create: `apps/api/src/modules/product-selection/domain/product-initiative-draft.test.ts`
- Create: `apps/api/src/modules/product-selection/domain/product-initiative-draft.repository.ts`

**Interfaces:**

- Produces: `prepareWorkSessionOpen`, `prepareWorkSessionPointerUpdate`, `prepareWorkSessionActivation`, `prepareProductInitiativeDecisionDraft`, repository records and commands.
- Consumes: generated contract types from Task 1.

- [ ] **Step 1: Write failing pure-domain tests**

Cover:

```ts
it("canonicalizes product selection without UI anchors in identity", () => {
  expect(
    contextKeyOf({ kind: "product_selection.v1", handoffId: HANDOFF_ID }),
  ).toBe(`product_selection|product_initiative_handoff:${HANDOFF_ID}`);
});

it("rejects stale work-session versions", () => {
  expect(() =>
    prepareWorkSessionActivation({ version: 4 }, { expectedVersion: 3 }),
  ).toThrow("WORK_SESSION_VERSION_CONFLICT");
});

it("normalizes a typed draft without producing a business decision", () => {
  const prepared = prepareProductInitiativeDecisionDraft(ACTOR, COMMAND);
  expect(prepared).not.toHaveProperty("outcome");
  expect(prepared).not.toHaveProperty("currentDestination");
  expect(prepared.payloadHash).toMatch(/^[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pnpm --filter @logix/api test -- src/modules/work-session/domain/work-session.test.ts src/modules/product-selection/domain/product-initiative-draft.test.ts
```

Expected: FAIL because the domain files/functions do not exist.

- [ ] **Step 3: Implement pure domain functions**

Keep route-context canonicalization exhaustive:

```ts
export function contextKeyOf(context: WorkSessionRouteContextV1): string {
  switch (context.kind) {
    case "product_selection.v1":
      return `product_selection|product_initiative_handoff:${uuid(context.handoffId)}`;
    case "stuffing.v1":
      return `stuffing|container:${uuid(context.containerId)}|task:${uuid(context.taskId)}`;
  }
}
```

Validate status transitions so `closed` cannot reactivate in place, `browser_held` cannot be claimed as `draft_saved`, and a pointer update cannot alter context identity.

- [ ] **Step 4: Add Prisma models and SQL migration**

Use explicit columns, not generic business payload:

```prisma
model WorkSession {
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @map("tenant_id")
  ownerActorId      String   @map("owner_actor_id")
  version           Int
  status            String
  workbenchCode     String   @map("workbench_code")
  contextKind       String   @map("context_kind")
  contextKey        String   @map("context_key")
  subjectKind       String   @map("subject_kind")
  subjectId         String   @map("subject_id") @db.Uuid
  taskKind          String?  @map("task_kind")
  taskId            String?  @map("task_id") @db.Uuid
  draftKind         String?  @map("draft_kind")
  draftId           String?  @map("draft_id") @db.Uuid
  domainVersionSeen Int?     @map("domain_version_seen")
  activeItemKey     String?  @map("active_item_key")
  contextMode       String?  @map("context_mode")
  displaySummary    String   @map("display_summary")
  lastOpenedAt      DateTime @map("last_opened_at") @db.Timestamptz
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([id, tenantId, ownerActorId], map: "work_session_owner_key")
  @@map("work_session")
}
```

Add SQL-only partial indexes:

```sql
CREATE UNIQUE INDEX "work_session_one_current_key"
ON "work_session" ("tenant_id", "owner_actor_id")
WHERE "status" = 'current';

CREATE UNIQUE INDEX "work_session_live_context_key"
ON "work_session" ("tenant_id", "owner_actor_id", "context_key")
WHERE "status" <> 'closed';
```

Create `product_initiative_decision_draft` with explicit typed JSON columns, `draft_version`, `initiative_version_seen`, `payload_hash`, and one row per tenant/handoff. It must reference `market_opportunity_handoff(id, tenant_id)` and must not reference WorkSession as an ownership relationship.

- [ ] **Step 5: Generate Prisma and dictionary coverage**

Run:

```powershell
pnpm db:generate
pnpm data-dictionary:bootstrap
pnpm data-dictionary:generate
pnpm data-dictionary:check
```

Review annotations so `work_session` is described as actor-owned reconstructable UI pointers and the Product Initiative draft as domain-owned typed working material.

- [ ] **Step 6: Run domain and schema checks**

```powershell
pnpm --filter @logix/api test -- src/modules/work-session/domain/work-session.test.ts src/modules/product-selection/domain/product-initiative-draft.test.ts
pnpm db:generate
pnpm data-dictionary:check
```

Expected: PASS.

- [ ] **Step 7: Commit persistence slice**

```powershell
git add -- database/schema.prisma database/migrations/20261014120000_add_recoverable_work_sessions/migration.sql database/dictionary apps/api/src/modules/work-session/domain apps/api/src/modules/product-selection/domain/product-initiative-draft.ts apps/api/src/modules/product-selection/domain/product-initiative-draft.test.ts apps/api/src/modules/product-selection/domain/product-initiative-draft.repository.ts
git commit -m "feat(work-session): add pointer persistence"
```

---

### Task 3: Implement Actor-Owned WorkSession API

**Files:**

- Create: `apps/api/src/modules/work-session/module.manifest.ts`
- Create: `apps/api/src/modules/work-session/work-session.module.ts`
- Create: `apps/api/src/modules/work-session/index.ts`
- Create: `apps/api/src/modules/work-session/application/*.ts`
- Create: `apps/api/src/modules/work-session/application/*.test.ts`
- Create: `apps/api/src/modules/work-session/infrastructure/prisma-work-session.repository.ts`
- Create: `apps/api/src/modules/work-session/presentation/work-sessions.controller.ts`
- Create: `apps/api/src/modules/work-session/presentation/work-session.dto.ts`
- Create: `apps/api/src/modules/work-session/presentation/work-sessions.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/identity/domain/role-capabilities.ts`
- Modify: `apps/api/src/modules/identity/domain/role-capabilities.test.ts`
- Create: `apps/api/src/infrastructure/integration/work-session.integration.test.ts`

**Interfaces:**

- Produces endpoints:
  - `GET /api/work-sessions?pageSize=50&cursor=...`
  - `POST /api/work-sessions/open`
  - `PATCH /api/work-sessions/:sessionId/pointer`
  - `POST /api/work-sessions/:sessionId/activate`
  - `POST /api/work-sessions/:sessionId/close`
- Consumes domain/repository interfaces from Task 2.

- [ ] **Step 1: Write failing application/controller tests**

Pin authenticated identity and capability metadata:

```ts
expect(capabilitiesOf(WorkSessionsController.prototype.list)).toEqual([
  "work_session.manage",
]);
expect(openService.execute).toHaveBeenCalledWith(
  expect.objectContaining({ tenantId: "tenant-1", actorId: "actor-1" }),
);
expect(openService.execute).not.toHaveBeenCalledWith(
  expect.objectContaining({
    tenantId: body.tenantId,
    actorId: body.ownerActorId,
  }),
);
```

Add service tests for duplicate context returning the existing session and stale version leaving the current session unchanged.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pnpm --filter @logix/api test -- src/modules/work-session
```

Expected: FAIL because the module and endpoints do not exist.

- [ ] **Step 3: Implement repository transactions**

Use advisory locking per actor for open/activate:

```ts
await tx.$queryRaw`
  SELECT 1 FROM (
    SELECT pg_advisory_xact_lock(hashtextextended(${`work-session:${tenantId}:${actorId}`}, 0))
  ) locked
`;
```

`activate` must:

1. load source and target by `tenantId + ownerActorId`;
2. compare both expected versions;
3. verify target is not closed;
4. compare the just-validated `domainVersionSeen` with the target pointer;
5. update source to the caller-provided honest status (`resumable`, `draft_saved`, or `browser_held`);
6. update target to `current` and increment both versions in one transaction.

- [ ] **Step 4: Implement services and stable errors**

Map `WORK_SESSION_VERSION_CONFLICT`, `WORK_SESSION_TARGET_CLOSED`, and `WORK_SESSION_DOMAIN_VERSION_CONFLICT` to 409; actor/tenant mismatch maps to 404 to prevent enumeration. Do not perform domain authorization inside WorkSession; the frontend validates target through the domain adapter before activate.

- [ ] **Step 5: Add capability without broadening domain authority**

Add `work_session.manage` to existing role packs that can enter workbench routes (`operations_dispatcher`, `review_supervisor`, `manager`, `business_admin`, and other current read-only users only if they already have `planning.read` or `task.read`). The capability permits only owner-scoped WorkSession records.

- [ ] **Step 6: Write and run real PostgreSQL integration tests**

Cover the five Review Focus failures, especially concurrent activation:

```ts
const [left, right] = await Promise.allSettled([
  activate(sessionA, versionA, sessionB, versionB),
  activate(sessionB, versionB, sessionA, versionA),
]);
expect([left.status, right.status].sort()).toEqual(["fulfilled", "rejected"]);
expect(await currentSessions("tenant-1", "actor-1")).toHaveLength(1);
```

Run after `pnpm infra:up`:

```powershell
pnpm db:migrate
pnpm --filter @logix/api test:integration -- src/infrastructure/integration/work-session.integration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit API slice**

```powershell
git add -- apps/api/src/app.module.ts apps/api/src/modules/work-session apps/api/src/modules/identity/domain/role-capabilities.ts apps/api/src/modules/identity/domain/role-capabilities.test.ts apps/api/src/infrastructure/integration/work-session.integration.test.ts
git commit -m "feat(work-session): add owner-scoped API"
```

---

### Task 4: Add Neutral Product Initiative Draft Save

**Files:**

- Create: `apps/api/src/modules/product-selection/application/save-product-initiative-draft.service.ts`
- Create: `apps/api/src/modules/product-selection/application/product-initiative-draft.services.test.ts`
- Create: `apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-draft.repository.ts`
- Modify: `apps/api/src/modules/product-selection/product-selection.module.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-initiatives.controller.ts`
- Modify: `apps/api/src/modules/product-selection/presentation/product-initiative.dto.ts`
- Create: `apps/api/src/modules/product-selection/presentation/product-initiative-draft.controller.test.ts`
- Modify: `apps/api/src/modules/product-selection/application/get-product-initiative.service.ts`
- Modify: `apps/api/src/modules/product-selection/application/decide-product-initiative.service.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`
- Modify: `apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts`

**Interfaces:**

- Produces: `POST /api/product-initiatives/:handoffId/drafts`; Product Initiative detail includes `decisionDraft` separately from the last business decision.
- Consumes: Task 1 contract and Task 2 draft repository.

- [ ] **Step 1: Write failing service and integration tests**

Assert neutral semantics:

```ts
const before = await readInitiative(handoffId);
const saved = await saveDraft(handoffId, command);
const after = await readInitiative(handoffId);

expect(saved.draftVersion).toBe(1);
expect(after.initiative?.outcome).toBe(before.initiative?.outcome);
expect(after.initiative?.currentDestination).toBe(
  before.initiative?.currentDestination,
);
expect(await handoffCount(handoffId)).toBe(0);
expect(await outboxCountForInitiative(handoffId)).toBe(0);
```

Also test invalid evidence, cross-tenant access, stale draft version, stale `initiativeVersionSeen`, idempotent replay, and same-key/different-payload conflict.

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm --filter @logix/api test -- src/modules/product-selection/application/product-initiative-draft.services.test.ts src/modules/product-selection/presentation/product-initiative-draft.controller.test.ts
```

Expected: FAIL because the service/controller are absent.

- [ ] **Step 3: Implement the neutral save service**

The service must verify:

1. authenticated tenant/actor;
2. accepted Product Opportunity exists in the tenant;
3. current Product Initiative version equals `initiativeVersionSeen`;
4. all evidence refs belong to the source market signal;
5. typed draft normalization succeeds;
6. repository saves only the decision-draft row.

It must not call `prepareProductInitiativeDecision` or `persistDecision`.

- [ ] **Step 4: Hydrate detail and close drafts after formal decisions**

`GET detail` returns both current Initiative and neutral decision draft. A successful formal decision must close/delete the neutral draft only after the decision transaction succeeds; a failed formal decision leaves it available for correction.

- [ ] **Step 5: Run focused unit/integration/migration tests**

```powershell
pnpm --filter @logix/api test -- src/modules/product-selection
pnpm --filter @logix/api test:integration -- src/infrastructure/integration/product-initiative-flow.integration.test.ts src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit draft slice**

```powershell
git add -- apps/api/src/modules/product-selection apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
git commit -m "feat(product-selection): save neutral decision drafts"
```

---

### Task 5: Build Frontend RouteContext and Session Orchestrator

**Files:**

- Create: `apps/web/src/work-session/routeContext.ts`
- Create: `apps/web/src/work-session/routeContext.test.ts`
- Create: `apps/web/src/work-session/workSessionAdapter.ts`
- Create: `apps/web/src/work-session/workSessionBrowserState.ts`
- Create: `apps/web/src/work-session/workSessionBrowserState.test.ts`
- Create: `apps/web/src/work-session/useWorkSessions.ts`
- Create: `apps/web/src/work-session/useWorkSessions.test.ts`
- Create: `apps/web/src/api/workSessions.ts`
- Create: `apps/web/src/api/workSessions.test.ts`

**Interfaces:**

- Produces:

```ts
export interface WorkSessionAdapter {
  readonly context: Readonly<Ref<WorkSessionRouteContextV1 | null>>;
  readonly domainVersionSeen: Readonly<Ref<number | null>>;
  readonly dirtyState: Readonly<Ref<"clean" | "dirty" | "saving">>;
  settleBeforeLeave(intent: "switch" | "new-tab"): Promise<
    | {
        kind: "ready";
        sourceStatus: "resumable" | "draft_saved" | "browser_held";
      }
    | { kind: "needs-choice"; choices: readonly DirtyChoice[] }
    | { kind: "failed"; message: string }
  >;
  validateTarget(session: WorkSessionV1): Promise<TargetValidation>;
  capturePointer(): WorkSessionPointerUpdateV1;
  restorePointer(session: WorkSessionV1): Promise<void>;
}
```

- Consumes: Task 1 generated contracts and Task 3 API.

- [ ] **Step 1: Write failing codec and orchestration tests**

Cover allowlisted query keys, canonical dedupe, no free URL, menu-open no navigation, save failure no activation, target denial no activation, and successful operation ordering.

```ts
expect(callOrder).toEqual([
  "settle-source",
  "validate-target",
  "activate-server",
  "router-replace",
  "restore-pointer",
]);
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm --filter @logix/web test -- src/work-session src/api/workSessions.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement closed RouteContext codecs**

Expose `parseRouteContext(route)` and `toRouteLocation(context)` for Product Selection and Stuffing only. Reject unknown/missing/extra pointer fields. Do not store or replay hash fragments or arbitrary query values.

- [ ] **Step 4: Implement safe browser state**

Use `sessionStorage` only for active session ID and per-tab layout anchors. Wrap every storage access in `try/catch`. Use `BroadcastChannel("logix.work-sessions.v1")` for refresh notifications; fall back to refetch on `visibilitychange` and `focus` when unavailable. Never store domain draft values.

- [ ] **Step 5: Implement API and orchestrator**

The orchestrator owns only session workflow. It asks the active adapter to settle; asks the target adapter/registry to validate; invokes server activation; then navigates and restores. It must never call domain save APIs directly.

- [ ] **Step 6: Run focused tests**

```powershell
pnpm --filter @logix/web test -- src/work-session src/api/workSessions.test.ts
pnpm --filter @logix/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit frontend runtime slice**

```powershell
git add -- apps/web/src/work-session apps/web/src/api/workSessions.ts apps/web/src/api/workSessions.test.ts
git commit -m "feat(web): orchestrate recoverable work sessions"
```

---

### Task 6: Implement the Production Session Switcher and Reference Contract

**Files:**

- Create: `apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue`
- Create: `apps/web/src/components/workbench/WorkbenchSessionSwitcher.test.ts`
- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.vue`
- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts`
- Modify: `apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.vue`
- Modify: `apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts`
- Modify: `apps/web/src/reference/universal-workbench/referenceScenarios.ts`
- Modify: `docs/product/UI_SYSTEM.md`

**Interfaces:**

- Produces: accessible switcher UI using `useWorkSessions`; forwards `switcher` slot through `RoleWorkbenchFrame`.
- Consumes: orchestrator and WorkSession models from Task 5.

- [ ] **Step 1: Write failing component accessibility/atomicity tests**

Verify:

- trigger announces current session;
- opening does not navigate;
- list has exactly one `aria-current` item;
- Escape/outside click returns focus;
- save-failed dialog leaves the trigger/session current;
- statuses are rendered as text;
- mobile panel is modal and traps focus.

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm --filter @logix/web test -- src/components/workbench/WorkbenchSessionSwitcher.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
```

Expected: FAIL because the switcher and forwarding slot are absent.

- [ ] **Step 3: Implement the switcher**

Use existing tokens and controls. Keep the menu concise:

```text
当前：选品 · 加拿大户外储物柜
待续办：装箱 · KOCU4960726
草稿已保存：选品 · 英国庭院棚
仅此标签保留：装箱 · MSMU1234567
冲突：选品 · 德国宠物围栏
```

Dirty choices must use exact truthful copy:

- Product Selection: `保存领域草稿并切换 / 放弃本地改动并切换 / 留在当前页`.
- Stuffing: `放弃本地改动并切换 / 在新标签页打开目标 / 留在当前页`.

- [ ] **Step 4: Forward the named slot and reuse production component in reference page**

`RoleWorkbenchFrame` must forward `#switcher` without altering its `responsiveMode="stacked"`. The reference page may provide an in-memory repository adapter but must render the same production switcher component and remain API-free.

- [ ] **Step 5: Update UI authority incrementally**

Add the implemented contract to `UI_SYSTEM.md`: pointer-only data, switch ordering, truthful statuses, no-draft boundary, and failure/current-marker invariants. Reference the approved design rather than copying its full prose.

- [ ] **Step 6: Run component/reference tests**

```powershell
pnpm --filter @logix/web test -- src/components/workbench/WorkbenchSessionSwitcher.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit switcher slice**

```powershell
git add -- apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue apps/web/src/components/workbench/WorkbenchSessionSwitcher.test.ts apps/web/src/components/workbench/RoleWorkbenchFrame.vue apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts apps/web/src/reference/universal-workbench docs/product/UI_SYSTEM.md
git commit -m "feat(web): add work session switcher"
```

---

### Task 7: Connect Product Selection as the Server-Draft Consumer

**Files:**

- Modify: `apps/web/src/api/marketSignals.ts`
- Modify: `apps/web/src/api/marketSignals.test.ts`
- Modify: `apps/web/src/composables/useProductInitiativeDecision.ts`
- Modify: `apps/web/src/composables/useProductInitiativeDecision.test.ts`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.test.ts`

**Interfaces:**

- Produces: Product Selection `WorkSessionAdapter` implementation and neutral `saveDraft()` API.
- Consumes: Task 4 draft endpoint, Task 5 adapter protocol, Task 6 switcher.

- [ ] **Step 1: Write failing dirty/save/resume tests**

Pin baseline equality rather than a manual dirty flag:

```ts
expect(state.isDraftDirty.value).toBe(false);
state.objective.value = "新的目标";
expect(state.isDraftDirty.value).toBe(true);
await state.saveDraft();
expect(saveProductInitiativeDraft).toHaveBeenCalledWith(
  HANDOFF_ID,
  expect.objectContaining({ initiativeVersionSeen: 3 }),
);
expect(state.isDraftDirty.value).toBe(false);
```

Page tests must prove save failure leaves `handoffId`, current marker, active gap panel, and local objective unchanged.

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm --filter @logix/web test -- src/api/marketSignals.test.ts src/composables/useProductInitiativeDecision.test.ts src/views/ProductSelectionWorkbench.test.ts
```

Expected: FAIL because neutral draft methods and adapter wiring are absent.

- [ ] **Step 3: Add API and composable draft lifecycle**

Hydrate neutral draft separately from the last business decision. Maintain a normalized baseline snapshot after load/save; compute dirty by stable serialization of typed fields. On `PRODUCT_INITIATIVE_DRAFT_VERSION_CONFLICT`, reload server draft with `keepLocal: true`, retain local input, and expose both versions to the right-pane conflict UI.

- [ ] **Step 4: Connect PageHeader switcher and adapter**

The WorkSession pointer uses:

```ts
{
  workbenchCode: "product_selection",
  routeContext: { kind: "product_selection.v1", handoffId },
  subjectRef: { kind: "product_initiative_handoff", id: handoffId },
  draftRef: decisionDraft
    ? { kind: "product_initiative_decision_draft", id: decisionDraft.draftId }
    : null,
  domainVersionSeen: initiative?.version ?? 0,
  activeItemKey: activeGapPanel,
  contextMode: activeGapPanel,
}
```

Do not add WorkSession status to the responsibility band or decision conclusion; it stays in the PageHeader switcher.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
pnpm --filter @logix/web test -- src/api/marketSignals.test.ts src/composables/useProductInitiativeDecision.test.ts src/views/ProductSelectionWorkbench.test.ts
pnpm --filter @logix/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Product Selection adapter**

```powershell
git add -- apps/web/src/api/marketSignals.ts apps/web/src/api/marketSignals.test.ts apps/web/src/composables/useProductInitiativeDecision.ts apps/web/src/composables/useProductInitiativeDecision.test.ts apps/web/src/views/ProductSelectionWorkbench.vue apps/web/src/views/ProductSelectionWorkbench.test.ts
git commit -m "feat(product-selection): resume typed decision drafts"
```

---

### Task 8: Connect Stuffing as the No-Draft Boundary Consumer

**Files:**

- Modify: `apps/web/src/views/StuffingWorkbench.vue`
- Modify: `apps/web/src/views/StuffingWorkbench.test.ts`
- Modify: `apps/web/src/components/stuffing/StuffingActionPanel.vue`
- Modify: `apps/web/src/components/stuffing/StuffingSnapshotForm.vue`
- Modify: `apps/web/src/components/stuffing/StuffingSnapshotForm.test.ts`

**Interfaces:**

- Produces: Stuffing `WorkSessionAdapter` with `supportsServerDraft: false`, dirty reporting, discard/reset, and target reread/version validation.
- Consumes: existing formal Stuffing APIs, Task 5 adapter protocol, Task 6 switcher.

- [ ] **Step 1: Write failing form and page tests**

Test dirty state against the hydrated snapshot baseline, reset/discard, post-save clean state, and truthful switch choices:

```ts
await wrapper.get("input[name='sealNumber']").setValue("NEW-SEAL");
expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([true]);
expect(wrapper.text()).not.toContain("保存草稿并切换");
expect(wrapper.text()).toContain("在新标签页打开目标");
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
pnpm --filter @logix/web test -- src/components/stuffing/StuffingSnapshotForm.test.ts src/views/StuffingWorkbench.test.ts
```

Expected: FAIL because dirty/discard and switcher adapter wiring are absent.

- [ ] **Step 3: Expose form dirty/reset protocol**

`StuffingSnapshotForm` emits `dirty-change`, exposes a reset method, and only clears dirty after props reflect the newly persisted snapshot. It must not write the form to browser or server session storage.

- [ ] **Step 4: Connect PageHeader switcher and target validation**

The target validator rereads the formal container/task/snapshot endpoints, verifies tenant/object access through those APIs, compares `snapshot.version` with `domainVersionSeen`, then allows activation. New-tab mode uses a normal same-origin route built by the closed RouteContext codec and marks the source session `browser_held`; it never copies form inputs.

- [ ] **Step 5: Run focused regression tests**

```powershell
pnpm --filter @logix/web test -- src/components/stuffing src/composables/useStuffingCommands.test.ts src/views/StuffingWorkbench.test.ts
pnpm --filter @logix/web typecheck
```

Expected: PASS; existing versioned snapshot and actual-time behavior unchanged.

- [ ] **Step 6: Commit Stuffing adapter**

```powershell
git add -- apps/web/src/views/StuffingWorkbench.vue apps/web/src/views/StuffingWorkbench.test.ts apps/web/src/components/stuffing/StuffingActionPanel.vue apps/web/src/components/stuffing/StuffingSnapshotForm.vue apps/web/src/components/stuffing/StuffingSnapshotForm.test.ts
git commit -m "feat(stuffing): protect unsaved session input"
```

---

### Task 9: Real Browser Evidence, Full Verification, and Review

**Files:**

- Create: `apps/web/e2e/support/recoverableWorkSessions.ts`
- Create: `apps/web/e2e/recoverable-work-sessions.spec.ts`
- Create: `apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/**`
- Modify: `docs/planning/tasks/recoverable-work-sessions-v1.md`
- Modify: `docs/superpowers/plans/2026-10-14-recoverable-work-sessions.md`

**Interfaces:**

- Produces: automated and visual evidence for the final brief.
- Consumes: all prior tasks.

- [ ] **Step 1: Write browser tests before taking baselines**

Cover both real consumers at all configured projects:

1. Product Selection dirty → neutral save → switch → refresh → resume exact gap/right mode.
2. Product Selection draft save failure → route/current/local fields unchanged.
3. Product Selection stale target → conflict copy and no stale action restoration.
4. Stuffing dirty → stay.
5. Stuffing dirty → discard and switch.
6. Stuffing dirty → open target in new tab; original tab retains local form and shows `仅此标签保留`.
7. Concurrent tab activation → exactly one current after focus/visibility refresh.
8. 403/404 target reread → source unchanged.
9. Keyboard open/navigate/close/focus restoration.
10. No page/pane horizontal overflow at `1440×900`, `1024×768`, `390×844`.

- [ ] **Step 2: Run E2E structurally before snapshots**

```powershell
pnpm --filter @logix/web test:e2e -- e2e/recoverable-work-sessions.spec.ts --grep-invert "visual"
```

Expected: PASS.

- [ ] **Step 3: Capture and manually inspect visual evidence**

Capture at least:

- Product Selection: menu open, draft saved, target conflict at all three viewports.
- Stuffing: dirty-choice dialog and `browser_held` status at all three viewports.
- One representative dark-mode desktop state.

Use `toHaveScreenshot()` only after manual inspection confirms: identity/purpose stable, responsibility visible, one current label, truthful draft status, no repeated state text, actions not obscured, recovery entry visible, no horizontal overflow.

- [ ] **Step 4: Run affected module gates**

```powershell
pnpm contract:check
pnpm contract:drift
pnpm data-dictionary:check
pnpm db:generate
pnpm --filter @logix/api lint
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api test
pnpm --filter @logix/api test:integration
pnpm --filter @logix/api build
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web test
pnpm --filter @logix/web test:e2e -- e2e/recoverable-work-sessions.spec.ts
pnpm --filter @logix/web build
pnpm repo:check
pnpm workbench-purposes:check
pnpm exec prettier --check docs/planning/tasks/recoverable-work-sessions-v1.md docs/superpowers/plans/2026-10-14-recoverable-work-sessions.md
```

Expected: all task-owned checks PASS. If `repo:check` still reports only pre-existing `.superpowers/sdd/**` link failures, record the exact output and do not claim it passed.

- [ ] **Step 5: Run one complete final gate**

With PostgreSQL and browser available:

```powershell
pnpm validate
```

Expected: PASS. If blocked solely by previously documented unowned temporary copies, keep the final task status at `review`/`blocked` as appropriate and record the exact unrelated failure; do not delete those paths.

- [ ] **Step 6: Run fresh Claude read-only high-risk review**

Review the full `merge-base(main, HEAD)...HEAD` diff against this brief, the approved UI design, database migration safety, auth/tenant/actor isolation, Product Initiative neutral-save semantics, Stuffing no-draft truthfulness, and three-viewport evidence. Record each finding in the brief and disposition as `accepted`, `rejected`, or `pending-owner` with evidence.

- [ ] **Step 7: Commit final evidence and fixes**

```powershell
git add -- apps/web/e2e/recoverable-work-sessions.spec.ts apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots apps/web/e2e/support/recoverableWorkSessions.ts docs/planning/tasks/recoverable-work-sessions-v1.md docs/superpowers/plans/2026-10-14-recoverable-work-sessions.md
git commit -m "test(work-session): verify recoverable sessions end to end"
```

- [ ] **Step 8: Integrate through one PR**

Push `feat/recoverable-work-sessions-v1`, create one PR, wait for required CI, fix only verified findings, merge after green checks, sync local `main`, and update the brief to `done` with PR/CI/merge evidence. If the platform denies external writes, stop at the verified local branch and report that exact blocker without using another tool to bypass it.
