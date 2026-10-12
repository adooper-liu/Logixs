import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ACTIVE_TASK_STATUSES,
  buildCalibrationProjection,
  loadTrackedTaskRecords,
  normalizeTaskRecords,
  observeCheckout,
  parseWriteScope,
  resolveCurrentTask,
  writeScopesOverlap,
} from "./task-brief-state.mjs";

const WRITE_STATUSES = new Set(["design", "coding", "fix"]);
const WIP_STATUSES = new Set(["coding", "fix"]);

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
    if (!current.path || !current.headSha) {
      throw registryError("incomplete record");
    }
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
  if (new Set(paths).size !== paths.length) {
    throw registryError("duplicate path");
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyWorktree(input) {
  if (!input.readable) return "unreadable";
  if (input.isPrimary) return "primary";
  if (input.activeResolution?.task) return "active";
  if (input.trackedDirtyPaths.length > 0) return "unowned-dirty";
  if (input.fullyMerged) return "dormant-merged";
  return "dormant-ahead";
}

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

const pathOf = (worktree) => worktree.registration.path;

export function buildWorktreeCalibrationProjection({
  primaryPath,
  mainRef,
  primaryTaskRecords,
  observedWorktrees,
}) {
  const findings = [];
  const primaryById = new Map(
    primaryTaskRecords.map((record) => [record.id, record]),
  );
  const worktrees = observedWorktrees
    .map((worktree) => {
      const localTask = worktree.activeResolution?.task;
      const primaryTask = localTask ? primaryById.get(localTask.id) : null;
      const staleMergedTask =
        localTask &&
        worktree.fullyMerged &&
        (!primaryTask || !ACTIVE_TASK_STATUSES.has(primaryTask.status));
      if (!staleMergedTask) {
        return {
          ...worktree,
          state: worktree.state ?? classifyWorktree(worktree),
        };
      }
      const retired = {
        ...worktree,
        activeResolution: {
          finding: {
            code: "TASK_CURRENT_NOT_FOUND",
            evidence: [localTask.path],
          },
        },
        checkoutProjection: null,
      };
      return {
        ...retired,
        state: classifyWorktree(retired),
      };
    })
    .sort((left, right) => pathOf(left).localeCompare(pathOf(right)));
  const primary = worktrees.find((worktree) => worktree.isPrimary);

  if (
    !primary ||
    !["main", "master"].includes(primary.registration.branch ?? "") ||
    primary.trackedDirtyPaths.length > 0
  ) {
    findings.push(
      finding(
        "WORKTREE_PRIMARY_INVALID",
        "blocking",
        primaryPath,
        primary?.trackedDirtyPaths ?? ["primary worktree is missing"],
        "Run calibration from a clean registered main or master checkout.",
        { worktreePath: primaryPath },
      ),
    );
  }

  for (const worktree of worktrees) {
    const worktreePath = pathOf(worktree);
    if (!worktree.readable || worktree.state === "unreadable") {
      findings.push(
        finding(
          "WORKTREE_READ_FAILED",
          "blocking",
          worktreePath,
          [worktree.readError ?? "GIT_READ_FAILED"],
          "Restore readable Git metadata before treating this worktree as safe.",
          { worktreePath },
        ),
      );
      continue;
    }
    if (worktree.activeResolution?.finding?.code === "TASK_CURRENT_AMBIGUOUS") {
      findings.push(
        finding(
          "WORKTREE_ACTIVE_TASK_AMBIGUOUS",
          "blocking",
          worktreePath,
          worktree.activeResolution.finding.evidence ?? [],
          "Declare exactly one active brief for this worktree branch.",
          { worktreePath },
        ),
      );
    }
    if (worktree.state === "unowned-dirty") {
      findings.push(
        finding(
          "WORKTREE_TRACKED_DIRTY_UNOWNED",
          "blocking",
          worktreePath,
          worktree.trackedDirtyPaths,
          "Assign the tracked work to one active brief or have its owner resolve it.",
          { worktreePath },
        ),
      );
    }
    if (worktree.state === "dormant-ahead") {
      findings.push(
        finding(
          "WORKTREE_DORMANT_AHEAD",
          "warning",
          worktreePath,
          [`ahead=${worktree.ahead}`],
          "Confirm the historical branch outcome before any cleanup.",
          { worktreePath },
        ),
      );
    }
    if (worktree.behind > 0) {
      findings.push(
        finding(
          "WORKTREE_BEHIND_MAIN",
          "warning",
          worktreePath,
          [`behind=${worktree.behind}`, `mainRef=${mainRef}`],
          "Treat the observed branch as stale until its owner reconciles it.",
          { worktreePath },
        ),
      );
    }
    if (worktree.registration.detached) {
      findings.push(
        finding(
          "WORKTREE_DETACHED_HEAD",
          "warning",
          worktreePath,
          [worktree.registration.headSha],
          "Identify the owning branch before writing in this worktree.",
          { worktreePath },
        ),
      );
    }
    if (worktree.untrackedPaths.length > 0) {
      findings.push(
        finding(
          "WORKTREE_UNOWNED_UNTRACKED_PRESENT",
          "warning",
          worktreePath,
          worktree.untrackedPaths,
          "Leave untracked work untouched and report it separately.",
          { worktreePath },
        ),
      );
    }
  }

  findings.sort(findingSort);
  const activeTasks = worktrees
    .filter(({ state }) => state === "active")
    .map(({ activeResolution, registration, checkoutProjection }) => ({
      task: activeResolution.task,
      worktreePath: registration.path,
      checkoutProjection,
    }));
  const writeTasks = activeTasks.filter(({ task }) =>
    WRITE_STATUSES.has(task.status),
  );
  const conflicts = {
    writers: [],
    scopes: [],
    locks: [],
    dependencies: [],
    wip: [],
  };

  for (let leftIndex = 0; leftIndex < writeTasks.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < writeTasks.length;
      rightIndex += 1
    ) {
      const left = writeTasks[leftIndex];
      const right = writeTasks[rightIndex];
      const pairEvidence = [
        `${left.task.path} @ ${left.worktreePath}`,
        `${right.task.path} @ ${right.worktreePath}`,
      ];
      if (left.task.writer && left.task.writer === right.task.writer) {
        conflicts.writers.push({ left, right, writer: left.task.writer });
        findings.push(
          finding(
            "WORKTREE_ACTIVE_WRITER_CONFLICT",
            "blocking",
            `${left.task.id} / ${right.task.id}`,
            pairEvidence,
            "Keep active write tasks on distinct writers or serialize them.",
          ),
        );
      }
      const overlaps = left.task.writeScopes.some((leftScope) =>
        right.task.writeScopes.some((rightScope) =>
          writeScopesOverlap(
            parseWriteScope(leftScope),
            parseWriteScope(rightScope),
          ),
        ),
      );
      if (overlaps) {
        conflicts.scopes.push({ left, right });
        findings.push(
          finding(
            "WORKTREE_ACTIVE_SCOPE_CONFLICT",
            "blocking",
            `${left.task.id} / ${right.task.id}`,
            pairEvidence,
            "Separate write scopes or serialize the tasks.",
          ),
        );
      }
      const sharedLocks = left.task.exclusiveLocks.filter((lock) =>
        right.task.exclusiveLocks.includes(lock),
      );
      if (sharedLocks.length > 0) {
        conflicts.locks.push({ left, right, locks: sharedLocks });
        findings.push(
          finding(
            "WORKTREE_ACTIVE_LOCK_CONFLICT",
            "blocking",
            `${left.task.id} / ${right.task.id}`,
            [...pairEvidence, ...sharedLocks],
            "Release or serialize tasks sharing an exclusive lock.",
          ),
        );
      }
    }
  }

  const wipTasks = activeTasks.filter(({ task }) =>
    WIP_STATUSES.has(task.status),
  );
  if (wipTasks.length > 2) {
    conflicts.wip.push(...wipTasks);
    findings.push(
      finding(
        "WORKTREE_WRITE_WIP_EXCEEDED",
        "blocking",
        `${wipTasks.length} active coding/fix tasks`,
        wipTasks.map(
          ({ task, worktreePath }) => `${task.path} @ ${worktreePath}`,
        ),
        "Reduce active coding/fix worktrees to the repository WIP limit of 2.",
      ),
    );
  }

  for (const active of activeTasks) {
    const blocked = active.task.dependsOn.flatMap((id) => {
      const dependency = primaryById.get(id);
      if (!dependency) return [`${id}: missing`];
      if (dependency.status !== "done") {
        return [`${id}: status=${dependency.status}`];
      }
      return [];
    });
    if (blocked.length > 0) {
      const conflict = { active, evidence: blocked };
      conflicts.dependencies.push(conflict);
      findings.push(
        finding(
          "WORKTREE_ACTIVE_DEPENDENCY_BLOCKED",
          "blocking",
          active.task.id,
          blocked,
          "Complete dependencies in the primary task catalog before continuing.",
          {
            worktreePath: active.worktreePath,
            taskPath: active.task.path,
          },
        ),
      );
    }
    for (const checkoutFinding of active.checkoutProjection?.derived
      ?.findings ?? []) {
      if (
        checkoutFinding.severity !== "blocking" ||
        checkoutFinding.code === "TASK_UNOWNED_UNTRACKED_PRESENT"
      ) {
        continue;
      }
      findings.push({
        ...checkoutFinding,
        worktreePath: active.worktreePath,
        taskPath: active.task.path,
      });
    }
  }

  findings.sort(findingSort);
  return {
    primary: primary
      ? {
          path: primaryPath,
          branch: primary.registration.branch,
          headSha: primary.registration.headSha,
          mainRef,
          trackedDirtyPaths: primary.trackedDirtyPaths,
          untrackedPaths: primary.untrackedPaths,
        }
      : null,
    primaryTaskRecords,
    worktrees,
    activeTasks,
    conflicts,
    findings,
    nextGate: findings.some(({ severity }) => severity === "blocking")
      ? "fix-worktree-findings"
      : "continue-with-current-task",
  };
}

