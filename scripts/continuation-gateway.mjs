import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  TASK_STATUSES,
  loadTrackedTaskRecords,
  normalizeRepositoryPath,
  normalizeTaskRecords,
  parseWriteScope,
  resolveCurrentTask,
  scopeOwnsPath,
  writeScopesOverlap,
} from "./task-brief-state.mjs";

export { loadTrackedTaskRecords };

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export const CONTINUATION_ACTIONS = new Set([
  "idle",
  "resume",
  "review-handoff",
  "select",
]);

export const CONTINUATION_SAFETY = new Set([
  "clear",
  "protect-read-only",
  "block-target",
]);

export function parseContinuationPointer(input) {
  if (typeof input !== "string") return null;
  const match = normalizeRepositoryPath(input).match(
    /^(docs\/planning\/tasks\/[^/#]+\.md)#([^#\s]+)$/,
  );
  return match ? { task: match[1], slice: match[2] } : null;
}

const normalizeComparablePath = (value) =>
  normalizeRepositoryPath(String(value ?? ""))
    .replace(/\/$/, "")
    .toLowerCase();

const samePath = (left, right) =>
  normalizeComparablePath(left) === normalizeComparablePath(right);

const selectFailure = (code, workspace, paths, remedy, slice = null) => ({
  action: "select",
  safety: "block-target",
  task: null,
  slice,
  conflicts: [conflict(code, workspace, paths, remedy)],
});

const statusInvalidSelection = (finding, workspace, slice = null) =>
  selectFailure(
    "CONTINUATION_TASK_STATUS_INVALID",
    workspace,
    finding.evidence,
    "Fix the tracked task status before continuing.",
    slice,
  );

export function resolveContinuationTarget(input) {
  if (input.intent.handoff && !input.intent.explicitPointer) {
    const requiredFields = [
      "task",
      "slice",
      "base",
      "role",
      "workspace",
      "commit",
    ];
    const missingFields = requiredFields.filter(
      (field) =>
        typeof input.intent.handoff[field] !== "string" ||
        input.intent.handoff[field].trim() === "",
    );
    if (missingFields.length > 0) {
      return selectFailure(
        "CONTINUATION_HANDOFF_INCOMPLETE",
        input.workspace.path,
        missingFields,
        "Provide task, slice, base, role, workspace, and commit in the HANDOFF pointer.",
      );
    }
    if (input.intent.handoff.role !== "main") {
      return selectFailure(
        "CONTINUATION_HANDOFF_ROLE_INVALID",
        input.workspace.path,
        [input.intent.handoff.role],
        "Use role=main for a review HANDOFF.",
      );
    }
    const handoffResolution = resolveCurrentTask({
      records: input.tasks,
      branch: input.workspace.branch,
      explicitBrief: input.intent.handoff.task,
    });
    if (handoffResolution.finding?.code === "TASK_STATUS_INVALID") {
      return statusInvalidSelection(
        handoffResolution.finding,
        input.workspace.path,
        input.intent.handoff.slice,
      );
    }
    const handoffTask = handoffResolution.task;
    if (handoffTask) {
      return {
        action: "review-handoff",
        safety: "clear",
        task: handoffTask,
        slice: input.intent.handoff.slice,
        conflicts: [],
      };
    }
    return selectFailure(
      "CONTINUATION_TARGET_NOT_FOUND",
      input.workspace.path,
      [normalizeRepositoryPath(input.intent.handoff.task)],
      "Select one existing task brief before continuing.",
      input.intent.handoff.slice,
    );
  }

  if (input.intent.explicitPointer) {
    const pointer = parseContinuationPointer(input.intent.explicitPointer);
    if (!pointer) {
      return selectFailure(
        "CONTINUATION_POINTER_INVALID",
        input.workspace.path,
        [],
        "Use docs/planning/tasks/<task>.md#<slice>.",
      );
    }
    const explicitResolution = resolveCurrentTask({
      records: input.tasks,
      branch: input.workspace.branch,
      explicitBrief: pointer.task,
    });
    if (explicitResolution.finding?.code === "TASK_STATUS_INVALID") {
      return statusInvalidSelection(
        explicitResolution.finding,
        input.workspace.path,
        pointer.slice,
      );
    }
    const explicitTask = explicitResolution.task;
    if (!explicitTask) {
      return selectFailure(
        "CONTINUATION_TARGET_NOT_FOUND",
        input.workspace.path,
        [pointer.task],
        "Select one existing task brief before continuing.",
        pointer.slice,
      );
    }
    return {
      action: "resume",
      safety: "clear",
      task: explicitTask,
      slice: pointer.slice,
      conflicts: [],
    };
  }

  const activeResolution = resolveCurrentTask({
    records: input.tasks,
    branch: input.workspace.branch,
  });
  if (activeResolution.finding?.code === "TASK_STATUS_INVALID") {
    return statusInvalidSelection(
      activeResolution.finding,
      input.workspace.path,
    );
  }
  if (activeResolution.finding?.code === "TASK_CURRENT_AMBIGUOUS") {
    return selectFailure(
      "CONTINUATION_TARGET_AMBIGUOUS",
      input.workspace.path,
      activeResolution.finding.evidence,
      "Select exactly one task brief before continuing.",
    );
  }
  const activeMatches = activeResolution.task ? [activeResolution.task] : [];
  const matches =
    activeMatches.length === 0 && input.intent.explicitContinuation
      ? input.tasks.filter(
          (candidate) =>
            candidate.status === "blocked" &&
            candidate.branch === input.workspace.branch,
        )
      : activeMatches;
  if (matches.length === 1) {
    const readOnlyReassessment = matches[0].status === "blocked";
    return {
      action: readOnlyReassessment ? "select" : "resume",
      safety: readOnlyReassessment ? "protect-read-only" : "clear",
      task: matches[0],
      slice: null,
      conflicts: [],
    };
  }
  if (matches.length > 1) {
    return {
      action: "select",
      safety: "block-target",
      task: null,
      slice: null,
      conflicts: [
        conflict(
          "CONTINUATION_TARGET_AMBIGUOUS",
          input.workspace.path,
          matches.map(({ path }) => path).sort(),
          "Select exactly one task brief before continuing.",
        ),
      ],
    };
  }
  if (input.intent.explicitContinuation) {
    return {
      action: "select",
      safety: "block-target",
      task: null,
      slice: null,
      conflicts: [
        conflict(
          "CONTINUATION_TARGET_NOT_FOUND",
          input.workspace.path,
          [],
          "Select one existing task brief before continuing.",
        ),
      ],
    };
  }
  return {
    action: "idle",
    safety: "clear",
    task: null,
    slice: null,
    conflicts: [],
  };
}

const remoteEvidence = {
  state: "not-observed",
  reason: "automatic continuation projection is local-only",
};

const conflict = (code, worktree, paths, remedy) => ({
  code,
  worktree,
  paths,
  remedy,
});

const advisory = (code, subject) => ({ code, subject });

const uniqueSorted = (values) =>
  [...new Set(values.map((value) => String(value)))].sort((left, right) =>
    left.localeCompare(right),
  );

const pathOverlapsScopes = (path, scopes) => {
  const parsedPath = parseWriteScope(normalizeRepositoryPath(path));
  return scopes.some((scope) => {
    const parsedScope = parseWriteScope(scope);
    return (
      scopeOwnsPath(parsedScope, path) ||
      writeScopesOverlap(parsedScope, parsedPath)
    );
  });
};

const worktreeAdvisoryCodes = (worktree) => {
  const codes = [];
  if (worktree.state === "dormant-ahead") {
    codes.push("CONTINUATION_WORKTREE_DORMANT_AHEAD");
  }
  if (worktree.behind > 0) {
    codes.push("CONTINUATION_WORKTREE_BEHIND_MAIN");
  }
  if (
    worktree.registration?.detached === true ||
    worktree.registration?.branch === null
  ) {
    codes.push("CONTINUATION_WORKTREE_DETACHED");
  }
  return codes;
};

const sortConflicts = (findings) =>
  findings.sort((left, right) =>
    `${left.code}\0${left.worktree}\0${left.paths.join("\0")}`.localeCompare(
      `${right.code}\0${right.worktree}\0${right.paths.join("\0")}`,
    ),
  );

const sortAdvisories = (findings) =>
  findings
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.code === item.code && candidate.subject === item.subject,
        ) === index,
    )
    .sort((left, right) =>
      `${left.subject}\0${left.code}`.localeCompare(
        `${right.subject}\0${right.code}`,
      ),
    );

