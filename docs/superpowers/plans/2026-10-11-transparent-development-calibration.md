# Transparent Checkout Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first transparent-development slice: one shared task-brief parser and one read-only current-checkout calibration command that reconcile the active brief with branch, base, changed paths, dependencies, and authority references.

**Architecture:** `scripts/task-brief-state.mjs` becomes the sole parser, normalized task model, path-scope authority, pure calibration projector, and read-only Git adapter. `check-repository.mjs` and `check-ui-structure-gate.mjs` consume that shared model, so the focused `calibration:check`, repository policy gate, and Vue write hook stop interpreting briefs differently. Progress-board rendering, board drift checks, and CI workflow wiring are explicitly deferred to the next thin plans under the same task brief.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, Git CLI through injected `execFileSync`, existing repository-policy scripts, Prettier, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md`

**Implementation Brief:** `docs/planning/tasks/transparent-development-calibration-v1.md`

## Global Constraints

- The task brief remains the only writable implementation carrier. Do not create mutable JSON/YAML state, a database, or a runtime state directory.
- This plan observes the current checkout only. Do not inspect or modify other worktrees and do not call GitHub APIs.
- All Git subprocess operations are read-only and use an injected `git(args)` adapter. Never run checkout, reset, clean, stash, add, commit, push, merge, or branch mutation from calibration code.
- Committed, staged, and unstaged tracked paths outside `writeScopes` block. Out-of-scope untracked paths warn only.
- Existing untracked `.claude/worktrees/`, `.tmp/`, and `apps/api/.tmp/` paths remain unowned observations unless they enter a declared scope. Never read their contents or alter them.
- Repository paths normalize to `/` and compare case-insensitively. Accepted scopes remain exact paths or directories ending in `/**`.
- Historical `done` and `blocked` briefs are not retroactively failed for unsupported non-status syntax, unchecked boxes, or missing new fields.
- `repo:check`, the UI hook, and `calibration:check` consume the same normalized task records and scope matcher.
- The UI hook continues to authorize writes only for `design`, `coding`, and `fix`. A `review` task is calibratable but write-blocked.
- `calibration:check` never writes files. It reports paths only and never reads untracked file contents.
- A green current-checkout calibration does not prove cross-worktree safety, remote PR/CI state, RAID synchronization, deployment, or business closure.
- Progress-board visualization and CI static wiring are not part of this plan. They get separate implementation plans after this slice is verified.

## Review Focus

1. **Offline or stacked branch without a valid merge-base** — return `TASK_BASE_UNKNOWN`; never invent `HEAD~1` or silently compare to the wrong branch. Task 3 tests explicit base, missing ref, and synthetic PR-head input.
2. **Mixed user work in one checkout** — tracked out-of-scope paths block, while out-of-scope untracked paths are warnings and are never attributed or read. Task 3 tests all four path tracks in one projection.
3. **Windows paths and scope escape attempts** — case drift must normalize, while drive letters, backslashes in declared scopes, repeated separators, `..`, and broad globs must fail closed. Task 1 owns these tests.
4. **Malformed active brief beside legacy history** — active malformed metadata must report file/line evidence, but unrelated `done` and `blocked` briefs must not be blanket-failed by the stricter parser. Tasks 1 and 2 test both classes.
5. **GitHub Actions synthetic merge checkout** — explicit PR head and branch must override checkout HEAD/branch for committed-diff observation, and both SHAs must be verified. Task 3 pins the exact Git calls.

---

## File Structure

- Create `scripts/task-brief-state.mjs` — supported frontmatter parser, normalized `TaskRecord`, scope/path helpers, task resolver, checkout observer, projection/finding engine, report formatter, CLI.
- Create `scripts/task-brief-state.test.mjs` — parser, path, task-resolution, projection, Git-adapter, CLI/no-write tests.
- Modify `scripts/check-repository.mjs` — remove its private parser/scope helpers, consume normalized task records, and run current-checkout blocking calibration for a unique active task branch.
- Modify `scripts/check-repository.test.mjs` — preserve existing repository-policy behavior and add shared-parser/calibration regressions.
- Modify `scripts/check-ui-structure-gate.mjs` — remove its private parser/scope matcher and consume the shared task model.
- Modify `scripts/check-ui-structure-gate.test.mjs` — preserve UI ownership behavior and add malformed-active-brief regression.
- Modify `package.json` — add `calibration:check` and include the new test in root `test`.
- Modify `docs/planning/tasks/transparent-development-calibration-v1.md` — record exact slice evidence and keep the overall task in `design` or `coding`; do not mark the whole brief done.

## Shared Interfaces

The implementation must export exactly:

```js
export const ACTIVE_TASK_STATUSES = new Set([
  "design",
  "coding",
  "fix",
  "review",
]);

export function normalizeRepositoryPath(value) {}
export function parseTaskFrontmatter(source, { path }) {}
export function normalizeTaskRecord({ path, source }) {}
export function normalizeTaskRecords(records) {}
export function parseWriteScope(scope) {}
export function scopeOwnsPath(scope, filePath) {}
export function writeScopesOverlap(left, right) {}
export function resolveCurrentTask({ records, branch, explicitBrief }) {}
export function buildCalibrationProjection(input) {}
export function calibrationFindings(projection) {}
export function observeCheckout(options) {}
export function formatCalibrationReport(projection) {}
export async function runCalibrationCli(argv, dependencies) {}
```

`buildCalibrationProjection` accepts data only:

```js
{
  task,
  records,
  authorityExists,
  observation: {
    actualBranch,
    baseSha,
    baseSource,
    headSha,
    committedPaths,
    stagedPaths,
    unstagedPaths,
    untrackedPaths,
  },
}
```

It returns:

```js
{
  task,
  declared,
  observed,
  derived: {
    trackedChangedPaths,
    ownedChangedPaths,
    blockingOutOfScopePaths,
    ownedUntrackedPaths,
    unownedUntrackedPaths,
    dependencies,
    authorities,
    findings,
    nextGate,
  },
}
```

Every path array is normalized, deduplicated, and stable-sorted.

---

### Task 1: Build the Shared Brief Parser and Scope Authority

**Files:**

- Create: `scripts/task-brief-state.mjs`
- Create: `scripts/task-brief-state.test.mjs`
- Modify: `docs/planning/tasks/transparent-development-calibration-v1.md`

**Interfaces:**

- Consumes: task metadata syntax from `docs/planning/tasks/_template.md` and existing parser behavior in the two gates.
- Produces: normalized task records, parser findings, and the only path/scope comparison functions used by later tasks.

- [ ] **Step 1: Write the failing supported-frontmatter tests**

Create `scripts/task-brief-state.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeTaskRecord,
  parseTaskFrontmatter,
  parseWriteScope,
  scopeOwnsPath,
  writeScopesOverlap,
} from "./task-brief-state.mjs";

const completeSource = `---\r
status: coding # machine value\r
branch: "docs/transparent-development-calibration-v1"\r
verification: >\r
  focused tests passed\r
  repo check passed\r
dependsOn: [universal-workbench-layout-standard-v1]\r
writeScopes:\r
  - scripts/task-brief-state.mjs\r
  - scripts/calibration/**\r
exclusiveLocks: []\r
sharedIntegrationScopes:\r
  - package.json\r
authorityRefs:\r
  - AGENTS.md\r
---\r
# 任务：校准\r
`;

test("parses the supported task frontmatter subset deterministically", () => {
  const parsed = parseTaskFrontmatter(completeSource, {
    path: "docs/planning/tasks/calibration.md",
  });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.values.status, "coding");
  assert.equal(
    parsed.values.branch,
    "docs/transparent-development-calibration-v1",
  );
  assert.equal(
    parsed.values.verification,
    "focused tests passed\nrepo check passed",
  );
  assert.deepEqual(parsed.values.dependsOn, [
    "universal-workbench-layout-standard-v1",
  ]);
  assert.deepEqual(parsed.values.writeScopes, [
    "scripts/task-brief-state.mjs",
    "scripts/calibration/**",
  ]);
  assert.deepEqual(parsed.values.exclusiveLocks, []);

  const quotedHash = parseTaskFrontmatter(
    `---\nbranch: "docs/calibration#slice"\n---`,
    { path: "quoted.md" },
  );
  assert.equal(quotedHash.values.branch, "docs/calibration#slice");
});

test("normalizes a task record once for every consumer", () => {
  const task = normalizeTaskRecord({
    path: "docs\\planning\\tasks\\calibration.md",
    source: completeSource,
  });
  assert.equal(task.id, "calibration");
  assert.equal(task.path, "docs/planning/tasks/calibration.md");
  assert.equal(task.title, "校准");
  assert.deepEqual(task.writeScopes, [
    "scripts/task-brief-state.mjs",
    "scripts/calibration/**",
  ]);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/task-brief-state.mjs`.

- [ ] **Step 3: Implement the minimal supported parser and task normalizer**

Create `scripts/task-brief-state.mjs`:

```js
import { basename } from "node:path";

export const ACTIVE_TASK_STATUSES = new Set([
  "design",
  "coding",
  "fix",
  "review",
]);

const LIST_FIELDS = new Set([
  "dependsOn",
  "writeScopes",
  "exclusiveLocks",
  "sharedIntegrationScopes",
  "authorityRefs",
  "uiStructure",
  "uiMustStayVisible",
  "uiProgressiveDisclosure",
  "uiForbidden",
  "uiViewportEvidence",
]);

export function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

const cleanScalar = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
};

export function parseTaskFrontmatter(source, { path }) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      values: {},
      errors: [
        {
          code: "TASK_PARSE_INVALID",
          path,
          line: 1,
          message: "task brief is missing a frontmatter block",
        },
      ],
    };
  }

  const values = {};
  const errors = [];
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const entry = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!entry) {
      if (line.trim()) {
        errors.push({
          code: "TASK_PARSE_INVALID",
          path,
          line: index + 2,
          message: "unsupported frontmatter syntax",
        });
      }
      continue;
    }

    const [, key, raw = ""] = entry;
    if (Object.hasOwn(values, key)) {
      errors.push({
        code: "TASK_PARSE_INVALID",
        path,
        line: index + 2,
        message: `duplicate frontmatter key '${key}'`,
      });
      continue;
    }

    const scalar = cleanScalar(raw);
    if (scalar === ">" || scalar === "|") {
      const content = [];
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) {
        content.push(lines[index + 1].trim());
        index += 1;
      }
      values[key] = content.join("\n").trim();
      continue;
    }

    if (scalar.startsWith("[") && scalar.endsWith("]")) {
      const inner = scalar.slice(1, -1).trim();
      values[key] = inner ? inner.split(",").map(cleanScalar) : [];
      continue;
    }

    if (!scalar) {
      const items = [];
      let nestedLine = null;
      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        const item = next.match(/^\s+-\s+(.+)$/);
        if (item) {
          items.push(cleanScalar(item[1]));
          index += 1;
          continue;
        }
        if (/^\s+\S/.test(next)) nestedLine = index + 3;
        break;
      }
      if (nestedLine !== null) {
        errors.push({
          code: "TASK_PARSE_INVALID",
          path,
          line: nestedLine,
          message: "nested mappings are not supported",
        });
      }
      values[key] = items.length ? items : "";
      continue;
    }

    values[key] = scalar;
  }

  for (const field of LIST_FIELDS) {
    if (Object.hasOwn(values, field) && !Array.isArray(values[field])) {
      errors.push({
        code: "TASK_PARSE_INVALID",
        path,
        line: 1,
        message: `${field} must be a list`,
      });
    }
  }
  return { values, errors };
}

export function normalizeTaskRecord({ path, source }) {
  const normalizedPath = normalizeRepositoryPath(path);
  const parsed = parseTaskFrontmatter(source, { path: normalizedPath });
  const heading =
    source.match(/^#\s+(.+)$/m)?.[1] ?? basename(normalizedPath, ".md");
  const list = (field) =>
    Array.isArray(parsed.values[field]) ? parsed.values[field] : [];
  return {
    id: basename(normalizedPath, ".md"),
    path: normalizedPath,
    title: heading.replace(/^任务[：:]\s*/, "").trim(),
    status: parsed.values.status ?? "",
    branch: parsed.values.branch ?? "",
    verification: parsed.values.verification ?? "",
    owner: parsed.values.owner ?? "",
    writer: parsed.values.writer ?? "",
    risk: parsed.values.risk ?? "",
    dependsOn: list("dependsOn"),
    writeScopes: list("writeScopes"),
    exclusiveLocks: list("exclusiveLocks"),
    sharedIntegrationScopes: list("sharedIntegrationScopes"),
    authorityRefs: list("authorityRefs"),
    uiStructure: list("uiStructure"),
    uiMustStayVisible: list("uiMustStayVisible"),
    uiProgressiveDisclosure: list("uiProgressiveDisclosure"),
    uiForbidden: list("uiForbidden"),
    uiViewportEvidence: list("uiViewportEvidence"),
    parseErrors: parsed.errors,
  };
}

