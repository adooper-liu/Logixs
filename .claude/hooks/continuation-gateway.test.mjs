import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath, URL } from "node:url";

const settingsUrl = new URL("../settings.json", import.meta.url);
const hookUrl = new URL("./continuation-gateway.mjs", import.meta.url);
const briefUrl = new URL(
  "../../docs/planning/tasks/continuation-gateway-v1.md",
  import.meta.url,
);
const packageUrl = new URL("../../package.json", import.meta.url);
const hookPath = fileURLToPath(hookUrl);

const git = (cwd, args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const write = (root, path, source) => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
};

const taskSource = ({
  status = "coding",
  branch = "feat/continue",
  taskPath = "docs/planning/tasks/example-v1.md",
  scope = "scripts/example/**",
  lock = "continuation-test",
} = {}) => `---
status: ${status}
branch: ${branch}
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - ${taskPath}
  - ${scope}
exclusiveLocks:
  - ${lock}
sharedIntegrationScopes: []
authorityRefs: []
---

# Example task
`;

const createRepository = ({ active = false, status = "coding" } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "logix continuation 中文 space "));
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.email", "continuation@example.test"]);
  git(root, ["config", "user.name", "Continuation Test"]);
  write(root, "README.md", "fixture\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "fixture base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  git(root, ["update-ref", "refs/remotes/origin/main", base]);
  if (active) {
    git(root, ["checkout", "-b", "feat/continue"]);
    write(
      root,
      "docs/planning/tasks/example-v1.md",
      taskSource({ status }),
    );
    git(root, ["add", "docs/planning/tasks/example-v1.md"]);
    git(root, ["commit", "-m", "add active task"]);
  }
  return { root, base, head: git(root, ["rev-parse", "HEAD"]) };
};

const comparablePath = (value) =>
  value.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();

const workspaceSpellings = (root) => {
  const gitRoot = git(root, ["rev-parse", "--show-toplevel"]);
  if (process.platform !== "win32") {
    return { handoffWorkspace: root, gitRoot };
  }
  if (comparablePath(root) !== comparablePath(gitRoot)) {
    assert.equal(
      comparablePath(realpathSync.native(root)),
      comparablePath(realpathSync.native(gitRoot)),
    );
    return { handoffWorkspace: root, gitRoot };
  }

  const handoffWorkspace = `${root} handoff alias`;
  symlinkSync(root, handoffWorkspace, "junction");
  assert.equal(
    comparablePath(realpathSync.native(handoffWorkspace)),
    comparablePath(realpathSync.native(gitRoot)),
  );
  return { handoffWorkspace, gitRoot };
};

const runHook = (input, options = {}) =>
  spawnSync(process.execPath, [hookPath], {
    encoding: "utf8",
    input: JSON.stringify(input),
    ...options,
  });

const gitSnapshot = (root) => ({
  head: git(root, ["rev-parse", "HEAD"]),
  status: git(root, ["status", "--porcelain=v1"]),
  worktrees: execFileSync(
    "git",
    ["worktree", "list", "--porcelain", "-z"],
    { cwd: root, encoding: "utf8" },
  ),
});

const parseOutput = (result) => {
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
};

const gitDirectory = (root) => {
  const marker = join(root, ".git");
  if (statSync(marker).isDirectory()) return marker;
  const relative = readFileSync(marker, "utf8").match(/^gitdir:\s*(.+)\s*$/i)?.[1];
  assert.ok(relative, "linked worktree must expose its gitdir");
  return resolve(root, relative);
};

const snapshotPath = (path) => {
  if (!existsSync(path)) return null;
  const stat = statSync(path, { bigint: true });
  if (stat.isDirectory()) {
    return readdirSync(path)
      .sort()
      .map((entry) => [entry, snapshotPath(join(path, entry))]);
  }
  return {
    bytes: readFileSync(path).toString("base64"),
    mtimeNs: String(stat.mtimeNs),
  };
};

const rawGitSnapshot = (root) => {
  const gitDir = gitDirectory(root);
  const commonDirPath = join(gitDir, "commondir");
  const commonDir = existsSync(commonDirPath)
    ? resolve(gitDir, readFileSync(commonDirPath, "utf8").trim())
    : gitDir;
  return {
    checkoutHead: snapshotPath(join(gitDir, "HEAD")),
    checkoutIndex: snapshotPath(join(gitDir, "index")),
    commonHead: snapshotPath(join(commonDir, "HEAD")),
    commonIndex: snapshotPath(join(commonDir, "index")),
    packedRefs: snapshotPath(join(commonDir, "packed-refs")),
    refs: snapshotPath(join(commonDir, "refs")),
  };
};