const CALIBRATION_FINDINGS_MAPPED_LOCALLY = new Set([
  "TASK_BRANCH_MISMATCH",
  "TASK_CHANGED_PATH_OUT_OF_SCOPE",
  "TASK_DEPENDENCY_MISSING",
  "TASK_DEPENDENCY_NOT_DONE",
]);

export function buildContinuationProjection(input) {
  const resolution = resolveContinuationTarget(input);
  const selectedTask = resolution?.task ?? null;
  const calibrationDerived = input.calibrationProjection?.derived;
  const checkout = calibrationDerived ?? {
    blockingOutOfScopePaths: [],
    unownedUntrackedPaths: [],
    dependencies: [],
    nextGate: "none",
  };
  const relevantConflicts = [...resolution.conflicts];
  const advisories = [];
  const handoff = input.intent.explicitPointer ? null : input.intent.handoff;
  const explicitTargetMismatch = Boolean(
    selectedTask &&
    !handoff &&
    input.intent.explicitPointer &&
    selectedTask.branch !== input.workspace.branch,
  );
  if (selectedTask && handoff) {
    const workspaceMatches = input.workspaceIdentityObservation
      ? input.workspaceIdentityObservation.equivalent === true
      : samePath(handoff.workspace, input.workspace.path);
    if (!workspaceMatches) {
      relevantConflicts.push(
        conflict(
          "CONTINUATION_WORKSPACE_MISMATCH",
          input.workspace.path,
          uniqueSorted([handoff.workspace, input.workspace.path]),
          "Open the HANDOFF workspace before continuing.",
        ),
      );
    }
    const identity = input.identityObservation;
    const observedHead = String(identity?.observedHead ?? "")
      .trim()
      .toLowerCase();
    const workspaceHead = String(input.workspace.head ?? "")
      .trim()
      .toLowerCase();
    const handoffBase = handoff.base.trim().toLowerCase();
    const handoffCommit = handoff.commit.trim().toLowerCase();
    const uncommitted = handoffCommit === "none";
    const fullGitSha = /^[0-9a-f]{40}$/;
    const invalidIdentityFields = [];
    if (!fullGitSha.test(handoffBase)) {
      invalidIdentityFields.push("base");
    }
    if (!uncommitted && !fullGitSha.test(handoffCommit)) {
      invalidIdentityFields.push("commit");
    }
    if (!fullGitSha.test(observedHead)) {
      invalidIdentityFields.push("observedHead");
    }
    if (!fullGitSha.test(workspaceHead)) {
      invalidIdentityFields.push("workspace.head");
    }
    if (identity?.baseResolvable !== true) {
      invalidIdentityFields.push("baseResolvable");
    }
    if (
      (uncommitted && identity?.commitResolvable !== null) ||
      (!uncommitted && identity?.commitResolvable !== true)
    ) {
      invalidIdentityFields.push("commitResolvable");
    }
    if (identity?.baseIsAncestorOfHead !== true) {
      invalidIdentityFields.push("baseIsAncestorOfHead");
    }
    if (identity?.reproducesDiff !== true) {
      invalidIdentityFields.push("reproducesDiff");
    }
    if (observedHead === "" || observedHead !== workspaceHead) {
      invalidIdentityFields.push("observedHead");
    }
    if (!uncommitted && handoffCommit !== observedHead) {
      invalidIdentityFields.push("commit");
    }
    if (invalidIdentityFields.length > 0) {
      relevantConflicts.push(
        conflict(
          "CONTINUATION_HANDOFF_IDENTITY_INVALID",
          input.workspace.path,
          uniqueSorted(invalidIdentityFields),
          "Re-observe the HANDOFF base, commit, HEAD, and diff before review.",
        ),
      );
    }
  }
  if (selectedTask && selectedTask.branch !== input.workspace.branch) {
    relevantConflicts.push(
      conflict(
        "CONTINUATION_BRANCH_MISMATCH",
        input.workspace.path,
        uniqueSorted([selectedTask.branch, input.workspace.branch]),
        "Open the target task branch before writing.",
      ),
    );
  }
  const invalidScopes = selectedTask
    ? selectedTask.writeScopes.filter((scope) => parseWriteScope(scope).error)
    : [];
  if (invalidScopes.length > 0) {
    relevantConflicts.push(
      conflict(
        "CONTINUATION_SCOPE_INVALID",
        input.workspace.path,
        uniqueSorted(invalidScopes),
        "Fix invalid target writeScopes before continuing.",
      ),
    );
  }
  if (
    selectedTask &&
    input.calibrationProjection?.task &&
    samePath(input.calibrationProjection.task.path, selectedTask.path)
  ) {
    for (const finding of checkout.findings ?? []) {
      if (
        finding.severity !== "blocking" ||
        CALIBRATION_FINDINGS_MAPPED_LOCALLY.has(finding.code)
      ) {
        continue;
      }
      relevantConflicts.push(
        conflict(
          finding.code,
          input.workspace.path,
          uniqueSorted(finding.evidence ?? []),
          finding.remedy,
        ),
      );
    }
  }
  const unfinishedDependencies = checkout.dependencies
    .filter(({ status }) => status !== "done")
    .map(({ id }) => id);
  if (selectedTask && unfinishedDependencies.length > 0) {
    relevantConflicts.push(
      conflict(
        "CONTINUATION_DEPENDENCY_UNFINISHED",
        input.workspace.path,
        uniqueSorted(unfinishedDependencies),
        "Complete the target task dependencies before writing.",
      ),
    );
  }
  if (selectedTask && checkout.blockingOutOfScopePaths.length > 0) {
    relevantConflicts.push(
      conflict(
        "CONTINUATION_CHECKOUT_OUT_OF_SCOPE",
        input.workspace.path,
        uniqueSorted(checkout.blockingOutOfScopePaths),
        "Resolve or assign out-of-scope tracked changes before writing.",
      ),
    );
  }
  if (selectedTask && checkout.unownedUntrackedPaths.length > 0) {
    const overlappingPaths = uniqueSorted(
      checkout.unownedUntrackedPaths.filter((path) =>
        pathOverlapsScopes(path, selectedTask.writeScopes),
      ),
    );
    if (overlappingPaths.length > 0) {
      relevantConflicts.push(
        conflict(
          "CONTINUATION_CHECKOUT_UNTRACKED_SCOPE_OVERLAP",
          input.workspace.path,
          overlappingPaths,
          "Keep overlapping target paths read-only until ownership is resolved.",
        ),
      );
    }
    if (overlappingPaths.length < checkout.unownedUntrackedPaths.length) {
      advisories.push(
        advisory(
          "CONTINUATION_CHECKOUT_UNTRACKED_NON_OVERLAP",
          input.workspace.path,
        ),
      );
    }
  }
  if (selectedTask) {
    for (const worktree of [...input.worktrees].sort((left, right) =>
      String(left.registration.path).localeCompare(
        String(right.registration.path),
      ),
    )) {
      const worktreePath = worktree.registration.path;
      if (samePath(worktreePath, input.workspace.path)) continue;
      const dirtyPaths = uniqueSorted([
        ...(worktree.trackedDirtyPaths ?? []),
        ...(worktree.untrackedPaths ?? []),
      ]);
      const overlappingPaths = dirtyPaths.filter((path) =>
        pathOverlapsScopes(path, selectedTask.writeScopes),
      );
      if (overlappingPaths.length > 0) {
        relevantConflicts.push(
          conflict(
            "CONTINUATION_WORKTREE_SCOPE_OVERLAP",
            worktreePath,
            overlappingPaths,
            "Keep overlapping target paths read-only until the other worktree is resolved.",
          ),
        );
      } else if (dirtyPaths.length > 0) {
        advisories.push(
          advisory("CONTINUATION_WORKTREE_DIRTY_NON_OVERLAP", worktreePath),
        );
      }
      for (const code of worktreeAdvisoryCodes(worktree)) {
        advisories.push(advisory(code, worktreePath));
      }
    }
  }
  sortConflicts(relevantConflicts);
  const sortedAdvisories = sortAdvisories(advisories);
  const targetBlocked = relevantConflicts.some(
    ({ code }) =>
      ![
        "CONTINUATION_CHECKOUT_UNTRACKED_SCOPE_OVERLAP",
        "CONTINUATION_WORKTREE_SCOPE_OVERLAP",
      ].includes(code),
  );
  const overlapProtected = relevantConflicts.some(({ code }) =>
    [
      "CONTINUATION_CHECKOUT_UNTRACKED_SCOPE_OVERLAP",
      "CONTINUATION_WORKTREE_SCOPE_OVERLAP",
    ].includes(code),
  );
  const blockedReadOnly = selectedTask?.status === "blocked";
  return {
    protocol: "logix-continuation/v1",
    action:
      explicitTargetMismatch || blockedReadOnly ? "select" : resolution.action,
    safety: targetBlocked
      ? "block-target"
      : overlapProtected || blockedReadOnly
        ? "protect-read-only"
        : resolution.safety,
    workspace: { ...input.workspace },
    target: selectedTask
      ? {
          brief: selectedTask.path,
          title: selectedTask.title,
          status: selectedTask.status,
          writer: selectedTask.writer,
          slice: resolution.slice,
          nextGate: checkout.nextGate,
        }
      : null,
    relevantConflicts,
    advisories: sortedAdvisories,
    remoteEvidence: { ...remoteEvidence },
  };
}