export function worktreeCalibrationFindings(projection) {
  return projection.findings;
}

const requireGit = (git, cwd, args) => {
  const result = git({ cwd, args });
  if (!result || result.exitCode !== 0) {
    const error = new Error("GIT_READ_FAILED");
    error.code = "GIT_READ_FAILED";
    throw error;
  }
  return result.stdout;
};

const trackedGit = (git, cwd) => (args) => requireGit(git, cwd, args);

const observeOne = ({
  registration,
  primaryPath,
  mainRef,
  git,
  readFile,
  authorityExists,
}) => {
  const cwd = registration.path;
  const branch = requireGit(git, cwd, ["branch", "--show-current"]).trim();
  const checkoutObservation = observeCheckout({
    baseRef: mainRef,
    branch,
    git: trackedGit(git, cwd),
  });
  if (!checkoutObservation.baseSha) {
    const error = new Error("GIT_READ_FAILED");
    error.code = "GIT_READ_FAILED";
    throw error;
  }
  const counts = requireGit(git, cwd, [
    "rev-list",
    "--left-right",
    "--count",
    `${mainRef}...HEAD`,
  ])
    .trim()
    .split(/\s+/)
    .map(Number);
  const ancestor = git({
    cwd,
    args: ["merge-base", "--is-ancestor", "HEAD", mainRef],
  });
  if (!ancestor || ![0, 1].includes(ancestor.exitCode)) {
    const error = new Error("GIT_READ_FAILED");
    error.code = "GIT_READ_FAILED";
    throw error;
  }
  const trackedDirtyPaths = [
    ...checkoutObservation.stagedPaths,
    ...checkoutObservation.unstagedPaths,
  ]
    .filter((path, index, all) => all.indexOf(path) === index)
    .sort();
  const untrackedPaths = checkoutObservation.untrackedPaths;
  const taskRecords = normalizeTaskRecords(
    loadTrackedTaskRecords({
      root: cwd,
      git: trackedGit(git, cwd),
      readFile,
    }),
  );
  const activeResolution = resolveCurrentTask({ records: taskRecords, branch });
  let checkoutProjection = null;
  if (activeResolution.task) {
    checkoutProjection = buildCalibrationProjection({
      task: activeResolution.task,
      records: taskRecords,
      authorityExists: (path) => authorityExists(resolve(cwd, path), path, cwd),
      observation: checkoutObservation,
    });
  }
  const observed = {
    registration: {
      ...registration,
      branch: branch || registration.branch,
      headSha: checkoutObservation.headSha,
    },
    isPrimary: cwd.toLowerCase() === primaryPath.toLowerCase(),
    readable: true,
    readError: null,
    ahead: counts[1] ?? 0,
    behind: counts[0] ?? 0,
    fullyMerged: ancestor.exitCode === 0,
    trackedDirtyPaths,
    untrackedPaths,
    taskRecords,
    activeResolution,
    checkoutProjection,
  };
  observed.state = classifyWorktree(observed);
  return observed;
};

