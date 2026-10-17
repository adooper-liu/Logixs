import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import {
  buildContinuationProjection,
  formatContinuationContext,
  parseContinuationPointer,
  resolveContinuationTarget,
} from "./continuation-gateway.mjs";
import {
  buildCalibrationProjection,
  normalizeTaskRecord,
} from "./task-brief-state.mjs";

const moduleUrl = new URL("./continuation-gateway.mjs", import.meta.url);

test("continuation projection exposes its pure public interface", async () => {
  assert.equal(
    existsSync(moduleUrl),
    true,
    "scripts/continuation-gateway.mjs must exist before it can be imported",
  );

  const projection = await import(moduleUrl);
  assert.deepEqual(
    [...projection.CONTINUATION_ACTIONS],
    ["idle", "resume", "review-handoff", "select"],
  );
  assert.deepEqual(
    [...projection.CONTINUATION_SAFETY],
    ["clear", "protect-read-only", "block-target"],
  );
  assert.equal(typeof projection.parseContinuationPointer, "function");
  assert.equal(typeof projection.resolveContinuationTarget, "function");
  assert.equal(typeof projection.buildContinuationProjection, "function");
  assert.equal(typeof projection.formatContinuationContext, "function");
  assert.equal(resolveContinuationTarget(fixture()).action, "idle");
});

const workspace = {
  path: "D:/Logixs",
  branch: "main",
  head: "a".repeat(40),
  mainRef: "origin/main",
};

const identityObservation = (overrides = {}) => ({
  baseResolvable: true,
  commitResolvable: true,
  baseIsAncestorOfHead: true,
  reproducesDiff: true,
  observedHead: workspace.head,
  ...overrides,
});

const task = (overrides = {}) => ({
  id: "example-v1",
  path: "docs/planning/tasks/example-v1.md",
  title: "Example V1",
  status: "coding",
  branch: "feat/example-v1",
  writer: "codex",
  risk: "high",
  verification: "",
  dependsOn: [],
  writeScopes: ["scripts/example/**"],
  exclusiveLocks: ["example"],
  authorityRefs: [],
  parseErrors: [],
  statusErrors: [],
  statusValidity: "valid",
  ...overrides,
});

const calibration = (
  current,
  observationOverrides = {},
  { authorityExists = () => true, records = [current] } = {},
) =>
  buildCalibrationProjection({
    task: current,
    records,
    authorityExists,
    observation: {
      actualBranch: current.branch,
      baseSha: "b".repeat(40),
      baseSource: "explicit",
      headSha: workspace.head,
      committedPaths: [],
      stagedPaths: [],
      unstagedPaths: [],
      untrackedPaths: [],
      ...observationOverrides,
    },
  });

const worktreeObservation = (overrides = {}) => {
  const { registration: registrationOverrides = {}, ...observationOverrides } =
    overrides;
  return {
    registration: {
      path: "D:/Logixs/.worktrees/other",
      headSha: "c".repeat(40),
      branch: "feat/other",
      detached: false,
      bare: false,
      locked: false,
      lockReason: null,
      prunable: false,
      pruneReason: null,
      ...registrationOverrides,
    },
    isPrimary: false,
    readable: true,
    readError: null,
    ahead: 0,
    behind: 0,
    fullyMerged: false,
    trackedDirtyPaths: [],
    untrackedPaths: [],
    taskRecords: [],
    activeResolution: { finding: { code: "TASK_CURRENT_NOT_FOUND" } },
    checkoutProjection: null,
    state: "dormant-ahead",
    ...observationOverrides,
  };
};

const fixture = (overrides = {}) => {
  const input = {
    intent: { explicitContinuation: false },
    workspace,
    tasks: [],
    worktrees: [],
    ...overrides,
  };
  if (!("calibrationProjection" in overrides) && input.tasks.length === 1) {
    input.calibrationProjection = calibration(input.tasks[0]);
  }
  return input;
};

test("clean main without a task or continuation intent stays silent", () => {
  const projection = buildContinuationProjection(fixture());

  assert.equal(projection.protocol, "logix-continuation/v1");
  assert.equal(projection.action, "idle");
  assert.equal(projection.safety, "clear");
  assert.equal(projection.target, null);
  assert.deepEqual(projection.relevantConflicts, []);
  assert.deepEqual(projection.advisories, []);
  assert.deepEqual(projection.remoteEvidence, {
    state: "not-observed",
    reason: "automatic continuation projection is local-only",
  });
  assert.equal(formatContinuationContext(projection), "");
});

test("an untrusted branch task status blocks continuation selection", () => {
  const invalid = normalizeTaskRecord({
    path: "docs/planning/tasks/ambiguous-status-v1.md",
    source: `---
status: done
status: coding
branch: feat/current
---
# Ambiguous status`,
  });
  const resolution = resolveContinuationTarget(
    fixture({
      workspace: { ...workspace, branch: "feat/current" },
      tasks: [invalid],
    }),
  );

  assert.equal(resolution.action, "select");
  assert.equal(resolution.safety, "block-target");
  assert.equal(resolution.task, null);
  assert.deepEqual(
    resolution.conflicts.map(({ code }) => code),
    ["CONTINUATION_TASK_STATUS_INVALID"],
  );
});

test("explicit continuation without a task requires target selection", () => {
  const projection = buildContinuationProjection(
    fixture({ intent: { explicitContinuation: true } }),
  );

  assert.equal(projection.action, "select");
  assert.equal(projection.safety, "block-target");
  assert.equal(projection.target, null);
  assert.deepEqual(
    projection.relevantConflicts.map(({ code }) => code),
    ["CONTINUATION_TARGET_NOT_FOUND"],
  );
});

test("a unique coding brief on the current feature branch resumes", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "resume");
  assert.equal(projection.safety, "clear");
  assert.deepEqual(projection.target, {
    brief: current.path,
    title: current.title,
    status: "coding",
    writer: "codex",
    slice: null,
    nextGate: "run-slice-verification",
  });
});

test("a review brief derives the review and integration gate", () => {
  const current = task({ status: "review" });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "resume");
  assert.equal(projection.target.nextGate, "dispose-review-and-integrate");
});

test("design and fix briefs derive their status-specific next gates", () => {
  for (const [status, nextGate] of [
    ["design", "approve-spec-or-plan"],
    ["fix", "run-slice-verification"],
  ]) {
    const current = task({ status });
    const projection = buildContinuationProjection(
      fixture({
        workspace: { ...workspace, branch: current.branch },
        tasks: [current],
      }),
    );

    assert.equal(projection.target.nextGate, nextGate);
  }
});

