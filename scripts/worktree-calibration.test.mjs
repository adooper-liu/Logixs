import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  buildWorktreeCalibrationProjection,
  classifyWorktree,
  observeRegisteredWorktrees,
  parseWorktreePorcelain,
  runReadOnlyGit,
  runWorktreeCalibrationCli,
} from "./worktree-calibration.mjs";
import { normalizeTaskRecord } from "./task-brief-state.mjs";

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

const primaryObservation = (overrides = {}) => ({
  ...observation(),
  isPrimary: true,
  state: "primary",
  registration: {
    ...observation().registration,
    path: "D:/repo",
    branch: "main",
  },
  ...overrides,
});

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

test("dormant merged is informational while dormant ahead only warns", () => {
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [],
    observedWorktrees: [
      primaryObservation(),
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
    observedWorktrees: [primaryObservation(), dirty],
  });
  assert.deepEqual(
    projection.findings.map(({ code, severity }) => [code, severity]),
    [
      ["WORKTREE_TRACKED_DIRTY_UNOWNED", "blocking"],
      ["WORKTREE_UNOWNED_UNTRACKED_PRESENT", "warning"],
    ],
  );
});

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
      primaryObservation(),
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
  const codingA = task("a", {
    branch: "feat/a",
    writer: "a",
    writeScopes: ["scripts/a/**"],
    locks: ["a-lock"],
  });
  const codingB = task("b", {
    branch: "feat/b",
    writer: "b",
    writeScopes: ["scripts/b/**"],
    locks: ["b-lock"],
  });
  const review = task("review", {
    status: "review",
    branch: "feat/review",
  });
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [codingA, codingB, review],
    observedWorktrees: [
      primaryObservation(),
      activeWorktree("D:/repo/.worktrees/a", codingA),
      activeWorktree("D:/repo/.worktrees/b", codingB),
      activeWorktree("D:/repo/.worktrees/review", review),
    ],
  });
  assert.deepEqual(projection.findings, []);
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
      primaryObservation(),
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

test("primary catalog retires merged stale tasks but preserves new ahead tasks", () => {
  const retired = task("retired", {
    status: "done",
    branch: "feat/retired",
    verification: "PR merged",
  });
  const staleReview = { ...retired, status: "review", verification: "" };
  const newTask = task("new-task", { branch: "feat/new-task" });
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [retired],
    observedWorktrees: [
      primaryObservation(),
      activeWorktree("D:/repo/.worktrees/retired", staleReview, {
        ahead: 0,
        fullyMerged: true,
      }),
      activeWorktree("D:/repo/.worktrees/new-task", newTask, {
        ahead: 2,
        fullyMerged: false,
      }),
    ],
  });

  assert.equal(
    projection.worktrees.find(({ registration }) =>
      registration.path.endsWith("/retired"),
    ).state,
    "dormant-merged",
  );
  assert.equal(
    projection.worktrees.find(({ registration }) =>
      registration.path.endsWith("/new-task"),
    ).state,
    "active",
  );
  assert.deepEqual(
    projection.activeTasks.map(({ task }) => task.id),
    ["new-task"],
  );
});

test("primary done suppresses stale local dependency blockers only", () => {
  const foundation = task("foundation", {
    status: "done",
    branch: "feat/foundation",
    verification: "PR merged",
  });
  const consumer = task("consumer", {
    branch: "feat/consumer",
    dependsOn: ["foundation"],
    writer: "consumer",
    writeScopes: ["scripts/consumer/**"],
    locks: ["consumer-lock"],
  });
  const localDependencyFindings = [
    {
      code: "TASK_DEPENDENCY_MISSING",
      severity: "blocking",
      subject: "foundation",
      evidence: ["foundation"],
      remedy: "Use primary truth.",
    },
    {
      code: "TASK_DEPENDENCY_NOT_DONE",
      severity: "blocking",
      subject: "foundation",
      evidence: ["status=blocked"],
      remedy: "Use primary truth.",
    },
    {
      code: "TASK_CHANGED_PATH_OUT_OF_SCOPE",
      severity: "blocking",
      subject: "outside.txt",
      evidence: ["outside.txt"],
      remedy: "Declare or remove it.",
    },
  ];
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [foundation, consumer],
    observedWorktrees: [
      primaryObservation(),
      activeWorktree("D:/repo/.worktrees/consumer", consumer, {
        taskRecords: [consumer],
        checkoutProjection: {
          task: consumer,
          derived: { findings: localDependencyFindings },
        },
      }),
    ],
  });

  assert.deepEqual(
    projection.findings.map(({ code }) => code),
    ["TASK_CHANGED_PATH_OUT_OF_SCOPE"],
  );
});

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
      primaryObservation(),
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

