# Universal Workbench Layout Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first delivery unit of the universal workbench standard: neutral layout primitives, an executable visual contract, and verified migrations of Product Selection and Market Signals without changing their domain semantics.

**Architecture:** Add a domain-neutral `WorkbenchLayout` pattern layer below existing workbench views and above the theme adapter. Pages keep all queue priority, facts, progress denominators, allowed actions, ownership, and state-machine rules; they provide those values through typed props and slots. A DEV-only reference surface consumes the same production primitives and supplies stable synthetic fixtures for structural and pixel regression, while Product Selection and Market Signals prove the abstraction against two different real consumers.

**Tech Stack:** Vue 3.5, TypeScript 5.6, Vue Router 4.5, Vitest 2.1, Vue Test Utils 2.4, Playwright 1.55, existing Logix theme tokens and repository policy scripts.

**Spec:** `docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md`

**Implementation Brief:** `docs/planning/tasks/universal-workbench-layout-standard-v1.md`

## Global Constraints

- Do not change the existing color system, theme identity, light/dark behavior, fonts, or design tokens.
- Do not import `themes/*` from business views or generic workbench components.
- The stable order is `PageHeader → responsibility context → decision strip → queue + detail + context`.
- Business state may change slot content; it may not remove panes, change pane order, change grid width, or replace the workbench identity.
- At `1440×900`, all three panes fill the remaining desktop height and have one controlled vertical scroll owner each.
- At `1024×768`, the left queue is a rail/drawer and detail remains adjacent to the right context pane.
- At `390×844`, queue, detail, and editing are explicit screens in that causal order; do not stack all three into one long page.
- Left and right rail collapse is user-controlled layout state only; business state never collapses a rail.
- Shared components must not compute progress denominators, permissions, ownership, completion, responsibility transfer, or allowed actions.
- Current Product Selection progress is `N/5`; current Market Signals evidence completeness is `N/6` or its own text status. The prototype's `N/8` is not a current domain contract.
- PageHeader `switcher` and `moreFunctions` are named presentation slots only in this unit. Do not implement WorkSession, persist UI sessions, or display empty production controls.
- “More functions” means a separately specified linked business surface, not right-pane tools.
- The right pane deepens the current task; it does not host a complete linked sub-feature page.
- Keep copy concise. Use Toptip/Tooltip only for non-decisive explanation; disabled reasons, failures, conflicts, and recovery remain inline.
- The reference surface is DEV/test-only, permanently marked as synthetic, absent from navigation, and performs no production API requests.
- Visual baselines supplement structural assertions and human review; they never prove business correctness by themselves.
- This plan does not implement resumable work sessions, task dossiers, collaboration conversations, AI orchestration, or any concrete “more functions” feature.
- When Codex is the slice implementer, every task stops at `ready-for-review` with uncommitted changes and a `HANDOFF`; the main agent runs the listed commit command only after reviewing the diff and fresh verification evidence. Under native execution, the main agent performs both implementation and checkpoint commits.

## Review Focus

1. **Unknown or non-numeric progress** — a consumer may provide text status or omit progress entirely; shared components must render it without inventing `/8`, a percentage, or `0` (Task 2 tests).
2. **Closed/read-only object selected after an active object** — responsibility, three panes, widths, and PageHeader identity stay stable while detail/context content becomes read-only (Tasks 7 and 8 tests).
3. **Narrow content width after the 64px application sidebar is applied** — `1024×768` must still keep detail and context adjacent while the queue becomes a rail/drawer (Tasks 3 and 6 tests).
4. **Existing form state during mobile screen changes and rail folding** — hidden panes stay mounted; selected item, draft values, pane scroll, and focus restore after navigation (Tasks 3, 6, and 7 tests).
5. **Reference route in production or reference fixture imported by production views** — production build has no reference route and repository checks reject forbidden imports or a missing screenshot suite (Tasks 5 and 6 tests).

---

## File Structure

### Governance and authority

- Modify `docs/product/UI_SYSTEM.md` — concise normative rules for the stable workbench shell, viewport behavior, collapsible rails, and visual contract.
- Modify `docs/planning/tasks/universal-workbench-layout-standard-v1.md` — slice state, evidence, and handoff record for this implementation only.

### Shared workbench pattern layer

- Create `apps/web/src/components/workbench/workbenchLayout.types.ts` — domain-neutral pane, mobile-screen, responsibility, pane-state, and visual-tone types.
- Create `apps/web/src/components/workbench/WorkbenchPane.vue` and `.test.ts` — pane header/body, one scroll owner, ARIA, and loading/empty/error/receipt rendering.
- Create `apps/web/src/components/workbench/WorkbenchResponsibilityBand.vue` and `.test.ts` — ordered known/unknown/not-applicable responsibility facts.
- Create `apps/web/src/components/workbench/WorkbenchDecisionStrip.vue` and `.test.ts` — conclusion plus raw progress/gap/action slots; no denominator or action computation.
- Create `apps/web/src/components/workbench/CollapsibleRail.vue` and `.test.ts` — controlled left/right rail, drawer behavior, keyboard close, and focus return.
- Create `apps/web/src/components/workbench/WorkbenchLayout.vue` and `.test.ts` — stable region order, full-height geometry, responsive screen control, rail state, and focus/scroll restoration.
- Modify `apps/web/src/components/workbench/WorkbenchPageHeader.vue` and `.test.ts` — named `switcher` and `moreFunctions` slots while preserving generated identity and transitional `actions` compatibility.
- Modify `apps/web/src/components/workbench/RoleWorkbenchFrame.vue` and `.test.ts` — retain container-specific content but delegate generic geometry to `WorkbenchLayout`.

### Executable visual contract

- Create `apps/web/src/reference/universal-workbench/referenceScenarios.ts` — fixed, synthetic, non-sensitive scenario values.
- Create `apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.vue` and `.test.ts` — interactive standard board using only production primitives.
- Create `apps/web/src/reference/universal-workbench/UniversalWorkbenchLinkedFeatureReferenceView.vue` — independent linked-feature surface proving “more functions” opens a new page.
- Create `apps/web/src/modules/reference/routes.ts` — DEV-only reference routes.
- Modify `apps/web/src/modules/registry.ts` — include the reference route contribution only in DEV/test builds.

### Visual and policy gates