test("a blocked brief is a candidate only for explicit continuation", () => {
  const blocked = task({ status: "blocked" });
  const base = fixture({
    workspace: { ...workspace, branch: blocked.branch },
    tasks: [blocked],
    checkout: undefined,
    calibrationProjection: calibration(blocked),
  });

  assert.equal(buildContinuationProjection(base).action, "idle");
  const explicit = buildContinuationProjection({
    ...base,
    intent: { explicitContinuation: true },
  });
  assert.equal(explicit.action, "select");
  assert.equal(explicit.safety, "protect-read-only");
  assert.equal(explicit.target.status, "blocked");
  assert.equal(explicit.target.nextGate, "revalidate-blocker");

  const pointer = buildContinuationProjection({
    ...base,
    intent: {
      explicitContinuation: true,
      explicitPointer: `${blocked.path}#RECHECK`,
    },
  });
  assert.equal(pointer.action, "select");
  assert.equal(pointer.safety, "protect-read-only");
  assert.equal(pointer.target.slice, "RECHECK");
});

test("an explicit brief and slice pointer wins over branch inference", () => {
  const first = task();
  const chosen = task({
    path: "docs/planning/tasks/chosen-v1.md",
    title: "Chosen V1",
  });
  const pointer = `${chosen.path}#CG1`;

  assert.deepEqual(parseContinuationPointer(pointer), {
    task: chosen.path,
    slice: "CG1",
  });
  const projection = buildContinuationProjection(
    fixture({
      intent: { explicitContinuation: true, explicitPointer: pointer },
      workspace: { ...workspace, branch: first.branch },
      tasks: [first, chosen],
    }),
  );
  assert.equal(projection.action, "resume");
  assert.equal(projection.safety, "clear");
  assert.equal(projection.target.brief, chosen.path);
  assert.equal(projection.target.slice, "CG1");
});

test("an explicit pointer wins over a complete handoff and branch inference", () => {
  const branchTask = task();
  const handoffTask = task({
    path: "docs/planning/tasks/handoff-v1.md",
    title: "Handoff V1",
  });
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        explicitPointer: `${branchTask.path}#OTHER`,
        handoff: {
          task: handoffTask.path,
          slice: "CG1",
          base: workspace.head,
          role: "main",
          workspace: workspace.path,
          commit: "none",
        },
      },
      workspace: { ...workspace, branch: branchTask.branch },
      tasks: [branchTask, handoffTask],
    }),
  );

  assert.equal(projection.action, "resume");
  assert.equal(projection.safety, "clear");
  assert.equal(projection.target.brief, branchTask.path);
  assert.equal(projection.target.slice, "OTHER");
});

test("an incomplete handoff blocks instead of falling back to a branch task", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: {
          task: current.path,
          slice: "CG1",
          role: "main",
          workspace: workspace.path,
          commit: "none",
        },
      },
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "select");
  assert.equal(projection.safety, "block-target");
  assert.equal(projection.target, null);
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [{ code: "CONTINUATION_HANDOFF_INCOMPLETE", paths: ["base"] }],
  );
});

test("a handoff for an unknown brief blocks without falling back", () => {
  const current = task();
  const missing = "docs/planning/tasks/missing-v1.md";
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: {
          task: missing,
          slice: "CG1",
          base: workspace.head,
          role: "main",
          workspace: workspace.path,
          commit: "none",
        },
      },
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "select");
  assert.equal(projection.safety, "block-target");
  assert.equal(projection.target, null);
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [{ code: "CONTINUATION_TARGET_NOT_FOUND", paths: [missing] }],
  );
});

test("handoff workspace and branch contradictions block the target", () => {
  const current = task();
  const cases = [
    {
      handoff: { workspace: "D:/Elsewhere", base: workspace.head },
      code: "CONTINUATION_WORKSPACE_MISMATCH",
    },
    {
      workspace: { ...workspace, branch: "feat/other" },
      handoff: { workspace: workspace.path, base: workspace.head },
      code: "CONTINUATION_BRANCH_MISMATCH",
    },
  ];

  for (const testCase of cases) {
    const actualWorkspace = testCase.workspace ?? {
      ...workspace,
      branch: current.branch,
    };
    const projection = buildContinuationProjection(
      fixture({
        intent: {
          explicitContinuation: true,
          handoff: {
            task: current.path,
            slice: "CG1",
            role: "main",
            commit: "none",
            ...testCase.handoff,
          },
        },
        identityObservation: identityObservation({ commitResolvable: null }),
        workspace: actualWorkspace,
        tasks: [current],
      }),
    );

    assert.equal(projection.action, "review-handoff");
    assert.equal(projection.safety, "block-target");
    assert.equal(projection.target.brief, current.path);
    assert.deepEqual(
      projection.relevantConflicts.map(({ code }) => code),
      [testCase.code],
    );
  }
});

test("a canonical workspace identity accepts filesystem aliases and fails closed", () => {
  const current = task();
  const handoff = {
    task: current.path,
    slice: "CG1",
    role: "main",
    base: workspace.head,
    workspace: "C:/Users/RUNNER~1/AppData/Local/Temp/logix continuation",
    commit: "none",
  };
  const input = fixture({
    intent: { explicitContinuation: true, handoff },
    identityObservation: identityObservation({ commitResolvable: null }),
    workspace: {
      ...workspace,
      path: "C:/Users/runneradmin/AppData/Local/Temp/logix continuation",
      branch: current.branch,
    },
    tasks: [current],
  });

  const equivalent = buildContinuationProjection({
    ...input,
    workspaceIdentityObservation: {
      equivalent: true,
      handoffCanonicalPath:
        "C:/Users/runneradmin/AppData/Local/Temp/logix continuation",
      workspaceCanonicalPath:
        "C:/Users/runneradmin/AppData/Local/Temp/logix continuation",
    },
  });
  assert.equal(equivalent.safety, "clear");
  assert.doesNotMatch(
    JSON.stringify(equivalent.relevantConflicts),
    /CONTINUATION_WORKSPACE_MISMATCH/,
  );

  const unresolved = buildContinuationProjection({
    ...input,
    workspaceIdentityObservation: {
      equivalent: false,
      handoffCanonicalPath: null,
      workspaceCanonicalPath: input.workspace.path,
    },
  });
  assert.equal(unresolved.safety, "block-target");
  assert.deepEqual(
    unresolved.relevantConflicts.map(({ code }) => code),
    ["CONTINUATION_WORKSPACE_MISMATCH"],
  );
});