export function observeRegisteredWorktrees({
  primaryPath,
  mainRef = "origin/main",
  git,
  readFile,
  authorityExists,
}) {
  let registrations;
  try {
    registrations = parseWorktreePorcelain(
      requireGit(git, primaryPath, ["worktree", "list", "--porcelain", "-z"]),
    );
  } catch (cause) {
    const error = new Error("WORKTREE_REGISTRY_READ_FAILED");
    error.code = "WORKTREE_REGISTRY_READ_FAILED";
    error.cause = cause;
    throw error;
  }
  if (
    !registrations.some(
      ({ path }) => path.toLowerCase() === primaryPath.toLowerCase(),
    )
  ) {
    const error = new Error("WORKTREE_PRIMARY_READ_FAILED");
    error.code = "WORKTREE_PRIMARY_READ_FAILED";
    throw error;
  }

  return registrations.map((registration) => {
    try {
      return observeOne({
        registration,
        primaryPath,
        mainRef,
        git,
        readFile,
        authorityExists,
      });
    } catch (cause) {
      if (registration.path.toLowerCase() === primaryPath.toLowerCase()) {
        const error = new Error("WORKTREE_PRIMARY_READ_FAILED");
        error.code = "WORKTREE_PRIMARY_READ_FAILED";
        error.cause = cause;
        throw error;
      }
      return {
        registration,
        isPrimary: false,
        readable: false,
        readError: cause.code ?? "GIT_READ_FAILED",
        ahead: 0,
        behind: 0,
        fullyMerged: false,
        trackedDirtyPaths: [],
        untrackedPaths: [],
        taskRecords: [],
        activeResolution: { finding: { code: "TASK_CURRENT_NOT_FOUND" } },
        checkoutProjection: null,
        state: "unreadable",
      };
    }
  });
}