- Create `apps/web/e2e/support/universalWorkbenchReference.ts` — reference URL, region helpers, overflow/geometry capture, and deterministic screenshot options.
- Create `apps/web/e2e/universal-workbench-reference.visual.spec.ts` — structural, interaction, accessibility, no-API, and pixel-regression tests.
- Create `apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/**` — tracked baselines generated only after human approval.
- Use existing `apps/web/playwright.config.ts` unchanged — its desktop, narrow, and mobile projects already match the visual contract; screenshot tolerance stays local to the dedicated visual spec.
- Modify `scripts/check-repository.mjs` and `scripts/check-repository.test.mjs` — require the DEV-only route boundary, screenshot suite, scenario coverage, and forbid production imports of reference fixtures.

### Real consumers

- Modify `apps/web/src/views/ProductSelectionWorkbench.vue` and `.test.ts` — consume shared structure, preserve real `N/5`, move the review editor to the right contextual pane, and retain every domain rule.
- Modify `apps/web/e2e/product-selection-workbench.spec.ts` — assert the shared regions and capture real-consumer three-viewport evidence.
- Modify `apps/web/src/views/MarketSignalsWorkbench.vue` and `.test.ts` — consume shared structure, retain `N/6`/validation status, and keep the right pane in archived/voided states.
- Modify `apps/web/e2e/workbench-network.spec.ts` — replace the obsolete “closed action pane absent” assertion with stable-shell/read-only-context assertions.

## Shared Interfaces

`apps/web/src/components/workbench/workbenchLayout.types.ts` will define exactly:

```ts
export type WorkbenchPaneId = "queue" | "detail" | "context";
export type WorkbenchMobileScreen = WorkbenchPaneId;
export type WorkbenchTone = "neutral" | "info" | "ok" | "warn" | "risk";

export interface WorkbenchResponsibilityItem {
  label: string;
  value: string | null;
  state: "known" | "unknown" | "not-applicable";
}

export type WorkbenchPaneState =
  | { kind: "ready" }
  | { kind: "loading"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; traceId?: string }
  | { kind: "receipt"; message: string };
```

Progress, gaps, and actions intentionally remain slots. A `WorkbenchDecisionStrip` must accept arbitrary consumer-rendered progress such as `3/5`, `4/6`, `验证待安排`, or no progress block at all.

---

### Task 1: Lock Governance and UI Authority

**Files:**

- Modify: `docs/planning/tasks/universal-workbench-layout-standard-v1.md`
- Modify: `docs/product/UI_SYSTEM.md:144-173`

**Interfaces:**

- Consumes: approved design at `docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md`.
- Produces: normative workbench layout rules and the exact active brief scopes used by the UI write hook.

- [ ] **Step 1: Change the implementation brief to active coding state**

Set these frontmatter fields without widening any scope:

```yaml
status: coding
branch: worktree-universal-workbench-ui-standard
owner: main
writer: codex
risk: medium
```

Keep all five UI arrays non-empty. Keep the five exclusive delivery units separate; this brief owns only the layout unit.

- [ ] **Step 2: Add the concise normative section to UI_SYSTEM**

After `### 5.2 角色工作台的因果结构`, add `### 5.3 通用办理布局契约` containing these enforceable rules:

```markdown
- 固定顺序为 PageHeader → 责任上下文 → 决策条 → 队列/详情/操作上下文。
- 通用布局只拥有几何、滚动、折叠、焦点和响应式；结论、分母、缺口、权限、责任和动作均由消费者提供。
- 桌面三栏占满头部以下剩余高度；每栏只有一个主纵向滚动容器。
- 1440 三栏并列；1024 左窄轨且中右并列；390 使用队列→详情→编辑分屏。
- 状态切换不得删除栏位、改变栏宽或替换正式身份。
- 参考页必须消费生产原语；版本化截图、结构断言和人工核对同批交付。
```

Link the approved design rather than copying its full text.

- [ ] **Step 3: Run docs and policy checks**

Run:

```powershell
pnpm exec prettier --write docs/product/UI_SYSTEM.md docs/planning/tasks/universal-workbench-layout-standard-v1.md
pnpm exec prettier --check docs/product/UI_SYSTEM.md docs/planning/tasks/universal-workbench-layout-standard-v1.md
pnpm repo:check
```

Expected: all commands exit `0`; the UI structure gate recognizes one active owner for every declared Vue path.

- [ ] **Step 4: Commit the governance boundary**

```powershell
git add -- docs/product/UI_SYSTEM.md docs/planning/tasks/universal-workbench-layout-standard-v1.md
git diff --cached --check
git commit -m "docs(ui): activate workbench layout standard"
```

---

### Task 2: Build the Domain-Neutral Presentation Primitives

**Files:**

- Create: `apps/web/src/components/workbench/workbenchLayout.types.ts`
- Create: `apps/web/src/components/workbench/WorkbenchPane.vue`
- Create: `apps/web/src/components/workbench/WorkbenchPane.test.ts`
- Create: `apps/web/src/components/workbench/WorkbenchResponsibilityBand.vue`
- Create: `apps/web/src/components/workbench/WorkbenchResponsibilityBand.test.ts`
- Create: `apps/web/src/components/workbench/WorkbenchDecisionStrip.vue`
- Create: `apps/web/src/components/workbench/WorkbenchDecisionStrip.test.ts`

**Interfaces:**

- Consumes: existing theme tokens from the active theme through CSS variables.
- Produces: the exact types above plus three presentational components used by Task 3 and both consumers.

- [ ] **Step 1: Write the types and failing responsibility-band tests**

Create the types file with the exact `WorkbenchPaneId`, `WorkbenchMobileScreen`, `WorkbenchTone`, `WorkbenchResponsibilityItem`, and `WorkbenchPaneState` definitions from this plan.

Create a test that proves unknown values are not rendered as zero:

```ts
it("renders known, unknown, and not-applicable responsibility facts without defaults", () => {
  const wrapper = mount(WorkbenchResponsibilityBand, {
    props: {
      ariaLabel: "岗位、对象与责任上下文",
      items: [
        { label: "当前对象", value: "机会 A", state: "known" },
        { label: "下一责任", value: null, state: "unknown" },
        { label: "等待对象", value: null, state: "not-applicable" },
      ],
    },
  });

  expect(wrapper.text()).toContain("机会 A");
  expect(wrapper.text()).toContain("未知");
  expect(wrapper.text()).toContain("不适用");
  expect(wrapper.text()).not.toContain("0");
});
```