export const normalizeTaskRecords = (records) =>
  records
    .map(normalizeTaskRecord)
    .sort((left, right) => left.path.localeCompare(right.path));
```

- [ ] **Step 4: Run the first parser tests and verify GREEN**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Add failing malformed-input and path-scope tests**

Append:

```js
test("fails closed on duplicate keys, nested mappings, and malformed list fields", () => {
  const parsed = parseTaskFrontmatter(
    `---\nstatus: coding\nstatus: fix\nwriteScopes:\n  nested: value\nauthorityRefs: AGENTS.md\n---`,
    { path: "bad.md" },
  );
  assert.ok(parsed.errors.length >= 3);
  assert.ok(
    parsed.errors.every(
      ({ code, path, line }) =>
        code === "TASK_PARSE_INVALID" && path === "bad.md" && line > 0,
    ),
  );
});

test("normalizes file paths but rejects unsafe declared scopes", () => {
  assert.deepEqual(parseWriteScope("Apps/API/**"), {
    kind: "directory",
    path: "apps/api",
    raw: "Apps/API/**",
  });
  assert.equal(scopeOwnsPath("Apps/API/**", "apps\\api\\src\\main.ts"), true);
  assert.equal(
    scopeOwnsPath("apps/api/src/main.ts", "APPS/API/src/main.ts"),
    true,
  );
  assert.deepEqual(parseWriteScope("../outside/**"), {
    error: "outside",
    raw: "../outside/**",
  });
  assert.deepEqual(parseWriteScope("apps/*/src/**"), {
    error: "pattern",
    raw: "apps/*/src/**",
  });
  assert.deepEqual(parseWriteScope("C:/repo/file.ts"), {
    error: "outside",
    raw: "C:/repo/file.ts",
  });
  assert.deepEqual(parseWriteScope("apps\\api\\main.ts"), {
    error: "outside",
    raw: "apps\\api\\main.ts",
  });
});