const displayPaths = (paths, limit = 50) => {
  const shown = paths.slice(0, limit);
  return paths.length > limit
    ? [...shown, `... ${paths.length - limit} more`]
    : shown;
};

export function formatWorktreeCalibrationReport(projection) {
  const blocking = projection.findings.filter(
    ({ severity }) => severity === "blocking",
  );
  const counts = new Map();
  for (const worktree of projection.worktrees) {
    counts.set(worktree.state, (counts.get(worktree.state) ?? 0) + 1);
  }
  const lines = [
    `worktree calibration: ${blocking.length === 0 ? "pass" : "fail"}`,
    `primary: ${projection.primary?.path ?? "unknown"} ${projection.primary?.branch ?? "detached"} ${projection.primary?.headSha ?? "unknown"}`,
    `main ref: ${projection.primary?.mainRef ?? "unknown"}`,
    `worktrees: ${projection.worktrees.length} (active ${counts.get("active") ?? 0}, dormant-ahead ${counts.get("dormant-ahead") ?? 0}, dormant-merged ${counts.get("dormant-merged") ?? 0}, unowned-dirty ${counts.get("unowned-dirty") ?? 0}, unreadable ${counts.get("unreadable") ?? 0})`,
  ];
  for (const worktree of projection.worktrees) {
    lines.push(
      `- ${worktree.registration.path} [${worktree.state}] branch=${worktree.registration.branch ?? "detached"} head=${worktree.registration.headSha} ahead=${worktree.ahead} behind=${worktree.behind} tracked=${worktree.trackedDirtyPaths.length} untracked=${worktree.untrackedPaths.length} task=${worktree.activeResolution?.task?.id ?? "none"}`,
    );
    lines.push(
      ...displayPaths(worktree.trackedDirtyPaths).map(
        (path) => `    tracked: ${path}`,
      ),
    );
    lines.push(
      ...displayPaths(worktree.untrackedPaths).map(
        (path) => `    untracked: ${path}`,
      ),
    );
  }
  for (const item of projection.findings) {
    lines.push(`[${item.severity}] ${item.code} ${item.subject}`);
    lines.push(
      ...displayPaths(item.evidence).map((evidence) => `  - ${evidence}`),
    );
    lines.push(`  remedy: ${item.remedy}`);
  }
  lines.push(`next gate: ${projection.nextGate}`);
  return `${lines.join("\n")}\n`;
}