- [ ] **Step 2: Run the responsibility test and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchResponsibilityBand.test.ts
```

Expected: FAIL because `WorkbenchResponsibilityBand.vue` does not exist.

- [ ] **Step 3: Implement WorkbenchResponsibilityBand minimally**

Use a semantic region and ordered definition list:

```vue
<script setup lang="ts">
import type { WorkbenchResponsibilityItem } from "./workbenchLayout.types";

defineProps<{
  ariaLabel: string;
  items: readonly WorkbenchResponsibilityItem[];
}>();

const displayValue = (item: WorkbenchResponsibilityItem) =>
  item.state === "known"
    ? item.value
    : item.state === "unknown"
      ? "未知"
      : "不适用";
</script>

<template>
  <section class="responsibility-band" :aria-label="ariaLabel">
    <dl>
      <div v-for="item in items" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ displayValue(item) }}</dd>
      </div>
    </dl>
    <slot name="tail" />
  </section>
</template>
```

Style only with existing tokens. Important facts remain text; do not hide them in tooltips.

- [ ] **Step 4: Write failing decision-strip pass-through tests**

```ts
it.each([
  ["segments", "3/8"],
  ["status", "验证待安排"],
  ["absent", ""],
])("passes through %s progress without inventing content", (_, progress) => {
  const wrapper = mount(WorkbenchDecisionStrip, {
    props: { conclusion: "办理中", ariaLabel: "当前结论与办理缺口" },
    slots: progress ? { progress } : {},
  });

  expect(wrapper.text()).toContain("办理中");
  if (progress) expect(wrapper.text()).toContain(progress);
  if (!progress) {
    expect(wrapper.text()).not.toContain("/");
    expect(wrapper.text()).not.toContain("%");
  }
});

it("emits a gap activation and keeps the disabled reason inline", async () => {
  const wrapper = mount(WorkbenchDecisionStrip, {
    props: {
      conclusion: "当前门槛未满足",
      ariaLabel: "当前结论与办理缺口",
      disabledReason: "还缺价格带证据",
    },
    slots: { gaps: '<button data-gap="pricing">价格带证据</button>' },
  });
  await wrapper.get('[data-gap="pricing"]').trigger("click");
  expect(wrapper.text()).toContain("还缺价格带证据");
});
```

- [ ] **Step 5: Run the decision-strip tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchDecisionStrip.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 6: Implement WorkbenchDecisionStrip minimally**

Define props and slots:

```ts
const props = withDefaults(
  defineProps<{
    conclusion: string;
    ariaLabel: string;
    tone?: WorkbenchTone;
    disabledReason?: string;
  }>(),
  { tone: "neutral", disabledReason: undefined },
);

defineSlots<{
  conclusionDetail?(): unknown;
  progress?(): unknown;
  gaps?(): unknown;
  action?(): unknown;
}>();
```

Render conclusion, then optional progress, gaps, and exactly one action slot. Render `disabledReason` inline with `role="status"`; never calculate progress.

- [ ] **Step 7: Write failing WorkbenchPane state tests**

```ts
it.each(["loading", "empty", "error", "receipt"] as const)(
  "renders the %s state while preserving the pane heading",
  (kind) => {
    const state =
      kind === "error"
        ? { kind, message: "没能加载", traceId: "trace-1" }
        : { kind, message: `${kind}-message` };
    const wrapper = mount(WorkbenchPane, {
      props: {
        id: "detail-pane",
        title: "事实、缺口与推进任务",
        ariaLabel: "事实、缺口与推进任务",
        state,
      },
    });
    expect(wrapper.get("h2").text()).toBe("事实、缺口与推进任务");
    expect(wrapper.text()).toContain(state.message);
  },
);
```

Add a retry test that expects one `retry` emit and an ARIA region test.

- [ ] **Step 8: Run the pane tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchPane.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 9: Implement WorkbenchPane minimally**

The component must always render a fixed header and one `.workbench-pane__scroll` body. `ready` renders the default slot; `loading`, `empty`, `error`, and `receipt` render their own slots or concise defaults. Only `error` renders a retry button, and only when a retry listener exists.

- [ ] **Step 10: Run all primitive tests and static checks**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchResponsibilityBand.test.ts src/components/workbench/WorkbenchDecisionStrip.test.ts src/components/workbench/WorkbenchPane.test.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
```

Expected: all tests and checks pass.

- [ ] **Step 11: Commit the presentation primitives**

```powershell
git add -- apps/web/src/components/workbench/workbenchLayout.types.ts apps/web/src/components/workbench/WorkbenchPane.vue apps/web/src/components/workbench/WorkbenchPane.test.ts apps/web/src/components/workbench/WorkbenchResponsibilityBand.vue apps/web/src/components/workbench/WorkbenchResponsibilityBand.test.ts apps/web/src/components/workbench/WorkbenchDecisionStrip.vue apps/web/src/components/workbench/WorkbenchDecisionStrip.test.ts
git diff --cached --check
git commit -m "feat(ui): add workbench presentation primitives"
```

---

### Task 3: Implement the Stable Layout and Collapsible Rails

**Files:**

- Create: `apps/web/src/components/workbench/CollapsibleRail.vue`
- Create: `apps/web/src/components/workbench/CollapsibleRail.test.ts`
- Create: `apps/web/src/components/workbench/WorkbenchLayout.vue`
- Create: `apps/web/src/components/workbench/WorkbenchLayout.test.ts`

**Interfaces:**

- Consumes: `WorkbenchPaneId`, `WorkbenchMobileScreen`, `WorkbenchPane`, and slots from Task 2.
- Produces: controlled `leftCollapsed`, `rightCollapsed`, and `mobileScreen` models plus stable layout slots used by all later tasks.

- [ ] **Step 1: Write failing rail tests**

```ts
it("folds and restores focus only after an explicit user action", async () => {
  const wrapper = mount(CollapsibleRail, {
    attachTo: document.body,
    props: {
      side: "left",
      collapsed: false,
      label: "任务队列",
      summary: "当前机会 · 2 待办",
      "onUpdate:collapsed": (value: boolean) =>
        wrapper.setProps({ collapsed: value }),
    },
    slots: { default: '<button id="inside">队列内容</button>' },
  });

  await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
  expect(wrapper.emitted("update:collapsed")?.[0]).toEqual([true]);
  expect(wrapper.text()).toContain("当前机会 · 2 待办");
  await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
  expect(document.activeElement).toBe(wrapper.get("#inside").element);
});
```