test("uses one overlap rule for exact and directory scopes", () => {
  assert.equal(
    writeScopesOverlap(
      parseWriteScope("apps/api/**"),
      parseWriteScope("apps/api/src/main.ts"),
    ),
    true,
  );
  assert.equal(
    writeScopesOverlap(
      parseWriteScope("apps/web/**"),
      parseWriteScope("apps/api/**"),
    ),
    false,
  );
});
```

- [ ] **Step 6: Run tests and verify RED**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
```

Expected: FAIL because the three scope exports do not exist.

- [ ] **Step 7: Implement the only scope parser and matcher**

Add:

```js
export function parseWriteScope(raw) {
  const value = String(raw);
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value)
  ) {
    return { error: "outside", raw };
  }
  const scope = normalizeRepositoryPath(value);
  const segments = scope.split("/");
  if (
    !scope ||
    segments.includes("") ||
    segments.includes(".") ||
    segments.includes("..")
  ) {
    return { error: "outside", raw };
  }
  if (scope.endsWith("/**")) {
    const prefix = scope.slice(0, -3).replace(/\/$/, "");
    if (!prefix || /[*?[\]]/.test(prefix)) return { error: "pattern", raw };
    return { kind: "directory", path: prefix.toLowerCase(), raw };
  }
  if (/[*?[\]]/.test(scope)) return { error: "pattern", raw };
  return { kind: "exact", path: scope.toLowerCase(), raw };
}

export function scopeOwnsPath(scope, filePath) {
  const parsed = typeof scope === "string" ? parseWriteScope(scope) : scope;
  if (parsed.error) return false;
  const path = normalizeRepositoryPath(filePath).toLowerCase();
  return parsed.kind === "exact"
    ? path === parsed.path
    : path === parsed.path || path.startsWith(`${parsed.path}/`);
}

export function writeScopesOverlap(left, right) {
  if (left.error || right.error) return false;
  if (left.kind === "exact" && right.kind === "exact") {
    return left.path === right.path;
  }
  if (left.kind === "directory") {
    return right.path === left.path || right.path.startsWith(`${left.path}/`);
  }
  return left.path === right.path || left.path.startsWith(`${right.path}/`);
}
```