test("primary, unreadable, ambiguity, detached, and checkout findings stay explicit", () => {
  const active = task("active", {
    branch: "feat/active",
    writer: "active",
    writeScopes: ["scripts/active/**"],
    locks: ["active-lock"],
  });
  const activeObservation = activeWorktree(
    "D:/repo/.worktrees/active",
    active,
    {
      checkoutProjection: {
        task: active,
        derived: {
          findings: [
            {
              code: "TASK_CHANGED_PATH_OUT_OF_SCOPE",
              severity: "blocking",
              subject: "outside.txt",
              evidence: ["outside.txt"],
              remedy: "Remove or declare it.",
            },
          ],
        },
      },
    },
  );
  const ambiguous = {
    ...observation(),
    registration: {
      ...observation().registration,
      path: "D:/repo/.worktrees/ambiguous",
    },
    activeResolution: {
      finding: {
        code: "TASK_CURRENT_AMBIGUOUS",
        evidence: ["a.md", "b.md"],
      },
    },
  };
  const unreadable = {
    ...observation({ readable: false, readError: "GIT_READ_FAILED" }),
    registration: {
      ...observation().registration,
      path: "D:/repo/.worktrees/unreadable",
    },
    state: "unreadable",
  };
  const detached = {
    ...observation({ ahead: 1, fullyMerged: false }),
    registration: {
      ...observation().registration,
      path: "D:/repo/.worktrees/detached",
      branch: null,
      detached: true,
    },
    state: "dormant-ahead",
  };
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: "D:/repo",
    mainRef: "origin/main",
    primaryTaskRecords: [active],
    observedWorktrees: [
      primaryObservation({ trackedDirtyPaths: ["primary.txt"] }),
      activeObservation,
      ambiguous,
      unreadable,
      detached,
    ],
  });
  assert.deepEqual(
    projection.findings.map(({ code }) => code),
    [
      "TASK_CHANGED_PATH_OUT_OF_SCOPE",
      "WORKTREE_ACTIVE_TASK_AMBIGUOUS",
      "WORKTREE_DETACHED_HEAD",
      "WORKTREE_DORMANT_AHEAD",
      "WORKTREE_PRIMARY_INVALID",
      "WORKTREE_READ_FAILED",
    ],
  );
});

const gitResult = (stdout = "", exitCode = 0) => ({ stdout, exitCode });