test("handoff requires role main and every protocol field", () => {
  const current = task();
  const complete = {
    task: current.path,
    slice: "CG1",
    base: "b".repeat(40),
    role: "main",
    workspace: workspace.path,
    commit: "none",
  };

  for (const field of [
    "task",
    "slice",
    "base",
    "role",
    "workspace",
    "commit",
  ]) {
    const handoff = { ...complete };
    delete handoff[field];
    const incomplete = buildContinuationProjection(
      fixture({
        intent: { explicitContinuation: true, handoff },
        workspace: { ...workspace, branch: current.branch },
        tasks: [current],
      }),
    );
    assert.deepEqual(
      incomplete.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
      [{ code: "CONTINUATION_HANDOFF_INCOMPLETE", paths: [field] }],
    );
  }

  const wrongRole = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: { ...complete, role: "implementer" },
      },
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );
  assert.equal(wrongRole.action, "select");
  assert.equal(wrongRole.safety, "block-target");
  assert.deepEqual(
    wrongRole.relevantConflicts.map(({ code }) => code),
    ["CONTINUATION_HANDOFF_ROLE_INVALID"],
  );
});

test("a complete handoff accepts a review base older than HEAD", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: {
          task: current.path,
          slice: "CG1",
          base: "b".repeat(40),
          role: "main",
          workspace: workspace.path,
          commit: workspace.head,
        },
      },
      identityObservation: identityObservation(),
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "review-handoff");
  assert.equal(projection.safety, "clear");
  assert.deepEqual(projection.relevantConflicts, []);
});

test("a complete uncommitted handoff accepts a reproducible working diff", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: {
          task: current.path,
          slice: "CG1",
          base: "b".repeat(40),
          role: "main",
          workspace: workspace.path,
          commit: "none",
        },
      },
      identityObservation: identityObservation({ commitResolvable: null }),
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "review-handoff");
  assert.equal(projection.safety, "clear");
  assert.deepEqual(projection.relevantConflicts, []);
});

test("handoff identity rejects matching non-SHA placeholders", () => {
  const current = task();
  const invalidSha = "not-a-git-sha";
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        handoff: {
          task: current.path,
          slice: "CG1",
          base: invalidSha,
          role: "main",
          workspace: workspace.path,
          commit: invalidSha,
        },
      },
      identityObservation: identityObservation({ observedHead: invalidSha }),
      workspace: {
        ...workspace,
        branch: current.branch,
        head: invalidSha,
      },
      tasks: [current],
    }),
  );

  assert.equal(projection.action, "review-handoff");
  assert.equal(projection.safety, "block-target");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "CONTINUATION_HANDOFF_IDENTITY_INVALID",
        paths: ["base", "commit", "observedHead", "workspace.head"],
      },
    ],
  );
});

test("handoff identity observations fail closed when unknown or contradictory", () => {
  const current = task();
  const completeHandoff = {
    task: current.path,
    slice: "CG1",
    base: "b".repeat(40),
    role: "main",
    workspace: workspace.path,
    commit: workspace.head,
  };
  const cases = [
    { name: "missing observation", observation: undefined },
    {
      name: "unresolvable base",
      observation: identityObservation({ baseResolvable: false }),
    },
    {
      name: "unresolvable commit",
      observation: identityObservation({ commitResolvable: false }),
    },
    {
      name: "unknown commit",
      observation: identityObservation({ commitResolvable: null }),
    },
    {
      name: "base is not an ancestor",
      observation: identityObservation({ baseIsAncestorOfHead: false }),
    },
    {
      name: "diff cannot be reproduced",
      observation: identityObservation({ reproducesDiff: false }),
    },
    {
      name: "observation is for another HEAD",
      observation: identityObservation({ observedHead: "c".repeat(40) }),
    },
    {
      name: "handoff commit differs from observed HEAD",
      handoff: { commit: "c".repeat(40) },
      observation: identityObservation(),
    },
    {
      name: "uncommitted handoff has a commit observation",
      handoff: { commit: "none" },
      observation: identityObservation({ commitResolvable: true }),
    },
  ];

  const actual = cases.map(({ name, handoff = {}, observation }) => {
    const projection = buildContinuationProjection(
      fixture({
        intent: {
          explicitContinuation: true,
          handoff: { ...completeHandoff, ...handoff },
        },
        identityObservation: observation,
        workspace: { ...workspace, branch: current.branch },
        tasks: [current],
      }),
    );
    return {
      name,
      action: projection.action,
      safety: projection.safety,
      codes: projection.relevantConflicts.map(({ code }) => code),
    };
  });

  assert.deepEqual(
    actual,
    cases.map(({ name }) => ({
      name,
      action: "review-handoff",
      safety: "block-target",
      codes: ["CONTINUATION_HANDOFF_IDENTITY_INVALID"],
    })),
  );
});

test("an explicit target on another branch requires selection and blocks", () => {
  const chosen = task();
  const projection = buildContinuationProjection(
    fixture({
      intent: {
        explicitContinuation: true,
        explicitPointer: `${chosen.path}#CG1`,
      },
      workspace: { ...workspace, branch: "feat/other" },
      tasks: [chosen],
    }),
  );

  assert.equal(projection.action, "select");
  assert.equal(projection.safety, "block-target");
  assert.equal(projection.target.brief, chosen.path);
  assert.deepEqual(
    projection.relevantConflicts.map(({ code }) => code),
    ["CONTINUATION_BRANCH_MISMATCH"],
  );
});

test("multiple branch candidates require explicit selection", () => {
  const first = task();
  const second = task({ path: "docs/planning/tasks/second-v1.md" });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: first.branch },
      tasks: [second, first],
    }),
  );

  assert.equal(projection.action, "select");
  assert.equal(projection.safety, "block-target");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code }) => code),
    ["CONTINUATION_TARGET_AMBIGUOUS"],
  );
});

test("an unfinished dependency blocks the selected target", () => {
  const current = task({ dependsOn: ["foundation-v1"] });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      calibrationProjection: calibration(current),
    }),
  );

  assert.equal(projection.action, "resume");
  assert.equal(projection.safety, "block-target");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "CONTINUATION_DEPENDENCY_UNFINISHED",
        paths: ["foundation-v1"],
      },
    ],
  );
});

test("out-of-scope tracked changes in the checkout block the target", () => {
  const current = task();
  const calibrationProjection = calibration(current, {
    stagedPaths: ["outside/file.txt"],
  });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      calibrationProjection,
    }),
  );

  assert.equal(projection.safety, "block-target");
  assert.equal(projection.target.nextGate, "fix-calibration-findings");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "CONTINUATION_CHECKOUT_OUT_OF_SCOPE",
        paths: ["outside/file.txt"],
      },
    ],
  );
});