test("settings preserve the UI gate and register only SessionStart continuation", () => {
  const settings = JSON.parse(readFileSync(settingsUrl, "utf8"));

  assert.deepEqual(settings.hooks.PreToolUse, [
    {
      matcher: "Write|Edit",
      hooks: [
        {
          type: "command",
          command: "node scripts/check-ui-structure-gate.mjs",
          timeout: 10,
          statusMessage: "Checking mandatory UI structure",
        },
      ],
    },
  ]);
  assert.deepEqual(settings.hooks.SessionStart, [
    {
      matcher: "startup|resume|clear|compact",
      hooks: [
        {
          type: "command",
          command: "node",
          args: [
            "${CLAUDE_PROJECT_DIR}/.claude/hooks/continuation-gateway.mjs",
          ],
          timeout: 5,
          statusMessage: "Loading local continuation checkpoint",
        },
      ],
    },
  ]);
  assert.equal(Object.hasOwn(settings.hooks, "CwdChanged"), false);
  assert.equal(Object.hasOwn(settings.hooks, "PostCompact"), false);
});

test("the active brief owns both SessionStart Hook files", () => {
  const brief = readFileSync(briefUrl, "utf8");

  assert.match(brief, /^\s+- \.claude\/hooks\/continuation-gateway\.mjs$/m);
  assert.match(
    brief,
    /^\s+- \.claude\/hooks\/continuation-gateway\.test\.mjs$/m,
  );
});

test("Hook Git reads preserve raw index, refs, and HEAD metadata", () => {
  const { root } = createRepository({ active: true });
  const readme = join(root, "README.md");
  const future = new Date(Date.now() + 60_000);
  utimesSync(readme, future, future);
  const before = rawGitSnapshot(root);

  parseOutput(
    runHook({ hook_event_name: "SessionStart", source: "startup", cwd: root }),
  );

  assert.deepEqual(rawGitSnapshot(root), before);
});

test("Hook returns fallback before the host timeout when Git stalls", () => {
  const { root } = createRepository({ active: true });
  const startedAt = Date.now();
  const result = runHook(
    { hook_event_name: "SessionStart", source: "startup", cwd: root },
    {
      env: { ...process.env, LOGIX_CONTINUATION_DEADLINE_MS: "1" },
      timeout: 6_500,
    },
  );
  const elapsed = Date.now() - startedAt;

  const context = parseOutput(result);
  assert.match(context, /Continuation snapshot unavailable/);
  assert.ok(elapsed < 5_000, `fallback took ${elapsed}ms`);
});

test("twelve registered worktrees complete before the internal deadline", () => {
  const { root } = createRepository({ active: true });
  for (let index = 1; index < 12; index += 1) {
    git(root, [
      "worktree",
      "add",
      "-b",
      `perf/sibling-${index}`,
      `${root} sibling ${index}`,
      "origin/main",
    ]);
  }

  const context = parseOutput(
    runHook(
      { hook_event_name: "SessionStart", source: "startup", cwd: root },
      { timeout: 6_500 },
    ),
  );

  assert.doesNotMatch(context, /Continuation snapshot unavailable/);
  assert.match(context, /action=resume/);
});