const adapterTaskSource = ({
  status = "coding",
  branch = "feat/example",
  scopes = ["scripts/example/**"],
} = {}) => `---
status: ${status}
branch: ${branch}
verification:
owner: main
writer: main
risk: high
dependsOn: []
writeScopes:
${scopes.map((scope) => `  - ${scope}`).join("\n")}
exclusiveLocks:
  - root-tooling
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
---
# 任务：Adapter
`;

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
    ["D:/repo|worktree list --porcelain -z", gitResult(registry)],
    ["D:/repo|branch --show-current", gitResult("main\n")],
    ["D:/repo|rev-parse HEAD", gitResult(`${"1".repeat(40)}\n`)],
    [
      "D:/repo|rev-parse --verify origin/main",
      gitResult(`${"1".repeat(40)}\n`),
    ],
    [
      "D:/repo|rev-list --left-right --count origin/main...HEAD",
      gitResult("0\t0\n"),
    ],
    ["D:/repo|merge-base --is-ancestor HEAD origin/main", gitResult("")],
    ["D:/repo|merge-base origin/main HEAD", gitResult(`${"1".repeat(40)}\n`)],
    [
      `D:/repo|diff --name-status -z --diff-filter=ACMRD ${"1".repeat(40)}...HEAD`,
      gitResult(""),
    ],
    [
      "D:/repo|diff --name-status -z --cached --diff-filter=ACMRD",
      gitResult(""),
    ],
    ["D:/repo|diff --name-status -z --diff-filter=ACMRD", gitResult("")],
    [
      "D:/repo|ls-files --others --exclude-standard",
      gitResult(".tmp/local.txt\n"),
    ],
    [
      "D:/repo|ls-files -z -- docs/planning/tasks/*.md",
      gitResult("docs/planning/tasks/foundation.md\0"),
    ],
    [
      "D:/repo/.worktrees/example|branch --show-current",
      gitResult("feat/example\n"),
    ],
    [
      "D:/repo/.worktrees/example|rev-parse HEAD",
      gitResult(`${"2".repeat(40)}\n`),
    ],
    [
      "D:/repo/.worktrees/example|rev-parse --verify origin/main",
      gitResult(`${"1".repeat(40)}\n`),
    ],
    [
      "D:/repo/.worktrees/example|merge-base origin/main HEAD",
      gitResult(`${"1".repeat(40)}\n`),
    ],
    [
      `D:/repo/.worktrees/example|diff --name-status -z --diff-filter=ACMRD ${"1".repeat(40)}...HEAD`,
      gitResult(""),
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --cached --diff-filter=ACMRD",
      gitResult(""),
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --diff-filter=ACMRD",
      gitResult(""),
    ],
    [
      "D:/repo/.worktrees/example|rev-list --left-right --count origin/main...HEAD",
      gitResult("5\t1\n"),
    ],
    [
      "D:/repo/.worktrees/example|merge-base --is-ancestor HEAD origin/main",
      gitResult("", 1),
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --diff-filter=ACMRD",
      gitResult(""),
    ],
    [
      "D:/repo/.worktrees/example|diff --name-status -z --cached --diff-filter=ACMRD",
      gitResult(""),
    ],
    [
      "D:/repo/.worktrees/example|ls-files --others --exclude-standard",
      gitResult("draft.md\n"),
    ],
    [
      "D:/repo/.worktrees/example|ls-files -z -- docs/planning/tasks/*.md",
      gitResult("docs/planning/tasks/example.md\0"),
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
        ? adapterTaskSource({ status: "done", branch: "feat/foundation" })
        : adapterTaskSource();
    },
    authorityExists: () => true,
  });

  assert.equal(result.length, 2);
  assert.deepEqual(reads.sort(), [
    "D:/repo/.worktrees/example/docs/planning/tasks/example.md",
    "D:/repo/docs/planning/tasks/foundation.md",
  ]);
  assert.equal(result[0].state, "primary");
  assert.equal(result[1].state, "active");
  assert.ok(
    calls.every(
      (call) =>
        !/\b(checkout|reset|clean|stash|add|commit|push|merge|rebase|fetch|pull)\b/.test(
          call,
        ) || call.includes("merge-base"),
    ),
  );
});

const adapterFixture = ({
  failCwd,
  registryFails = false,
  untracked = [],
  dirtyByCwd = new Map(),
  detachedHealthy = false,
} = {}) => {
  const primary = "D:/repo";
  const healthy = "D:/repo/.worktrees/healthy";
  const broken = "D:/repo/.worktrees/broken";
  const mainHead = "1".repeat(40);
  const healthyHead = "2".repeat(40);
  const brokenHead = "3".repeat(40);
  const registry = [
    `worktree ${primary}`,
    `HEAD ${mainHead}`,
    "branch refs/heads/main",
    "",
    `worktree ${healthy}`,
    `HEAD ${healthyHead}`,
    detachedHealthy ? "detached" : "branch refs/heads/feat/healthy",
    "",
    `worktree ${broken}`,
    `HEAD ${brokenHead}`,
    "branch refs/heads/feat/broken",
    "",
  ].join("\0");
  const heads = new Map([
    [primary, mainHead],
    [healthy, healthyHead],
    [broken, brokenHead],
  ]);
  const branches = new Map([
    [primary, "main"],
    [healthy, detachedHealthy ? "" : "feat/healthy"],
    [broken, "feat/broken"],
  ]);
  const reads = [];
  const git = ({ cwd, args }) => {
    const command = args.join(" ");
    if (registryFails && command === "worktree list --porcelain -z") {
      throw new Error("registry failed");
    }
    if (command === "worktree list --porcelain -z") return gitResult(registry);
    if (cwd === failCwd) throw new Error("worktree failed");
    if (command === "branch --show-current") {
      return gitResult(`${branches.get(cwd)}\n`);
    }
    if (command === "rev-parse HEAD") return gitResult(`${heads.get(cwd)}\n`);
    if (command === "rev-parse --verify origin/main") {
      return gitResult(`${mainHead}\n`);
    }
    if (command === "merge-base origin/main HEAD") {
      return gitResult(`${mainHead}\n`);
    }
    if (command.startsWith("diff --name-status -z --diff-filter=ACMRD ")) {
      return gitResult("");
    }
    if (command === "diff --name-status -z --cached --diff-filter=ACMRD") {
      return gitResult("");
    }
    if (command === "diff --name-status -z --diff-filter=ACMRD") {
      return gitResult(dirtyByCwd.get(cwd) ?? "");
    }
    if (command === "ls-files --others --exclude-standard") {
      return gitResult(cwd === healthy ? `${untracked.join("\n")}\n` : "");
    }
    if (command === "ls-files -z -- docs/planning/tasks/*.md") {
      return gitResult(
        cwd === primary
          ? "docs/planning/tasks/foundation.md\0"
          : `docs/planning/tasks/${branches.get(cwd).slice(5)}.md\0`,
      );
    }
    if (command === "rev-list --left-right --count origin/main...HEAD") {
      return gitResult(cwd === primary ? "0\t0\n" : "1\t0\n");
    }
    if (command === "merge-base --is-ancestor HEAD origin/main") {
      return gitResult("", cwd === primary ? 0 : 1);
    }
    throw new Error(`unexpected ${cwd}|${command}`);
  };
  return {
    options: {
      primaryPath: primary,
      mainRef: "origin/main",
      git,
      readFile: (path) => {
        reads.push(path.replaceAll("\\", "/"));
        const branch = path.includes("foundation")
          ? "feat/foundation"
          : path.includes("healthy")
            ? "feat/healthy"
            : "feat/broken";
        return adapterTaskSource({
          status: path.includes("foundation") ? "done" : "coding",
          branch,
        });
      },
      authorityExists: () => true,
    },
    reads,
    paths: { primary, healthy, broken },
  };
};