export function formatContinuationContext(projection) {
  if (projection.action === "idle" && projection.safety === "clear") return "";

  const compact = (value, maxBytes = 120) => {
    const normalized = String(value ?? "none")
      .replace(/\s+/g, " ")
      .trim();
    if (Buffer.byteLength(normalized, "utf8") <= maxBytes) return normalized;

    const suffix = "...";
    const contentBudget = maxBytes - Buffer.byteLength(suffix, "utf8");
    let bytes = 0;
    let result = "";
    for (const character of normalized) {
      const characterBytes = Buffer.byteLength(character, "utf8");
      if (bytes + characterBytes > contentBudget) break;
      result += character;
      bytes += characterBytes;
    }
    return `${result}${suffix}`;
  };
  const target = projection.target;
  const conflictSummary = projection.relevantConflicts.length
    ? projection.relevantConflicts
        .slice(0, 5)
        .map(
          ({ code, worktree }) =>
            `${compact(code, 72)}@${compact(worktree, 96)}`,
        )
        .join(", ")
    : "none";
  const advisorySummary = projection.advisories.length
    ? projection.advisories
        .slice(0, 5)
        .map(
          ({ code, subject }) => `${compact(code, 72)}@${compact(subject, 96)}`,
        )
        .join(", ")
    : "none";
  const lines = [
    "Continuation local derived snapshot; not authority.",
    `action=${projection.action} safety=${projection.safety}`,
    `workspace=${compact(projection.workspace.path)} branch=${compact(projection.workspace.branch)} head=${String(projection.workspace.head).slice(0, 12)} mainRef=${compact(projection.workspace.mainRef)}`,
    target
      ? `target=${compact(target.brief)} status=${compact(target.status)} writer=${compact(target.writer)} slice=${compact(target.slice)} nextGate=${compact(target.nextGate)}`
      : "target=none",
    `Conflicts: ${conflictSummary}`,
    `Advisories: ${advisorySummary}`,
    `Remote evidence: ${compact(projection.remoteEvidence.state, 60)} (${compact(projection.remoteEvidence.reason)})`,
    "Read AGENTS.md, the unique brief and real diff before any write.",
  ];
  return lines.join("\n");
}