test("clean main without an active tracked task stays silent and read-only", () => {
  const { root } = createRepository();
  const before = gitSnapshot(root);

  for (const source of ["startup", "resume", "clear", "compact"]) {
    const result = runHook({
      hook_event_name: "SessionStart",
      source,
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
  assert.deepEqual(gitSnapshot(root), before);
});

test("all SessionStart sources recalculate the active feature checkout", () => {
  const { root } = createRepository({ active: true });
  const before = gitSnapshot(root);

  for (const source of ["startup", "resume", "clear", "compact"]) {
    const context = parseOutput(
      runHook({ hook_event_name: "SessionStart", source, cwd: root }),
    );
    assert.match(context, /action=resume safety=clear/);
    assert.match(
      context,
      /target=docs\/planning\/tasks\/example-v1\.md status=coding/,
    );
    assert.match(context, /nextGate=run-slice-verification/);
  }

  assert.deepEqual(gitSnapshot(root), before);
});

test("fresh startup ignores an ENOENT transcript and resumes the active checkout", () => {
  const { root } = createRepository({ active: true });
  const transcriptPath = join(root, "fresh session", "not-created.jsonl");
  const before = gitSnapshot(root);

  const result = runHook({
    hook_event_name: "SessionStart",
    source: "startup",
    cwd: root,
    transcript_path: transcriptPath,
  });
  const context = parseOutput(result);

  assert.doesNotMatch(context, /Continuation snapshot unavailable/);
  assert.match(context, /action=resume safety=clear/);
  assert.match(
    context,
    /target=docs\/planning\/tasks\/example-v1\.md status=coding/,
  );
  assert.match(context, /nextGate=run-slice-verification/);
  assert.equal(result.stderr, "");
  assert.deepEqual(gitSnapshot(root), before);
});

test("recovery sources keep the controlled fallback for an ENOENT transcript", () => {
  const { root } = createRepository({ active: true });
  const transcriptPath = join(root, "missing recovery", "not-created.jsonl");
  const before = gitSnapshot(root);
  const results = ["resume", "clear", "compact"].map((source) => ({
    source,
    result: runHook({
      hook_event_name: "SessionStart",
      source,
      cwd: root,
      transcript_path: transcriptPath,
    }),
  }));

  const observations = results.map(({ source, result }) => {
    const context = parseOutput(result);
    return {
      source,
      fallback: /Continuation snapshot unavailable/.test(context),
      branchInferred: /action=resume safety=clear/.test(context),
      enoentDiagnostic: /continuation gateway: ENOENT/.test(result.stderr),
    };
  });
  assert.deepEqual(gitSnapshot(root), before);
  assert.deepEqual(
    observations,
    ["resume", "clear", "compact"].map((source) => ({
      source,
      fallback: true,
      branchInferred: false,
      enoentDiagnostic: true,
    })),
  );
});

test("non-ENOENT transcript read failures keep the controlled fallback", () => {
  const { root } = createRepository({ active: true });
  const before = gitSnapshot(root);

  const result = runHook({
    hook_event_name: "SessionStart",
    source: "startup",
    cwd: root,
    transcript_path: root,
  });
  const context = parseOutput(result);

  assert.match(context, /Continuation snapshot unavailable/);
  assert.match(result.stderr, /continuation gateway:/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
  assert.deepEqual(gitSnapshot(root), before);
});

test("a complete HANDOFF uses read-only Git identity observation", () => {
  const { root, base, head } = createRepository({
    active: true,
    status: "review",
  });
  const { handoffWorkspace } = workspaceSpellings(root);
  const prompt = `HANDOFF docs/planning/tasks/example-v1.md#CG1 base=${base} role=main workspace=${handoffWorkspace} commit=${head}`;
  const transcriptPath = join(root, "recovery transcript.jsonl");
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({ type: "user", message: { role: "user", content: prompt } })}\n`,
  );
  const before = gitSnapshot(root);

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      transcript_path: transcriptPath,
    }),
  );

  assert.match(context, /action=review-handoff safety=clear/);
  assert.match(context, /slice=CG1/);
  assert.doesNotMatch(context, /CONTINUATION_HANDOFF_IDENTITY_INVALID/);
  assert.deepEqual(gitSnapshot(root), before);
});

test("recovery keeps the latest non-empty user HANDOFF across tool results", () => {
  const { root, base, head } = createRepository({
    active: true,
    status: "review",
  });
  const { handoffWorkspace } = workspaceSpellings(root);
  const handoff = `HANDOFF docs/planning/tasks/example-v1.md#CG2 base=${base} role=main workspace=${handoffWorkspace} commit=${head}`;
  const transcriptPath = join(root, "tool-result transcript.jsonl");
  writeFileSync(
    transcriptPath,
    [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: handoff },
      }),
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", content: "finished" }],
        },
      }),
    ].join("\n"),
  );

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      transcript_path: transcriptPath,
    }),
  );

  assert.match(context, /action=review-handoff safety=clear/);
  assert.match(context, /slice=CG2/);
});

test("a nested stdin cwd resolves to its registered checkout root", () => {
  const { root } = createRepository({ active: true });
  const { gitRoot } = workspaceSpellings(root);
  const nested = join(root, "scripts", "example", "nested");
  mkdirSync(nested, { recursive: true });

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "startup",
      cwd: nested,
    }),
  );

  assert.match(context, /action=resume safety=clear/);
  assert.match(
    context,
    new RegExp(
      `workspace=${gitRoot.replaceAll("\\", "/").replaceAll("/", "\\/")}`,
    ),
  );
});

test("commit none requires a real staged or unstaged diff", () => {
  const { root, base } = createRepository({ active: true, status: "review" });
  const { handoffWorkspace } = workspaceSpellings(root);
  const prompt = `HANDOFF docs/planning/tasks/example-v1.md#CG2 base=${base} role=main workspace=${handoffWorkspace} commit=none`;

  const cleanContext = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      prompt,
    }),
  );
  assert.match(cleanContext, /action=review-handoff safety=block-target/);
  assert.match(cleanContext, /CONTINUATION_HANDOFF_IDENTITY_INVALID/);

  appendFileSync(
    join(root, "docs/planning/tasks/example-v1.md"),
    "\nLocal review note.\n",
  );
  const dirtyContext = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      prompt,
    }),
  );
  assert.match(dirtyContext, /action=review-handoff safety=clear/);
});