test("observer matches a native Windows primary path to normalized registry spelling", () => {
  const registry = [
    "worktree D:/repo",
    `HEAD ${"1".repeat(40)}`,
    "branch refs/heads/main",
    "",
  ].join("\0");
  const git = ({ cwd, args }) => {
    const command = args.join(" ");
    if (command === "worktree list --porcelain -z") {
      assert.equal(cwd, "D:\\repo");
      return gitResult(registry);
    }
    assert.equal(cwd, "D:/repo");
    if (command === "branch --show-current") return gitResult("main\n");
    if (command === "rev-parse HEAD") return gitResult(`${"1".repeat(40)}\n`);
    if (command === "rev-parse --verify origin/main") {
      return gitResult(`${"1".repeat(40)}\n`);
    }
    if (command === "merge-base origin/main HEAD") {
      return gitResult(`${"1".repeat(40)}\n`);
    }
    if (command.startsWith("diff --name-status -z")) return gitResult("");
    if (command === "ls-files --others --exclude-standard") {
      return gitResult("");
    }
    if (command === "ls-files -z -- docs/planning/tasks/*.md") {
      return gitResult("");
    }
    if (command === "rev-list --left-right --count origin/main...HEAD") {
      return gitResult("0\t0\n");
    }
    if (command === "merge-base --is-ancestor HEAD origin/main") {
      return gitResult("");
    }
    throw new Error(`unexpected ${command}`);
  };

  const observed = observeRegisteredWorktrees({
    primaryPath: "D:\\repo",
    mainRef: "origin/main",
    git,
    readFile: () => "",
    authorityExists: () => true,
  });
  assert.equal(observed[0].isPrimary, true);
});

test("one unreadable non-primary worktree does not hide readable siblings", () => {
  const fixture = adapterFixture({ failCwd: "D:/repo/.worktrees/broken" });
  const observed = observeRegisteredWorktrees(fixture.options);
  assert.equal(
    observed.find(
      ({ registration }) => registration.path === fixture.paths.broken,
    ).readable,
    false,
  );
  assert.equal(
    observed.find(
      ({ registration }) => registration.path === fixture.paths.healthy,
    ).readable,
    true,
  );
});

test("untracked poison brief is listed but never opened", () => {
  const fixture = adapterFixture({
    untracked: ["docs/planning/tasks/poison.md"],
  });
  const observed = observeRegisteredWorktrees(fixture.options);
  assert.ok(
    observed.some(({ untrackedPaths }) =>
      untrackedPaths.includes("docs/planning/tasks/poison.md"),
    ),
  );
  assert.ok(fixture.reads.every((path) => !path.endsWith("poison.md")));
});