test("non-overlapping unowned checkout paths are advisory only", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      checkout: undefined,
      calibrationProjection: calibration(current, {
        untrackedPaths: ["outside/local-note.txt"],
      }),
    }),
  );

  assert.equal(projection.safety, "clear");
  assert.deepEqual(projection.relevantConflicts, []);
  assert.deepEqual(projection.advisories, [
    {
      code: "CONTINUATION_CHECKOUT_UNTRACKED_NON_OVERLAP",
      subject: workspace.path,
    },
  ]);
});

test("unowned checkout paths overlapping the selected target protect read-only", () => {
  const current = task();
  const producerTask = task({
    id: "producer-v1",
    path: "docs/planning/tasks/producer-v1.md",
    writeScopes: ["docs/producer/**"],
  });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      checkout: undefined,
      calibrationProjection: calibration(producerTask, {
        untrackedPaths: ["scripts/example/local.txt"],
      }),
    }),
  );

  assert.equal(projection.safety, "protect-read-only");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "CONTINUATION_CHECKOUT_UNTRACKED_SCOPE_OVERLAP",
        paths: ["scripts/example/local.txt"],
      },
    ],
  );
});

test("consumes real calibration derived and worktree registration shapes", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      checkout: undefined,
      calibrationProjection: calibration(current),
      worktrees: [
        worktreeObservation({
          trackedDirtyPaths: ["scripts/example/target.txt"],
          state: "active",
        }),
      ],
    }),
  );

  assert.equal(projection.safety, "protect-read-only");
  assert.equal(
    projection.target.nextGate,
    "run-slice-verification",
    "nextGate must come from calibrationProjection.derived.nextGate",
  );
  assert.deepEqual(
    projection.relevantConflicts.map(({ worktree, paths }) => ({
      worktree,
      paths,
    })),
    [
      {
        worktree: "D:/Logixs/.worktrees/other",
        paths: ["scripts/example/target.txt"],
      },
    ],
  );
});

test("malformed target write scopes fail closed", () => {
  const current = task({ writeScopes: ["scripts/**/invalid"] });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      checkout: undefined,
      calibrationProjection: calibration(current),
    }),
  );

  assert.equal(projection.safety, "block-target");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "CONTINUATION_SCOPE_INVALID",
        paths: ["scripts/**/invalid"],
      },
    ],
  );
});

test("blocking findings from the matching calibration projection fail closed", () => {
  const current = task({ authorityRefs: ["docs/missing.md"] });
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      calibrationProjection: calibration(
        current,
        {},
        {
          authorityExists: () => false,
        },
      ),
    }),
  );

  assert.equal(projection.safety, "block-target");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, paths }) => ({ code, paths })),
    [
      {
        code: "TASK_AUTHORITY_MISSING",
        paths: ["docs/missing.md"],
      },
    ],
  );
});

test("non-overlapping dirty worktrees are advisory only", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      worktrees: [
        worktreeObservation({
          registration: {
            path: "D:/Logixs/.worktrees/other",
            branch: "feat/other",
          },
          state: "unowned-dirty",
          trackedDirtyPaths: ["docs/other.md"],
          untrackedPaths: ["notes/private.txt"],
        }),
      ],
    }),
  );

  assert.equal(projection.safety, "clear");
  assert.deepEqual(projection.relevantConflicts, []);
  assert.deepEqual(projection.advisories, [
    {
      code: "CONTINUATION_WORKTREE_DIRTY_NON_OVERLAP",
      subject: "D:/Logixs/.worktrees/other",
    },
  ]);
});

test("tracked or untracked path overlap protects the target read-only", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      worktrees: [
        worktreeObservation({
          registration: {
            path: "D:/Logixs/.worktrees/untracked",
            branch: "feat/untracked",
          },
          state: "unowned-dirty",
          untrackedPaths: ["scripts/example/secret.txt"],
        }),
        worktreeObservation({
          registration: {
            path: "D:/Logixs/.worktrees/tracked",
            branch: "feat/tracked",
          },
          state: "active",
          trackedDirtyPaths: ["scripts/example/target.txt"],
        }),
      ],
    }),
  );

  assert.equal(projection.safety, "protect-read-only");
  assert.deepEqual(
    projection.relevantConflicts.map(({ code, worktree, paths }) => ({
      code,
      worktree,
      paths,
    })),
    [
      {
        code: "CONTINUATION_WORKTREE_SCOPE_OVERLAP",
        worktree: "D:/Logixs/.worktrees/tracked",
        paths: ["scripts/example/target.txt"],
      },
      {
        code: "CONTINUATION_WORKTREE_SCOPE_OVERLAP",
        worktree: "D:/Logixs/.worktrees/untracked",
        paths: ["scripts/example/secret.txt"],
      },
    ],
  );
});

test("dormant-ahead, behind-main, and detached worktrees stay advisory", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      worktrees: [
        worktreeObservation({
          registration: { path: "D:/Logixs/.worktrees/ahead" },
          state: "dormant-ahead",
          ahead: 1,
        }),
        worktreeObservation({
          registration: { path: "D:/Logixs/.worktrees/behind" },
          state: "dormant-merged",
          behind: 2,
          fullyMerged: true,
        }),
        worktreeObservation({
          registration: {
            path: "D:/Logixs/.worktrees/detached",
            branch: null,
            detached: true,
          },
          state: "dormant-merged",
          fullyMerged: true,
        }),
      ],
    }),
  );

  assert.equal(projection.safety, "clear");
  assert.deepEqual(
    projection.advisories.map(({ code }) => code),
    [
      "CONTINUATION_WORKTREE_DORMANT_AHEAD",
      "CONTINUATION_WORKTREE_BEHIND_MAIN",
      "CONTINUATION_WORKTREE_DETACHED",
    ],
  );
});