- [ ] **Step 8: Run Task 1 gates**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
pnpm exec eslint scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs
pnpm exec prettier --check scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs
```

Expected: all parser/path tests, lint, and format pass.

- [ ] **Step 9: Commit the shared parser**

```powershell
git add -- scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs docs/planning/tasks/transparent-development-calibration-v1.md
git diff --cached --check
git commit -m "feat(governance): add shared task brief parser"
```

---

### Task 2: Migrate Repository and UI Gates to the Shared Model

**Files:**

- Modify: `scripts/check-repository.mjs:620-948,1286-1314`
- Modify: `scripts/check-repository.test.mjs`
- Modify: `scripts/check-ui-structure-gate.mjs:1-133`
- Modify: `scripts/check-ui-structure-gate.test.mjs`

**Interfaces:**

- Consumes: Task 1 normalized records and scope functions.
- Produces: unchanged repository-policy/UI-hook behavior with no private frontmatter parser or scope matcher in either consumer.

- [ ] **Step 1: Add failing repository shared-parser tests**

Import `normalizeTaskRecord` in `scripts/check-repository.test.mjs`, then add:

```js
test("repository validation consumes the normalized task model", () => {
  const record = taskRecord({
    path: "calibration",
    status: "coding",
    writer: "main",
    writeScopes: ["Scripts/Calibration/**"],
    exclusiveLocks: ["task-brief-contract"],
  });
  const normalized = normalizeTaskRecord(record);
  assert.equal(normalized.path, "calibration.md");
  assert.deepEqual(normalized.writeScopes, ["Scripts/Calibration/**"]);
  assert.deepEqual(validateTaskStatusRecords([record]), []);
});

test("active malformed frontmatter reports file and line", () => {
  assert.match(
    validateTaskStatusRecords([
      {
        path: "bad.md",
        source: "---\nstatus: coding\nwriteScopes:\n  nested: value\n---",
      },
    ]).join("\n"),
    /bad\.md:\d+: nested mappings are not supported/,
  );
});

test("legacy done and blocked records are not retroactively failed", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      {
        path: "done.md",
        source:
          "---\nstatus: done\nverification: CI-1\nlegacy:\n  nested: value\n---",
      },
      {
        path: "blocked.md",
        source: "---\nstatus: blocked\nlegacy:\n  nested: value\n---",
      },
    ]),
    [],
  );
});
```

- [ ] **Step 2: Add the failing UI-hook parser test**

Append:

```js
test("UI gate rejects malformed active task metadata", () => {
  const result = evaluateUiStructureGate({
    filePath: "apps/web/src/views/Workbench.vue",
    records: [
      {
        path: "docs/planning/tasks/ui.md",
        source: "---\nstatus: coding\nwriteScopes:\n  nested: value\n---",
      },
    ],
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /TASK_PARSE_INVALID .*ui\.md:\d+/);
});
```

- [ ] **Step 3: Run both suites and verify RED**

Run:

```powershell
node --test scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
```

Expected: FAIL because both consumers still use private parsers.

- [ ] **Step 4: Replace repository parser/scope helpers with imports**

Add:

```js
import {
  ACTIVE_TASK_STATUSES,
  normalizeTaskRecords,
  parseWriteScope,
  writeScopesOverlap,
} from "./task-brief-state.mjs";
```

Delete `cleanFrontmatterScalar`, `parseInlineList`, `parseTaskFrontmatter`, `isRepositoryRelativeScope`, local `parseWriteScope`, and local `writeScopesOverlap`.

Change task setup:

```js
const parsedRecords = normalizeTaskRecords(records).map((task) => ({
  ...task,
  metadata: task,
}));
const recordsById = new Map(parsedRecords.map((record) => [record.id, record]));
for (const record of parsedRecords) {
  if (ACTIVE_TASK_STATUSES.has(record.status)) {
    for (const error of record.parseErrors) {
      errors.push(`${error.path}:${error.line}: ${error.message}`);
    }
    if (record.parseErrors.length > 0) continue;
  }
  // Existing status/risk/WIP/dependency/lock behavior follows.
}
```

Change `taskStatusErrors` so parser paths are repository-relative:

```js
function taskStatusErrors() {
  const taskDirectory = resolve(repositoryRoot, "docs/planning/tasks");
  const taskFiles = readdirSync(taskDirectory)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => resolve(taskDirectory, name));
  return validateTaskStatusRecords(
    taskFiles.map((path) => ({
      path: toRepositoryRelativePath(path),
      source: readFileSync(path, "utf8"),
    })),
  );
}
```

Preserve existing error strings outside parser diagnostics.

- [ ] **Step 5: Replace UI-hook parser/scope helpers with imports**

Import:

```js
import { normalizeTaskRecord, scopeOwnsPath } from "./task-brief-state.mjs";
```

Delete `cleanScalar`, `parseInlineList`, `parseFrontmatter`, and local `scopeOwnsPath`.

Implement:

```js
export function parseUiTaskRecord(record) {
  const task = normalizeTaskRecord(record);
  return {
    path: task.path,
    status: task.status,
    writeScopes: task.writeScopes,
    uiStructure: task.uiStructure,
    uiMustStayVisible: task.uiMustStayVisible,
    uiProgressiveDisclosure: task.uiProgressiveDisclosure,
    uiForbidden: task.uiForbidden,
    uiViewportEvidence: task.uiViewportEvidence,
    parseErrors: task.parseErrors,
  };
}
```

Before owner lookup:

```js
const UI_WRITE_STATUSES = new Set(["design", "coding", "fix"]);
const parsed = records.map(parseUiTaskRecord);
const malformed = parsed.filter(
  (record) =>
    UI_WRITE_STATUSES.has(record.status) && record.parseErrors.length > 0,
);
if (malformed.length > 0) {
  return {
    allowed: false,
    reason: `UI edit blocked: ${malformed
      .flatMap(({ parseErrors }) =>
        parseErrors.map(({ code, path, line }) => `${code} ${path}:${line}`),
      )
      .join(", ")}`,
  };
}
```

Use `parsed` for the remaining owner lookup. Keep owner statuses exactly `design`, `coding`, `fix`.

- [ ] **Step 6: Run all parser/repository/UI tests**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
```