test("primary registry failure is fatal and stable", () => {
  const fixture = adapterFixture({ registryFails: true });
  assert.throws(
    () => observeRegisteredWorktrees(fixture.options),
    ({ code, message }) =>
      code === "WORKTREE_REGISTRY_READ_FAILED" &&
      message === "WORKTREE_REGISTRY_READ_FAILED",
  );
});

test("adapter preserves rename source and target through shared checkout observation", () => {
  const fixture = adapterFixture({
    dirtyByCwd: new Map([
      [
        "D:/repo/.worktrees/healthy",
        "R100\0outside/source.txt\0scripts/example/target.txt\0",
      ],
    ]),
  });
  const observed = observeRegisteredWorktrees(fixture.options);
  const healthy = observed.find(
    ({ registration }) => registration.path === fixture.paths.healthy,
  );
  assert.deepEqual(healthy.checkoutProjection.derived.blockingOutOfScopePaths, [
    "outside/source.txt",
  ]);
  assert.deepEqual(healthy.trackedDirtyPaths, [
    "outside/source.txt",
    "scripts/example/target.txt",
  ]);
});

test("detached tracked dirt remains unowned and produces both findings", () => {
  const fixture = adapterFixture({
    detachedHealthy: true,
    dirtyByCwd: new Map([["D:/repo/.worktrees/healthy", "M\0outside.txt\0"]]),
  });
  const observed = observeRegisteredWorktrees(fixture.options);
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: fixture.paths.primary,
    mainRef: "origin/main",
    primaryTaskRecords: observed.find(({ isPrimary }) => isPrimary).taskRecords,
    observedWorktrees: observed,
  });
  const healthy = projection.worktrees.find(
    ({ registration }) => registration.path === fixture.paths.healthy,
  );
  assert.equal(healthy.state, "unowned-dirty");
  assert.ok(
    projection.findings.some(
      ({ code, worktreePath }) =>
        code === "WORKTREE_DETACHED_HEAD" &&
        worktreePath === fixture.paths.healthy,
    ),
  );
  assert.ok(
    projection.findings.some(
      ({ code, worktreePath }) =>
        code === "WORKTREE_TRACKED_DIRTY_UNOWNED" &&
        worktreePath === fixture.paths.healthy,
    ),
  );
});

const cliProjection = ({ blocking = false, untrackedCount = 1 } = {}) => ({
  primaryTaskRecords: [],
  worktrees: [
    primaryObservation(),
    {
      ...observation({
        ahead: 1,
        fullyMerged: false,
        untrackedPaths: Array.from(
          { length: untrackedCount },
          (_, index) => `.tmp/path-${index}.txt`,
        ),
        trackedDirtyPaths: blocking ? ["outside.txt"] : [],
      }),
      registration: {
        ...observation().registration,
        path: "D:/repo/.worktrees/ahead",
        branch: "ahead",
      },
      state: blocking ? "unowned-dirty" : "dormant-ahead",
    },
  ],
});

const cliDependencies = (fixture) => ({
  primaryPath: "D:/repo",
  observe: () => fixture.worktrees,
  loadPrimaryTasks: () => fixture.primaryTaskRecords,
});