Add tests for the right side, Escape closing drawer mode, and no automatic event after an unrelated prop update.

- [ ] **Step 2: Run the rail tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/CollapsibleRail.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement CollapsibleRail as a controlled component**

Use this contract:

```ts
interface Props {
  side: "left" | "right";
  collapsed: boolean;
  label: string;
  summary?: string;
  mode?: "rail" | "drawer";
}

const emit = defineEmits<{
  "update:collapsed": [value: boolean];
  opened: [];
  closed: [];
}>();
```

Keep the body mounted and hide it with CSS/`hidden` plus `inert` behavior, rather than destroying slot state with `v-if`. Store the last focused descendant before folding and focus it after reopening when still connected.

- [ ] **Step 4: Write failing WorkbenchLayout stability tests**

Mount all slots with stable markers and verify order and presence:

```ts
it("keeps identity, responsibility, decision, and all three panes in stable order", () => {
  const wrapper = mount(WorkbenchLayout, {
    props: {
      leftCollapsed: false,
      rightCollapsed: false,
      mobileScreen: "queue",
      leftRailLabel: "任务队列",
      rightRailLabel: "操作上下文",
    },
    slots: {
      header: '<div data-region="header">header</div>',
      responsibility: '<div data-region="responsibility">responsibility</div>',
      decision: '<div data-region="decision">decision</div>',
      queue: '<div data-region="queue">queue</div>',
      detail: '<div data-region="detail">detail</div>',
      context: '<div data-region="context">context</div>',
    },
  });

  expect(
    wrapper
      .findAll("[data-region]")
      .map((node) => node.attributes("data-region")),
  ).toEqual([
    "header",
    "responsibility",
    "decision",
    "queue",
    "detail",
    "context",
  ]);
});
```

Add tests that:

- update slot text from active to read-only without changing region count/order;
- fold left, fold right, and fold both without removing pane DOM;
- change `mobileScreen` queue → detail → context and retain a typed input value in a hidden pane;
- return focus to the selected detail item after context → detail.

- [ ] **Step 5: Run the layout tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchLayout.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 6: Implement WorkbenchLayout with exact slot and model contracts**

Use:

```ts
const props = withDefaults(
  defineProps<{
    leftCollapsed?: boolean;
    rightCollapsed?: boolean;
    mobileScreen?: WorkbenchMobileScreen;
    leftRailLabel: string;
    rightRailLabel: string;
    leftRailSummary?: string;
    rightRailSummary?: string;
  }>(),
  {
    leftCollapsed: false,
    rightCollapsed: false,
    mobileScreen: "queue",
    leftRailSummary: undefined,
    rightRailSummary: undefined,
  },
);

const emit = defineEmits<{
  "update:leftCollapsed": [value: boolean];
  "update:rightCollapsed": [value: boolean];
  "update:mobileScreen": [value: WorkbenchMobileScreen];
  restoreFocus: [pane: WorkbenchPaneId];
}>();
```

Slots are exactly `header`, `responsibility`, `decision`, `queue`, `queueRail`, `detail`, `context`, `contextRail`, and optional `mobileBreadcrumb`.

CSS responsibilities:

- top-level uses `min-height: 0` and grid rows `auto auto auto minmax(0, 1fr)`;
- desktop workspace uses three columns and a bounded available height inherited from `.app-content`;
- each pane/rail fills the workspace row;
- at the narrow breakpoint, left becomes a rail and detail/context stay in one row;
- at mobile, all panes remain mounted but only the active screen is perceivable/interactive;
- no literal colors, font sizes, or off-scale spacing.

- [ ] **Step 7: Run layout and rail tests**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/CollapsibleRail.test.ts src/components/workbench/WorkbenchLayout.test.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
```

Expected: all checks pass.

- [ ] **Step 8: Commit the layout core**

```powershell
git add -- apps/web/src/components/workbench/CollapsibleRail.vue apps/web/src/components/workbench/CollapsibleRail.test.ts apps/web/src/components/workbench/WorkbenchLayout.vue apps/web/src/components/workbench/WorkbenchLayout.test.ts
git diff --cached --check
git commit -m "feat(ui): add stable workbench layout"
```

---

### Task 4: Integrate PageHeader and Preserve Container Consumers

**Files:**

- Modify: `apps/web/src/components/workbench/WorkbenchPageHeader.vue`
- Modify: `apps/web/src/components/workbench/WorkbenchPageHeader.test.ts`
- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.vue`
- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts`

**Interfaces:**

- Consumes: `WorkbenchLayout`, `WorkbenchPane`, and generated workbench identity.
- Produces: named PageHeader slots and a backward-compatible container adapter, proving existing consumers need not migrate together.

- [ ] **Step 1: Write failing PageHeader slot-priority tests**

Extend the stub to render named slots and add:

```ts
it("renders switcher and more-functions slots without changing generated identity", () => {
  const wrapper = mount(WorkbenchPageHeader, {
    props: { stageCode: "product_selection" },
    slots: {
      switcher: '<button aria-label="切换工作现场">切换</button>',
      moreFunctions: '<button aria-label="更多关联功能">更多功能</button>',
      actions: '<button aria-label="旧动作">旧动作</button>',
    },
    global: { stubs: { PageHeader: PageHeaderStub } },
  });

  expect(wrapper.get("h1").text()).toBe("选品立项");
  expect(wrapper.find('[aria-label="切换工作现场"]').exists()).toBe(true);
  expect(wrapper.find('[aria-label="更多关联功能"]').exists()).toBe(true);
  expect(wrapper.find('[aria-label="旧动作"]').exists()).toBe(false);
});
```

This locks the transitional rule: named slots win; legacy `actions` only renders when both named slots are absent.

- [ ] **Step 2: Run the header test and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchPageHeader.test.ts
```

Expected: FAIL because the named slots are not defined or forwarded.

- [ ] **Step 3: Implement named slots without changing the theme contract**