Expected: all existing and new tests pass. Do not weaken parser diagnostics to satisfy invalid legacy fixtures; strict diagnostics apply only to active records.

- [ ] **Step 7: Prove duplicate definitions are gone**

Run:

```powershell
rg -n "function parse(Task)?Frontmatter|function parseFrontmatter|function scopeOwnsPath|function parseWriteScope" scripts/check-repository.mjs scripts/check-ui-structure-gate.mjs scripts/task-brief-state.mjs
```

Expected: parser and scope definitions appear only in `task-brief-state.mjs`.

- [ ] **Step 8: Run entry and static checks**

Run:

```powershell
pnpm repo:check
"{}" | node scripts/check-ui-structure-gate.mjs
pnpm exec eslint scripts/task-brief-state.mjs scripts/check-repository.mjs scripts/check-ui-structure-gate.mjs
pnpm exec prettier --check scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs scripts/check-repository.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.mjs scripts/check-ui-structure-gate.test.mjs
```

Expected: repository checks pass; empty hook input exits `0` without output; lint/format pass.

- [ ] **Step 9: Commit the shared-model migration**

```powershell
git add -- scripts/check-repository.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.mjs scripts/check-ui-structure-gate.test.mjs
git diff --cached --check
git commit -m "refactor(governance): share task brief parsing"
```

---

### Task 3: Add Current-Checkout Projection and Read-Only CLI

**Files:**

- Modify: `scripts/task-brief-state.mjs`
- Modify: `scripts/task-brief-state.test.mjs`
- Modify: `scripts/check-repository.mjs`
- Modify: `scripts/check-repository.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: normalized records and scope matcher from Tasks 1–2.
- Produces: task resolution, checkout observation, calibration projection/findings, text/JSON report, root `pnpm calibration:check`, and blocking integration in `repo:check`.

- [ ] **Step 1: Add failing current-task resolution tests**

Extend imports:

```js
import {
  buildCalibrationProjection,
  observeCheckout,
  resolveCurrentTask,
  runCalibrationCli,
} from "./task-brief-state.mjs";
```

Add fixture factory:

```js
const taskSource = ({
  status = "coding",
  branch = "feat/calibration",
  verification = "",
  dependsOn = [],
  scopes = ["scripts/calibration/**"],
  authorities = ["AGENTS.md"],
} = {}) => `---
status: ${status}
branch: ${branch}
verification: ${verification}
owner: main
writer: main
risk: high
dependsOn: [${dependsOn.join(", ")}]
writeScopes:
${scopes.map((scope) => `  - ${scope}`).join("\n")}
exclusiveLocks:
  - task-brief-contract
sharedIntegrationScopes: []
authorityRefs:
${authorities.map((authority) => `  - ${authority}`).join("\n")}
---
# 任务：校准
`;

const currentTask = normalizeTaskRecord({
  path: "docs/planning/tasks/calibration.md",
  source: taskSource(),
});

test("resolves an explicit brief or one active branch match", () => {
  assert.equal(
    resolveCurrentTask({
      records: [currentTask],
      branch: "feat/calibration",
    }).task.id,
    "calibration",
  );
  assert.equal(
    resolveCurrentTask({
      records: [currentTask],
      branch: "other",
      explicitBrief: "docs/planning/tasks/calibration.md",
    }).task.id,
    "calibration",
  );
});

