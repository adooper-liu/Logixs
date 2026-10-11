import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export const ACTIVE_TASK_STATUSES = new Set([
  "design",
  "coding",
  "fix",
  "review",
]);

const LIST_FIELDS = new Set([
  "dependsOn",
  "writeScopes",
  "exclusiveLocks",
  "sharedIntegrationScopes",
  "authorityRefs",
  "uiStructure",
  "uiMustStayVisible",
  "uiProgressiveDisclosure",
  "uiForbidden",
  "uiViewportEvidence",
]);

export function normalizeRepositoryPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

const stripInlineComment = (value) => {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? null : (quote ?? character);
      continue;
    }
    if (
      character === "#" &&
      quote === null &&
      (index === 0 || /\s/.test(value[index - 1]))
    ) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
};

const cleanScalar = (value) => {
  const trimmed = stripInlineComment(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const splitInlineList = (value) => {
  const items = [];
  let quote = null;
  let escaped = false;
  let start = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? null : (quote ?? character);
      continue;
    }
    if ((character === "," && quote === null) || index === value.length) {
      items.push(cleanScalar(value.slice(start, index)));
      start = index + 1;
    }
  }
  return items;
};

export function parseTaskFrontmatter(source, { path }) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      values: {},
      errors: [
        {
          code: "TASK_PARSE_INVALID",
          path,
          line: 1,
          message: "task brief is missing a frontmatter block",
        },
      ],
    };
  }

  const values = {};
  const errors = [];
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const entry = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!entry) {
      if (line.trim()) {
        errors.push({
          code: "TASK_PARSE_INVALID",
          path,
          line: index + 2,
          message: "unsupported frontmatter syntax",
        });
      }
      continue;
    }

    const [, key, raw = ""] = entry;
    if (Object.hasOwn(values, key)) {
      errors.push({
        code: "TASK_PARSE_INVALID",
        path,
        line: index + 2,
        message: `duplicate frontmatter key '${key}'`,
      });
      continue;
    }

    const scalar = cleanScalar(raw);
    if (scalar === ">" || scalar === "|") {
      const content = [];
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) {
        content.push(lines[index + 1].trim());
        index += 1;
      }
      values[key] = content.join("\n").trim();
      continue;
    }

    if (scalar.startsWith("[") && scalar.endsWith("]")) {
      const inner = scalar.slice(1, -1).trim();
      values[key] = inner ? splitInlineList(inner) : [];
      continue;
    }

    if (!scalar) {
      const items = [];
      let nestedLine = null;
      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        const item = next.match(/^\s+-\s+(.+)$/);
        if (item) {
          items.push(cleanScalar(item[1]));
          index += 1;
          continue;
        }
        if (/^\s+\S/.test(next)) nestedLine = index + 3;
        break;
      }
      if (nestedLine !== null) {
        errors.push({
          code: "TASK_PARSE_INVALID",
          path,
          line: nestedLine,
          message: "nested mappings are not supported",
        });
      }
      values[key] = items.length ? items : "";
      continue;
    }

    values[key] = scalar;
  }

  for (const field of LIST_FIELDS) {
    if (
      Object.hasOwn(values, field) &&
      values[field] !== "" &&
      !Array.isArray(values[field])
    ) {
      errors.push({
        code: "TASK_PARSE_INVALID",
        path,
        line: 1,
        message: `${field} must be a list`,
      });
    }
  }

  return { values, errors };
}