test("projection and context are deterministic, compact, and actionable", () => {
  const current = task({ status: "review" });
  const input = fixture({
    intent: {
      explicitContinuation: true,
      explicitPointer: `${current.path}#CG1`,
    },
    workspace: { ...workspace, branch: current.branch },
    tasks: [current],
    worktrees: [
      worktreeObservation({
        registration: { path: "D:/Logixs/.worktrees/other" },
        state: "dormant-ahead",
        untrackedPaths: ["notes/do-not-read.txt"],
        untrackedContents: "never expose this secret content",
      }),
    ],
  });
  const before = structuredClone(input);

  const first = buildContinuationProjection(input);
  const second = buildContinuationProjection(input);
  const context = formatContinuationContext(first);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.match(context, /local derived snapshot/i);
  assert.match(context, /action=resume safety=clear/);
  assert.match(context, /D:\/Logixs/);
  assert.match(context, /branch=feat\/example-v1/);
  assert.match(context, new RegExp(`head=${"a".repeat(12)}`));
  assert.match(context, /status=review writer=codex slice=CG1/);
  assert.match(context, /nextGate=dispose-review-and-integrate/);
  assert.match(context, /Conflicts: none/);
  assert.match(context, /Read AGENTS\.md/);
  assert.match(context, /unique brief and real diff/);
  assert.ok(Buffer.byteLength(context, "utf8") <= 4096);
  assert.doesNotMatch(context, /do-not-read/);
  assert.doesNotMatch(context, /never expose this secret content/);
  assert.doesNotMatch(context, /writeScopes/);
  assert.doesNotMatch(context, /trackedDirtyPaths|untrackedPaths/);
});

test("context stays under four kilobytes with excessive advisory input", () => {
  const current = task();
  const projection = buildContinuationProjection(
    fixture({
      workspace: { ...workspace, branch: current.branch },
      tasks: [current],
      worktrees: Array.from({ length: 50 }, (_, index) =>
        worktreeObservation({
          registration: {
            path: `D:/Logixs/.worktrees/${"long-name-".repeat(30)}${index}`,
          },
          state: "dormant-ahead",
        }),
      ),
    }),
  );

  const context = formatContinuationContext(projection);
  assert.ok(Buffer.byteLength(context, "utf8") <= 4096);
  assert.match(context, /Read AGENTS\.md, the unique brief and real diff/);
});

test("context enforces 4096 UTF-8 bytes without splitting multibyte text", () => {
  const longText = "续线事实".repeat(200);
  const projection = {
    protocol: "logix-continuation/v1",
    action: "resume",
    safety: "block-target",
    workspace: {
      path: longText,
      branch: longText,
      head: "a".repeat(40),
      mainRef: longText,
    },
    target: {
      brief: longText,
      title: longText,
      status: longText,
      writer: longText,
      slice: longText,
      nextGate: longText,
    },
    relevantConflicts: Array.from({ length: 5 }, (_, index) => ({
      code: `${longText}-${index}`,
      worktree: `${longText}-${index}`,
      paths: [],
      remedy: longText,
    })),
    advisories: Array.from({ length: 5 }, (_, index) => ({
      code: `${longText}-${index}`,
      subject: `${longText}-${index}`,
    })),
    remoteEvidence: { state: "not-observed", reason: longText },
  };

  const context = formatContinuationContext(projection);
  assert.ok(Buffer.byteLength(context, "utf8") <= 4096);
  assert.doesNotMatch(context, /\uFFFD/);
  assert.match(
    context,
    /Read AGENTS\.md, the unique brief and real diff before any write\.$/,
  );
});

const taskBriefSource = ({
  status,
  branch,
  title,
  writer = "codex",
  verification,
}) => `---
status: ${status}
branch: ${branch}
owner: main
writer: ${writer}
risk: low
${verification === undefined ? "" : `verification: ${verification}\n`}dependsOn: []
writeScopes:
  - scripts/example/**
exclusiveLocks: []
sharedIntegrationScopes: []
authorityRefs: []
---

# ${title}
`;

const queryRecords = [
  {
    path: "docs/planning/tasks/coding-v1.md",
    source: taskBriefSource({
      status: "coding",
      branch: "feat/current",
      title: "Coding task",
    }),
  },
  ...["review", "fix", "blocked", "design", "done"].map((status) => ({
    path: `docs/planning/tasks/${status}-v1.md`,
    source: taskBriefSource({
      status,
      branch: `feat/${status}`,
      title: `${status} task`,
    }),
  })),
];

const runTaskQuery = async (argv, overrides = {}) => {
  const { runTasksListCli } = await import(moduleUrl);
  return runTasksListCli(argv, {
    loadRecords: () => queryRecords,
    getBranch: () => "feat/current",
    ...overrides,
  });
};

test("tasks:list defaults to the current tracked task and status summary", async () => {
  const result = await runTaskQuery([]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    [
      'current: docs/planning/tasks/coding-v1.md status=coding branch=feat/current writer=codex parseValidity=valid advisories=none verification=missing validCompletion=false title="Coding task"',
      "status: coding=1 review=1 fix=1 blocked=1 design=1 done=1",
      "",
    ].join("\n"),
  );
});

test("tasks:list supports current and every allowed status without filename inference", async () => {
  const current = await runTaskQuery(["--current"]);
  assert.equal(current.exitCode, 0);
  assert.match(current.stdout, /^docs\/planning\/tasks\/coding-v1\.md\t/);

  for (const status of [
    "coding",
    "review",
    "fix",
    "blocked",
    "design",
    "done",
  ]) {
    const result = await runTaskQuery(["--status", status]);
    assert.equal(result.exitCode, 0, status);
    assert.match(
      result.stdout,
      new RegExp(`status=${status}(?:\\t|$)`),
      status,
    );
  }

  const misleading = await runTaskQuery(["--status", "coding"], {
    loadRecords: () => [
      {
        path: "docs/planning/tasks/done-by-name.md",
        source: taskBriefSource({
          status: "coding",
          branch: "feat/current",
          title: "Frontmatter wins",
        }),
      },
    ],
  });
  assert.match(misleading.stdout, /done-by-name\.md\tstatus=coding/);
});

test("tasks:list JSON is the structured equivalent of the default query", async () => {
  const result = await runTaskQuery(["--json"]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0);
  assert.deepEqual(output, {
    query: "summary",
    current: {
      id: "coding-v1",
      path: "docs/planning/tasks/coding-v1.md",
      title: "Coding task",
      status: "coding",
      branch: "feat/current",
      writer: "codex",
      risk: "low",
      parseValidity: "valid",
      advisories: [],
      verification: "missing",
      validCompletion: false,
    },
    statusSummary: {
      coding: 1,
      review: 1,
      fix: 1,
      blocked: 1,
      design: 1,
      done: 1,
    },
    advisories: [],
  });
});

test("tasks:list reports no current task or status matches as none with success", async () => {
  const current = await runTaskQuery(["--current"], {
    getBranch: () => "main",
  });
  const status = await runTaskQuery(["--status", "done"], {
    loadRecords: () =>
      queryRecords.filter((record) => !record.path.includes("done")),
  });

  assert.deepEqual(current, { exitCode: 0, stdout: "none\n", stderr: "" });
  assert.deepEqual(status, { exitCode: 0, stdout: "none\n", stderr: "" });
});

