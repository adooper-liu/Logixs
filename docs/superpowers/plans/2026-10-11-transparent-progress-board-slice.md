# Transparent Progress Board Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the current task's declared-versus-observed delivery chain in the existing progress board and add a deterministic, read-only `board:check` without introducing another state source.

**Architecture:** Refactor `scripts/build-progress-board.mjs` from import-time execution into pure load/render/normalize/check functions, while preserving existing module, station, phase, ledger, and gap projections. The builder consumes `task-brief-state.mjs` for task metadata and the current checkout calibration projection, inserts one derived “当前交付薄片” region into the existing static board, and compares deterministic output while normalizing only named volatile metadata/calibration blocks.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, existing static HTML/CSS template, shared `task-brief-state.mjs`, Prettier, browser inspection through the local run workflow.

**Spec:** `docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md` §9

**Implementation Brief:** `docs/planning/tasks/transparent-development-calibration-v1.md#切片-tdc3-visual-vertical-slice`

## Global Constraints

- The task brief and checkout remain the only sources; the board is derived and read-only.
- Reuse `normalizeTaskRecords`, `resolveCurrentTask`, `observeCheckout`, and `buildCalibrationProjection`. Do not add another parser or finding engine.
- `board:build` is the only command allowed to write `docs/planning/progress-board.html`.
- `board:check` must never write and must fail when deterministic content drifts.
- Normalize only named, balanced volatile markers. Never strip arbitrary HTML or entire sections to make a check pass.
- Preserve existing module, fourteen-station, bootstrap-phase, task-ledger, and gap semantics and hierarchy.
- Preserve existing light/dark palette and typography. The calibration section extends the industrial control-board visual language.
- Computed, declared, editorial, and unknown facts must have text/form distinctions, not color alone.
- Desktop order is task → authority/dependencies → checkout/scope → findings/next gate. Mobile keeps that causal order in one column.
- Long paths stay inside their own scroll/wrap container; body must not overflow horizontally.
- The board must display remote PR/CI and other worktrees as `not-observed`, never infer pass/clean.
- Show at most 50 paths per track and always show full counts.
- Do not modify `apps/web`, CI workflow, GitHub settings, RAID/checklist authority, other worktrees, or unrelated local evidence.
- Keep the overall brief `coding`; this slice does not create a PR or trigger final whole-branch review.

## Review Focus

1. **Volatile normalization hides stable drift** — changing task title, finding code, scopes, or deterministic repository sections must fail `board:check`; only explicitly marked branch/head/dirty/current-path blocks may normalize.
2. **HTML injection through brief/path/verification** — every repository-derived string must be escaped before rendering; tests include tags and event attributes.
3. **Large untracked sets** — render total count and first 50 only, with `N more`; do not generate megabyte-scale panels or read file contents.
4. **No active task or unknown base** — board renders an explicit `not-observed` calibration state without crashing or claiming pass.
5. **Phone-width path overflow and status-by-color** — 390px layout stays single-column, path containers own overflow, and fact kind/finding severity remain visible as text.

---

## File Structure

- Modify `scripts/build-progress-board.mjs` — import shared task records, export pure data/render/check functions, support `--check`, and render calibration panel.
- Create `scripts/build-progress-board.test.mjs` — deterministic/volatile/drift/no-write/escaping/truncation/calibration-order tests.
- Modify `scripts/progress-board.template.html` — add calibration placeholder, fact semantics, responsive one-column CSS, path containment.
- Regenerate `docs/planning/progress-board.html` — derived output through `board:build` only.
- Modify `package.json` — add `board:check` and root test entry.
- Modify `docs/planning/tasks/transparent-development-calibration-v1.md` — record TDC3 evidence while keeping `coding`.

## Shared Interfaces

The refactored board module exports:

```js
export function loadProgressBoardData(options) {}
export function renderProgressBoard(data, { template }) {}
export function normalizeCheckableBoard(html) {}
export function renderCalibrationPanel(projection) {}
export async function runBoardCommand(argv, dependencies) {}
```

`loadProgressBoardData` returns the current existing board data plus:

```js
{
  generatedAt,
  commit,
  branch,
  dirty,
  tasks,
  modules,
  stations,
  sections,
  gaps,
  calibration,
}
```

When no task can be resolved safely, `calibration` is:

```js
{
  state: "not-observed",
  reason: "TASK_CURRENT_NOT_FOUND" | "TASK_CURRENT_AMBIGUOUS" | "TASK_BASE_UNKNOWN",
  otherWorktrees: "not-observed",
  remoteIntegration: "not-observed",
}
```

---

### Task 1: Refactor the Board into Pure Load, Render, and Check Functions

**Files:**

- Modify: `scripts/build-progress-board.mjs`
- Create: `scripts/build-progress-board.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: existing board source readers and Task 1–3 shared task-state exports.
- Produces: import-safe `loadProgressBoardData`, `renderProgressBoard`, `normalizeCheckableBoard`, `runBoardCommand`, and root `board:check`.

- [ ] **Step 1: Write failing import-safe and deterministic tests**

Create `scripts/build-progress-board.test.mjs` with a complete compact template fixture containing every current placeholder plus `<!--__CALIBRATION__-->`. Import the four board exports and assert:

```js
test("module import does not write the committed board", async () => {
  const writes = [];
  const result = await runBoardCommand(["--check"], {
    load: () => fixture,
    readTemplate: () => BOARD_TEMPLATE,
    readOutput: () =>
      renderProgressBoard(fixture, { template: BOARD_TEMPLATE }),
    writeOutput: (...args) => writes.push(args),
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(writes, []);
});

test("the same data and template render identical bytes", () => {
  assert.equal(renderFixture(), renderFixture());
});
```

- [ ] **Step 2: Run RED**

```powershell
node --test scripts/build-progress-board.test.mjs
```

Expected: FAIL because the current module writes on import and exports no pure functions.

- [ ] **Step 3: Refactor current top-level loading/rendering without changing stable sections**

Move all repository reads and Git metadata into `loadProgressBoardData({ root, now, git })`. Move template replacement into `renderProgressBoard(data, { template })`. Keep `NODE_INFO`, editorial `gaps`, render helpers, status mappings, and existing placeholders semantically unchanged.

Guard execution with `pathToFileURL` so imports are side-effect-free.

- [ ] **Step 4: Add failing volatile-normalization and drift tests**

Use balanced markers:

```html
<!--VOLATILE_META_START-->...<!--VOLATILE_META_END-->
<!--VOLATILE_CALIBRATION_START-->...<!--VOLATILE_CALIBRATION_END-->
```

Tests must prove:

- generatedAt/commit/branch/head/path observations inside named volatile blocks normalize;
- a changed task title, finding code, module row, or gap outside the markers remains different;
- missing, duplicate, or reversed markers throw a stable error;
- `--check` drift exits `1`, reports `progress board is stale`, and performs zero writes.

- [ ] **Step 5: Implement strict normalization and command modes**

`normalizeCheckableBoard(html)` replaces each complete named block with one canonical marker. It rejects unbalanced or duplicate markers.

`runBoardCommand` behavior:

- no flag: load/render/write output;
- `--check`: load/render/normalize/compare, never write;
- `--deterministic`: fixed generatedAt/commit/branch/dirty for controlled generation;
- unknown flag: exit `2`, no write.

- [ ] **Step 6: Add root command/tests and run GREEN**

Add:

```json
"board:check": "node scripts/build-progress-board.mjs --check"
```

Add `scripts/build-progress-board.test.mjs` to root `test`.

Run:

```powershell
node --test scripts/build-progress-board.test.mjs scripts/task-brief-state.test.mjs
pnpm board:build
pnpm board:check
pnpm exec eslint scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs
pnpm exec prettier --check scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs package.json
```

Expected: all pass; build writes only `docs/planning/progress-board.html`; immediate check performs no write.

- [ ] **Step 7: Commit the checkable generator**

```powershell
git add -- scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs package.json docs/planning/progress-board.html
git diff --cached --check
git commit -m "refactor(governance): make progress board checkable"
```

---

### Task 2: Render the Current Delivery-Slice Panel

**Files:**

- Modify: `scripts/build-progress-board.mjs`
- Modify: `scripts/build-progress-board.test.mjs`
- Modify: `scripts/progress-board.template.html`
- Regenerate: `docs/planning/progress-board.html`

**Interfaces:**

- Consumes: `CalibrationProjection` from `task-brief-state.mjs` and Task 1 pure renderer.
- Produces: `renderCalibrationPanel(projection)` at `<!--__CALIBRATION__-->`.

- [ ] **Step 1: Add failing order, semantic-kind, escaping, and truncation tests**

Fixture projection includes declared task data, one dependency, authorities, each path track, one blocking finding, one warning, and unknown remote/worktree state.

Assert:

- headings appear in task → authority/dependency → checkout → findings → next-gate order;
- `data-fact-kind="declared|computed|unknown|editorial"` all exist;
- raw `<script>`, `<img onerror>`, `&`, quotes, and unsafe path text are escaped;
- 55 unowned paths render total `55`, exactly 50 path rows, and `5 more`;
- finding code and severity text are present independently of color.

- [ ] **Step 2: Add placeholder and verify RED**

Insert before existing module section:

```html
<section id="calibration" aria-labelledby="calibration-title">
  <!--__CALIBRATION__-->
</section>
```

Run tests. Expected: FAIL because renderer leaves the placeholder unresolved.

- [ ] **Step 3: Implement calibration loading and safe fallback**

In `loadProgressBoardData`, use the shared task record loader/resolver/observer/projector. If no unique task or base exists, create the explicit `not-observed` state. Never throw merely because main/detached checkout has no task.

Always set:

```js
otherWorktrees: "not-observed",
remoteIntegration: "not-observed",
```

- [ ] **Step 4: Implement escaped panel renderer**

Render three shared-boundary columns, not a wall of cards:

1. declared task, authority, dependency, scopes;
2. observed branch/base/head and four path tracks;
3. findings, declared verification, unknown remote integration, next gate.

All strings pass through the existing `esc` helper. Empty computed arrays render `none`; unobserved values render `unknown` or `not-observed`.

- [ ] **Step 5: Add responsive semantic CSS**

Use existing tokens only. Wide view uses three columns within one panel boundary. At `max-width: 760px`, stack one column. Fact-kind and severity use visible text labels plus border form; color is secondary. `.cal-paths` owns wrapping/overflow; body does not.

- [ ] **Step 6: Run tests, regenerate, and check drift**

```powershell
node --test scripts/build-progress-board.test.mjs
pnpm board:build
pnpm board:check
pnpm exec prettier --check scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs scripts/progress-board.template.html docs/planning/progress-board.html
```

Expected: all pass, exactly one calibration section, no unresolved placeholder.

- [ ] **Step 7: Commit visual projection**

```powershell
git add -- scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs scripts/progress-board.template.html docs/planning/progress-board.html
git diff --cached --check
git commit -m "feat(governance): visualize current delivery slice"
```

---

### Task 3: Perform Real Board Review and Record TDC3 Evidence

**Files:**

- Modify: `docs/planning/tasks/transparent-development-calibration-v1.md`
- Verify: all TDC3 files

**Interfaces:**

- Consumes: generated board and read-only checks.
- Produces: exact TDC3 evidence; overall task remains `coding` for later CI wiring.

- [ ] **Step 1: Run full focused suites and static checks**

```powershell
node --test scripts/build-progress-board.test.mjs scripts/task-brief-state.test.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
pnpm calibration:check -- --brief docs/planning/tasks/transparent-development-calibration-v1.md --base 7c7f084b
pnpm board:check
pnpm repo:check
pnpm docs:check
pnpm lint
pnpm typecheck
```

Run scoped Prettier for all task-owned tracked paths. Root `format:check` may remain externally blocked only by the known unreadable `.pytest_cache`; do not modify it.

- [ ] **Step 2: Inspect the generated board in a real browser**

Use the repository's run workflow or a local static server. Review:

- 1440×900 light/dark;
- 390×844 light/dark.

Record:

- no body horizontal overflow;
- causal order is clear;
- computed/declared/unknown/editorial distinguishable without color;
- long paths contained;
- unowned paths are warnings, not task failures;
- existing board sections retain hierarchy.

Fix at most one bounded visual pass, then rerun board tests/check and inspect affected views once.

- [ ] **Step 3: Check scope/secrets and write evidence**

```powershell
git diff --name-only 7c7f084b...HEAD
git diff --check 7c7f084b...HEAD
git status --short
```

Append exact counts, board review results, calibration tracks, warnings, and next step `TDC4 CI static wiring`. Keep `status: coding`.

- [ ] **Step 4: Commit TDC3 record**

```powershell
pnpm exec prettier --write docs/planning/tasks/transparent-development-calibration-v1.md
git add -- docs/planning/tasks/transparent-development-calibration-v1.md
git diff --cached --check
git commit -m "docs(governance): record visual calibration slice"
```

Do not create PR or final review. Delete only this plan's SDD workspace after completion.