export function normalizeTaskRecord({ path, source }) {
  const normalizedPath = normalizeRepositoryPath(path);
  const parsed = parseTaskFrontmatter(source, { path: normalizedPath });
  const heading =
    source.match(/^#\s+(.+)$/m)?.[1] ?? basename(normalizedPath, ".md");
  const list = (field) =>
    Array.isArray(parsed.values[field]) ? parsed.values[field] : [];

  return {
    id: basename(normalizedPath, ".md"),
    path: normalizedPath,
    title: heading.replace(/^任务[：:]\s*/, "").trim(),
    status: parsed.values.status ?? "",
    branch: parsed.values.branch ?? "",
    verification: parsed.values.verification ?? "",
    owner: parsed.values.owner ?? "",
    writer: parsed.values.writer ?? "",
    risk: parsed.values.risk ?? "",
    dependsOn: list("dependsOn"),
    writeScopes: list("writeScopes"),
    exclusiveLocks: list("exclusiveLocks"),
    sharedIntegrationScopes: list("sharedIntegrationScopes"),
    authorityRefs: list("authorityRefs"),
    uiStructure: list("uiStructure"),
    uiMustStayVisible: list("uiMustStayVisible"),
    uiProgressiveDisclosure: list("uiProgressiveDisclosure"),
    uiForbidden: list("uiForbidden"),
    uiViewportEvidence: list("uiViewportEvidence"),
    frontmatter: parsed.values,
    parseErrors: parsed.errors,
  };
}

export const normalizeTaskRecords = (records) =>
  records
    .map(normalizeTaskRecord)
    .sort((left, right) => left.path.localeCompare(right.path));

export function parseWriteScope(raw) {
  const value = String(raw);
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value)
  ) {
    return { error: "outside", raw };
  }

  const scope = normalizeRepositoryPath(value);
  const segments = scope.split("/");
  if (
    !scope ||
    segments.includes("") ||
    segments.includes(".") ||
    segments.includes("..")
  ) {
    return { error: "outside", raw };
  }

  if (scope.endsWith("/**")) {
    const prefix = scope.slice(0, -3).replace(/\/$/, "");
    if (!prefix || /[*?[\]]/.test(prefix)) {
      return { error: "pattern", raw };
    }
    return { kind: "directory", path: prefix.toLowerCase(), raw };
  }

  if (/[*?[\]]/.test(scope)) return { error: "pattern", raw };
  return { kind: "exact", path: scope.toLowerCase(), raw };
}

export function scopeOwnsPath(scope, filePath) {
  const parsed = typeof scope === "string" ? parseWriteScope(scope) : scope;
  if (parsed.error) return false;
  const path = normalizeRepositoryPath(filePath).toLowerCase();
  return parsed.kind === "exact"
    ? path === parsed.path
    : path === parsed.path || path.startsWith(`${parsed.path}/`);
}

export function writeScopesOverlap(left, right) {
  if (left.error || right.error) return false;
  if (left.kind === "exact" && right.kind === "exact") {
    return left.path === right.path;
  }
  if (left.kind === "directory" && right.kind === "directory") {
    return (
      left.path === right.path ||
      left.path.startsWith(`${right.path}/`) ||
      right.path.startsWith(`${left.path}/`)
    );
  }
  const directory = left.kind === "directory" ? left : right;
  const exact = left.kind === "exact" ? left : right;
  return (
    exact.path === directory.path || exact.path.startsWith(`${directory.path}/`)
  );
}

const makeFinding = (
  code,
  severity,
  subject,
  evidence,
  remedy,
  extra = {},
) => ({
  code,
  severity,
  subject,
  evidence: [...evidence],
  remedy,
  ...extra,
});

export function resolveCurrentTask({ records, branch, explicitBrief }) {
  if (explicitBrief) {
    const expected = normalizeRepositoryPath(explicitBrief).toLowerCase();
    const task = records.find(
      (record) => record.path.toLowerCase() === expected,
    );
    return task
      ? { task }
      : {
          finding: makeFinding(
            "TASK_CURRENT_NOT_FOUND",
            "blocking",
            explicitBrief,
            [explicitBrief],
            "Pass an existing task brief path.",
          ),
        };
  }

  const matches = records.filter(
    (record) =>
      ACTIVE_TASK_STATUSES.has(record.status) && record.branch === branch,
  );
  if (matches.length === 1) return { task: matches[0] };

  return {
    finding: makeFinding(
      matches.length === 0
        ? "TASK_CURRENT_NOT_FOUND"
        : "TASK_CURRENT_AMBIGUOUS",
      "blocking",
      branch,
      matches.map(({ path }) => path),
      "Declare exactly one active task for the branch or pass --brief.",
    ),
  };
}

const stablePaths = (paths) =>
  [...new Set(paths.map(normalizeRepositoryPath))].sort();

const ownsPath = (task, path) =>
  task.writeScopes.some((scope) => scopeOwnsPath(scope, path));

const isRepositoryRelativePath = (path) => {
  const value = String(path);
  const normalized = normalizeRepositoryPath(value);
  const segments = normalized.split("/");
  return (
    Boolean(normalized) &&
    !value.includes("\\") &&
    !normalized.startsWith("/") &&
    !/^[A-Za-z]:/.test(normalized) &&
    !segments.includes("") &&
    !segments.includes(".") &&
    !segments.includes("..")
  );
};

const cappedEvidence = (paths, limit = 50) => {
  if (paths.length <= limit) return paths;
  return [...paths.slice(0, limit), `... ${paths.length - limit} more`];
};

