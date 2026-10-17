import { execFile, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildContinuationProjection,
  formatContinuationContext,
  resolveContinuationTarget,
} from "../../scripts/continuation-gateway.mjs";
import {
  buildCalibrationProjection,
  observeCheckout,
} from "../../scripts/task-brief-state.mjs";
import {
  buildWorktreeCalibrationProjection,
  observeRegisteredWorktrees,
  parseWorktreePorcelain,
  runReadOnlyGit,
} from "../../scripts/worktree-calibration.mjs";

const FALLBACK_CONTEXT =
  "Continuation snapshot unavailable; run the usual repository checks before writing.";
const OBSERVER_FLAG = "--observe";
const MAX_DEADLINE_MS = 4_000;
const modulePath = fileURLToPath(import.meta.url);

process.env.GIT_OPTIONAL_LOCKS = "0";

const outputContext = (additionalContext) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }),
  );
};

const diagnostic = (code) => {
  process.stderr.write(`continuation gateway: ${code}\n`);
};

const noRefreshArgs = (args) => {
  if (args[0] !== "diff") return args;
  const options = args.slice(1);
  const hasRevision = options.some((argument) => !argument.startsWith("-"));
  if (hasRevision) return args;
  if (options.includes("--cached")) {
    return [
      "diff-index",
      "--cached",
      ...options.filter((argument) => argument !== "--cached"),
      "HEAD",
      "--",
    ];
  }
  return ["diff-files", ...options, "--"];
};

const hookGitArgs = (args) => [
  "-c",
  "core.excludesFile=/dev/null",
  ...noRefreshArgs(args),
];

const hookGit = ({ cwd, args }) =>
  runReadOnlyGit({
    cwd,
    args: hookGitArgs(args),
  });

const hookGitAsync = ({ cwd, args }) =>
  new Promise((resolveResult) => {
    execFile(
      "git",
      hookGitArgs(args),
      { cwd, encoding: "utf8", windowsHide: true },
      (error, stdout) => {
        resolveResult({
          stdout: typeof stdout === "string" ? stdout : "",
          exitCode: error
            ? Number.isInteger(error.code)
              ? error.code
              : Number.isInteger(error.status)
                ? error.status
                : 2
            : 0,
        });
      },
    );
  });

const gitReadKey = (cwd, args) =>
  `${resolve(cwd).replaceAll("\\", "/").toLowerCase()}\0${JSON.stringify(args)}`;

const prefetchWorktreeGit = async ({ primaryPath, mainRef }) => {
  const cache = new Map();
  const read = async (cwd, args) => {
    const key = gitReadKey(cwd, args);
    if (cache.has(key)) return cache.get(key);
    const result = await hookGitAsync({ cwd, args });
    cache.set(key, result);
    return result;
  };
  const seed = (cwd, args, result) => {
    cache.set(gitReadKey(cwd, args), result);
  };
  const registryArgs = ["worktree", "list", "--porcelain", "-z"];
  const registry = await read(primaryPath, registryArgs);
  if (registry.exitCode !== 0) {
    return (cwd, args) => cache.get(gitReadKey(cwd, args)) ?? hookGit({ cwd, args });
  }

  let registrations;
  try {
    registrations = parseWorktreePorcelain(registry.stdout);
  } catch {
    return (cwd, args) => cache.get(gitReadKey(cwd, args)) ?? hookGit({ cwd, args });
  }

  const mainRefResult = await read(primaryPath, [
    "rev-parse",
    "--verify",
    mainRef,
  ]);
  for (const registration of registrations) {
    seed(registration.path, ["branch", "--show-current"], {
      stdout: registration.branch ? `${registration.branch}\n` : "",
      exitCode: 0,
    });
    seed(registration.path, ["rev-parse", "HEAD"], {
      stdout: `${registration.headSha}\n`,
      exitCode: 0,
    });
    seed(
      registration.path,
      ["rev-parse", "--verify", mainRef],
      mainRefResult,
    );
  }

  const readRound = (argsFor) =>
    Promise.all(
      registrations.map((registration) =>
        read(registration.path, argsFor(registration)),
      ),
    );
  const mergeBases = await readRound(() => ["merge-base", mainRef, "HEAD"]);
  await Promise.all(
    registrations.map((registration, index) => {
      const mergeBase = mergeBases[index];
      if (mergeBase.exitCode !== 0 || !mergeBase.stdout.trim()) return null;
      return read(registration.path, [
        "diff",
        "--name-status",
        "-z",
        "--diff-filter=ACMRD",
        `${mergeBase.stdout.trim()}...HEAD`,
      ]);
    }),
  );
  for (const argsFor of [
    () => ["diff", "--name-status", "-z", "--cached", "--diff-filter=ACMRD"],
    () => ["diff", "--name-status", "-z", "--diff-filter=ACMRD"],
    () => ["ls-files", "--others", "--exclude-standard"],
    () => ["rev-list", "--left-right", "--count", `${mainRef}...HEAD`],
    () => ["merge-base", "--is-ancestor", "HEAD", mainRef],
    () => ["ls-files", "-z", "--", "docs/planning/tasks/*.md"],
  ]) {
    await readRound(argsFor);
  }

  return (cwd, args) => cache.get(gitReadKey(cwd, args)) ?? hookGit({ cwd, args });
};