const TASK_QUERY_STATUSES = [...TASK_STATUSES];

const taskQueryFailure = (message) => ({
  exitCode: 2,
  stdout: "",
  stderr: `tasks:list: ${message}\n`,
});

const parseTaskQueryArguments = (argv) => {
  let current = false;
  let status = null;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--current") {
      current = true;
      continue;
    }
    if (argument === "--status") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: "missing value for '--status'" };
      }
      if (!TASK_QUERY_STATUSES.includes(value)) {
        return { error: `invalid status '${value}'` };
      }
      status = value;
      index += 1;
      continue;
    }
    return { error: `unknown argument '${argument}'` };
  }

  if (current && status) {
    return { error: "choose only one of '--current' or '--status'" };
  }
  return { current, status, json };
};

const taskQueryAdvisories = (records) =>
  [
    ...new Map(
      records.flatMap((record) =>
        record.parseErrors.map((error) => [
          `${record.path}\0${error.code}`,
          { path: record.path, code: error.code },
        ]),
      ),
    ).values(),
  ].sort((left, right) =>
    `${left.path}\0${left.code}`.localeCompare(`${right.path}\0${right.code}`),
  );

const hasTaskVerification = (verification) =>
  Array.isArray(verification)
    ? verification.some((value) => String(value).trim())
    : typeof verification === "string" && Boolean(verification.trim());