const findingSort = (left, right) =>
  left.code.localeCompare(right.code) ||
  left.subject.localeCompare(right.subject) ||
  left.evidence.join("\n").localeCompare(right.evidence.join("\n"));

const nextGate = (findings, task) => {
  if (findings.some(({ severity }) => severity === "blocking")) {
    return "fix-calibration-findings";
  }
  if (task.status === "design") return "approve-spec-or-plan";
  if (task.status === "coding" || task.status === "fix") {
    return "run-slice-verification";
  }
  if (task.status === "review") return "dispose-review-and-integrate";
  return "no-active-delivery-gate";
};

export function buildCalibrationProjection({
  task,
  records,
  authorityExists,
  observation,
}) {
  const trackedChangedPaths = stablePaths([
    ...observation.committedPaths,
    ...observation.stagedPaths,
    ...observation.unstagedPaths,
  ]);
  const untrackedPaths = stablePaths(observation.untrackedPaths);
  const ownedChangedPaths = trackedChangedPaths.filter((path) =>
    ownsPath(task, path),
  );
  const blockingOutOfScopePaths = trackedChangedPaths.filter(
    (path) => !ownsPath(task, path),
  );
  const ownedUntrackedPaths = untrackedPaths.filter((path) =>
    ownsPath(task, path),
  );
  const unownedUntrackedPaths = untrackedPaths.filter(
    (path) => !ownsPath(task, path),
  );

  const recordsById = new Map(records.map((record) => [record.id, record]));
  const dependencies = task.dependsOn.map((id) => {
    const record = recordsById.get(id);
    return {
      id,
      path: record?.path ?? null,
      status: record?.status ?? "missing",
    };
  });
  const authorities = task.authorityRefs.map((path) => ({
    path,
    state:
      isRepositoryRelativePath(path) && authorityExists(path)
        ? "present"
        : "missing",
  }));

  const findings = [];
  for (const error of task.parseErrors) {
    findings.push(
      makeFinding(
        "TASK_PARSE_INVALID",
        "blocking",
        `${error.path}:${error.line}`,
        [error.message],
        "Fix the active task frontmatter using the supported task template syntax.",
      ),
    );
  }
  if (task.branch !== observation.actualBranch) {
    findings.push(
      makeFinding(
        "TASK_BRANCH_MISMATCH",
        "blocking",
        task.path,
        [
          `declared=${task.branch || "missing"}`,
          `observed=${observation.actualBranch || "detached"}`,
        ],
        "Use the declared task branch or update the brief through an approved decision.",
      ),
    );
  }
  if (!observation.baseSha || observation.baseSource === "unknown") {
    findings.push(
      makeFinding(
        "TASK_BASE_UNKNOWN",
        "blocking",
        task.path,
        ["base source is unknown"],
        "Pass an explicit verified --base SHA.",
      ),
    );
  }
  if (blockingOutOfScopePaths.length > 0) {
    findings.push(
      makeFinding(
        "TASK_CHANGED_PATH_OUT_OF_SCOPE",
        "blocking",
        `${blockingOutOfScopePaths.length} tracked path${blockingOutOfScopePaths.length === 1 ? "" : "s"}`,
        blockingOutOfScopePaths,
        "Move the change into a declared scope, update the brief, or remove unrelated tracked work.",
      ),
    );
  }
  for (const authority of authorities) {
    if (authority.state === "missing") {
      findings.push(
        makeFinding(
          "TASK_AUTHORITY_MISSING",
          "blocking",
          authority.path,
          [authority.path],
          "Reference an existing repository authority path.",
        ),
      );
    }
    if (
      trackedChangedPaths.some(
        (path) => path.toLowerCase() === authority.path.toLowerCase(),
      ) &&
      !ownsPath(task, authority.path)
    ) {
      findings.push(
        makeFinding(
          "TASK_AUTHORITY_WRITE_UNDECLARED",
          "blocking",
          authority.path,
          [authority.path],
          "Add the authority path to writeScopes and hold the matching lock before modifying it.",
        ),
      );
    }
  }
  for (const dependency of dependencies) {
    if (dependency.status === "missing") {
      findings.push(
        makeFinding(
          "TASK_DEPENDENCY_MISSING",
          "blocking",
          dependency.id,
          [dependency.id],
          "Reference an existing task brief ID.",
        ),
      );
    } else if (dependency.status !== "done") {
      findings.push(
        makeFinding(
          "TASK_DEPENDENCY_NOT_DONE",
          "blocking",
          dependency.id,
          [`status=${dependency.status}`],
          "Complete the dependency before continuing this task.",
        ),
      );
    }
  }
  if (task.status === "done" && !task.verification) {
    findings.push(
      makeFinding(
        "TASK_DONE_VERIFICATION_MISSING",
        "blocking",
        task.path,
        [task.path],
        "Record traceable verification evidence before marking the task done.",
      ),
    );
  }
  if (unownedUntrackedPaths.length > 0) {
    const count = unownedUntrackedPaths.length;
    findings.push(
      makeFinding(
        "TASK_UNOWNED_UNTRACKED_PRESENT",
        "warning",
        `${count} unowned untracked path${count === 1 ? "" : "s"}`,
        cappedEvidence(unownedUntrackedPaths),
        "Leave unowned work untouched and report it separately.",
      ),
    );
  }

  findings.sort(findingSort);
  return {
    task,
    declared: {
      status: task.status,
      branch: task.branch,
      risk: task.risk,
      verification: task.verification,
      writeScopes: task.writeScopes,
      authorityRefs: task.authorityRefs,
      dependsOn: task.dependsOn,
    },
    observed: observation,
    derived: {
      trackedChangedPaths,
      ownedChangedPaths,
      blockingOutOfScopePaths,
      ownedUntrackedPaths,
      unownedUntrackedPaths,
      dependencies,
      authorities,
      findings,
      nextGate: nextGate(findings, task),
    },
  };
}

