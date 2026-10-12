import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWorktreeCalibrationProjection,
  classifyWorktree,
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