Add `switcher`, `moreFunctions`, and transitional `actions` to `defineSlots`. Compose the two named slots inside the existing PageHeader `actions` slot. Do not modify `components/ui/PageHeader.vue`, `ui-theme/contracts.ts`, or Logix theme files.

- [ ] **Step 4: Write failing RoleWorkbenchFrame compatibility tests**

Add assertions that:

- queue, primary, and secondary regions remain mounted when `contextReady` is false;
- the no-selection message appears in detail/context slots rather than deleting panes;
- existing `selectedContainer`, `nodes`, warning, and context slots still render;
- responsive layout is delegated to `WorkbenchLayout` and the component no longer owns `.workbench-grid`.

Example:

```ts
it("keeps all three information responsibilities before a container is selected", () => {
  const wrapper = mountRoleFrame({
    contextReady: false,
    selectedContainer: null,
  });
  expect(wrapper.findAll('[data-workbench-pane="queue"]')).toHaveLength(1);
  expect(wrapper.findAll('[data-workbench-pane="detail"]')).toHaveLength(1);
  expect(wrapper.findAll('[data-workbench-pane="context"]')).toHaveLength(1);
  expect(wrapper.text()).toContain("从左侧任务队列选择一项工作");
});
```

- [ ] **Step 5: Run RoleWorkbenchFrame tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/RoleWorkbenchFrame.test.ts
```

Expected: FAIL because the current component deletes detail and secondary panes when no context exists.

- [ ] **Step 6: Refactor RoleWorkbenchFrame into a container adapter**

Keep container-only responsibilities in this file:

- `ContainerSummary`, `LiveNodeView`, and `LiveNodeRail`;
- workspace/node labels;
- container identity;
- selection errors and projection warnings.

Wrap those values into `WorkbenchResponsibilityBand`, then supply queue/detail/context through `WorkbenchLayout` and `WorkbenchPane`. For no selection, keep all panes mounted and render the existing empty message in detail and a concise “选择对象后显示动作” context state.

- [ ] **Step 7: Run all compatibility tests**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchPageHeader.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts
pnpm --filter @logix/web typecheck
```

Expected: all checks pass; no existing consumer API changes.

- [ ] **Step 8: Commit the header and compatibility adapter**

```powershell
git add -- apps/web/src/components/workbench/WorkbenchPageHeader.vue apps/web/src/components/workbench/WorkbenchPageHeader.test.ts apps/web/src/components/workbench/RoleWorkbenchFrame.vue apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts
git diff --cached --check
git commit -m "refactor(ui): adapt role workbenches to shared layout"
```

---

### Task 5: Build the Executable Reference Surface

**Files:**

- Create: `apps/web/src/reference/universal-workbench/referenceScenarios.ts`
- Create: `apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.vue`
- Create: `apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts`
- Create: `apps/web/src/reference/universal-workbench/UniversalWorkbenchLinkedFeatureReferenceView.vue`
- Create: `apps/web/src/modules/reference/routes.ts`
- Modify: `apps/web/src/modules/registry.ts`

**Interfaces:**

- Consumes: all production primitives and named PageHeader slots from Tasks 2–4.
- Produces: a deterministic DEV/test-only route used by Task 6; no runtime API dependency.

- [ ] **Step 1: Create fixed synthetic scenarios**

Define:

```ts
export type ReferenceScenarioKey =
  "working" | "waiting" | "failed" | "conflict" | "readonly" | "dirty-session";

export interface ReferenceScenario {
  key: ReferenceScenarioKey;
  conclusion: string;
  progressLabel?: string;
  responsibility: readonly WorkbenchResponsibilityItem[];
  detailTitle: string;
  detailBody: readonly string[];
  contextTitle: string;
  contextBody: readonly string[];
  disabledReason?: string;
}
```

Each exported scenario uses fixed ISO timestamps, explicit versions, and the visible notice `合成结构演练数据，不是生产记录`. `failed` includes an error code and trace ID; `conflict` includes seen/server versions; `readonly` includes frozen result and next responsibility. Exactly one synthetic session has `current: true`.

- [ ] **Step 2: Write failing reference-view tests**

```ts
it("renders every required visual-contract scenario with production primitives", async () => {
  const wrapper = mount(UniversalWorkbenchReferenceView, {
    global: { plugins: [router] },
  });

  expect(wrapper.text()).toContain("合成结构演练数据，不是生产记录");
  for (const key of ["working", "waiting", "failed", "conflict", "readonly"]) {
    await wrapper.get(`[data-scenario="${key}"]`).trigger("click");
    expect(wrapper.get('[aria-label="岗位、对象与责任上下文"]').exists()).toBe(
      true,
    );
    expect(wrapper.get('[aria-label="当前结论与办理缺口"]').exists()).toBe(
      true,
    );
    expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
  }
});
```

Add tests for left/right/both folding, right editing and return, exactly one current session, the more-functions menu not changing the right-pane mode, and zero calls to a mocked fetch/API client.

- [ ] **Step 3: Run reference-view tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
```

Expected: FAIL because the reference view and scenarios do not exist.

- [ ] **Step 4: Implement the reference view using only production primitives**

The view may style scenario controls and the synthetic notice, but it must not define grid columns, pane geometry, theme colors, workbench card chrome, or breakpoints. Those come only from shared primitives.

The reference PageHeader renders synthetic `switcher` and `moreFunctions` slots. Those controls are explicitly marked as contract demonstrations, not active production capabilities.

- [ ] **Step 5: Implement the independent linked-feature reference page**

Create a second page with its own PageHeader and visible source references:

```text
来源工作台：选品立项
来源对象：合成机会 REF-001
来源事项：品类定义
```

It must not appear inside the right pane. It proves that selecting a reference “more function” navigates to a separate surface.

- [ ] **Step 6: Register routes only in DEV/test**

`apps/web/src/modules/reference/routes.ts`:

```ts
import type { RouteRecordRaw } from "vue-router";

export const referenceRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: "/__reference/universal-workbench",
        component: () =>
          import("../../reference/universal-workbench/UniversalWorkbenchReferenceView.vue"),
        meta: { title: "通用工作台结构参考" },
      },
      {
        path: "/__reference/universal-workbench/linked-feature",
        component: () =>
          import("../../reference/universal-workbench/UniversalWorkbenchLinkedFeatureReferenceView.vue"),
        meta: { title: "关联子功能结构参考" },
      },
    ]
  : [];