test("a HANDOFF from a different existing workspace still blocks", () => {
  const { root, base, head } = createRepository({
    active: true,
    status: "review",
  });
  const { root: otherRoot } = createRepository();
  const prompt = `HANDOFF docs/planning/tasks/example-v1.md#CG2 base=${base} role=main workspace=${otherRoot} commit=${head}`;

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      prompt,
    }),
  );

  assert.match(context, /action=review-handoff safety=block-target/);
  assert.match(context, /CONTINUATION_WORKSPACE_MISMATCH/);
});

test("an explicit blocked task receives its calibration next gate", () => {
  const { root } = createRepository({ active: true, status: "blocked" });

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      prompt: "TASK docs/planning/tasks/example-v1.md#CG2",
    }),
  );

  assert.match(context, /action=select safety=protect-read-only/);
  assert.match(context, /nextGate=revalidate-blocker/);
});

test("an incomplete HANDOFF blocks instead of falling back to the branch", () => {
  const { root } = createRepository({ active: true, status: "review" });
  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "resume",
      cwd: root,
      prompt: "HANDOFF docs/planning/tasks/example-v1.md#CG1 role=main",
    }),
  );

  assert.match(context, /action=select safety=block-target/);
  assert.match(context, /CONTINUATION_HANDOFF_INCOMPLETE/);
});

test("an overlapping path in another registered worktree protects read-only", () => {
  const { root } = createRepository({ active: true });
  const sibling = `${root} sibling`;
  git(root, [
    "worktree",
    "add",
    "-b",
    "feat/other",
    sibling,
    "origin/main",
  ]);
  write(sibling, "scripts/example/conflict.mjs", "export {};\n");
  const before = gitSnapshot(root);

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "startup",
      cwd: root,
    }),
  );

  assert.match(context, /action=resume safety=protect-read-only/);
  assert.match(context, /CONTINUATION_WORKTREE_SCOPE_OVERLAP/);
  assert.deepEqual(gitSnapshot(root), before);
});

test("an unreadable registered sibling returns the controlled fallback", () => {
  const { root } = createRepository({ active: true });
  const sibling = `${root} unreadable sibling`;
  git(root, [
    "worktree",
    "add",
    "-b",
    "feat/unreadable",
    sibling,
    "origin/main",
  ]);
  rmSync(sibling, { recursive: true, force: true, maxRetries: 3 });

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "startup",
      cwd: root,
    }),
  );

  assert.match(context, /Continuation snapshot unavailable/);
  assert.doesNotMatch(context, /action=resume safety=clear/);
});

test("a clean sibling active task exposes real writer conflicts", () => {
  const { root } = createRepository({ active: true });
  const sibling = `${root} active sibling`;
  git(root, [
    "worktree",
    "add",
    "-b",
    "feat/sibling",
    sibling,
    "origin/main",
  ]);
  const siblingTask = "docs/planning/tasks/sibling-v1.md";
  write(
    sibling,
    siblingTask,
    taskSource({
      branch: "feat/sibling",
      taskPath: siblingTask,
      scope: "scripts/sibling/**",
      lock: "sibling-test",
    }),
  );
  git(sibling, ["add", siblingTask]);
  git(sibling, ["commit", "-m", "add sibling active task"]);

  const context = parseOutput(
    runHook({
      hook_event_name: "SessionStart",
      source: "startup",
      cwd: root,
    }),
  );

  assert.match(context, /action=resume safety=block-target/);
  assert.match(context, /WORKTREE_ACTIVE_WRITER_CONFLICT/);
});

test("root pnpm test includes CG1 and CG2 continuation tests", () => {
  const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));

  assert.match(packageJson.scripts.test, /scripts\/continuation-gateway\.test\.mjs/);
  assert.match(
    packageJson.scripts.test,
    /\.claude\/hooks\/continuation-gateway\.test\.mjs/,
  );
});

test("invalid input fails open with one fallback JSON object", () => {
  const result = runHook({
    hook_event_name: "SessionStart",
    source: "startup",
    cwd: join(tmpdir(), "continuation-missing-checkout"),
  });
  const context = parseOutput(result);

  assert.match(context, /Continuation snapshot unavailable/);
  assert.match(context, /repository checks before writing/);
  assert.match(result.stderr, /continuation gateway:/);
  assert.equal(result.stdout.trim().split("\n").length, 1);
});