const taskQueryRecord = (record) => {
  const advisories = [
    ...new Set(record.parseErrors.map((error) => error.code)),
  ].sort();
  const parseValidity = advisories.length > 0 ? "invalid" : "valid";
  const verificationPresent = hasTaskVerification(record.verification);
  return {
    id: record.id,
    path: record.path,
    title: record.title,
    status: record.status,
    branch: record.branch,
    writer: record.writer,
    risk: record.risk,
    parseValidity,
    advisories,
    verification: verificationPresent ? "present" : "missing",
    validCompletion:
      parseValidity === "valid" &&
      record.status === "done" &&
      verificationPresent,
  };
};

const formatTaskQueryRecord = (record) =>
  `${record.path}\tstatus=${record.status}\tbranch=${record.branch || "none"}\twriter=${record.writer || "none"}\tparseValidity=${record.parseValidity}\tadvisories=${record.advisories.join(",") || "none"}\tverification=${record.verification}\tvalidCompletion=${record.validCompletion}\ttitle=${JSON.stringify(record.title)}`;

const formatTaskQueryAdvisories = (advisories) =>
  advisories.length > 0
    ? [
        "advisories:",
        ...advisories.map(({ path, code }) => `  - ${path} ${code}`),
      ]
    : [];

const statusSummary = (records) =>
  Object.fromEntries(
    TASK_QUERY_STATUSES.map((status) => [
      status,
      records.filter((record) => record.status === status).length,
    ]),
  );