export const calibrationFindings = (projection) => projection.derived.findings;

const splitPaths = (output) =>
  output.split(/\r?\n/).filter(Boolean).map(normalizeRepositoryPath).sort();

const splitNameStatusPaths = (output) => {
  const tokens = output.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index];
    index += 1;
    if (/^[RC]\d+$/.test(status)) {
      paths.push(tokens[index], tokens[index + 1]);
      index += 2;
    } else {
      paths.push(tokens[index]);
      index += 1;
    }
  }
  return stablePaths(paths);
};

export function observeCheckout({
  base,
  baseRef = "origin/main",
  head,
  branch,
  git,
}) {
  const actualBranch = branch ?? git(["branch", "--show-current"]).trim();
  const headTarget = head ?? "HEAD";
  const headSha = git(
    head ? ["rev-parse", "--verify", head] : ["rev-parse", "HEAD"],
  ).trim();

  const [baseSha, baseSource] = (() => {
    if (base) {
      try {
        return [git(["rev-parse", "--verify", base]).trim(), "explicit"];
      } catch {
        return [null, "unknown"];
      }
    }
    try {
      git(["rev-parse", "--verify", baseRef]);
      return [git(["merge-base", baseRef, headTarget]).trim(), "merge-base"];
    } catch {
      return [null, "unknown"];
    }
  })();

  const committedPaths = baseSha
    ? splitNameStatusPaths(
        git([
          "diff",
          "--name-status",
          "-z",
          "--diff-filter=ACMRD",
          `${baseSha}...${headTarget}`,
        ]),
      )
    : [];
  return {
    actualBranch,
    baseSha,
    baseSource,
    headSha,
    committedPaths,
    stagedPaths: splitNameStatusPaths(
      git(["diff", "--name-status", "-z", "--cached", "--diff-filter=ACMRD"]),
    ),
    unstagedPaths: splitNameStatusPaths(
      git(["diff", "--name-status", "-z", "--diff-filter=ACMRD"]),
    ),
    untrackedPaths: splitPaths(
      git(["ls-files", "--others", "--exclude-standard"]),
    ),
  };
}

const displayPaths = (paths, limit = 50) => {
  const shown = paths.slice(0, limit);
  if (paths.length > limit) shown.push(`... ${paths.length - limit} more`);
  return shown;
};