test("CLI returns warning-only success without writes", async () => {
  const writes = [];
  const result = await runWorktreeCalibrationCli([], {
    ...cliDependencies(cliProjection()),
    writeFile: (...args) => writes.push(args),
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /worktree calibration: pass/);
  assert.match(result.stdout, /WORKTREE_DORMANT_AHEAD/);
  assert.deepEqual(writes, []);
});

test("CLI returns one for blocking and two for usage or registry failure", async () => {
  const blocked = await runWorktreeCalibrationCli(
    [],
    cliDependencies(cliProjection({ blocking: true })),
  );
  assert.equal(blocked.exitCode, 1);

  const usage = await runWorktreeCalibrationCli(
    ["--unknown"],
    cliDependencies(cliProjection()),
  );
  assert.equal(usage.exitCode, 2);
  assert.match(usage.stderr, /unknown argument/);

  const registry = await runWorktreeCalibrationCli([], {
    ...cliDependencies(cliProjection()),
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

test("JSON output retains complete path arrays and validates primary", async () => {
  const result = await runWorktreeCalibrationCli(
    ["--", "--json", "--primary", "D:/repo", "--main-ref", "refs/heads/main"],
    cliDependencies(cliProjection({ untrackedCount: 55 })),
  );
  const projection = JSON.parse(result.stdout);
  assert.equal(projection.primary.mainRef, "refs/heads/main");
  assert.equal(projection.worktrees[1].untrackedPaths.length, 55);

  const textResult = await runWorktreeCalibrationCli(
    ["--primary", "D:/repo"],
    cliDependencies(cliProjection({ untrackedCount: 55 })),
  );
  assert.equal(
    (textResult.stdout.match(/^ {2}- \.tmp\/path-/gm) ?? []).length,
    50,
  );
  assert.match(textResult.stdout, /\.\.\. 5 more/);

  const relative = await runWorktreeCalibrationCli(
    ["--primary", "relative/path"],
    cliDependencies(cliProjection()),
  );
  assert.equal(relative.exitCode, 2);
  assert.match(relative.stderr, /absolute path/);
});

const temporaryRoots = [];
after(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const testGit = (cwd, ...args) =>
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

const writeTask = (root, name, source) => {
  const directory = join(root, "docs/planning/tasks");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${name}.md`), source, "utf8");
};

const createTemporaryWorktreeRepository = () => {
  const root = mkdtempSync(join(tmpdir(), "logix-worktrees-"));
  temporaryRoots.push(root);
  testGit(root, "init", "-b", "main");
  writeTask(
    root,
    "foundation",
    taskSource({
      status: "done",
      branch: "feat/foundation",
      verification: "CI",
      writer: "foundation",
      writeScopes: ["docs/foundation.md"],
      locks: ["foundation-lock"],
    }),
  );
  writeFileSync(join(root, "README.md"), "root\n", "utf8");
  testGit(root, "add", "README.md", "docs/planning/tasks/foundation.md");
  testGit(root, "commit", "-m", "base");

  const directory = join(root, "worktrees");
  const merged = join(directory, "merged");
  const ahead = join(directory, "有 空格 ahead");
  const dirty = join(directory, "dirty");
  const active = join(directory, "active");
  const detached = join(directory, "detached");
  mkdirSync(directory, { recursive: true });

  testGit(root, "worktree", "add", "-b", "merged", merged, "main");
  testGit(root, "worktree", "add", "-b", "ahead", ahead, "main");
  writeFileSync(join(ahead, "ahead.txt"), "ahead\n", "utf8");
  testGit(ahead, "add", "ahead.txt");
  testGit(ahead, "commit", "-m", "ahead");

  testGit(root, "worktree", "add", "-b", "dirty", dirty, "main");
  writeFileSync(join(dirty, "README.md"), "dirty\n", "utf8");

  testGit(root, "worktree", "add", "-b", "active", active, "main");
  writeTask(
    active,
    "active",
    taskSource({
      branch: "active",
      writer: "active",
      writeScopes: ["scripts/active/**"],
      locks: ["active-lock"],
    }),
  );
  testGit(active, "add", "docs/planning/tasks/active.md");
  testGit(active, "commit", "-m", "active brief");
  writeTask(
    active,
    "poison",
    taskSource({ branch: "active", writer: "poison" }),
  );

  testGit(root, "worktree", "add", "--detach", detached, "main");
  return { root, paths: { merged, ahead, dirty, active, detached } };
};

const stateCounts = (worktrees) =>
  Object.fromEntries(
    [...new Set(worktrees.map(({ state }) => state))]
      .sort()
      .map((state) => [
        state,
        worktrees.filter((worktree) => worktree.state === state).length,
      ]),
  );

test("real Git registry classifies merged, ahead, dirty, active, and detached worktrees", () => {
  const fixture = createTemporaryWorktreeRepository();
  const reads = [];
  const observed = observeRegisteredWorktrees({
    primaryPath: fixture.root.replaceAll("\\", "/"),
    mainRef: "main",
    git: runReadOnlyGit,
    readFile: (path, encoding) => {
      reads.push(path.replaceAll("\\", "/"));
      return readFileSync(path, encoding);
    },
    authorityExists: () => true,
  });
  const primary = observed.find(({ isPrimary }) => isPrimary);
  const projection = buildWorktreeCalibrationProjection({
    primaryPath: fixture.root.replaceAll("\\", "/"),
    mainRef: "main",
    primaryTaskRecords: primary.taskRecords,
    observedWorktrees: observed,
  });

  assert.deepEqual(stateCounts(projection.worktrees), {
    active: 1,
    "dormant-ahead": 1,
    "dormant-merged": 2,
    primary: 1,
    "unowned-dirty": 1,
  });
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
  assert.ok(reads.every((path) => !path.endsWith("poison.md")));
});
