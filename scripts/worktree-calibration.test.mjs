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