export function formatCalibrationReport(projection) {
  const blocking = projection.derived.findings.filter(
    ({ severity }) => severity === "blocking",
  );
  const lines = [
    `calibration: ${blocking.length === 0 ? "pass" : "fail"}`,
    `brief: ${projection.task.path}`,
    `branch: ${projection.observed.actualBranch}`,
    `base: ${projection.observed.baseSha ?? "unknown"} (${projection.observed.baseSource})`,
    `head: ${projection.observed.headSha}`,
  ];
  for (const [label, paths] of [
    ["owned tracked", projection.derived.ownedChangedPaths],
    ["out-of-scope tracked", projection.derived.blockingOutOfScopePaths],
    ["owned untracked", projection.derived.ownedUntrackedPaths],
    ["unowned untracked", projection.derived.unownedUntrackedPaths],
  ]) {
    lines.push(`${label}: ${paths.length}`);
    lines.push(...displayPaths(paths).map((path) => `  - ${path}`));
  }
  for (const item of projection.derived.findings) {
    lines.push(`[${item.severity}] ${item.code} ${item.subject}`);
    lines.push(...item.evidence.map((evidence) => `  - ${evidence}`));
  }
  lines.push(`next gate: ${projection.derived.nextGate}`);
  return `${lines.join("\n")}\n`;
}

function parseCliArguments(argv) {
  const options = {
    baseRef: "origin/main",
    json: false,
    ci: false,
  };
  const valueOptions = new Map([
    ["--brief", "brief"],
    ["--base", "base"],
    ["--base-ref", "baseRef"],
    ["--branch", "branch"],
    ["--head", "head"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--ci") {
      options.ci = true;
      continue;
    }
    const key = valueOptions.get(arg);
    if (!key || !argv[index + 1]) {
      return { error: `unknown or incomplete argument '${arg}'` };
    }
    options[key] = argv[index + 1];
    index += 1;
  }
  return { options };
}

export async function runCalibrationCli(argv, dependencies) {
  const parsed = parseCliArguments(argv);
  if (parsed.error) {
    return { exitCode: 2, stdout: "", stderr: `${parsed.error}\n` };
  }
  const options = parsed.options;
  if (options.ci) {
    options.base ??= process.env.BASE_SHA;
    options.head ??= process.env.HEAD_SHA;
    options.branch ??= process.env.HEAD_BRANCH;
    if (!options.base || !options.head || !options.branch) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: "--ci requires base, head, and branch identity\n",
      };
    }
  }

  const records = normalizeTaskRecords(dependencies.loadRecords());
  let observation;
  try {
    observation = dependencies.observe(options);
  } catch {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "calibration observation failed: GIT_READ_FAILED\n",
    };
  }
  const resolution = resolveCurrentTask({
    records,
    branch: observation.actualBranch,
    explicitBrief: options.brief,
  });
  if (!resolution.task) {
    const projection = {
      task: { path: options.brief ?? "unknown" },
      observed: observation,
      derived: {
        ownedChangedPaths: [],
        blockingOutOfScopePaths: [],
        ownedUntrackedPaths: [],
        unownedUntrackedPaths: [],
        findings: [resolution.finding],
        nextGate: "fix-calibration-findings",
      },
    };
    return {
      exitCode: 1,
      stdout: options.json
        ? `${JSON.stringify(projection, null, 2)}\n`
        : formatCalibrationReport(projection),
      stderr: "",
    };
  }

  const projection = buildCalibrationProjection({
    task: resolution.task,
    records,
    authorityExists: dependencies.authorityExists,
    observation,
  });
  const hasBlocking = projection.derived.findings.some(
    ({ severity }) => severity === "blocking",
  );
  return {
    exitCode: hasBlocking ? 1 : 0,
    stdout: options.json
      ? `${JSON.stringify(projection, null, 2)}\n`
      : formatCalibrationReport(projection),
    stderr: "",
  };
}

const splitNullTerminated = (output) =>
  output.split("\0").filter(Boolean).map(normalizeRepositoryPath).sort();

export function loadTrackedTaskRecords({ root, git, readFile = readFileSync }) {
  return splitNullTerminated(
    git(["ls-files", "-z", "--", "docs/planning/tasks/*.md"]),
  )
    .filter((path) => !basename(path).startsWith("_"))
    .map((path) => ({
      path,
      source: readFile(resolve(root, path), "utf8"),
    }));
}

const loadTaskRecords = () =>
  loadTrackedTaskRecords({
    root: repositoryRoot,
    git: (args) =>
      execFileSync("git", args, {
        cwd: repositoryRoot,
        encoding: "utf8",
      }),
  });

const defaultDependencies = () => ({
  loadRecords: loadTaskRecords,
  observe: (options) =>
    observeCheckout({
      ...options,
      git: (args) =>
        execFileSync("git", args, {
          cwd: repositoryRoot,
          encoding: "utf8",
        }),
    }),
  authorityExists: (path) => existsSync(resolve(repositoryRoot, path)),
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await runCalibrationCli(
    process.argv.slice(2),
    defaultDependencies(),
  );
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