```

Spread `referenceRoutes` in `moduleRouteContributions`. Do not add `navLabel`, `navIcon`, or a workbench directory entry.

- [ ] **Step 7: Run reference tests and production build**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web build
```

Expected: tests and build pass; production route registration is an empty array.

- [ ] **Step 8: Commit the executable reference surface**

```powershell
git add -- apps/web/src/reference/universal-workbench apps/web/src/modules/reference/routes.ts apps/web/src/modules/registry.ts
git diff --cached --check
git commit -m "feat(ui): add workbench layout reference"
```

---

### Task 6: Establish Structural and Pixel Visual Gates

**Files:**

- Create: `apps/web/e2e/support/universalWorkbenchReference.ts`
- Create: `apps/web/e2e/universal-workbench-reference.visual.spec.ts`
- Create: `apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/**`
- Use unchanged: `apps/web/playwright.config.ts` — keep the existing three viewport projects; screenshot tolerance stays local to the dedicated visual spec.
- Modify: `scripts/check-repository.mjs`
- Modify: `scripts/check-repository.test.mjs`

**Interfaces:**

- Consumes: DEV reference routes and stable ARIA/test IDs from Task 5.
- Produces: tracked visual baselines and repository rules that later consumer tasks must preserve.

- [ ] **Step 1: Write failing repository-policy tests**

Add fixtures to `scripts/check-repository.test.mjs` proving that checks fail when:

- the reference route has `navLabel` or is unconditional;
- a production view imports from `src/reference/universal-workbench`;
- the visual spec contains no `toHaveScreenshot`;
- any required scenario key (`working`, `waiting`, `failed`, `conflict`, `readonly`) is missing.

Example assertion:

```js
assert.match(
  result.stderr,
  /reference route must be DEV-only and absent from navigation/i,
);
```

- [ ] **Step 2: Run repository-policy tests and verify red**

Run:

```powershell
node --test scripts/check-repository.test.mjs
```

Expected: FAIL because the new visual-contract checks do not exist.

- [ ] **Step 3: Implement the minimal static gate**

Extend `check-repository.mjs` to inspect exact reference and spec paths. It should check source structure only; it must not duplicate browser geometry checks.

- [ ] **Step 4: Write the Playwright structural tests before baselines**

Use these exact test names:

```ts
test("reference page preserves the standard region order at all three viewports", ...);
test("desktop rails fold independently and together without losing full height", ...);
test("right-side editing preserves the selected item and restores focus on return", ...);
test("business states change pane content without changing workbench identity or geometry", ...);
test("session switching keeps exactly one current session and does not move it on save failure", ...);
test("more functions opens an independent referenced page instead of replacing the right pane", ...);
test("mobile moves explicitly from queue to detail to editing and restores scroll and focus", ...);
test("keyboard order follows queue detail action causality and reduced motion is honored", ...);
test("reference page matches the representative dark-theme baseline", ...);
test("reference page performs no production API requests", ...);
```

`apps/web/e2e/support/universalWorkbenchReference.ts` exports:

```ts
export const referencePath = "/__reference/universal-workbench";
export const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
};
export async function captureLayout(page: Page): Promise<LayoutEvidence>;
export async function expectNoWorkbenchOverflow(page: Page): Promise<void>;
```

Abort and record all `**/api/**` requests; any request fails the reference-page test.

- [ ] **Step 5: Run structural E2E and verify failures are meaningful**

Run:

```powershell
pnpm --filter @logix/web exec playwright test e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
```

Expected before snapshots: structural tests pass, screenshot assertions fail because baselines do not exist. Any geometry failure must be fixed before creating baselines.

- [ ] **Step 6: Generate candidate baselines**

After structural assertions pass, run:

```powershell
pnpm --filter @logix/web exec playwright test e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1 --update-snapshots
```

Expected: 19 Windows PNG baselines are created: three default, three edit, one mobile detail, and 12 representative desktop states including rails, waiting, failed, conflict, readonly, session menu/switch, more-functions/linked-feature, and dark mode.

- [ ] **Step 7: Perform the mandatory human screenshot review**

Open every generated PNG and record pass/finding in the implementation brief for:

- first-screen causal order;
- stable workbench purpose;
- responsibility visibility;
- one clear primary action and inline disabled reason;
- no card wall, duplicated state, training copy, or invented AI text;
- stable geometry across working/waiting/failed/conflict/readonly;
- desktop full-height and independent scroll;
- narrow detail/context adjacency;
- mobile explicit screens and unobscured action;
- meaningful collapsed rails;
- dark-mode hierarchy;
- synthetic-data labeling;
- “more functions” opening an independent page.

Do not update a rejected baseline; fix the component and regenerate only after the finding is resolved.

- [ ] **Step 8: Re-run visual and policy gates without update mode**

Run:

```powershell
pnpm --filter @logix/web exec playwright test e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
node --test scripts/check-repository.test.mjs
pnpm repo:check
```

Expected: all pass against committed baselines.

- [ ] **Step 9: Commit the executable visual contract**

```powershell
git add -- apps/web/e2e/support/universalWorkbenchReference.ts apps/web/e2e/universal-workbench-reference.visual.spec.ts apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots scripts/check-repository.mjs scripts/check-repository.test.mjs docs/planning/tasks/universal-workbench-layout-standard-v1.md
git diff --cached --check
git commit -m "test(ui): lock workbench visual contract"
```

---

### Task 7: Migrate Product Selection as the First Consumer

**Files:**

- Modify: `apps/web/src/views/ProductSelectionWorkbench.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.test.ts`
- Modify: `apps/web/e2e/product-selection-workbench.spec.ts`

**Interfaces:**

- Consumes: all shared primitives and visual gates.
- Produces: the first real consumer, preserving current `N/5`, gap navigation, outcome rules, and read-only semantics.

- [ ] **Step 1: Add failing structure and real-progress tests**

Extend `ProductSelectionWorkbench.test.ts`:

```ts
it("keeps the shared workbench regions and the real five-area progress", async () => {
  const wrapper = await mountAcceptedOpportunity();
  expect(wrapper.get('[aria-label="岗位、对象与责任上下文"]').exists()).toBe(
    true,
  );
  expect(wrapper.get('[aria-label="当前结论与办理缺口"]').text()).toContain(
    "/5",
  );
  expect(wrapper.get('[aria-label="当前结论与办理缺口"]').text()).not.toContain(
    "/8",
  );
  expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
});
```

