import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCalibrationProjection,
  normalizeTaskRecord,
  observeCheckout,
  parseTaskFrontmatter,
  parseWriteScope,
  resolveCurrentTask,
  runCalibrationCli,
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
      parseWriteScope("apps/api/src/contracts/**"),
      parseWriteScope("apps/api/**"),
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
        {
          ...currentTask,
          id: "other",
          path: "docs/planning/tasks/other.md",
        },
      ],
      branch: "feat/calibration",
    }).finding.code,
    "TASK_CURRENT_AMBIGUOUS",
  );
});

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
      const key = args.join(" ");
      if (args[0] === "branch") return "feat/calibration\n";
      if (key === "rev-parse HEAD") return "head456\n";
      if (key === "rev-parse --verify origin/main") {
        throw new Error("missing ref");
      }
      return "";
    },
  });
  assert.equal(observation.baseSha, null);
  assert.equal(observation.baseSource, "unknown");
});

test("rejects authority references that escape the repository", () => {
  const checked = [];
  const task = normalizeTaskRecord({
    path: "docs/planning/tasks/calibration.md",
    source: taskSource({ authorities: ["../outside.md"] }),
  });
  const projection = buildCalibrationProjection({
    task,
    records: [task],
    authorityExists: (path) => {
      checked.push(path);
      return true;
    },
    observation: {
      actualBranch: "feat/calibration",
      baseSha: "base123",
      baseSource: "explicit",
      headSha: "head456",
      committedPaths: [],
      stagedPaths: [],
      unstagedPaths: [],
      untrackedPaths: [],
    },
  });
  assert.deepEqual(checked, []);
  assert.equal(projection.derived.findings[0].code, "TASK_AUTHORITY_MISSING");
});

test("returns unknown for an explicit base that cannot be verified", () => {
  const observation = observeCheckout({
    base: "missing-base",
    branch: "feat/calibration",
    git: (args) => {
      const key = args.join(" ");
      if (key === "rev-parse HEAD") return "head456\n";
      if (key === "rev-parse --verify missing-base") {
        throw new Error("missing ref");
      }
      return "";
    },
  });
  assert.equal(observation.baseSha, null);
  assert.equal(observation.baseSource, "unknown");
});

test("CLI converts checkout observation failures to a stable error", async () => {
  const result = await runCalibrationCli([], {
    loadRecords: () => [],
    observe: () => {
      throw new Error("sensitive absolute path");
    },
    authorityExists: () => true,
  });
  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "calibration observation failed: GIT_READ_FAILED\n",
  );
  assert.doesNotMatch(result.stderr, /sensitive|Error:|at /);
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