const git = (cwd, args) => hookGit({ cwd, args });

const requireGit = (
  cwd,
  args,
  code = "GIT_READ_FAILED",
  readGit = git,
) => {
  const result = readGit(cwd, args);
  if (result.exitCode !== 0) throw new Error(code);
  return result.stdout;
};

const samePath = (left, right) =>
  String(left).replaceAll("\\", "/").toLowerCase() ===
  String(right).replaceAll("\\", "/").toLowerCase();

const observeWorkspaceIdentity = (handoffPath, workspacePath) => {
  if (process.platform !== "win32") return null;
  try {
    const handoffCanonicalPath = realpathSync.native(handoffPath);
    const workspaceCanonicalPath = realpathSync.native(workspacePath);
    return {
      equivalent: samePath(handoffCanonicalPath, workspaceCanonicalPath),
      handoffCanonicalPath,
      workspaceCanonicalPath,
    };
  } catch {
    return {
      equivalent: false,
      handoffCanonicalPath: null,
      workspaceCanonicalPath: null,
    };
  }
};

const resolveCheckoutRoot = (inputCwd) =>
  resolve(
    requireGit(
      inputCwd,
      ["rev-parse", "--show-toplevel"],
      "CWD_NOT_IN_GIT",
    ).trim(),
  );

const gitResolvesCommit = (cwd, revision) =>
  git(cwd, ["rev-parse", "--verify", `${revision}^{commit}`]).exitCode === 0;

const selectMainRef = (cwd) => {
  for (const candidate of ["origin/main", "main", "master"]) {
    if (gitResolvesCommit(cwd, candidate)) return candidate;
  }
  throw new Error("MAIN_REF_NOT_FOUND");
};

const textContent = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
};

const readRecoveryPrompt = (transcriptPath, sessionSource) => {
  if (typeof transcriptPath !== "string" || !transcriptPath) return "";
  let source;
  try {
    source = readFileSync(transcriptPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" && sessionSource === "startup") return "";
    throw error;
  }
  let latest = "";
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const message = record.message ?? record;
      if (record.type !== "user" && message.role !== "user") continue;
      const candidate = textContent(message.content).trim();
      if (candidate) latest = candidate;
    } catch {
      // Transcript metadata and malformed non-message records are not intent.
    }
  }
  return latest;
};