Add tests that:

- selecting `review_points` moves `ProductInitiativeReviewPanel` into the context pane;
- returning from the editor restores focus to the selected gap;
- working → return-pending → handed-off → legacy-read-only keeps region order and three panes;
- the existing domain events and submit payloads are unchanged.

- [ ] **Step 2: Run the Product Selection tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/views/ProductSelectionWorkbench.test.ts
```

Expected: FAIL because the page does not use shared ARIA regions and the review editor remains in the detail pane.

- [ ] **Step 3: Replace only the outer layout**

In `ProductSelectionWorkbench.vue`:

- keep all script/composable/domain computed values;
- map current object/result/owner values to `WorkbenchResponsibilityBand`;
- move `progress-head` and `ProductInitiativeGapGroup` into `WorkbenchDecisionStrip` slots;
- preserve `progressFilled / requiredCount` exactly, currently `/5`;
- wrap existing queue, detail, and context content in shared panes;
- remove local `.work-context`, `.workbench-grid`, pane geometry, sticky, and responsive layout CSS;
- retain domain-specific density and outcome/editor styles.

- [ ] **Step 4: Move the review editor to the context pane**

When `activeGapPanel === "review_points"`, render `ProductInitiativeReviewPanel` in the right context pane. The detail pane retains facts, gap navigation, result snapshot, and professional evidence. Other outcome editor panels remain in `ProductInitiativeOutcomePanel`, also in the context pane.

Do not move validation, payload construction, or submit decisions into shared components.

- [ ] **Step 5: Run Product Selection unit tests**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/views/ProductSelectionWorkbench.test.ts src/composables/useProductInitiativeDecision.test.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
```

Expected: all pass; current domain tests remain unchanged.

- [ ] **Step 6: Add real-consumer E2E structure assertions**

In `product-selection-workbench.spec.ts`, retain all existing purpose/state assertions and add:

- standard six-region order;
- real `/5`, never `/8`;
- right editor after gap activation;
- 1440 full-height panes and no page overflow;
- 1024 queue rail with detail/context adjacency;
- 390 queue → detail → edit screen flow;
- historical, return-pending, and frozen states preserve the same shell.

Save run diagnostics under Playwright `test-results`, not repository `.tmp`.

- [ ] **Step 7: Run Product Selection in all viewports plus visual contract**

Run:

```powershell
pnpm --filter @logix/web exec playwright test e2e/product-selection-workbench.spec.ts e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
```

Expected: all pass; reference snapshots do not change.

- [ ] **Step 8: Capture and review real-consumer screenshots**

Attach Product Selection working and frozen views at all three viewports to the Playwright run. Manually verify no duplicate status, wrong denominator, card wall, hidden disabled reason, or editor detached from its selected gap. Record the six screenshot results in the brief.

- [ ] **Step 9: Commit the first consumer**

```powershell
git add -- apps/web/src/views/ProductSelectionWorkbench.vue apps/web/src/views/ProductSelectionWorkbench.test.ts apps/web/e2e/product-selection-workbench.spec.ts docs/planning/tasks/universal-workbench-layout-standard-v1.md
git diff --cached --check
git commit -m "refactor(product-selection): adopt shared workbench layout"
```

---

### Task 8: Migrate Market Signals and Remove the Closed-Mode Geometry Split

**Files:**

- Modify: `apps/web/src/views/MarketSignalsWorkbench.vue`
- Modify: `apps/web/src/views/MarketSignalsWorkbench.test.ts`
- Modify: `apps/web/e2e/workbench-network.spec.ts`

**Interfaces:**

- Consumes: shared primitives and visual contract.
- Produces: a semantically different second consumer that preserves `N/6`/validation status and proves closed states retain the stable shell.

- [ ] **Step 1: Replace obsolete closed-mode assertions with failing stable-shell assertions**

Change the existing test around `MarketSignalsWorkbench.test.ts:1195`:

```ts
it("keeps responsibility and a read-only context pane for voided signals", async () => {
  const wrapper = await mountSignal({ currentDestination: "voided" });

  expect(wrapper.get('[aria-label="岗位、对象与责任上下文"]').exists()).toBe(
    true,
  );
  expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
  expect(wrapper.get('[aria-label="当前事项操作上下文"]').text()).toContain(
    "已作废关闭",
  );
  expect(
    wrapper.get('[aria-label="当前事项操作上下文"]').find("input").exists(),
  ).toBe(false);
  expect(
    wrapper.get('[aria-label="当前事项操作上下文"]').find("textarea").exists(),
  ).toBe(false);
  expect(wrapper.get('[aria-label="当前事项操作上下文"]').text()).not.toContain(
    "提交判断",
  );
});
```

Add an active → archived/voided round-trip test comparing region count/order and asserting that the PageHeader title/purpose do not change.