const parseCliArguments = (argv) => {
  const options = {
    json: false,
    mainRef: "origin/main",
    primary: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--main-ref" || argument === "--primary") {
      const value = argv[index + 1];
      if (!value) return { error: `incomplete argument '${argument}'` };
      if (argument === "--main-ref") options.mainRef = value;
      else options.primary = value;
      index += 1;
      continue;
    }
    return { error: `unknown argument '${argument}'` };
  }
  if (options.primary && !isAbsolute(options.primary)) {
    return { error: "--primary requires an absolute path" };
  }
  return { options };
};

export async function runWorktreeCalibrationCli(argv, dependencies) {
  const parsed = parseCliArguments(argv);
  if (parsed.error) {
    return { exitCode: 2, stdout: "", stderr: `${parsed.error}\n` };
  }
  const primaryPath = parsed.options.primary ?? dependencies.primaryPath;
  try {
    const observedWorktrees = await dependencies.observe({
      primaryPath,
      mainRef: parsed.options.mainRef,
    });
    const primaryTaskRecords = await dependencies.loadPrimaryTasks(
      observedWorktrees,
      primaryPath,
    );
    const projection = buildWorktreeCalibrationProjection({
      primaryPath,
      mainRef: parsed.options.mainRef,
      primaryTaskRecords,
      observedWorktrees,
    });
    const hasBlocking = projection.findings.some(
      ({ severity }) => severity === "blocking",
    );
    return {
      exitCode: hasBlocking ? 1 : 0,
      stdout: parsed.options.json
        ? `${JSON.stringify(projection, null, 2)}\n`
        : formatWorktreeCalibrationReport(projection),
      stderr: "",
    };
  } catch (error) {
    const code = error.code ?? "WORKTREE_READ_FAILED";
    return {
      exitCode: 2,
      stdout: "",
      stderr: `worktree calibration failed: ${code}\n`,
    };
  }
}

export function runReadOnlyGit({ cwd, args }) {
  try {
    return {
      stdout: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
      }),
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      exitCode: Number.isInteger(error.status) ? error.status : 2,
    };
  }
}

const defaultDependencies = () => ({
  primaryPath: process.cwd().replaceAll("\\", "/"),
  observe: ({ primaryPath, mainRef }) =>
    observeRegisteredWorktrees({
      primaryPath,
      mainRef,
      git: runReadOnlyGit,
      readFile: readFileSync,
      authorityExists: (absolutePath) => existsSync(absolutePath),
    }),
  loadPrimaryTasks: (observedWorktrees) =>
    observedWorktrees.find(({ isPrimary }) => isPrimary)?.taskRecords ?? [],
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await runWorktreeCalibrationCli(
    process.argv.slice(2),
    defaultDependencies(),
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