export function runTasksListCli(argv, dependencies) {
  const options = parseTaskQueryArguments(argv);
  if (options.error) return taskQueryFailure(options.error);

  let records;
  try {
    records = normalizeTaskRecords(dependencies.loadRecords());
  } catch {
    return taskQueryFailure("tracked task observation failed");
  }

  const historicalMalformedRecords = records.filter(
    (record) =>
      record.parseErrors.length > 0 &&
      (record.status === "done" || record.status === "blocked") &&
      record.statusValidity === "valid",
  );
  const blockingMalformedRecords = records.filter(
    (record) =>
      record.parseErrors.length > 0 &&
      !historicalMalformedRecords.includes(record),
  );
  const parseErrors = taskQueryAdvisories(blockingMalformedRecords);
  if (parseErrors.length > 0) {
    return {
      exitCode: 2,
      stdout: options.json
        ? `${JSON.stringify({ query: "error", errors: parseErrors }, null, 2)}\n`
        : "",
      stderr: options.json
        ? ""
        : [
            "tasks:list: malformed tracked briefs",
            ...parseErrors.map(({ path, code }) => `  - ${path} ${code}`),
            "",
          ].join("\n"),
    };
  }
  const advisories = taskQueryAdvisories(historicalMalformedRecords);

  let branch;
  try {
    branch = dependencies.getBranch();
  } catch {
    return taskQueryFailure("tracked task observation failed");
  }

  const resolution = resolveCurrentTask({ records, branch });
  const current = resolution.task ? taskQueryRecord(resolution.task) : null;
  const ambiguous = resolution.finding?.code === "TASK_CURRENT_AMBIGUOUS";
  const ambiguousCurrent = ambiguous
    ? {
        state: "ambiguous",
        task: null,
        candidates: [...resolution.finding.evidence].sort(),
      }
    : null;
  if (options.current) {
    const payload = {
      query: "current",
      current: ambiguousCurrent ?? current,
      advisories,
    };
    const currentLines = ambiguous
      ? [
          "ambiguous",
          ...ambiguousCurrent.candidates.map((path) => `  - ${path}`),
        ]
      : current
        ? [formatTaskQueryRecord(current)]
        : ["none"];
    return {
      exitCode: ambiguous ? 1 : 0,
      stdout: options.json
        ? `${JSON.stringify(payload, null, 2)}\n`
        : [...currentLines, ...formatTaskQueryAdvisories(advisories), ""].join(
            "\n",
          ),
      stderr: "",
    };
  }

  if (options.status) {
    const tasks = records
      .filter((record) => record.status === options.status)
      .map(taskQueryRecord);
    const relevantAdvisories = taskQueryAdvisories(
      historicalMalformedRecords.filter(
        (record) => record.status === options.status,
      ),
    );
    const payload = {
      query: "status",
      status: options.status,
      tasks,
      advisories: relevantAdvisories,
    };
    return {
      exitCode: 0,
      stdout: options.json
        ? `${JSON.stringify(payload, null, 2)}\n`
        : tasks.length > 0
          ? `${tasks.map(formatTaskQueryRecord).join("\n")}\n`
          : "none\n",
      stderr: "",
    };
  }

  const summary = statusSummary(records);
  const payload = {
    query: "summary",
    current: ambiguousCurrent ?? current,
    statusSummary: summary,
    advisories,
  };
  return {
    exitCode: ambiguous ? 1 : 0,
    stdout: options.json
      ? `${JSON.stringify(payload, null, 2)}\n`
      : [
          ambiguous
            ? "current: ambiguous"
            : current
              ? `current: ${formatTaskQueryRecord(current).replaceAll("\t", " ")}`
              : "current: none",
          ...(ambiguous
            ? ambiguousCurrent.candidates.map((path) => `  - ${path}`)
            : []),
          ...formatTaskQueryAdvisories(advisories),
          `status: ${TASK_QUERY_STATUSES.map((status) => `${status}=${summary[status]}`).join(" ")}`,
          "",
        ].join("\n"),
    stderr: "",
  };
}

const defaultTaskQueryDependencies = () => ({
  loadRecords: () =>
    loadTrackedTaskRecords({
      root: repositoryRoot,
      git: (args) =>
        execFileSync("git", args, {
          cwd: repositoryRoot,
          encoding: "utf8",
        }),
    }),
  getBranch: () =>
    execFileSync("git", ["branch", "--show-current"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim(),
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = runTasksListCli(
    process.argv.slice(2),
    defaultTaskQueryDependencies(),
  );
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
