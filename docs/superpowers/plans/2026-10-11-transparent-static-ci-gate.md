# Transparent Static CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the shared checkout calibration and deterministic progress-board drift check into the existing non-scheduled CI static job, then complete one final verified/reviewed integration of the transparent-development task.

**Architecture:** Add one source-level workflow contract test that exercises `.github/workflows/ci.yml` as data and proves event routing plus command order without executing GitHub Actions. The static job keeps its existing repository and format gates, runs task calibration only for PRs with explicit base/head/branch identity, uses merge-base mode for manual dispatch, and never runs task calibration on scheduled jobs because the static job remains skipped there. After the workflow change, the whole branch receives one complete local gate, one fresh read-only Claude review, one PR/CI integration, and brief closeout.

**Tech Stack:** GitHub Actions YAML, Node.js 20+ ESM, built-in `node:test`, existing `task-brief-state.mjs` CLI, existing deterministic board generator/checker, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md` §10

**Implementation Brief:** `docs/planning/tasks/transparent-development-calibration-v1.md#切片-tdc4-static-ci-gate`

## Global Constraints

- The task brief remains the only writable implementation carrier; CI consumes derived facts and never writes task state.
- Modify only `.github/workflows/ci.yml`, the focused workflow contract test, the board loader/check tests required for synthetic PR identity, `package.json` test registration if required, and the existing brief/plan evidence.
- Keep `permissions: contents: read`; do not add secrets, write tokens, external services, deployment, GitHub API calls, or new jobs.
- `static` remains skipped for `schedule`; scheduled dependency/dictionary behavior stays unchanged.
- PR calibration must receive and verify explicit base SHA, head SHA, and head branch from `github.event.pull_request`.
- `workflow_dispatch` must use the checked-out branch and default merge-base behavior; it must not fabricate PR event fields.
- `repo:check`, `calibration:check`, `board:check`, and `format:check` are read-only in CI.
- Calibration runs after `repo:check` and before `board:check` / `format:check`, so failure output points first to task/checkout contradictions.
- Do not change production validation, unit, build, E2E, dictionary, security, or quality aggregation semantics.
- Do not touch or attribute `.claude/worktrees/`, `.tmp/`, `apps/api/.tmp/`, or `apps/ai-service/.pytest_cache`.

## Review Focus

1. **PR synthetic checkout identity** — CI must pass base/head/head-branch explicitly and the CLI must verify both SHAs; a wrong merge commit must not be calibrated silently.
2. **Manual dispatch without PR payload** — static must still run read-only calibration using the checked-out branch and merge-base rather than empty PR environment values.
3. **Scheduled event** — the static job and task calibration remain skipped; existing scheduled dependency/dictionary checks continue unchanged.
4. **Command ordering and write boundary** — `repo:check` precedes calibration, `board:check` follows it, and no `board:build` or other writer enters static.
5. **Workflow expression drift** — branch identity must come from `github.event.pull_request.head.ref`, not `github.ref`, `github.head_ref` fallback guessing, or shell-computed defaults.

---

### Task 1: Pin the Static Workflow Contract

**Files:**

- Create: `scripts/check-ci-workflow.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `.github/workflows/ci.yml` text and root script names `repo:check`, `calibration:check`, `board:check`, `format:check`.
- Produces: a source-level contract test that fails if PR/manual/schedule routing, explicit identities, command order, or the read-only boundary drift.

- [ ] **Step 1: Write the failing workflow contract tests**

Create `scripts/check-ci-workflow.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

const staticJob =
  workflow.match(/\n  static:\n([\s\S]*?)\n  unit:\n/)?.[1] ?? "";

const indexOfCommand = (command) => {
  const index = staticJob.indexOf(command);
  assert.notEqual(index, -1, `static job is missing ${command}`);
  return index;
};