- [ ] **Step 2: Run the Market tests and verify red**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/views/MarketSignalsWorkbench.test.ts
```

Expected: FAIL because closed mode currently replaces responsibility and deletes the action pane.

- [ ] **Step 3: Migrate Market Signals to the shared shell**

In `MarketSignalsWorkbench.vue`:

- retain queue grouping, paging, partial retry, drafts, validation owner, return handling, receipts, and service calls;
- provide its own current `N/6` completeness or validation text to the decision slot;
- always render `WorkbenchResponsibilityBand`;
- move closed conclusion content to the decision strip;
- always render the context pane;
- for closed signals, render `MarketSignalDecisionPanel` in its existing closed/read-only branch or an equivalent read-only context with frozen conclusion, responsibility, and available next entry;
- remove `.market-workbench--closed`, `.workbench-grid--closed`, local workbench geometry, and responsive CSS;
- preserve `MarketSignalEvidencePanel :closed="isClosed"` so supplement controls remain unavailable.

- [ ] **Step 4: Run Market unit tests and domain regressions**

Run:

```powershell
pnpm --filter @logix/web exec vitest run src/views/MarketSignalsWorkbench.test.ts src/data/marketSignalEvidenceFlow.test.ts
pnpm --filter @logix/web lint
pnpm --filter @logix/web typecheck
```

Expected: all pass; archived/voided remain read-only and three-pane.

- [ ] **Step 5: Update the existing network E2E assertion**

Replace `信号处理动作` count `0` assertions with:

- context pane count `1`;
- frozen/closed label visible;
- no writable inputs or decision CTA;
- grid geometry unchanged from active state;
- responsibility still visible.

Do not widen the large network spec with the reference-page screenshot matrix.

- [ ] **Step 6: Run Market and reference E2E in all viewports**

Run:

```powershell
pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
```

Expected: all pass; reference snapshots do not change.

- [ ] **Step 7: Capture and review real-consumer screenshots**

Attach Market working and archived/voided views at all three viewports. Manually verify its progress/status remains distinct from Product Selection, closed mode keeps the right pane, and no write controls survive. Record the six results in the brief.

- [ ] **Step 8: Commit the second consumer**

```powershell
git add -- apps/web/src/views/MarketSignalsWorkbench.vue apps/web/src/views/MarketSignalsWorkbench.test.ts apps/web/e2e/workbench-network.spec.ts docs/planning/tasks/universal-workbench-layout-standard-v1.md
git diff --cached --check
git commit -m "refactor(market-signals): stabilize workbench layout"
```

---

### Task 9: Integrate, Verify, and Prepare Independent Review

**Files:**

- Modify: `docs/planning/tasks/universal-workbench-layout-standard-v1.md`
- Verify all files listed in the implementation brief.

**Interfaces:**

- Consumes: completed Tasks 1–8.
- Produces: one reviewable branch with complete evidence and no scope expansion.

- [ ] **Step 1: Run targeted unit suites**

```powershell
pnpm --filter @logix/web exec vitest run src/components/workbench/WorkbenchPane.test.ts src/components/workbench/WorkbenchResponsibilityBand.test.ts src/components/workbench/WorkbenchDecisionStrip.test.ts src/components/workbench/CollapsibleRail.test.ts src/components/workbench/WorkbenchLayout.test.ts src/components/workbench/WorkbenchPageHeader.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts src/views/ProductSelectionWorkbench.test.ts src/views/MarketSignalsWorkbench.test.ts
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run repository policy tests and checks**

```powershell
node --test scripts/check-repository.test.mjs
pnpm repo:check
pnpm workbench-purposes:check
```

Expected: all pass; the reference route is DEV-only and all active brief scopes remain valid.

- [ ] **Step 3: Run Web static and unit gates**

```powershell
pnpm --filter @logix/web lint
pnpm --filter @logix/web format:check
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web test
pnpm --filter @logix/web build
```

Expected: all exit `0`.

- [ ] **Step 4: Run the dedicated visual contract in all viewports**

```powershell
pnpm --filter @logix/web exec playwright test e2e/universal-workbench-reference.visual.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
```

Expected: all structural, interaction, no-API, and screenshot tests pass against tracked baselines.

- [ ] **Step 5: Run affected real-consumer E2E in all viewports**

```powershell
pnpm --filter @logix/web exec playwright test e2e/product-selection-workbench.spec.ts e2e/workbench-network.spec.ts --project=desktop-chromium --project=narrow-chromium --project=mobile-chromium --workers=1
```

Expected: all affected business paths pass.

- [ ] **Step 6: Perform the final manual visual review**

Review all 19 reference baselines and the 12 real-consumer evidence screenshots. Record each as `pass` or a concrete finding in the brief. Required checks:

```text
identity and purpose
responsibility and deadline visibility
causal order
real progress denominator
single primary action and inline disabled reason
stable states and geometry
full-height scroll ownership
narrow adjacency
mobile screen flow
rail semantics
failure/conflict recovery
dark-theme readability
synthetic-data labeling
linked feature opens independently
```

Do not declare completion while any screenshot finding remains unresolved.

- [ ] **Step 7: Check scope and secrets**

```powershell
git diff --name-only 58d34d406eb916fa12983e390093db692bc265c7...HEAD
git diff --check 58d34d406eb916fa12983e390093db692bc265c7...HEAD
git status --short
```

Expected: every changed path is declared by the implementation brief; no generated logs, `.tmp`, credentials, unrelated refactors, or untracked evidence remain.

- [ ] **Step 8: Update the brief to ready-for-review**

Record exact commands, counts, screenshot review results, exceptions, and current commit. Change task state to `review` only after all required local evidence is present.

- [ ] **Step 9: Commit verification records**

```powershell
git add -- docs/planning/tasks/universal-workbench-layout-standard-v1.md
git diff --cached --check
git commit -m "docs(ui): record workbench layout verification"
```

- [ ] **Step 10: Request fresh independent review**

Provide the reviewer this pointer only:

```text
TASK docs/planning/tasks/universal-workbench-layout-standard-v1.md#L5-market-consumer-and-integration base=58d34d406eb916fa12983e390093db692bc265c7 role=reviewer workspace=D:\Logixs\.claude\worktrees\universal-workbench-ui-standard mode=worktree-diff
```

The fresh reviewer must return `logix-review/v1`, make no writes, and focus on:

- business-state leakage into shared components;
- layout stability across state and viewport;
- Product Selection `N/5` and Market `N/6` truthfulness;
- closed-state context and action safety;
- reference-route production exclusion;
- visual baseline integrity and missing human evidence.

- [ ] **Step 11: Dispose findings before PR preparation**

For each finding, write `accepted`, `rejected`, or `pending-owner` with evidence and an existing brief/spec/UI_SYSTEM writeback. Only accepted, written-back findings enter a fix slice. After findings are cleared, rerun only the gates affected by the fixes, plus the final screenshot suite when visual behavior changed.

---

## Implementation Notes

- Do not delete the repository's 40 existing orphaned `visual-layout.spec.ts-snapshots` in this plan. Their cleanup is separate maintenance and not needed to establish the new active contract.
- Do not add a global state library. Layout state is controlled component state in Unit 1; persisted WorkSession state belongs to Unit 2.
- Do not create a common business DTO for Product Selection and Market Signals. Their different denominators and state semantics are evidence that the shared boundary is visual and structural only.
- Do not migrate the other 21 workbenches in this branch. `RoleWorkbenchFrame` compatibility proves existing container consumers can continue while later business slices migrate deliberately.
- Do not add actual PageHeader switcher or more-functions controls to production consumers until those capabilities have approved contracts. Their reference-page rendering is synthetic and clearly labeled.