test("fails closed for zero or ambiguous current tasks", () => {
  assert.equal(
    resolveCurrentTask({ records: [currentTask], branch: "missing" }).finding
      .code,
    "TASK_CURRENT_NOT_FOUND",
  );
  assert.equal(
    resolveCurrentTask({
      records: [
        currentTask,
        { ...currentTask, id: "other", path: "docs/planning/tasks/other.md" },
      ],
      branch: "feat/calibration",
    }).finding.code,
    "TASK_CURRENT_AMBIGUOUS",
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
```

Expected: FAIL because resolution/projection/observer/CLI exports do not exist.

- [ ] **Step 3: Implement task resolution and stable finding factory**

Add:

```js
const makeFinding = (
  code,
  severity,
  subject,
  evidence,
  remedy,
  extra = {},
) => ({
  code,
  severity,
  subject,
  evidence: [...evidence].sort(),
  remedy,
  ...extra,
});

export function resolveCurrentTask({ records, branch, explicitBrief }) {
  if (explicitBrief) {
    const expected = normalizeRepositoryPath(explicitBrief).toLowerCase();
    const task = records.find(
      (record) => record.path.toLowerCase() === expected,
    );
    return task
      ? { task }
      : {
          finding: makeFinding(
            "TASK_CURRENT_NOT_FOUND",
            "blocking",
            explicitBrief,
            [explicitBrief],
            "Pass an existing task brief path.",
          ),
        };
  }
  const matches = records.filter(
    (record) =>
      ACTIVE_TASK_STATUSES.has(record.status) && record.branch === branch,
  );
  if (matches.length === 1) return { task: matches[0] };
  return {
    finding: makeFinding(
      matches.length === 0
        ? "TASK_CURRENT_NOT_FOUND"
        : "TASK_CURRENT_AMBIGUOUS",
      "blocking",
      branch,
      matches.map(({ path }) => path),
      "Declare exactly one active task for the branch or pass --brief.",
    ),
  };
}
```

- [ ] **Step 4: Add failing four-track, authority, dependency, and branch tests**

Append:

```js
test("splits tracked and untracked paths into four ownership tracks", () => {
  const dependency = normalizeTaskRecord({
    path: "docs/planning/tasks/foundation.md",
    source: taskSource({
      status: "done",
      branch: "feat/foundation",
      verification: "CI-1",
    }),
  });
  const task = normalizeTaskRecord({
    path: "docs/planning/tasks/calibration.md",
    source: taskSource({
      dependsOn: ["foundation"],
      scopes: ["scripts/calibration/**", "docs/planning/tasks/calibration.md"],
    }),
  });
  const projection = buildCalibrationProjection({
    task,
    records: [task, dependency],
    authorityExists: (path) => path === "AGENTS.md",
    observation: {
      actualBranch: "feat/calibration",
      baseSha: "base123",
      baseSource: "explicit",
      headSha: "head456",
      committedPaths: ["scripts/calibration/core.mjs"],
      stagedPaths: ["outside/staged.txt"],
      unstagedPaths: ["scripts/calibration/core.mjs"],
      untrackedPaths: ["scripts/calibration/new.mjs", ".tmp/unrelated.json"],
    },
  });
  assert.deepEqual(projection.derived.ownedChangedPaths, [
    "scripts/calibration/core.mjs",
  ]);
  assert.deepEqual(projection.derived.blockingOutOfScopePaths, [
    "outside/staged.txt",
  ]);
  assert.deepEqual(projection.derived.ownedUntrackedPaths, [
    "scripts/calibration/new.mjs",
  ]);
  assert.deepEqual(projection.derived.unownedUntrackedPaths, [
    ".tmp/unrelated.json",
  ]);
  const warning = projection.derived.findings.find(
    ({ code }) => code === "TASK_UNOWNED_UNTRACKED_PRESENT",
  );
  assert.equal(warning.subject, "1 unowned untracked path");
  assert.deepEqual(
    projection.derived.findings.map(({ code }) => code),
    ["TASK_CHANGED_PATH_OUT_OF_SCOPE", "TASK_UNOWNED_UNTRACKED_PRESENT"],
  );
});

test("reports branch, base, authority, and dependency contradictions", () => {
  const task = normalizeTaskRecord({
    path: "docs/planning/tasks/calibration.md",
    source: taskSource({
      dependsOn: ["missing", "blocked"],
      authorities: ["AGENTS.md", "docs/missing.md"],
      scopes: ["scripts/calibration/**"],
    }),
  });
  const blocked = normalizeTaskRecord({
    path: "docs/planning/tasks/blocked.md",
    source: taskSource({ status: "blocked", branch: "feat/blocked" }),
  });
  const projection = buildCalibrationProjection({
    task,
    records: [task, blocked],
    authorityExists: (path) => path === "AGENTS.md",
    observation: {
      actualBranch: "wrong-branch",
      baseSha: null,
      baseSource: "unknown",
      headSha: "head456",
      committedPaths: ["AGENTS.md"],
      stagedPaths: [],
      unstagedPaths: [],
      untrackedPaths: [],
    },
  });
  assert.deepEqual(
    projection.derived.findings.map(({ code }) => code),
    [
      "TASK_AUTHORITY_MISSING",
      "TASK_AUTHORITY_WRITE_UNDECLARED",
      "TASK_BASE_UNKNOWN",
      "TASK_BRANCH_MISMATCH",
      "TASK_CHANGED_PATH_OUT_OF_SCOPE",
      "TASK_DEPENDENCY_MISSING",
      "TASK_DEPENDENCY_NOT_DONE",
    ],
  );
});
```

- [ ] **Step 5: Run tests and verify projection RED**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs
```

Expected: resolution tests pass; projection tests fail because projection behavior is missing.

- [ ] **Step 6: Implement pure projection, findings, and display caps**

Implementation rules:

- `trackedChangedPaths` is the deduped union of committed, staged, and unstaged paths.
- Each path is owned if any valid `writeScopes` entry matches.
- Dependencies resolve by task ID and retain declared order in data; findings stable-sort by code, subject, evidence.
- Authorities resolve only through injected `authorityExists`.
- A modified authority outside `writeScopes` emits both `TASK_AUTHORITY_WRITE_UNDECLARED` and normal out-of-scope finding.
- `TASK_UNOWNED_UNTRACKED_PRESENT` is one warning whose subject contains the total count and whose evidence contains at most the first 50 paths plus `... N more`.
- Projection arrays retain every path; text output later caps every displayed path track at 50 and shows total count.
- Every first-release finding except `TASK_UNOWNED_UNTRACKED_PRESENT` is blocking.

Use:

```js
const nextGate = (findings, task) => {
  if (findings.some(({ severity }) => severity === "blocking")) {
    return "fix-calibration-findings";
  }
  if (task.status === "design") return "approve-spec-or-plan";
  if (task.status === "coding" || task.status === "fix") {
    return "run-slice-verification";
  }
  if (task.status === "review") return "dispose-review-and-integrate";
  return "no-active-delivery-gate";
};
```

- [ ] **Step 7: Add failing observer and no-write CLI tests**

Inject a fake Git runner:

```js
test("observes explicit PR branch, base, and head with read-only Git calls", () => {
  const calls = [];
  const outputs = new Map([
    ["rev-parse --verify base123", "base123\n"],
    ["rev-parse --verify head456", "head456\n"],
    [
      "diff --name-only --diff-filter=ACMRD base123...head456",
      "scripts/a.mjs\n",
    ],
    ["diff --name-only --cached --diff-filter=ACMRD", "scripts/b.mjs\n"],
    ["diff --name-only --diff-filter=ACMRD", "scripts/c.mjs\n"],
    ["ls-files --others --exclude-standard", ".tmp/evidence.json\n"],
  ]);
  const observation = observeCheckout({
    base: "base123",
    head: "head456",
    branch: "feat/calibration",
    git: (args) => {
      const key = args.join(" ");
      calls.push(key);
      return outputs.get(key) ?? "";
    },
  });
  assert.equal(observation.actualBranch, "feat/calibration");
  assert.equal(observation.baseSource, "explicit");
  assert.equal(observation.headSha, "head456");
  assert.deepEqual(observation.committedPaths, ["scripts/a.mjs"]);
  assert.ok(
    calls.every(
      (call) => !/checkout|reset|clean|stash|add|commit|push|merge/.test(call),
    ),
  );
});

test("reports unknown base instead of inventing HEAD~1", () => {
  const observation = observeCheckout({
    baseRef: "origin/main",
    git: (args) => {
      if (args[0] === "branch") return "feat/calibration\n";
      if (args.join(" ") === "rev-parse HEAD") return "head456\n";
      throw new Error("missing ref");
    },
  });
  assert.equal(observation.baseSha, null);
  assert.equal(observation.baseSource, "unknown");
});

test("CLI check returns findings without writing files", async () => {
  const writes = [];
  const result = await runCalibrationCli(
    ["--brief", "docs/planning/tasks/calibration.md", "--base", "base123"],
    {
      loadRecords: () => [
        {
          path: "docs/planning/tasks/calibration.md",
          source: taskSource(),
        },
      ],
      observe: () => ({
        actualBranch: "feat/calibration",
        baseSha: "base123",
        baseSource: "explicit",
        headSha: "head456",
        committedPaths: [],
        stagedPaths: [],
        unstagedPaths: [],
        untrackedPaths: [],
      }),
      authorityExists: () => true,
      write: (...args) => writes.push(args),
    },
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(writes, []);
  assert.match(result.stdout, /calibration: pass/);
});
```

- [ ] **Step 8: Implement observer, formatter, and CLI**

Add imports only now:

```js
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
```

Observer rules:

- With explicit `head`, verify it and compare `<base>...<head>`; with explicit `branch`, do not call `branch --show-current`.
- Without explicit head, use verified `git rev-parse HEAD` and compare `<base>...HEAD`.
- Explicit `base` is verified and yields `baseSource="explicit"`.
- Otherwise verify `baseRef` (default `origin/main`) and call `merge-base <baseRef> <head>`; failures produce `{ baseSha: null, baseSource: "unknown" }`.
- Branch/head failures are not silently defaulted.
- Split output with `output.split(/\r?\n/).filter(Boolean).map(normalizeRepositoryPath).sort()`.

CLI arguments:

```text
--brief PATH
--base SHA
--base-ref REF
--branch NAME
--head SHA
--json
--ci
```

`--ci` requires explicit base, head, and branch from arguments or `BASE_SHA`, `HEAD_SHA`, `HEAD_BRANCH` environment variables.

Text output starts `calibration: pass|fail`, names brief/base/head, prints every finding as `[blocking|warning] CODE subject`, and caps each displayed path list at 50 while showing total count. JSON output serializes the full projection.

Direct execution:

```js
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await runCalibrationCli(
    process.argv.slice(2),
    defaultDependencies(),
  );
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
```

- [ ] **Step 9: Add root command and repository integration**

In `package.json` add:

```json
"calibration:check": "node scripts/task-brief-state.mjs"
```

Add `scripts/task-brief-state.test.mjs` to the root `test` node-test list.

In `check-repository.mjs`, after task status checks, run current-checkout blocking calibration only when:

- not `docsOnly`;
- actual branch is neither `main` nor `master` and is not detached;
- exactly one active task declares that branch.

Warnings are omitted from `repo:check` errors. Explicit `calibration:check` remains the full report.

Add repository tests with an injected projection/finding function so tests do not depend on the real branch:

```js
test("repo check converts blocking calibration findings to errors", () => {
  const errors = calibrationErrors({
    findings: [
      {
        code: "TASK_CHANGED_PATH_OUT_OF_SCOPE",
        severity: "blocking",
        subject: "outside.txt",
        evidence: ["outside.txt"],
      },
      {
        code: "TASK_UNOWNED_UNTRACKED_PRESENT",
        severity: "warning",
        subject: "1 unowned untracked path",
        evidence: [".tmp/evidence.json"],
      },
    ],
  });
  assert.deepEqual(errors, [
    "TASK_CHANGED_PATH_OUT_OF_SCOPE outside.txt: outside.txt",
  ]);
});
```

- [ ] **Step 10: Run slice behavior on fixtures and the real branch**

Run:

```powershell
node --test scripts/task-brief-state.test.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
pnpm calibration:check -- --brief docs/planning/tasks/transparent-development-calibration-v1.md --base 52c7c0de
pnpm repo:check
pnpm exec eslint scripts/task-brief-state.mjs scripts/check-repository.mjs scripts/check-ui-structure-gate.mjs
pnpm exec prettier --check scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs scripts/check-repository.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.mjs scripts/check-ui-structure-gate.test.mjs package.json
```

Expected:

- all tests and static checks pass;
- the real calibration reports `.claude/worktrees/`, `.tmp/`, and `apps/api/.tmp/` only under `TASK_UNOWNED_UNTRACKED_PRESENT` warning and exits `0`;
- every tracked path since the approved design base is inside the brief `writeScopes`;
- no command writes files.

If execution starts after an additional approved plan commit, use that plan commit SHA as `--base` and record the ruling in the SDD ledger instead of silently retaining `52c7c0de`.

- [ ] **Step 11: Commit current-checkout calibration**

```powershell
git add -- scripts/task-brief-state.mjs scripts/task-brief-state.test.mjs scripts/check-repository.mjs scripts/check-repository.test.mjs package.json
git diff --cached --check
git commit -m "feat(governance): reconcile task scope with checkout"
```

---

### Task 4: Verify and Record the First Thin Slice

**Files:**

- Modify: `docs/planning/tasks/transparent-development-calibration-v1.md`
- Verify: all files modified by Tasks 1–3

**Interfaces:**

- Consumes: shared parser, migrated gates, and read-only calibration CLI.
- Produces: a committed, independently usable first slice and exact evidence for planning the later board/CI slices. It does not complete the overall brief.

- [ ] **Step 1: Run the focused suites**

```powershell
node --test scripts/task-brief-state.test.mjs scripts/check-repository.test.mjs scripts/check-ui-structure-gate.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run repository and root static gates**

```powershell
pnpm calibration:check -- --brief docs/planning/tasks/transparent-development-calibration-v1.md --base 52c7c0de
pnpm repo:check
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm format:check
git diff --check
```

Expected: every configured gate exits `0`. If root `format:check` sees only unrelated untracked `.tmp` evidence, run exact tracked/PR-scope formatting, record the blocker by path, and leave those files untouched.

- [ ] **Step 3: Check actual scope and secrets**

```powershell
git diff --name-only 52c7c0de...HEAD
git diff --check 52c7c0de...HEAD
git status --short
```

Expected:

- every tracked changed path belongs to this brief;
- `.claude/worktrees/`, `.tmp/`, and `apps/api/.tmp/` remain untracked/unowned;
- no logs, credentials, test results, or external evidence are staged.

- [ ] **Step 4: Append first-slice evidence without changing overall status to done**

Keep `status: design` until the implementation plan is approved. At execution start change it to `coding`. After this slice, keep `coding` because TDC3/TDC4 remain. Append a progress row containing:

- parser/repository/UI test counts;
- actual calibration base/head;
- four path-track counts;
- warning codes;
- lint/typecheck/format/repo/docs results;
- current commit;
- explicit next step: write the progress-board thin-slice plan.

- [ ] **Step 5: Format and commit the slice record**

```powershell
pnpm exec prettier --write docs/planning/tasks/transparent-development-calibration-v1.md
pnpm exec prettier --check docs/planning/tasks/transparent-development-calibration-v1.md
git add -- docs/planning/tasks/transparent-development-calibration-v1.md
git diff --cached --check
git commit -m "docs(governance): record checkout calibration slice"
```

- [ ] **Step 6: Preserve continuation boundaries**

Do not create a PR or dispatch the final whole-branch review yet. The same brief and branch continue with two later thin plans:

1. progress-board visual vertical slice and `board:check`;
2. CI static wiring, final full verification, fresh whole-branch review, PR/CI/merge, and brief closeout.

Delete only this plan's SDD workspace after Task 4 is complete. Do not remove any worktree or unrelated `.tmp` directory.

---

## Implementation Notes

- `check-repository.mjs` remains the broad policy aggregator. `calibration:check` is the focused current-task report.
- Do not parse task-body prose into mutable slice state.
- Do not read untracked contents. Paths are sufficient for attribution.
- Do not copy authority content into the projection. Show path and existence only.
- Do not make every main checkout require an active brief.
- Do not revive `thin-agent-orchestrator-v1.md`; its role model conflicts with current governance.
- Do not implement progress-board or CI workflow changes in this plan, even if the shared projection makes them easy. Their design is approved, but they remain separate implementation slices.