test("static job calibrates PR head identity before board and format checks", () => {
  assert.match(staticJob, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
  assert.match(
    staticJob,
    /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(
    staticJob,
    /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  );
  assert.match(
    staticJob,
    /HEAD_BRANCH: \$\{\{ github\.event\.pull_request\.head\.ref \}\}/,
  );
  assert.match(
    staticJob,
    /pnpm calibration:check -- --ci --base "\$env:BASE_SHA" --head "\$env:HEAD_SHA" --branch "\$env:HEAD_BRANCH"/,
  );

  const order = [
    "pnpm repo:check",
    "pnpm calibration:check",
    "pnpm board:check",
    "pnpm format:check",
  ].map(indexOfCommand);
  assert.deepEqual(
    order,
    order.slice().sort((left, right) => left - right),
  );
  assert.doesNotMatch(
    staticJob,
    /board:build|git\s+(checkout|reset|clean|stash|add|commit|push|merge)\b/,
  );
});

test("static job uses merge-base calibration for manual dispatch only", () => {
  assert.match(
    staticJob,
    /if \(\$env:EVENT_NAME -eq "pull_request"\)[\s\S]*?--ci[\s\S]*?else[\s\S]*?pnpm calibration:check/,
  );
  assert.match(workflow, /static:\n\s+if: github\.event_name != 'schedule'/);
  assert.match(
    workflow,
    /schedule:[\s\S]*?dependencies = \$true[\s\S]*?dictionary = \$true/,
  );
});
```

Modify the root `test` command to include `scripts/check-ci-workflow.test.mjs` next to the other repository-governance tests.

- [ ] **Step 2: Run RED**

Run:

```powershell
node --test scripts/check-ci-workflow.test.mjs
```

Expected: FAIL because the static job currently runs only `repo:check` and `format:check` and lacks explicit PR identity/calibration/board steps.

- [ ] **Step 3: Prove the new test itself is formatted and lintable**

Run:

```powershell
pnpm exec prettier --check scripts/check-ci-workflow.test.mjs package.json
pnpm exec eslint scripts/check-ci-workflow.test.mjs
```

Expected: both pass after applying scoped Prettier if needed. Do not weaken assertions to match the old workflow.

---

### Task 2: Support Synthetic PR Identity in Board Check

**Files:**

- Modify: `scripts/build-progress-board.mjs`
- Modify: `scripts/build-progress-board.test.mjs`

**Interfaces:**

- Consumes: optional `BASE_SHA`, `HEAD_SHA`, and `HEAD_BRANCH` environment values already required by calibration CI mode.
- Produces: `loadProgressBoardData({ calibrationIdentity })`, where an explicit identity is forwarded to `observeCheckout({ base, head, branch })`; board check continues to render stable task/finding semantics while treating the locally present unowned-untracked warning as volatile checkout evidence.

- [ ] **Step 1: Add failing synthetic-identity tests**

Add a dependency-injected loader test that records Git calls and proves explicit `base/head/branch` avoid `branch --show-current`, verify both SHAs, and resolve the active brief. Add a check-normalization test proving changing only `TASK_UNOWNED_UNTRACKED_PRESENT` count/evidence does not cause drift, while changing `TASK_BRANCH_MISMATCH` or any other blocking finding code still does.

- [ ] **Step 2: Run RED**

```powershell
node --test --test-name-pattern "synthetic PR|unowned untracked" scripts/build-progress-board.test.mjs
```

Expected: FAIL because the loader does not accept explicit calibration identity and warning markup is currently outside the checkout volatile block.

- [ ] **Step 3: Implement the minimal identity and warning boundary**

Extend the loader input with:

```js
calibrationIdentity = {},
```

Call:

```js
const observation = observeCheckout({
  ...calibrationIdentity,
  git: (args) => git(args),
});
```

In default dependencies, map `BASE_SHA`, `HEAD_SHA`, and `HEAD_BRANCH` only when all three are present; otherwise pass `{}`. Move only the rendered `TASK_UNOWNED_UNTRACKED_PRESENT` item into the existing `VOLATILE_CALIBRATION` checkout block (or omit that one warning from stable findings after its count/path track is rendered there). All blocking finding codes and non-checkout warnings stay outside the marker.

- [ ] **Step 4: Run GREEN and regenerate**

```powershell
node --test scripts/build-progress-board.test.mjs scripts/task-brief-state.test.mjs
pnpm board:build
pnpm board:check
pnpm exec eslint scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs
pnpm exec prettier --check scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs docs/planning/progress-board.html
```

Expected: all pass; a clean synthetic PR identity and the local dirty checkout normalize to the same checkable stable content, while stable task/finding drift remains detectable.

- [ ] **Step 5: Commit the CI-safe board check**

```powershell
git add -- scripts/build-progress-board.mjs scripts/build-progress-board.test.mjs docs/planning/progress-board.html
git diff --cached --check
git commit -m "fix(governance): calibrate board against CI head"
```

---

### Task 3: Wire Read-Only Calibration into the Static Job

**Files:**

- Modify: `.github/workflows/ci.yml:108-125`
- Test: `scripts/check-ci-workflow.test.mjs`

**Interfaces:**

- Consumes: `pnpm calibration:check -- --ci --base SHA --head SHA --branch NAME` for PRs; `pnpm calibration:check` for manual dispatch; `pnpm board:check` for deterministic artifact drift.
- Produces: one `static` job whose event-specific calibration is explicit, read-only, and ordered between repository policy and deterministic board/format checks.

- [ ] **Step 1: Add the minimal static-job environment and calibration step**

In `.github/workflows/ci.yml`, add static-job environment:

```yaml
env:
  EVENT_NAME: ${{ github.event_name }}
  BASE_SHA: ${{ github.event.pull_request.base.sha }}
  HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}
```

Replace the two existing static check steps after install with:

```yaml
- run: pnpm repo:check
- name: Calibrate task checkout
  shell: pwsh
  run: |
    if ($env:EVENT_NAME -eq "pull_request") {
      pnpm calibration:check -- --ci --base "$env:BASE_SHA" --head "$env:HEAD_SHA" --branch "$env:HEAD_BRANCH"
    } else {
      pnpm calibration:check
    }
- run: pnpm board:check
- run: pnpm format:check
```

Do not change any other job.

- [ ] **Step 2: Run GREEN workflow tests**

Run:

```powershell
node --test scripts/check-ci-workflow.test.mjs scripts/task-brief-state.test.mjs scripts/build-progress-board.test.mjs
```

Expected: all workflow, calibration CLI, and board tests pass.

- [ ] **Step 3: Run local event-equivalent commands**

Manual-dispatch equivalent:

```powershell
pnpm repo:check
pnpm calibration:check
pnpm board:check
```

PR equivalent against the task's approved base/current head:

```powershell
$head = git rev-parse HEAD
pnpm calibration:check -- --ci --base 7c7f084b --head $head --branch docs/transparent-development-calibration-v1
```

Expected: all exit `0`; only `TASK_UNOWNED_UNTRACKED_PRESENT` may appear locally as a warning. The CI check uses clean checkout semantics and does not read untracked contents.

- [ ] **Step 4: Run static validation**

```powershell
pnpm exec prettier --check .github/workflows/ci.yml scripts/check-ci-workflow.test.mjs package.json
pnpm exec eslint scripts/check-ci-workflow.test.mjs
pnpm repo:check
pnpm docs:check
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 5: Commit the static CI gate**

```powershell
git add -- .github/workflows/ci.yml scripts/check-ci-workflow.test.mjs package.json
git diff --cached --check
git commit -m "ci(governance): calibrate static delivery state"
```

---

### Task 4: Verify the Whole Branch and Record Final Local Evidence

**Files:**

- Modify: `docs/planning/tasks/transparent-development-calibration-v1.md`
- Verify: all task-owned paths since `5deb703b`

**Interfaces:**

- Consumes: completed parser/calibration/board/CI slices.
- Produces: exact pre-review evidence, with overall status moved to `review` only after all local code gates are green or an explicitly scoped external formatting blocker is recorded.

- [ ] **Step 1: Run the full configured local gate once**

Start required infrastructure, then run:

```powershell
pnpm infra:up
pnpm validate
```

Expected: configured repository, contract, data dictionary, generation, lint, formatting, typecheck, unit, integration, E2E, and build gates pass. If the known unreadable `apps/ai-service/.pytest_cache` alone blocks `format:check`, preserve it untouched, run exact tracked/task-owned Prettier plus every remaining `validate` stage explicitly, and record that one external blocker by path and exit code; do not claim root `validate` passed.

- [ ] **Step 2: Run final task calibration and board check after the full gate**

```powershell
$head = git rev-parse HEAD
pnpm calibration:check -- --brief docs/planning/tasks/transparent-development-calibration-v1.md --base 5deb703b
pnpm calibration:check -- --ci --base 5deb703b --head $head --branch docs/transparent-development-calibration-v1
pnpm board:check
```

Expected: both calibration modes and the board check exit `0`; tracked out-of-scope count is `0`.

- [ ] **Step 3: Check actual scope and secrets**

```powershell
git diff --name-only 5deb703b...HEAD
git diff --check 5deb703b...HEAD
git status --short
```

Expected: every tracked path is in this brief's `writeScopes`; `.claude/worktrees/`, `.tmp/`, and `apps/api/.tmp/` remain untracked/unowned; no credentials, logs, screenshots, or temporary review files are staged.

- [ ] **Step 4: Record local completion evidence and move to review**

In the existing brief:

- check the CI static gate and local automated/visual verification acceptance rows;
- set `status: review` only after the final local evidence is recorded;
- append exact test counts, calibration base/head, four path counts, board check, full gate result, any external-only blocker, TDC3 viewport evidence, and current commit;
- state that remote PR/CI and fresh review remain not-observed until Task 5.

Run:

```powershell
pnpm exec prettier --write docs/planning/tasks/transparent-development-calibration-v1.md
pnpm docs:check
git add -- docs/planning/tasks/transparent-development-calibration-v1.md
git diff --cached --check
git commit -m "docs(governance): prepare calibration task review"
```

---

### Task 5: Fresh Whole-Branch Review, PR/CI, and Closeout

**Files:**

- Modify after disposition/integration: `docs/planning/tasks/transparent-development-calibration-v1.md`
- Read-only review: every task-owned changed path since merge-base with `main`

**Interfaces:**

- Consumes: the review package, approved spec, all thin plans, current brief, and local verification evidence.
- Produces: `logix-review/v1`, `logix-disposition/v1`, one final PR, required CI evidence, merge, and the completed brief on `main`.

- [ ] **Step 1: Build the whole-branch review package**

Run the executing-plans review-package helper when permitted; otherwise provide the fresh read-only reviewer with:

- merge base `git merge-base origin/main HEAD`;
- current head;
- spec, brief, all three implementation plans;
- complete diff and local gate evidence;
- Review Focus from every plan;
- explicit unknowns: other worktrees and remote PR/CI are not observed by the board.

- [ ] **Step 2: Dispatch one fresh Claude Opus 4.8 read-only review**

The reviewer must return `logix-review/v1`, with evidence-backed findings/unknowns/verification gaps and `writes: none`. Review focus includes parser/scope fail-closed behavior, Git observation, HTML escaping and drift normalization, responsive semantics, workflow event routing, and user-work protection.

- [ ] **Step 3: Disposition findings**

For every finding, write `logix-disposition/v1` as `accepted`, `rejected`, or `pending-owner` with reproduction evidence and authority location. Accepted Critical/Important findings receive one TDD fix pass and full affected-suite rerun. Minor findings are recorded as deferred and do not enter the fix pass. Do not let range-outside refactors or future cross-worktree/GitHub API ideas block this task.

- [ ] **Step 4: Push one task branch and create/update one PR**

```powershell
git push -u origin docs/transparent-development-calibration-v1
gh pr create --base main --head docs/transparent-development-calibration-v1 --title "feat(governance): add transparent delivery calibration" --body-file <prepared-body-path>
```

The PR body states problem, shared projection design, path/user-work safety, board semantics, CI event routing, local evidence, known `.pytest_cache` formatting limitation if still present, rollback, and deferred cross-worktree/remote-integration slices. Do not include temporary evidence files in the commit.

- [ ] **Step 5: Wait for required CI and merge**

Inspect the PR checks with `gh pr checks`. Required checks must be successful; skipped checks are acceptable only where path/event rules require them. Resolve real failures with TDD and push new commits; do not bypass hooks or protections. Merge using the repository's protected PR flow after checks succeed.

- [ ] **Step 6: Synchronize main and close the brief**

After merge, return to the main checkout, fast-forward `main`, and update the existing brief in a follow-up branch/PR only if the merged PR could not already record immutable review/CI links. Final brief closeout must include review verdict/dispositions, PR URL, CI run/check evidence, merge commit, and keep cross-worktree/GitHub API/RAID/automatic dispatch as explicit future work. Set `status: done` only when those references are real and repository checks pass.

- [ ] **Step 7: Final verification on main**

```powershell
pnpm repo:check
pnpm docs:check
pnpm board:check
git status --short
git log -1 --oneline
```

Expected: all read-only gates pass; only pre-existing unowned paths remain; `main` contains the merged task commit and the brief has real completion evidence.

---

## Self-Review

- Spec coverage: §10 CI static routing, §11 user-work protection, §12 workflow/board tests, §13 final review/CI completion, and §14 deferred slices are each owned by Tasks 1–5.
- Placeholder scan: no `TBD`, generic “add tests,” or undefined implementation steps remain; `<prepared-body-path>` is a command-time temporary PR body produced from the stated exact content and is not a repository artifact.
- Type consistency: the plan uses existing CLI arguments `--ci --base --head --branch` and existing `board:check`; no new runtime API is invented.
- Review Focus coverage: PR identity, manual dispatch, schedule skip, command order/write boundary, and branch expression drift each have a board/workflow contract assertion in Tasks 1–2 and a real command or CI check in Tasks 3–5.