const explicitPointer = (source) => {
  const withoutHandoff = String(source ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*HANDOFF\s+/i.test(line))
    .join("\n");
  const taskMatch = withoutHandoff.match(
    /(?:^|\s)TASK\s+(docs\/planning\/tasks\/[^/#\s]+\.md#[^#\s]+)/i,
  );
  if (taskMatch) return taskMatch[1];
  const standaloneMatch = withoutHandoff.match(
    /^\s*(docs\/planning\/tasks\/[^/#\s]+\.md#[^#\s]+)\s*$/im,
  );
  return standaloneMatch?.[1] ?? null;
};

const parseHandoff = (source) => {
  const line = String(source ?? "").match(/^\s*HANDOFF(?:\s+(.+))?$/im);
  if (!line) return null;
  const body = line[1] ?? "";
  const pointer = body.match(
    /^(docs\/planning\/tasks\/[^/#\s]+\.md)#([^#\s]+)/i,
  );
  const field = (name) =>
    body.match(new RegExp(`(?:^|\\s)${name}=(\\S+)`, "i"))?.[1];
  const workspace = body.match(
    /(?:^|\s)workspace=(.+?)(?=\s+commit=|$)/i,
  )?.[1];
  return {
    task: pointer?.[1],
    slice: pointer?.[2],
    base: field("base"),
    role: field("role"),
    workspace,
    commit: field("commit"),
  };
};

const handoffIdentityReady = (handoff) =>
  ["task", "slice", "base", "role", "workspace", "commit"].every(
    (field) => typeof handoff?.[field] === "string" && handoff[field] !== "",
  );

const observeHandoffIdentity = (cwd, handoff, observedHead) => {
  const baseResolvable = gitResolvesCommit(cwd, handoff.base);
  const uncommitted = handoff.commit.toLowerCase() === "none";
  const commitResolvable = uncommitted
    ? null
    : gitResolvesCommit(cwd, handoff.commit);
  const baseIsAncestorOfHead =
    baseResolvable &&
    git(cwd, ["merge-base", "--is-ancestor", handoff.base, "HEAD"])
      .exitCode === 0;
  const committed = git(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--diff-filter=ACMRD",
    `${handoff.base}...HEAD`,
  ]);
  const staged = git(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--cached",
    "--diff-filter=ACMRD",
  ]);
  const unstaged = git(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--diff-filter=ACMRD",
  ]);
  const diffReadable = [committed, staged, unstaged].every(
    ({ exitCode }) => exitCode === 0,
  );
  const hasWorkingDiff = Boolean(staged.stdout || unstaged.stdout);
  return {
    baseResolvable,
    commitResolvable,
    baseIsAncestorOfHead,
    reproducesDiff:
      baseResolvable && diffReadable && (!uncommitted || hasWorkingDiff),
    observedHead,
  };
};

const currentPrompt = (input) =>
  [input.prompt, input.user_prompt, input.userPrompt]
    .filter((value) => typeof value === "string")
    .join("\n");

const observeTargetCalibration = ({
  cwd,
  mainRef,
  target,
  tasks,
  existing,
  readGit,
}) => {
  if (existing?.task && samePath(existing.task.path, target.path)) {
    return existing;
  }
  const observation = observeCheckout({
    baseRef: mainRef,
    branch: requireGit(
      cwd,
      ["branch", "--show-current"],
      "GIT_READ_FAILED",
      readGit,
    ).trim(),
    git: (args) => requireGit(cwd, args, "GIT_READ_FAILED", readGit),
  });
  return buildCalibrationProjection({
    task: target,
    records: tasks,
    authorityExists: (path) => existsSync(resolve(cwd, path)),
    observation,
  });
};

const TARGET_WORKTREE_FINDINGS = new Set([
  "WORKTREE_ACTIVE_WRITER_CONFLICT",
  "WORKTREE_ACTIVE_SCOPE_CONFLICT",
  "WORKTREE_ACTIVE_LOCK_CONFLICT",
  "WORKTREE_ACTIVE_DEPENDENCY_BLOCKED",
  "WORKTREE_WRITE_WIP_EXCEEDED",
]);

const targetWorktreeFindings = (projection, target) => {
  const targetIsActive = projection.activeTasks.some(
    ({ task }) => task.path === target.path,
  );
  return projection.findings.filter((finding) => {
    if (!TARGET_WORKTREE_FINDINGS.has(finding.code)) return false;
    if (finding.code === "WORKTREE_WRITE_WIP_EXCEEDED") return targetIsActive;
    return (
      finding.taskPath === target.path ||
      finding.subject.split(" / ").includes(target.id)
    );
  });
};

const withWorktreeFindings = (calibration, findings) => ({
  ...calibration,
  derived: {
    ...calibration.derived,
    findings: [...calibration.derived.findings, ...findings],
  },
});

const run = async (input) => {
  if (!input || typeof input !== "object") throw new Error("INPUT_INVALID");
  if (typeof input.cwd !== "string" || !isAbsolute(input.cwd)) {
    throw new Error("CWD_INVALID");
  }
  const cwd = resolveCheckoutRoot(resolve(input.cwd));
  const mainRef = selectMainRef(cwd);
  const readGit = await prefetchWorktreeGit({ primaryPath: cwd, mainRef });
  const observedWorktrees = observeRegisteredWorktrees({
    primaryPath: cwd,
    mainRef,
    git: ({ cwd: worktreePath, args }) => readGit(worktreePath, args),
    readFile: readFileSync,
    authorityExists: (absolutePath) => existsSync(absolutePath),
  });
  if (
    observedWorktrees.some(
      (worktree) => !worktree.readable || worktree.state === "unreadable",
    )
  ) {
    throw new Error("WORKTREE_READ_FAILED");
  }
  const checkout = observedWorktrees.find(({ isPrimary }) => isPrimary);
  if (!checkout) throw new Error("CHECKOUT_NOT_FOUND");

  const prompt =
    currentPrompt(input) ||
    readRecoveryPrompt(input.transcript_path, input.source);
  const pointer = explicitPointer(prompt);
  const handoff = parseHandoff(prompt);
  const intent = {
    explicitContinuation: Boolean(pointer || handoff),
    ...(pointer ? { explicitPointer: pointer } : {}),
    ...(!pointer && handoff ? { handoff } : {}),
  };
  const workspace = {
    path: checkout.registration.path,
    branch: checkout.registration.branch,
    head: checkout.registration.headSha,
    mainRef,
  };
  const resolution = resolveContinuationTarget({
    intent,
    workspace,
    tasks: checkout.taskRecords,
  });
  const target = resolution.task;
  let calibrationProjection = checkout.checkoutProjection;
  let worktrees = observedWorktrees;
  if (target) {
    calibrationProjection = observeTargetCalibration({
      cwd,
      mainRef,
      target,
      tasks: checkout.taskRecords,
      existing: calibrationProjection,
      readGit,
    });
    worktrees = observedWorktrees.map((worktree) =>
      worktree.isPrimary && worktree.activeResolution?.task
        ? { ...worktree, state: "active" }
        : worktree,
    );
    const worktreeProjection = buildWorktreeCalibrationProjection({
      primaryPath: cwd,
      mainRef,
      primaryTaskRecords: checkout.taskRecords,
      observedWorktrees: worktrees,
    });
    calibrationProjection = withWorktreeFindings(
      calibrationProjection,
      targetWorktreeFindings(worktreeProjection, target),
    );
  }

  const projection = buildContinuationProjection({
    intent,
    workspace,
    tasks: checkout.taskRecords,
    worktrees,
    calibrationProjection,
    ...(!pointer && handoff?.workspace
      ? {
          workspaceIdentityObservation: observeWorkspaceIdentity(
            handoff.workspace,
            workspace.path,
          ),
        }
      : {}),
    ...(!pointer && handoffIdentityReady(handoff)
      ? {
          identityObservation: observeHandoffIdentity(
            cwd,
            handoff,
            workspace.head,
          ),
        }
      : {}),
  });
  const context = formatContinuationContext(projection);
  if (context) outputContext(context);
};

const readStdin = async () => {
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  return source;
};

const observerMain = async () => {
  try {
    await run(JSON.parse(await readStdin()));
  } catch (error) {
    diagnostic(error?.code ?? error?.message ?? "READ_FAILED");
    outputContext(FALLBACK_CONTEXT);
  }
};

const deadlineMs = () => {
  const requested = Number(process.env.LOGIX_CONTINUATION_DEADLINE_MS);
  return Number.isFinite(requested) && requested >= 1
    ? Math.min(requested, MAX_DEADLINE_MS)
    : MAX_DEADLINE_MS;
};

const hookMain = async () => {
  const source = await readStdin();
  const result = spawnSync(process.execPath, [modulePath, OBSERVER_FLAG], {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    input: source,
    timeout: deadlineMs(),
    windowsHide: true,
  });
  if (result.error?.code === "ETIMEDOUT") {
    diagnostic("DEADLINE_EXCEEDED");
    outputContext(FALLBACK_CONTEXT);
    return;
  }
  if (result.status !== 0) {
    diagnostic("OBSERVER_FAILED");
    outputContext(FALLBACK_CONTEXT);
    return;
  }
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
};

if (process.argv.includes(OBSERVER_FLAG)) await observerMain();
else await hookMain();
