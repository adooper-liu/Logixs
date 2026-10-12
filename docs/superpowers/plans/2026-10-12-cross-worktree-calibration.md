# Cross-Worktree Calibration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only local `worktrees:check` command that classifies every Git-registered worktree, reconciles active task declarations with actual Git state, blocks real cross-worktree write conflicts, and leaves dormant or untracked user work untouched.

**Architecture:** `scripts/worktree-calibration.mjs` owns only worktree-registry parsing, per-worktree read-only observation, lifecycle classification, active-task conflict aggregation, reporting, and CLI orchestration. It imports the existing tracked-only brief loader, normalized task model, scope authority, rename-aware checkout observer, and single-checkout projection from `task-brief-state.mjs`; it neither creates another parser nor stores mutable state. The old thin-agent orchestrator brief is renamed and rewritten as the sole task carrier for this narrower Claude-only calibration slice.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, Git CLI through injected argument-array adapters, existing repository-policy scripts, pnpm, Prettier, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md`

**Implementation Brief:** current carrier `docs/planning/tasks/thin-agent-orchestrator-v1.md`; Task 1 renames it to `docs/planning/tasks/cross-worktree-calibration-v1.md`.

## Global Constraints

- Git worktree registration is the only discovery source; never scan `.worktrees/`, `.claude/worktrees/`, sibling directories, or arbitrary filesystem roots for extra worktrees.
- The task brief remains the only writable implementation carrier; do not create a worktree registry, state database, run-spec directory, signals/reviews directory, or mutable JSON/YAML state.
- Keep the current Claude-only role model: the main Claude Code session implements and integrates; one fresh Claude Code session performs final read-only review. Do not revive Codex orchestration, Cursor implementation, process adapters, or automatic TASK/HANDOFF dispatch.
- Read task contents only after `git ls-files -z -- docs/planning/tasks/*.md` positively identifies them as tracked in that worktree. Untracked paths are path-only observations and their contents are never opened.
- Reuse `task-brief-state.mjs` for frontmatter, task normalization, scope overlap, rename-aware checkout observation, and single-checkout findings. Do not duplicate those mechanisms.
- Run only read-only Git commands with executable-plus-argument arrays. Never invoke checkout, reset, clean, stash, add, commit, push, merge, rebase, fetch, pull, or mutating `git worktree` subcommands from calibration code.
- The first release runs only from a local `main`/`master` primary checkout. A non-main primary or tracked-dirty primary blocks; primary untracked paths warn only.
- Dormant policy is fixed: clean and fully merged is informational; clean and ahead warns; tracked dirty without an active brief blocks; untracked paths warn only.
- Cross-task writer/scope/lock conflicts include active `design`, `coding`, and `fix`; `review` is observable but read-only. The coding/fix WIP limit is 2.
- Primary main's tracked task catalog is authoritative for dependency existence and status. A stale worktree copy cannot satisfy a dependency.
- This plan does not integrate with `repo:check`, CI, progress board, hooks, remote GitHub state, or automatic scheduling.
- Never read, format, stage, remove, or attribute existing `.tmp/`, `apps/api/.tmp/`, worktree-local `.tmp/`, screenshots, caches, or other unowned paths.
- A green result proves only local registered-worktree calibration. It does not authorize cleanup, deletion, rebasing, merging, or discarding unmerged commits.

## Review Focus

1. **Git porcelain path bytes and Windows paths** — `worktree list --porcelain -z` entries containing spaces, Chinese characters, drive letters, detached state, lock reasons, and prunable metadata must parse without record bleed or shell reinterpretation. Task 2 pins this.
2. **Untracked poison brief inside a registered worktree** — its path may warn, but no consumer may open it or let its contents influence active-task resolution. Tasks 4 and 5 pin read spies and a real temporary repository.
3. **Stale worktree task versus primary dependency truth** — a worktree-local dependency marked done must still block when primary main says missing or non-done. Task 3 pins both contradictions.
4. **Partial observation failure** — one unreadable non-primary worktree must yield `WORKTREE_READ_FAILED` while preserving the other worktree facts; registry/primary failure must exit `2`, not report a partial pass. Tasks 2, 4, and 5 pin the distinction.
5. **Historical clean worktrees** — fully merged branches must remain informational and clean-ahead branches warning-only; neither may be silently treated as active or make exit code `1`. Tasks 2, 3, and 6 pin fixture and real dry-run behavior.

---

## File Structure

- Git rename `docs/planning/tasks/thin-agent-orchestrator-v1.md` → `docs/planning/tasks/cross-worktree-calibration-v1.md` — sole task carrier, rewritten to current Claude-only governance and this plan's exact scopes/evidence.
- Modify `docs/INDEX.md` — replace the obsolete orchestrator entry with cross-worktree calibration and current state.
- Create `scripts/worktree-calibration.mjs` — porcelain parser, classifier, cross-task conflict projector, read-only adapter, formatter, and CLI.
- Create `scripts/worktree-calibration.test.mjs` — pure unit fixtures, adapter spies, temporary real Git repository/worktree tests, CLI/no-write tests.
- Modify `package.json` — add `worktrees:check` and include the new suite in root `test`.
- Modify `docs/planning/progress-board.html` only when `board:build` is required because the renamed brief changes the committed derived task ledger. No cross-worktree panel is added.
- Modify `docs/planning/tasks/cross-worktree-calibration-v1.md` throughout execution — exact slice evidence, review disposition, PR/CI/merge closeout.

## Shared Interfaces

The new module exports exactly:

```js
export function parseWorktreePorcelain(source) {}
export function classifyWorktree(input) {}
export function buildWorktreeCalibrationProjection(input) {}
export function worktreeCalibrationFindings(projection) {}
export function observeRegisteredWorktrees(options) {}
export function formatWorktreeCalibrationReport(projection) {}
export async function runWorktreeCalibrationCli(argv, dependencies) {}
```

Normalized registry entry:

```js
{
  path: "D:/Logixs/.worktrees/example",
  headSha: "0123456789abcdef0123456789abcdef01234567",
  branch: "feat/example" | null,
  detached: false,
  bare: false,
  locked: false,
  lockReason: null,
  prunable: false,
  pruneReason: null
}
```

Pure observed-worktree input:

```js
{
  registration,
  readable: true,
  readError: null,
  ahead: 1,
  behind: 20,
  fullyMerged: false,
  trackedDirtyPaths: [],
  untrackedPaths: [],
  taskRecords: [],
  activeResolution: { task } | { finding },
  checkoutProjection: null
}
```

`buildWorktreeCalibrationProjection` input:

```js
{
  (primaryPath, mainRef, primaryTaskRecords, observedWorktrees);
}
```

Every path/finding/conflict array is normalized, deduplicated, and stable-sorted.

---

### Task 1: Replace the Obsolete Orchestrator Carrier

**Files:**

- Rename: `docs/planning/tasks/thin-agent-orchestrator-v1.md` → `docs/planning/tasks/cross-worktree-calibration-v1.md`
- Modify: `docs/planning/tasks/cross-worktree-calibration-v1.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/planning/progress-board.html`

**Interfaces:**

- Consumes: current `AGENTS.md` §1.2/§1.3 role mapping, approved spec, completed current-checkout calibration.
- Produces: the only active implementation brief for Tasks 2–6, with exact write scopes, locks, dependency, slices, review boundary, and accepted dormant policy.

- [ ] **Step 1: Create the implementation branch before writing**

Run from synchronized `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/cross-worktree-calibration-v1
```

Expected: branch is `feat/cross-worktree-calibration-v1`; pre-existing untracked `.tmp/` and `apps/api/.tmp/` remain untouched.

- [ ] **Step 2: Rename the existing brief through Git**

```powershell
git mv docs/planning/tasks/thin-agent-orchestrator-v1.md docs/planning/tasks/cross-worktree-calibration-v1.md
```

Expected: Git reports one rename, not an unrelated delete plus untracked copy.

- [ ] **Step 3: Replace obsolete scheduling metadata and scope**

Set the frontmatter to:

```yaml
---
status: coding
branch: feat/cross-worktree-calibration-v1
owner: main
writer: main
risk: high
dependsOn:
  - transparent-development-calibration-v1
writeScopes:
  - docs/planning/tasks/cross-worktree-calibration-v1.md
  - docs/planning/tasks/thin-agent-orchestrator-v1.md
  - docs/INDEX.md
  - docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md
  - docs/superpowers/plans/2026-10-12-cross-worktree-calibration.md
  - scripts/worktree-calibration.mjs
  - scripts/worktree-calibration.test.mjs
  - package.json
  - docs/planning/progress-board.html
exclusiveLocks:
  - repository-governance
  - root-tooling
  - worktree-calibration
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/_template.md
  - docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md
---
```

Rewrite the body so that it:

- names the current main Claude Code session as sole writer;
- names one fresh Claude Code session as final read-only reviewer;
- retains `ORCH-D01` and the 2026-10-01 rows under an explicit “historical superseded direction” heading;
- removes Codex/Cursor runtime roles, manual/process adapters, run-spec/PID/timeout state, and automatic TASK/HANDOFF dispatch from current scope;
- records the selected dormant policy;
- defines CWC1/CWC2/CWC3 exactly as the spec;
- declares that no registered worktree may be cleaned or changed by this task.

- [ ] **Step 4: Update the document index**

Replace the obsolete row in `docs/INDEX.md` with a row whose columns are exactly:

```text
任务：跨 Worktree 只读校准 V1 | 从 Git 注册表校准 active/dormant、实际差异、writer/scope/lock/dependency/WIP | coding（只读本地薄片）
```

Make the first column a Markdown link whose target, relative to `docs/INDEX.md`, is `./planning/tasks/cross-worktree-calibration-v1.md`.

Search for the old path/name:

```powershell
rg -n "thin-agent-orchestrator-v1|多代理薄编排器 V1" docs --glob "*.md"
```

Expected: only the new brief's historical supersession section and approved spec/plan references remain; no live index/link points to the old path.

- [ ] **Step 5: Regenerate the existing board ledger**

```powershell
pnpm board:build
pnpm board:check
```

Expected: board regeneration reflects only the renamed task ledger; no cross-worktree UI section is introduced.

- [ ] **Step 6: Validate and commit the governance carrier**

```powershell
pnpm exec prettier --write docs/planning/tasks/cross-worktree-calibration-v1.md docs/INDEX.md docs/planning/progress-board.html
pnpm docs:check
pnpm repo:check
pnpm board:check
git diff --check
git add -- docs/planning/tasks/cross-worktree-calibration-v1.md docs/INDEX.md docs/planning/progress-board.html
git add -u -- docs/planning/tasks/thin-agent-orchestrator-v1.md
git diff --cached --check
git commit -m "docs(governance): repurpose worktree calibration task"
```

Expected: commit contains the Git rename, index update, and regenerated board only.

---

### Task 2: Parse and Classify Registered Worktrees

**Files:**

- Create: `scripts/worktree-calibration.mjs`
- Create: `scripts/worktree-calibration.test.mjs`

**Interfaces:**

- Consumes: raw `git worktree list --porcelain -z` bytes converted to a Node string without shell tokenization.
- Produces: `parseWorktreePorcelain(source)` and `classifyWorktree(input)` for Task 3 projection and Task 4 adapter.

- [ ] **Step 1: Write failing porcelain parser tests**

Create the test imports and fixtures:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyWorktree,
  parseWorktreePorcelain,
} from "./worktree-calibration.mjs";

const porcelain = [
  "worktree D:/Logixs",
  "HEAD 1111111111111111111111111111111111111111",
  "branch refs/heads/main",
  "",
  "worktree D:/Logixs/.worktrees/有 空格",
  "HEAD 2222222222222222222222222222222222222222",
  "detached",
  "locked reason with spaces",
  "prunable stale metadata",
  "",
].join("\0");

test("parses registered worktree porcelain without reinterpreting paths", () => {
  assert.deepEqual(parseWorktreePorcelain(porcelain), [
    {
      path: "D:/Logixs",
      headSha: "1111111111111111111111111111111111111111",
      branch: "main",
      detached: false,
      bare: false,
      locked: false,
      lockReason: null,
      prunable: false,
      pruneReason: null,
    },
    {
      path: "D:/Logixs/.worktrees/有 空格",
      headSha: "2222222222222222222222222222222222222222",
      branch: null,
      detached: true,
      bare: false,
      locked: true,
      lockReason: "reason with spaces",
      prunable: true,
      pruneReason: "stale metadata",
    },
  ]);
});

test("rejects malformed, relative, duplicate, and incomplete registrations", () => {
  for (const value of [
    "worktree relative/path\0HEAD 1111111111111111111111111111111111111111\0",
    "worktree D:/same\0HEAD 1111111111111111111111111111111111111111\0\0worktree D:/same\0HEAD 2222222222222222222222222222222222222222\0",
    "worktree D:/missing-head\0branch refs/heads/main\0",
    "HEAD 1111111111111111111111111111111111111111\0",
  ]) {
    assert.throws(
      () => parseWorktreePorcelain(value),
      /WORKTREE_REGISTRY_INVALID/,
    );
  }
});
```

- [ ] **Step 2: Run parser tests and verify RED**

```powershell
node --test --test-name-pattern "porcelain|registrations" scripts/worktree-calibration.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `worktree-calibration.mjs`.

- [ ] **Step 3: Implement the strict parser**

Implement record splitting without `trim()` on path values:

```js
import { isAbsolute } from "node:path";

const registryError = (message) => {
  const error = new Error(`WORKTREE_REGISTRY_INVALID: ${message}`);
  error.code = "WORKTREE_REGISTRY_INVALID";
  return error;
};

export function parseWorktreePorcelain(source) {
  const records = [];
  let current = null;
  const finish = () => {
    if (!current) return;
    if (!current.path || !current.headSha)
      throw registryError("incomplete record");
    records.push(current);
    current = null;
  };

  for (const field of String(source).split("\0")) {
    if (!field) {
      finish();
      continue;
    }
    const separator = field.indexOf(" ");
    const key = separator === -1 ? field : field.slice(0, separator);
    const value = separator === -1 ? "" : field.slice(separator + 1);
    if (key === "worktree") {
      finish();
      if (!isAbsolute(value) || value.includes("\0")) {
        throw registryError("unsafe worktree path");
      }
      current = {
        path: value.replaceAll("\\", "/"),
        headSha: null,
        branch: null,
        detached: false,
        bare: false,
        locked: false,
        lockReason: null,
        prunable: false,
        pruneReason: null,
      };
      continue;
    }
    if (!current) throw registryError("field before worktree");
    if (key === "HEAD") current.headSha = value;
    else if (key === "branch") {
      current.branch = value.replace(/^refs\/heads\//, "");
    } else if (key === "detached") current.detached = true;
    else if (key === "bare") current.bare = true;
    else if (key === "locked") {
      current.locked = true;
      current.lockReason = value || null;
    } else if (key === "prunable") {
      current.prunable = true;
      current.pruneReason = value || null;
    }
  }
  finish();

  const paths = records.map(({ path }) => path.toLowerCase());
  if (new Set(paths).size !== paths.length)
    throw registryError("duplicate path");
  return records.sort((left, right) => left.path.localeCompare(right.path));
}
```

The final implementation may factor helpers, but it must preserve exact error code, strict path validation, and stable order.

- [ ] **Step 4: Add failing lifecycle classification tests**

```js
const observation = (overrides = {}) => ({
  registration: {
    path: "D:/repo/.worktrees/example",
    headSha: "a".repeat(40),
    branch: "feat/example",
    detached: false,
    bare: false,
    locked: false,
    lockReason: null,
    prunable: false,
    pruneReason: null,
  },
  readable: true,
  readError: null,
  ahead: 0,
  behind: 0,
  fullyMerged: true,
  trackedDirtyPaths: [],
  untrackedPaths: [],
  taskRecords: [],
  activeResolution: { finding: { code: "TASK_CURRENT_NOT_FOUND" } },
  checkoutProjection: null,
  ...overrides,
});

test("classifies the primary and every non-primary lifecycle state", () => {
  assert.equal(
    classifyWorktree({ ...observation(), isPrimary: true }),
    "primary",
  );
  assert.equal(
    classifyWorktree({
      ...observation(),
      activeResolution: { task: { id: "example" } },
    }),
    "active",
  );
  assert.equal(classifyWorktree(observation()), "dormant-merged");
  assert.equal(
    classifyWorktree(observation({ ahead: 1, fullyMerged: false })),
    "dormant-ahead",
  );
  assert.equal(
    classifyWorktree(observation({ trackedDirtyPaths: ["outside.txt"] })),
    "unowned-dirty",
  );
  assert.equal(
    classifyWorktree(
      observation({ readable: false, readError: "GIT_READ_FAILED" }),
    ),
    "unreadable",
  );
});
```

- [ ] **Step 5: Run classification tests and verify RED**

```powershell
node --test --test-name-pattern "lifecycle state" scripts/worktree-calibration.test.mjs
```

Expected: parser tests pass; classification test fails because `classifyWorktree` is missing or incomplete.

- [ ] **Step 6: Implement lifecycle classification**

```js
export function classifyWorktree(input) {
  if (!input.readable) return "unreadable";
  if (input.isPrimary) return "primary";
  if (input.activeResolution?.task) return "active";
  if (input.trackedDirtyPaths.length > 0) return "unowned-dirty";
  if (input.fullyMerged) return "dormant-merged";
  return "dormant-ahead";
}
```

Do not use untracked count to choose lifecycle state.

- [ ] **Step 7: Run Task 2 gates**

```powershell
node --test scripts/worktree-calibration.test.mjs
pnpm exec eslint scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
pnpm exec prettier --check scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --check
```

Expected: parser/classifier tests and static checks pass.

- [ ] **Step 8: Commit parser and classifier**

```powershell
git add -- scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --cached --check
git commit -m "feat(governance): classify registered worktrees"
```

---

### Task 3: Build the Pure Cross-Worktree Projection

**Files:**

- Modify: `scripts/worktree-calibration.mjs`
- Modify: `scripts/worktree-calibration.test.mjs`

**Interfaces:**

- Consumes: classified observed worktrees and primary normalized task records.
- Produces: deterministic projection, conflicts, findings, and next gate; Task 4 adapter supplies its data and Task 5 CLI renders it.

- [ ] **Step 1: Add task fixture helpers and failing dormant-policy tests**

Import shared normalization in the test:

```js
import { normalizeTaskRecord } from "./task-brief-state.mjs";

const taskSource = ({
  status = "coding",
  branch = "feat/example",
  writer = "main",
  dependsOn = [],
  writeScopes = ["scripts/example/**"],
  locks = ["root-tooling"],
  verification = "",
} = {}) => `---
status: ${status}
branch: ${branch}
verification: ${verification}
owner: main
writer: ${writer}
risk: high
dependsOn: [${dependsOn.join(", ")}]
writeScopes:
${writeScopes.map((scope) => `  - ${scope}`).join("\n")}
exclusiveLocks:
${locks.map((lock) => `  - ${lock}`).join("\n")}
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
---
# 任务：Example
`;

const task = (id, options = {}) =>
  normalizeTaskRecord({
    path: `docs/planning/tasks/${id}.md`,
    source: taskSource(options),
  });
```

Add:

```js
test("dormant merged is informational while dormant ahead only warns", () => {
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [],
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      {
        ...observation(),
        registration: {
          ...observation().registration,
          path: "D:/repo/.worktrees/merged",
          branch: "merged",
        },
        state: "dormant-merged",
      },
      {
        ...observation({ ahead: 2, behind: 10, fullyMerged: false }),
        registration: {
          ...observation().registration,
          path: "D:/repo/.worktrees/ahead",
          branch: "ahead",
        },
        state: "dormant-ahead",
      },
    ],
  });

  assert.deepEqual(
    projection.findings.map(({ code, severity }) => [code, severity]),
    [
      ["WORKTREE_BEHIND_MAIN", "warning"],
      ["WORKTREE_DORMANT_AHEAD", "warning"],
    ],
  );
  assert.equal(projection.nextGate, "continue-with-current-task");
});

test("unowned tracked dirt blocks while untracked paths only warn", () => {
  const dirty = {
    ...observation({
      trackedDirtyPaths: ["outside.txt"],
      untrackedPaths: ["secret-draft.md"],
    }),
    state: "unowned-dirty",
  };
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [],
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      dirty,
    ],
  });
  assert.deepEqual(
    projection.findings.map(({ code, severity }) => [code, severity]),
    [
      ["WORKTREE_TRACKED_DIRTY_UNOWNED", "blocking"],
      ["WORKTREE_UNOWNED_UNTRACKED_PRESENT", "warning"],
    ],
  );
});
```

- [ ] **Step 2: Run dormant-policy tests and verify RED**

```powershell
node --test --test-name-pattern "dormant|unowned tracked" scripts/worktree-calibration.test.mjs
```

Expected: FAIL because the projection/finding engine does not exist.

- [ ] **Step 3: Implement stable finding and base projection helpers**

Use one finding factory and sort rule:

```js
const finding = (code, severity, subject, evidence, remedy, location = {}) => ({
  code,
  severity,
  subject,
  evidence: [...evidence].sort(),
  remedy,
  ...location,
});

const findingSort = (left, right) =>
  left.code.localeCompare(right.code) ||
  left.subject.localeCompare(right.subject) ||
  (left.worktreePath ?? "").localeCompare(right.worktreePath ?? "") ||
  left.evidence.join("\n").localeCompare(right.evidence.join("\n"));
```

Implement the dormant/dirty/read/untracked/behind/detached findings before conflict aggregation. `worktreeCalibrationFindings(projection)` returns `projection.findings`.

- [ ] **Step 4: Add failing writer/scope/lock/WIP tests**

```js
const activeWorktree = (path, record, overrides = {}) => ({
  ...observation(),
  registration: {
    ...observation().registration,
    path,
    branch: record.branch,
  },
  state: "active",
  activeResolution: { task: record },
  checkoutProjection: {
    task: record,
    derived: { findings: [] },
  },
  ...overrides,
});

test("active write tasks conflict on writer, nested scope, and lock", () => {
  const left = task("left", {
    branch: "feat/left",
    writeScopes: ["scripts/shared/**"],
    locks: ["root-tooling"],
  });
  const right = task("right", {
    branch: "feat/right",
    writeScopes: ["Scripts/Shared/file.mjs"],
    locks: ["root-tooling"],
  });
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [left, right],
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      activeWorktree("D:/repo/.worktrees/left", left),
      activeWorktree("D:/repo/.worktrees/right", right),
    ],
  });
  assert.deepEqual(
    projection.findings.map(({ code }) => code),
    [
      "WORKTREE_ACTIVE_LOCK_CONFLICT",
      "WORKTREE_ACTIVE_SCOPE_CONFLICT",
      "WORKTREE_ACTIVE_WRITER_CONFLICT",
    ],
  );
});

test("review is observable but excluded from write conflicts and WIP", () => {
  const codingA = task("a", { branch: "feat/a" });
  const codingB = task("b", { branch: "feat/b" });
  const review = task("review", {
    status: "review",
    branch: "feat/review",
  });
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [codingA, codingB, review],
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      activeWorktree("D:/repo/.worktrees/a", codingA),
      activeWorktree("D:/repo/.worktrees/b", codingB),
      activeWorktree("D:/repo/.worktrees/review", review),
    ],
  });
  assert.ok(
    projection.findings.every(
      ({ code }) => code !== "WORKTREE_WRITE_WIP_EXCEEDED",
    ),
  );
});

test("three coding or fix tasks exceed the write WIP limit", () => {
  const records = ["a", "b", "c"].map((id) =>
    task(id, {
      branch: `feat/${id}`,
      writer: id,
      writeScopes: [`scripts/${id}/**`],
      locks: [`lock-${id}`],
    }),
  );
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: records,
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      ...records.map((record) =>
        activeWorktree(`D:/repo/.worktrees/${record.id}`, record),
      ),
    ],
  });
  assert.equal(
    projection.findings.find(
      ({ code }) => code === "WORKTREE_WRITE_WIP_EXCEEDED",
    ).severity,
    "blocking",
  );
});
```

- [ ] **Step 5: Run active-conflict tests and verify RED**

```powershell
node --test --test-name-pattern "active write|review is observable|WIP" scripts/worktree-calibration.test.mjs
```

Expected: dormant tests pass; conflict tests fail until aggregation exists.

- [ ] **Step 6: Implement active write conflict aggregation**

Implementation rules:

```js
const WRITE_STATUSES = new Set(["design", "coding", "fix"]);
const WIP_STATUSES = new Set(["coding", "fix"]);
```

- Build `activeTasks` from `state === "active"` observations.
- Build `writeTasks` from tasks whose status is in `WRITE_STATUSES`.
- For every unordered pair, compare non-empty writer, every parsed scope pair, and lock intersections.
- Emit one finding per conflicting pair/type with both task paths and worktree paths in evidence.
- Count only `coding/fix` for WIP; emit one finding when count exceeds 2.
- Populate `conflicts.writers/scopes/locks/wip` from the same computed records; do not recompute separately.

- [ ] **Step 7: Add failing primary-authoritative dependency tests**

```js
test("dependency status comes only from the primary task catalog", () => {
  const dependency = task("foundation", {
    status: "blocked",
    branch: "feat/foundation",
  });
  const consumer = task("consumer", {
    branch: "feat/consumer",
    dependsOn: ["foundation", "missing"],
    writer: "consumer",
    writeScopes: ["scripts/consumer/**"],
    locks: ["consumer-lock"],
  });
  const staleDone = { ...dependency, status: "done", verification: "old CI" };
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [dependency, consumer],
    observedWorktrees: [
      { ...observation(), isPrimary: true, state: "primary" },
      activeWorktree("D:/repo/.worktrees/consumer", consumer, {
        taskRecords: [consumer, staleDone],
      }),
    ],
  });
  const dependencyFinding = projection.findings.find(
    ({ code }) => code === "WORKTREE_ACTIVE_DEPENDENCY_BLOCKED",
  );
  assert.deepEqual(dependencyFinding.evidence, [
    "foundation: status=blocked",
    "missing: missing",
  ]);
});
```

- [ ] **Step 8: Implement dependency checks and active checkout finding carry-through**

For each active task dependency, read only `primaryTaskRecords` indexed by ID. Emit one stable dependency finding per active task with all failed dependencies.

For `checkoutProjection.derived.findings`, carry every blocking `TASK_*` finding into the worktree projection with unchanged code/severity/subject/evidence/remedy plus `worktreePath` and `taskPath`. Do not carry `TASK_UNOWNED_UNTRACKED_PRESENT` twice; the worktree warning owns aggregate untracked reporting.

- [ ] **Step 9: Run Task 3 gates**

```powershell
node --test scripts/worktree-calibration.test.mjs
pnpm exec eslint scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
pnpm exec prettier --check scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --check
```

Expected: all pure projection, dormant policy, conflict, dependency, WIP, and ordering tests pass.

- [ ] **Step 10: Commit the pure projection**

```powershell
git add -- scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --cached --check
git commit -m "feat(governance): project cross-worktree conflicts"
```

---

### Task 4: Add the Read-Only Worktree Git Adapter

**Files:**

- Modify: `scripts/worktree-calibration.mjs`
- Modify: `scripts/worktree-calibration.test.mjs`

**Interfaces:**

- Consumes: injected `git({ cwd, args })`, `readFile(path)`, primary path, and main ref.
- Produces: `observeRegisteredWorktrees(options)` returning complete observations or stable unreadable records without mutating Git state.

- [ ] **Step 1: Add failing adapter call-contract tests**

```js
test("observer discovers only registered worktrees and uses read-only Git calls", () => {
  const calls = [];
  const registry = [
    "worktree D:/repo",
    `HEAD ${"1".repeat(40)}`,
    "branch refs/heads/main",
    "",
    "worktree D:/repo/.worktrees/example",
    `HEAD ${"2".repeat(40)}`,
    "branch refs/heads/feat/example",
    "",
  ].join("\0");
  const outputs = new Map([
    ["D:/repo|worktree list --porcelain -z", registry],
    ["D:/repo|branch --show-current", "main\n"],
    ["D:/repo|rev-parse HEAD", `${"1".repeat(40)}\n`],
    ["D:/repo|rev-parse --verify origin/main", `${"1".repeat(40)}\n`],
    ["D:/repo|rev-list --left-right --count origin/main...HEAD", "0\t0\n"],
    ["D:/repo|merge-base --is-ancestor HEAD origin/main", ""],
    ["D:/repo|diff --name-status -z --diff-filter=ACMRD", ""],
    ["D:/repo|diff --name-status -z --cached --diff-filter=ACMRD", ""],
    ["D:/repo|ls-files --others --exclude-standard", ".tmp/local.txt\n"],
    [
      "D:/repo|ls-files -z -- docs/planning/tasks/*.md",
      "docs/planning/tasks/foundation.md\0",
    ],
    ["D:/repo/.worktrees/example|branch --show-current", "feat/example\n"],
    ["D:/repo/.worktrees/example|rev-parse HEAD", `${"2".repeat(40)}\n`],
    [
      "D:/repo/.worktrees/example|rev-parse --verify origin/main",
      `${"1".repeat(40)}\n`,
    ],
    [
      "D:/repo/.worktrees/example|rev-list --left-right --count origin/main...HEAD",
      "5\t1\n",
    ],
    [
      "D:/repo/.worktrees/example|merge-base --is-ancestor HEAD origin/main",
      "",
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --diff-filter=ACMRD",
      "",
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --cached --diff-filter=ACMRD",
      "",
    ],
    [
      "D:/repo/.worktrees/example|ls-files --others --exclude-standard",
      "draft.md\n",
    ],
    [
      "D:/repo/.worktrees/example|ls-files -z -- docs/planning/tasks/*.md",
      "docs/planning/tasks/example.md\0",
    ],
  ]);
  const reads = [];
  const result = observeRegisteredWorktrees({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    git: ({ cwd, args }) => {
      const key = `${cwd}|${args.join(" ")}`;
      calls.push(key);
      if (!outputs.has(key)) throw new Error(`unexpected ${key}`);
      return outputs.get(key);
    },
    readFile: (path) => {
      reads.push(path.replaceAll("\\", "/"));
      return path.endsWith("foundation.md")
        ? taskSource({
            status: "done",
            branch: "feat/foundation",
            verification: "CI",
          })
        : taskSource();
    },
  });

  assert.equal(result.length, 2);
  assert.deepEqual(reads.sort(), [
    "D:/repo/.worktrees/example/docs/planning/tasks/example.md",
    "D:/repo/docs/planning/tasks/foundation.md",
  ]);
  assert.ok(
    calls.every(
      (call) =>
        !/\b(checkout|reset|clean|stash|add|commit|push|merge|rebase|fetch|pull)\b/.test(
          call,
        ) || call.includes("merge-base"),
    ),
  );
});
```

The implementation may need one explicit adapter result for `merge-base --is-ancestor`: represent exit status separately rather than inferring from output. Define the injected Git result as:

```js
{ stdout: string, exitCode: number }
```

Update the fixture accordingly before GREEN; non-zero is expected only for `merge-base --is-ancestor` (not merged) and must not be treated as an unreadable Git failure.

- [ ] **Step 2: Run adapter test and verify RED**

```powershell
node --test --test-name-pattern "registered worktrees|read-only Git" scripts/worktree-calibration.test.mjs
```

Expected: FAIL because `observeRegisteredWorktrees` is missing.

- [ ] **Step 3: Implement registry and per-worktree observation**

Implementation sequence per registered entry:

1. Read registry once from primary with `worktree list --porcelain -z`.
2. Validate that `primaryPath` is exactly one registered path, case-insensitively.
3. Run branch/HEAD/main-ref/ahead-behind/ancestor/tracked diff/untracked path commands in that worktree.
4. Load tracked briefs with shared `loadTrackedTaskRecords({ root: path, git, readFile })`.
5. Normalize records and call `resolveCurrentTask({ records, branch })`.
6. For a unique active task, call shared `observeCheckout` and `buildCalibrationProjection` with the worktree adapter.
7. Classify the observation.
8. For a non-primary failure, return `{ readable: false, readError: "GIT_READ_FAILED", ...registration }` and continue.
9. For registry/primary failure, throw a stable error with code `WORKTREE_REGISTRY_READ_FAILED` or `WORKTREE_PRIMARY_READ_FAILED`.

Do not call `existsSync` on untracked paths. `authorityExists` for active checkout projection may test only declared repository-relative authority paths under that worktree.

- [ ] **Step 4: Add failing partial-failure and poison-read tests**

```js
test("one unreadable non-primary worktree does not hide readable siblings", () => {
  const observed = observeRegisteredWorktrees(
    adapterFixture({ failCwd: "D:/repo/.worktrees/broken" }),
  );
  assert.equal(
    observed.find(({ registration }) => registration.path.endsWith("broken"))
      .readable,
    false,
  );
  assert.equal(
    observed.find(({ registration }) => registration.path.endsWith("healthy"))
      .readable,
    true,
  );
});

test("untracked poison brief is listed but never opened", () => {
  const reads = [];
  const observed = observeRegisteredWorktrees(
    adapterFixture({
      untracked: ["docs/planning/tasks/poison.md"],
      readFile: (path) => {
        reads.push(path.replaceAll("\\", "/"));
        return taskSource();
      },
    }),
  );
  assert.ok(
    observed.some(({ untrackedPaths }) =>
      untrackedPaths.includes("docs/planning/tasks/poison.md"),
    ),
  );
  assert.ok(reads.every((path) => !path.endsWith("poison.md")));
});

test("primary registry failure is fatal and stable", () => {
  assert.throws(
    () => observeRegisteredWorktrees(adapterFixture({ registryFails: true })),
    ({ code, message }) =>
      code === "WORKTREE_REGISTRY_READ_FAILED" &&
      !/Error:| at |token|secret/i.test(message),
  );
});
```

Implement `adapterFixture` in the test file as an explicit map of Git results; it must not execute the user's repository.

- [ ] **Step 5: Add failing rename and detached tests**

Use the adapter map to return:

```text
R100\0outside/source.txt\0owned/target.txt\0
```

for committed or working-tree `diff --name-status -z`. Assert the active worktree's shared checkout projection includes `outside/source.txt` in `blockingOutOfScopePaths`. Add a detached registration with dirty tracked paths and assert classification `unowned-dirty` plus both `WORKTREE_DETACHED_HEAD` warning and `WORKTREE_TRACKED_DIRTY_UNOWNED` blocker.

- [ ] **Step 6: Run Task 4 tests and static gates**

```powershell
node --test scripts/worktree-calibration.test.mjs scripts/task-brief-state.test.mjs
pnpm exec eslint scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
pnpm exec prettier --check scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --check
```

Expected: all adapter, partial failure, poison, rename, detached, and shared observer regressions pass.

- [ ] **Step 7: Commit the read-only adapter**

```powershell
git add -- scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
git diff --cached --check
git commit -m "feat(governance): observe registered worktrees"
```

---

### Task 5: Add CLI and Real Temporary-Repository Tests

**Files:**

- Modify: `scripts/worktree-calibration.mjs`
- Modify: `scripts/worktree-calibration.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 4 observer and Task 3 projection.
- Produces: `pnpm worktrees:check`, full text/JSON reports, stable exits `0/1/2`, and real Git behavior evidence independent of the user's existing worktrees.

- [ ] **Step 1: Write failing CLI behavior tests**

```js
test("CLI returns warning-only success without writes", async () => {
  const writes = [];
  const projection = warningOnlyProjection();
  const result = await runWorktreeCalibrationCli([], {
    observe: () => projection.worktrees,
    loadPrimaryTasks: () => projection.primaryTaskRecords,
    authorityExists: () => true,
    writeFile: (...args) => writes.push(args),
    primaryPath: "D:/repo",
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /worktree calibration: pass/);
  assert.match(result.stdout, /WORKTREE_DORMANT_AHEAD/);
  assert.deepEqual(writes, []);
});

test("CLI returns one for blocking and two for usage or registry failure", async () => {
  const blocked = await runWorktreeCalibrationCli(
    [],
    dependenciesFor(blockingProjection()),
  );
  assert.equal(blocked.exitCode, 1);

  const usage = await runWorktreeCalibrationCli(
    ["--unknown"],
    dependenciesFor(warningOnlyProjection()),
  );
  assert.equal(usage.exitCode, 2);
  assert.match(usage.stderr, /unknown argument/);

  const registry = await runWorktreeCalibrationCli([], {
    ...dependenciesFor(warningOnlyProjection()),
    observe: () => {
      const error = new Error("WORKTREE_REGISTRY_READ_FAILED");
      error.code = "WORKTREE_REGISTRY_READ_FAILED";
      throw error;
    },
  });
  assert.equal(registry.exitCode, 2);
  assert.equal(
    registry.stderr,
    "worktree calibration failed: WORKTREE_REGISTRY_READ_FAILED\n",
  );
});

test("JSON output retains complete path arrays", async () => {
  const result = await runWorktreeCalibrationCli(
    ["--json", "--main-ref", "refs/heads/main"],
    dependenciesFor(warningOnlyProjection({ untrackedCount: 55 })),
  );
  const projection = JSON.parse(result.stdout);
  assert.equal(projection.primary.mainRef, "refs/heads/main");
  assert.equal(projection.worktrees[1].untrackedPaths.length, 55);
});
```

- [ ] **Step 2: Run CLI tests and verify RED**

```powershell
node --test --test-name-pattern "CLI|JSON output" scripts/worktree-calibration.test.mjs
```

Expected: FAIL because formatting/CLI exports are missing.

- [ ] **Step 3: Implement CLI parsing, formatting, and direct execution**

Supported arguments only:

```text
--json
--main-ref REF
```

Accept one standalone `--` package-runner separator, as the existing calibration CLI does. Unknown/incomplete arguments return exit `2`.

Text starts with:

```text
worktree calibration: pass|fail
primary: <path> <branch> <head>
main ref: <ref>
worktrees: <total> (active <n>, dormant-ahead <n>, dormant-merged <n>, unowned-dirty <n>, unreadable <n>)
```

Print each worktree and finding. Cap displayed paths at 50 with `... N more`; JSON remains complete.

Direct execution uses `execFileSync("git", args, { cwd, encoding: "utf8" })` and captures expected `merge-base --is-ancestor` exit code without shell invocation. It never exposes stack traces.

- [ ] **Step 4: Add the root script and root test registration**

In `package.json` add:

```json
"worktrees:check": "node scripts/worktree-calibration.mjs"
```

Add `scripts/worktree-calibration.test.mjs` to the root `test` Node test list. Do not add `worktrees:check` to `repo:check`, `validate`, `static` CI, or board generation.

- [ ] **Step 5: Write a real temporary Git/worktree test harness**

Import only Node built-ins:

```js
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
```

Create repositories under `mkdtempSync(join(tmpdir(), "logix-worktrees-"))`. Use a helper:

```js
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Logix Test",
      GIT_AUTHOR_EMAIL: "logix-test@example.invalid",
      GIT_COMMITTER_NAME: "Logix Test",
      GIT_COMMITTER_EMAIL: "logix-test@example.invalid",
    },
  });
```

The harness must:

1. initialize a repository with branch `main`;
2. commit one done dependency brief;
3. create one clean merged worktree branch;
4. create one clean ahead worktree branch and commit one file;
5. create one tracked-dirty unowned worktree;
6. create one active worktree with a tracked current-branch brief;
7. place an untracked poison brief whose content would create ambiguity if opened;
8. create one detached worktree;
9. use one worktree path containing spaces and Chinese characters;
10. remove only the temporary root in `test.after`, never call remove/prune against user worktrees.

- [ ] **Step 6: Add real integration assertions**

```js
test("real Git registry classifies merged, ahead, dirty, active, and detached worktrees", () => {
  const fixture = createTemporaryWorktreeRepository();
  const observed = observeRegisteredWorktrees({
    primaryPath: fixture.root,
    mainRef: "main",
    git: realGitAdapter,
    readFile: readFileSync,
  });
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: fixture.root,
    mainRef: "main",
    primaryTaskRecords: observed.find(({ isPrimary }) => isPrimary).taskRecords,
    observedWorktrees: observed,
  });
  assert.deepEqual(fixture.expectedStates, stateCount(projection.worktrees));
  assert.ok(
    projection.findings.some(
      ({ code }) => code === "WORKTREE_TRACKED_DIRTY_UNOWNED",
    ),
  );
  assert.ok(
    projection.findings.some(({ code }) => code === "WORKTREE_DORMANT_AHEAD"),
  );
  assert.ok(
    projection.worktrees.some(({ registration }) =>
      registration.path.includes("有 空格"),
    ),
  );
});
```

Add a read spy or filesystem permission trap proving the poison brief is never opened. On Windows, do not rely on POSIX chmod; the read spy is authoritative.

- [ ] **Step 7: Run Task 5 gates**

```powershell
node --test scripts/worktree-calibration.test.mjs scripts/task-brief-state.test.mjs
pnpm worktrees:check -- --json > $null
pnpm exec eslint scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
pnpm exec prettier --check scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs package.json
pnpm repo:check
pnpm docs:check
git diff --check
```

Expected: all unit/integration/CLI tests pass; JSON dry invocation writes only to stdout redirected by the caller, not by the command.

- [ ] **Step 8: Commit CLI and integration tests**

```powershell
git add -- scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs package.json
git diff --cached --check
git commit -m "feat(governance): add worktree calibration CLI"
```

---

### Task 6: Run the Real Dry-Run and Record CWC Evidence

**Files:**

- Modify: `docs/planning/tasks/cross-worktree-calibration-v1.md`
- Verify: `scripts/worktree-calibration.mjs`, its tests, shared task-state tests, package scripts, renamed docs, board artifact.

**Interfaces:**

- Consumes: committed CLI and the current machine's Git-registered worktree facts.
- Produces: exact CWC1–CWC3 evidence and a review-ready brief. It does not clean or modify any observed worktree.

- [ ] **Step 1: Confirm primary safety before the dry-run**

```powershell
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected: branch is `feat/cross-worktree-calibration-v1`. Because the spec requires CLI execution from main/master, do not run the real command from the feature branch as if it were valid.

Create a temporary read-only main observation checkout only if needed for validation by using the already registered primary main checkout after committing the feature branch; do not create another worktree from code. The main session may switch to main only when task changes are committed and must switch back before editing.

- [ ] **Step 2: Run the focused suites and repository gates**

```powershell
node --test scripts/worktree-calibration.test.mjs scripts/task-brief-state.test.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
pnpm exec eslint scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs
pnpm exec prettier --check docs/planning/tasks/cross-worktree-calibration-v1.md docs/INDEX.md docs/superpowers/specs/2026-10-12-cross-worktree-calibration-design.md docs/superpowers/plans/2026-10-12-cross-worktree-calibration.md scripts/worktree-calibration.mjs scripts/worktree-calibration.test.mjs package.json docs/planning/progress-board.html
pnpm repo:check
pnpm docs:check
pnpm board:check
git diff --check
```

Expected: every focused/static gate exits `0`.

- [ ] **Step 3: Execute the real command from synchronized main without writing**

After the feature commits are available, invoke the feature script by absolute path while the primary checkout is main, or temporarily use `node <feature-worktree>/scripts/worktree-calibration.mjs --main-ref origin/main` only if module-relative imports resolve inside the feature checkout and its `primaryPath` is explicitly the main checkout. Prefer this explicit CLI option in the implementation:

```text
--primary PATH
```

Add `--primary PATH` to Task 5 CLI only for this operational requirement. It must:

- require an absolute registered worktree path;
- default to `process.cwd()`;
- never change cwd globally;
- be covered by usage/path validation tests.

Run from the feature branch:

```powershell
pnpm worktrees:check -- --primary D:/Logixs --main-ref origin/main
pnpm worktrees:check -- --primary D:/Logixs --main-ref origin/main --json
```

Expected from the design-time historical set, excluding primary and the current implementation worktree:

```text
active historical: 0
dormant-ahead: 5
dormant-merged: 3
unowned-dirty: 0
unreadable: 0
```

When implementation runs in an additional registered feature worktree, the full observed set should also contain `active: 1` for `feat/cross-worktree-calibration-v1`.

If the live counts differ, inspect only Git branch/status facts and tracked briefs to explain the drift. Do not update code/tests to force old counts and do not clean anything.

- [ ] **Step 4: Prove no observed worktree changed**

Capture before/after for every registered worktree:

```powershell
git worktree list --porcelain
```

For each registered path, compare:

```powershell
git -C <registered-path> rev-parse HEAD
git -C <registered-path> status --short
```

Use a small one-off PowerShell loop only for verification output; do not commit it. Expected: every HEAD and status is byte-for-byte unchanged by `worktrees:check`.

- [ ] **Step 5: Record exact evidence in the brief**

Append:

- focused test count;
- parser/classifier/conflict/adapter/temp-repo coverage;
- primary/main ref/head;
- actual state counts;
- each warning/blocking finding code and count;
- per-worktree tracked dirty and untracked counts, never contents;
- before/after no-change result;
- root lint/repo/docs/format status;
- explicit unknowns and deferred integrations.

Keep `status: coding` until final local gates are complete, then move to `review`. Do not mark done before fresh review and PR CI.

- [ ] **Step 6: Format and commit dry-run evidence**

```powershell
pnpm exec prettier --write docs/planning/tasks/cross-worktree-calibration-v1.md
pnpm board:build
pnpm board:check
pnpm docs:check
pnpm repo:check
git add -- docs/planning/tasks/cross-worktree-calibration-v1.md docs/planning/progress-board.html
git diff --cached --check
git commit -m "docs(governance): record cross-worktree calibration evidence"
```

---

### Task 7: Whole-Branch Review, Single PR, CI, and Closeout

**Files:**

- Modify after findings/integration evidence: `docs/planning/tasks/cross-worktree-calibration-v1.md`
- Regenerate when brief changes: `docs/planning/progress-board.html`
- Read-only review: every task-owned path since the branch merge-base with `origin/main`.

**Interfaces:**

- Consumes: approved spec, this plan, rewritten brief, implementation, tests, real dry-run evidence.
- Produces: one fresh `logix-review/v1`, one `logix-disposition/v1`, one implementation PR, required CI, merge, and final done evidence.

- [ ] **Step 1: Run the task-level final local gate**

This is a high-risk repository-governance task. Run one complete configured gate on the final PR candidate:

```powershell
pnpm infra:up
pnpm validate
```

If the known `apps/ai-service/.pytest_cache` EPERM alone blocks root `format:check`, preserve it untouched and record the non-zero result. Run exact task-owned Prettier and every later validate stage individually:

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Do not claim `validate` passed when it did not.

- [ ] **Step 2: Run final cross-worktree safety evidence**

```powershell
pnpm worktrees:check -- --primary D:/Logixs --main-ref origin/main
pnpm repo:check
pnpm docs:check
pnpm board:check
git diff --name-only $(git merge-base origin/main HEAD)...HEAD
git diff --check $(git merge-base origin/main HEAD)...HEAD
git status --short
```

Expected: no task-owned out-of-scope changes; observed worktrees unchanged; warning-only historical worktrees do not block. Any live tracked-dirty/active conflict blocks review readiness until explained or resolved by its owner.

- [ ] **Step 3: Dispatch one fresh Claude read-only whole-branch review**

Provide:

- merge base and HEAD;
- spec, plan, rewritten brief;
- complete diff and exact local gate outputs;
- real worktree dry-run counts and before/after no-change evidence;
- every Review Focus item verbatim;
- explicit prohibition on reading untracked content or writing any checkout.

Require `logix-review/v1` with evidence-backed findings, unknowns, verification gaps, declined-to-judge list, and `writes: none`.

- [ ] **Step 4: Disposition and one TDD fix pass**

Write every finding to the existing brief as `accepted`, `rejected`, or `pending-owner`. Critical/Important accepted findings receive one fix pass:

1. add a regression test;
2. watch it fail for the finding's reason;
3. implement the minimal fix;
4. rerun the affected suite;
5. rerun the complete governance suite and final local gates.

Minor findings are recorded as deferred and not fixed in this pass. Do not dispatch a second whole-branch review after covered RED→GREEN fixes.

- [ ] **Step 5: Move the brief to review and commit evidence**

Set `status: review`, record reviewer baseline/head/verdict/dispositions, test counts, dry-run result, and remaining remote PR/CI unknowns. Then:

```powershell
pnpm exec prettier --write docs/planning/tasks/cross-worktree-calibration-v1.md
pnpm board:build
pnpm board:check
pnpm repo:check
pnpm docs:check
git add -- docs/planning/tasks/cross-worktree-calibration-v1.md docs/planning/progress-board.html
git diff --cached --check
git commit -m "docs(governance): prepare worktree calibration review"
```

- [ ] **Step 6: Push and create one implementation PR**

```powershell
git push -u origin feat/cross-worktree-calibration-v1
gh pr create --base main --head feat/cross-worktree-calibration-v1 --title "feat(governance): add cross-worktree calibration" --body-file <temporary-pr-body-path>
```

The temporary body must include:

- problem and selected dormant policy;
- shared-parser/observer reuse;
- no-write/untracked-content boundary;
- current dry-run state counts and warnings;
- fresh review/dispositions;
- local validation, known `.pytest_cache` limitation if still present;
- rollback by reverting the PR;
- deferred board/hook/remote/automation slices.

The temporary body file stays outside the repository.

- [ ] **Step 7: Require CI and merge through protected main**

```powershell
gh pr checks <pr-number> --watch --interval 20
```

Required `quality` and every applicable check must pass. Diagnose failures; never bypass, force-push, or merge red checks. After explicit merge authorization required by the host, merge with a merge commit.

- [ ] **Step 8: Write immutable closeout evidence through a minimal follow-up PR if needed**

After merge, fast-forward local main, create a closeout branch before editing, and record:

- implementation PR URL;
- successful CI run/check URLs;
- merge commit;
- final finding dispositions;
- exact completion boundary and deferred work.

Set `status: done` with non-empty frontmatter `verification`, regenerate board, run repo/docs/board/scoped format, create one pure-doc closeout PR, require `quality`, merge, and sync main. The docs-only CI routing must not require an active task calibration.

- [ ] **Step 9: Final main verification**

```powershell
pnpm repo:check
pnpm docs:check
pnpm board:check
git status --short
git log -1 --oneline --decorate
```

Expected: all read-only gates pass; only pre-existing unowned local paths remain; main contains the merged implementation and immutable closeout evidence.

---

## Self-Review

- **Spec coverage:** Tasks 1–7 cover governance migration, all seven exports, every lifecycle state, dormant policy, writer/scope/lock/dependency/WIP conflicts, primary safety, read-only Git boundaries, CLI, real temporary worktrees, current dry-run, final review, PR/CI/merge, and closeout.
- **Scope:** One subsystem and one CLI. Board/hook/CI/remote/automation integrations remain explicitly deferred.
- **Placeholder scan:** No implementation TBD/TODO remains. `<registered-path>`, `<ref>`, `<temporary-pr-body-path>`, and `<pr-number>` are command-time values whose sources and constraints are explicitly defined, not design placeholders.
- **Type consistency:** All tasks use the seven spec exports verbatim. Adapter Git results consistently use `{ stdout, exitCode }`; projection fields and lifecycle strings match the spec.
- **Review Focus:** Porcelain bytes/Windows paths are pinned in Task 2; poison brief and partial failure in Task 4/5; primary dependency truth and historical dormant behavior in Task 3; real repository behavior in Task 6.
- **User-work protection:** No task instructs cleanup, deletion, prune, unlock, checkout, rebase, or reading untracked contents. Temporary integration tests clean only directories they create under the system temp directory.