test("tasks:list rejects invalid or conflicting arguments with stable failures", async () => {
  const cases = [
    [["--status", "paused"], "invalid status 'paused'"],
    [["--status"], "missing value for '--status'"],
    [["--unknown"], "unknown argument '--unknown'"],
    [
      ["--current", "--status", "coding"],
      "choose only one of '--current' or '--status'",
    ],
  ];

  for (const [argv, message] of cases) {
    const result = await runTaskQuery(argv);
    assert.deepEqual(result, {
      exitCode: 2,
      stdout: "",
      stderr: `tasks:list: ${message}\n`,
    });
  }
});

const temporaryRepositories = [];
after(() => {
  for (const root of temporaryRepositories) rmSync(root, { recursive: true });
});

const git = (root, args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });

const write = (root, path, source) => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
};

test("tasks:list reads only tracked briefs and leaves Git state unchanged", async () => {
  const { loadTrackedTaskRecords, runTasksListCli } = await import(moduleUrl);
  const root = mkdtempSync(join(tmpdir(), "logix task query "));
  temporaryRepositories.push(root);
  git(root, ["init", "--initial-branch=feat/current"]);
  git(root, ["config", "user.email", "query@example.test"]);
  git(root, ["config", "user.name", "Task Query Test"]);
  write(
    root,
    "docs/planning/tasks/tracked-v1.md",
    taskBriefSource({
      status: "coding",
      branch: "feat/current",
      title: "Tracked task",
    }),
  );
  git(root, ["add", "docs/planning/tasks/tracked-v1.md"]);
  git(root, ["commit", "-m", "tracked task"]);
  write(
    root,
    "docs/planning/tasks/untracked-v1.md",
    "this content must never be parsed",
  );
  const before = {
    head: git(root, ["rev-parse", "HEAD"]),
    status: git(root, ["status", "--porcelain=v1"]),
    worktrees: git(root, ["worktree", "list", "--porcelain", "-z"]),
  };
  const readPaths = [];

  const result = runTasksListCli(["--status", "coding"], {
    loadRecords: () =>
      loadTrackedTaskRecords({
        root,
        git: (args) => git(root, args),
        readFile: (path, encoding) => {
          readPaths.push(path);
          return readFileSync(path, encoding);
        },
      }),
    getBranch: () => git(root, ["branch", "--show-current"]).trim(),
  });
  const afterSnapshot = {
    head: git(root, ["rev-parse", "HEAD"]),
    status: git(root, ["status", "--porcelain=v1"]),
    worktrees: git(root, ["worktree", "list", "--porcelain", "-z"]),
  };

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /tracked-v1\.md/);
  assert.doesNotMatch(result.stdout, /untracked-v1/);
  assert.equal(readPaths.length, 1);
  assert.match(readPaths[0], /tracked-v1\.md$/);
  assert.deepEqual(afterSnapshot, before);
});

