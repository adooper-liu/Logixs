import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWorktreeCalibrationProjection,
  classifyWorktree,
  observeRegisteredWorktrees,
  parseWorktreePorcelain,
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