test("continuation gateway remains import-safe and package exposes tasks:list", () => {
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(moduleUrl.href)})`,
    ],
    { encoding: "utf8" },
  );
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, "");
  assert.equal(imported.stderr, "");
  assert.equal(
    packageJson.scripts["tasks:list"],
    "node scripts/continuation-gateway.mjs",
  );
});

test("continuation Skills share the tracked task query and projection boundary", () => {
  const skillRoot = new URL("../.claude/skills/", import.meta.url);
  const skills = Object.fromEntries(
    ["continuation", "continue-work", "drift-check", "logix-help"].map(
      (name) => [
        name,
        readFileSync(new URL(`${name}/SKILL.md`, skillRoot), "utf8"),
      ],
    ),
  );

  for (const source of Object.values(skills)) {
    assert.match(source, /tasks:list/);
  }
  assert.match(skills["continue-work"], /action.*safety.*nextGate/s);
  assert.match(skills.continuation, /只生成提示词/);
  assert.match(skills["drift-check"], /只读/);
  assert.match(skills["logix-help"], /--status/);
});

test("tasks:list preserves ambiguous current candidates in text and JSON", async () => {
  const records = ["alpha", "beta"].map((name) => ({
    path: `docs/planning/tasks/${name}-v1.md`,
    source: taskBriefSource({
      status: "coding",
      branch: "feat/current",
      title: `${name} task`,
    }),
  }));
  const textResult = await runTaskQuery(["--current"], {
    loadRecords: () => records,
  });
  const jsonResult = await runTaskQuery(["--current", "--json"], {
    loadRecords: () => records,
  });

  assert.equal(textResult.exitCode, 1);
  assert.equal(textResult.stderr, "");
  assert.match(textResult.stdout, /^ambiguous$/m);
  assert.match(textResult.stdout, /docs\/planning\/tasks\/alpha-v1\.md/);
  assert.match(textResult.stdout, /docs\/planning\/tasks\/beta-v1\.md/);
  assert.equal(jsonResult.exitCode, 1);
  assert.deepEqual(JSON.parse(jsonResult.stdout).current, {
    state: "ambiguous",
    task: null,
    candidates: [
      "docs/planning/tasks/alpha-v1.md",
      "docs/planning/tasks/beta-v1.md",
    ],
  });
});

test("tasks:list fails closed on malformed tracked briefs", async () => {
  const malformed = [
    {
      path: "docs/planning/tasks/malformed-v1.md",
      source: "not frontmatter\n",
    },
  ];

  for (const argv of [[], ["--current"], ["--status", "coding"]]) {
    const result = await runTaskQuery(argv, {
      loadRecords: () => malformed,
    });
    assert.deepEqual(result, {
      exitCode: 2,
      stdout: "",
      stderr:
        "tasks:list: malformed tracked briefs\n" +
        "  - docs/planning/tasks/malformed-v1.md TASK_PARSE_INVALID\n",
    });
  }

  const jsonResult = await runTaskQuery(["--json"], {
    loadRecords: () => malformed,
  });
  assert.equal(jsonResult.exitCode, 2);
  assert.equal(jsonResult.stderr, "");
  assert.deepEqual(JSON.parse(jsonResult.stdout), {
    query: "error",
    errors: [
      {
        path: "docs/planning/tasks/malformed-v1.md",
        code: "TASK_PARSE_INVALID",
      },
    ],
  });
});

test("tasks:list keeps malformed historical done and blocked briefs advisory", async () => {
  const malformedHistorical = ["done", "blocked"].map((status) => ({
    path: `docs/planning/tasks/legacy-${status}-v1.md`,
    source: taskBriefSource({
      status,
      branch: `feat/legacy-${status}`,
      title: `Legacy ${status}`,
      verification: status === "done" ? "historical evidence" : undefined,
    }).replace("dependsOn: []", "legacy unsupported line\ndependsOn: []"),
  }));
  const records = [queryRecords[0], ...malformedHistorical];
  const expectedAdvisories = malformedHistorical
    .map(({ path }) => ({ path, code: "TASK_PARSE_INVALID" }))
    .sort((left, right) => left.path.localeCompare(right.path));

  for (const argv of [["--current", "--json"], ["--json"]]) {
    const result = await runTaskQuery(argv, {
      loadRecords: () => records,
    });
    const output = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.equal(output.current.path, "docs/planning/tasks/coding-v1.md");
    assert.deepEqual(output.advisories, expectedAdvisories);
  }

  const currentText = await runTaskQuery(["--current"], {
    loadRecords: () => records,
  });
  const defaultText = await runTaskQuery([], {
    loadRecords: () => records,
  });
  const currentRecord =
    'docs/planning/tasks/coding-v1.md\tstatus=coding\tbranch=feat/current\twriter=codex\tparseValidity=valid\tadvisories=none\tverification=missing\tvalidCompletion=false\ttitle="Coding task"';
  const advisoryLines = [
    "advisories:",
    ...expectedAdvisories.map(({ path, code }) => `  - ${path} ${code}`),
  ];

  assert.deepEqual(currentText, {
    exitCode: 0,
    stdout: [currentRecord, ...advisoryLines, ""].join("\n"),
    stderr: "",
  });
  assert.deepEqual(defaultText, {
    exitCode: 0,
    stdout: [
      `current: ${currentRecord.replaceAll("\t", " ")}`,
      ...advisoryLines,
      "status: coding=1 review=0 fix=0 blocked=1 design=0 done=1",
      "",
    ].join("\n"),
    stderr: "",
  });

  for (const status of ["done", "blocked"]) {
    const jsonResult = await runTaskQuery(["--status", status, "--json"], {
      loadRecords: () => records,
    });
    const textResult = await runTaskQuery(["--status", status], {
      loadRecords: () => records,
    });
    const output = JSON.parse(jsonResult.stdout);

    assert.equal(jsonResult.exitCode, 0);
    assert.equal(jsonResult.stderr, "");
    assert.deepEqual(output.advisories, [
      {
        path: `docs/planning/tasks/legacy-${status}-v1.md`,
        code: "TASK_PARSE_INVALID",
      },
    ]);
    assert.deepEqual(
      {
        parseValidity: output.tasks[0].parseValidity,
        advisories: output.tasks[0].advisories,
        validCompletion: output.tasks[0].validCompletion,
      },
      {
        parseValidity: "invalid",
        advisories: ["TASK_PARSE_INVALID"],
        validCompletion: false,
      },
    );
    assert.match(textResult.stdout, /parseValidity=invalid/);
    assert.match(textResult.stdout, /advisories=TASK_PARSE_INVALID/);
    assert.match(textResult.stdout, /validCompletion=false/);
  }
});

test("tasks:list fails closed when duplicate status declarations are ambiguous", async () => {
  const cases = [
    ["done", "coding"],
    ["blocked", "fix"],
    ["blocked", "review"],
    ["review", "blocked"],
    ["coding", "done"],
    ["fix", "blocked"],
  ];
  const observations = [];

  for (const [firstStatus, secondStatus] of cases) {
    const transition = `${firstStatus}->${secondStatus}`;
    const path = `docs/planning/tasks/ambiguous-${firstStatus}-${secondStatus}-v1.md`;
    const source = taskBriefSource({
      status: firstStatus,
      branch: "feat/current",
      title: `Ambiguous ${transition}`,
    }).replace(
      `status: ${firstStatus}`,
      `status: ${firstStatus}\nstatus: ${secondStatus}`,
    );
    const queries = [
      ["default", []],
      ["current", ["--current"]],
      [`status:${firstStatus}`, ["--status", firstStatus]],
      [`status:${secondStatus}`, ["--status", secondStatus]],
    ];

    for (const [query, argv] of queries) {
      const result = await runTaskQuery(argv, {
        loadRecords: () => [{ path, source }],
      });
      observations.push({
        transition,
        query,
        exitCode: result.exitCode,
        stdoutEmpty: result.stdout === "",
        reportsParseInvalid: result.stderr.includes(
          `${path} TASK_PARSE_INVALID`,
        ),
      });
    }
  }

  assert.deepEqual(
    observations,
    cases.flatMap(([firstStatus, secondStatus]) =>
      [
        "default",
        "current",
        `status:${firstStatus}`,
        `status:${secondStatus}`,
      ].map((query) => ({
        transition: `${firstStatus}->${secondStatus}`,
        query,
        exitCode: 2,
        stdoutEmpty: true,
        reportsParseInvalid: true,
      })),
    ),
  );
});

test("tasks:list fails closed when status is an inline array", async () => {
  const path = "docs/planning/tasks/status-array-v1.md";
  const source = taskBriefSource({
    status: "[done, coding]",
    branch: "feat/current",
    title: "Ambiguous status array",
  });

  for (const argv of [
    [],
    ["--current"],
    ["--status", "done"],
    ["--status", "coding"],
  ]) {
    const result = await runTaskQuery(argv, {
      loadRecords: () => [{ path, source }],
    });

    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(`${path} TASK_PARSE_INVALID`));
  }
});

test("tasks:list fails closed on malformed status-like declarations", async () => {
  for (const [label, declaration] of [
    ["indented", " status: coding"],
    ["space-colon", "status : coding"],
    ["tab-colon", "status\t: review"],
  ]) {
    const path = `docs/planning/tasks/${label}-status-v1.md`;
    const source = taskBriefSource({
      status: "done",
      branch: "feat/current",
      title: "Malformed status",
    }).replace("status: done", `status: done\n${declaration}`);

    for (const argv of [
      [],
      ["--current"],
      ["--status", "done"],
      ["--status", "coding"],
    ]) {
      const result = await runTaskQuery(argv, {
        loadRecords: () => [{ path, source }],
      });

      assert.equal(result.exitCode, 2, label);
      assert.equal(result.stdout, "", label);
      assert.match(
        result.stderr,
        new RegExp(`${path} TASK_PARSE_INVALID`),
        label,
      );
    }
  }
});

test("tasks:list fails closed when tracked task status is missing", async () => {
  const path = "docs/planning/tasks/missing-status-v1.md";
  const source = taskBriefSource({
    status: "coding",
    branch: "feat/current",
    title: "Missing status",
  }).replace("status: coding\n", "");

  for (const argv of [[], ["--current"], ["--status", "coding"]]) {
    const result = await runTaskQuery(argv, {
      loadRecords: () => [{ path, source }],
    });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, new RegExp(`${path} TASK_PARSE_INVALID`));
  }
});

test("tasks:list still fails closed when an active tracked brief is malformed", async () => {
  const malformedActivePath =
    "docs/planning/tasks/malformed-active-coding-v1.md";
  const records = [
    queryRecords[0],
    {
      path: "docs/planning/tasks/legacy-done-v1.md",
      source: taskBriefSource({
        status: "done",
        branch: "feat/legacy-done",
        title: "Legacy done",
      }).replace("dependsOn: []", "legacy unsupported line\ndependsOn: []"),
    },
    {
      path: "docs/planning/tasks/legacy-blocked-v1.md",
      source: taskBriefSource({
        status: "blocked",
        branch: "feat/legacy-blocked",
        title: "Legacy blocked",
      }).replace("dependsOn: []", "legacy unsupported line\ndependsOn: []"),
    },
    {
      path: malformedActivePath,
      source: taskBriefSource({
        status: "coding",
        branch: "feat/malformed-active",
        title: "Malformed active coding",
      }).replace("dependsOn: []", "active unsupported line\ndependsOn: []"),
    },
  ];

  for (const argv of [["--current", "--json"], ["--json"]]) {
    const result = await runTaskQuery(argv, {
      loadRecords: () => records,
    });

    assert.equal(result.exitCode, 2);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      query: "error",
      errors: [{ path: malformedActivePath, code: "TASK_PARSE_INVALID" }],
    });
  }
});

test("tasks:list exposes verification presence and valid completion", async () => {
  const records = [
    {
      path: "docs/planning/tasks/done-valid-v1.md",
      source: taskBriefSource({
        status: "done",
        branch: "feat/done-valid",
        title: "Done valid",
        verification: "CI passed",
      }),
    },
    {
      path: "docs/planning/tasks/done-missing-v1.md",
      source: taskBriefSource({
        status: "done",
        branch: "feat/done-missing",
        title: "Done missing",
      }),
    },
  ];
  const jsonResult = await runTaskQuery(["--status", "done", "--json"], {
    loadRecords: () => records,
  });
  const textResult = await runTaskQuery(["--status", "done"], {
    loadRecords: () => records,
  });
  const byPath = Object.fromEntries(
    JSON.parse(jsonResult.stdout).tasks.map((record) => [record.path, record]),
  );

  assert.deepEqual(
    {
      verification: byPath["docs/planning/tasks/done-valid-v1.md"].verification,
      validCompletion:
        byPath["docs/planning/tasks/done-valid-v1.md"].validCompletion,
    },
    { verification: "present", validCompletion: true },
  );
  assert.deepEqual(
    {
      verification:
        byPath["docs/planning/tasks/done-missing-v1.md"].verification,
      validCompletion:
        byPath["docs/planning/tasks/done-missing-v1.md"].validCompletion,
    },
    { verification: "missing", validCompletion: false },
  );
  assert.match(
    textResult.stdout,
    /done-valid-v1\.md.*verification=present.*validCompletion=true/,
  );
  assert.match(
    textResult.stdout,
    /done-missing-v1\.md.*verification=missing.*validCompletion=false/,
  );
});

test("tasks:list accepts historical list verification as present", async () => {
  const path = "docs/planning/tasks/done-list-verification-v1.md";
  const source = taskBriefSource({
    status: "done",
    branch: "feat/done-list-verification",
    title: "Done with list verification",
  }).replace(
    "dependsOn: []",
    "verification:\n  - CI passed\n  - review passed\ndependsOn: []",
  );

  const result = await runTaskQuery(["--status", "done", "--json"], {
    loadRecords: () => [{ path, source }],
  });
  const task = JSON.parse(result.stdout).tasks[0];

  assert.equal(result.exitCode, 0);
  assert.equal(task.verification, "present");
  assert.equal(task.validCompletion, true);
});

const readContinuationSkills = () => {
  const skillRoot = new URL("../.claude/skills/", import.meta.url);
  return Object.fromEntries(
    ["continuation", "continue-work", "drift-check", "logix-help"].map(
      (name) => [
        name,
        readFileSync(new URL(`${name}/SKILL.md`, skillRoot), "utf8"),
      ],
    ),
  );
};

test("machine task queries are silent and workspace-rooted in every Skill", () => {
  const skills = readContinuationSkills();
  for (const name of ["continuation", "continue-work", "drift-check"]) {
    assert.match(
      skills[name],
      /pnpm -w --silent tasks:list -- --current --json/,
      name,
    );
  }
  assert.match(skills["logix-help"], /pnpm -w tasks:list/);
  assert.match(
    skills["logix-help"],
    /pnpm -w --silent tasks:list -- --current --json/,
  );
});

test("silent JSON task query is parseable from a nested workspace directory", () => {
  const root = mkdtempSync(join(tmpdir(), "logix nested query "));
  temporaryRepositories.push(root);
  git(root, ["init", "--initial-branch=feat/current"]);
  git(root, ["config", "user.email", "query@example.test"]);
  git(root, ["config", "user.name", "Task Query Test"]);
  write(
    root,
    "package.json",
    JSON.stringify({
      private: true,
      type: "module",
      packageManager: "pnpm@10.15.1",
      scripts: { "tasks:list": "node scripts/continuation-gateway.mjs" },
    }),
  );
  write(root, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n');
  write(
    root,
    "scripts/continuation-gateway.mjs",
    readFileSync(moduleUrl, "utf8"),
  );
  write(
    root,
    "scripts/task-brief-state.mjs",
    readFileSync(new URL("./task-brief-state.mjs", import.meta.url), "utf8"),
  );
  write(
    root,
    "docs/planning/tasks/current-v1.md",
    taskBriefSource({
      status: "coding",
      branch: "feat/current",
      title: "Current task",
    }),
  );
  mkdirSync(join(root, "apps", "web"), { recursive: true });
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "task query fixture"]);
  const result = spawnSync(
    "pnpm",
    ["-w", "--silent", "tasks:list", "--", "--current", "--json"],
    {
      cwd: join(root, "apps", "web"),
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
  assert.equal(JSON.parse(result.stdout).query, "current");
});

test("continue-work treats startup projection as non-authoritative and reobserves safety", () => {
  const source = readContinuationSkills()["continue-work"];

  assert.match(source, /启动投影不是写入授权/);
  assert.match(source, /写入前.*重新观察.*checkout.*worktree/s);
});
