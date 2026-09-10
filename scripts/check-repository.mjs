import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const ignoredDirectories = new Set([
  ".agents",
  ".claude",
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const allowedTaskStatuses = new Set([
  "design",
  "coding",
  "review",
  "fix",
  "blocked",
  "done",
]);
const activeTaskStatuses = new Set(["design", "coding", "review", "fix"]);
const forbiddenDirectoryPattern =
  /(^|\/)(node_modules|dist|coverage|playwright-report|test-results|tmp)(\/|$)/;
const allowedEnvironmentFilePattern = /\.env(?:\..+)?\.example$/;
const sensitiveFilePattern = /(^|\/)(\.env(?:\..+)?|id_rsa|id_ed25519)$/;
const sensitiveExtensionPattern = /\.(key|p12|pfx|pem)$/i;
const forbiddenLockfilePattern =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock)$/;
const secretContentPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
];
const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".yaml",
  ".yml",
]);

const normalizePath = (value) => value.replaceAll("\\", "/");

export function findForbiddenTrackedPaths(paths) {
  return paths.filter((rawPath) => {
    const path = normalizePath(rawPath);
    if (
      forbiddenDirectoryPattern.test(path) ||
      forbiddenLockfilePattern.test(path) ||
      path.endsWith(".log") ||
      (path.endsWith("pnpm-lock.yaml") && path !== "pnpm-lock.yaml")
    ) {
      return true;
    }
    return (
      (sensitiveFilePattern.test(path) ||
        sensitiveExtensionPattern.test(path)) &&
      !allowedEnvironmentFilePattern.test(path)
    );
  });
}

export function extractMarkdownTargets(source) {
  const targets = [];
  const inlineLink = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*)?\)/g;
  const referenceLink = /^\s*\[[^\]]+\]:\s*(<[^>]+>|[^\s]+)(?:\s+["'(].*)?$/gm;

  for (const pattern of [inlineLink, referenceLink]) {
    for (const match of source.matchAll(pattern)) {
      targets.push(match[1].replace(/^<|>$/g, ""));
    }
  }
  return targets;
}

const isExternalTarget = (target) =>
  target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target);

export function findBrokenMarkdownLinks(markdownFiles) {
  const errors = [];
  for (const markdownFile of markdownFiles) {
    const source = readFileSync(markdownFile, "utf8");
    for (const target of extractMarkdownTargets(source)) {
      if (isExternalTarget(target)) continue;
      const pathWithoutQueryOrAnchor = target.split(/[?#]/, 1)[0];
      if (!pathWithoutQueryOrAnchor) continue;

      let decodedPath;
      try {
        decodedPath = decodeURIComponent(pathWithoutQueryOrAnchor);
      } catch {
        errors.push(`${markdownFile}: invalid encoded link '${target}'`);
        continue;
      }

      const absoluteTarget = resolve(dirname(markdownFile), decodedPath);
      if (!existsSync(absoluteTarget)) {
        errors.push(`${markdownFile}: missing link target '${target}'`);
      }
    }
  }
  return errors;
}

export function validateTaskStatusRecords(records) {
  const errors = [];
  const activeTasks = [];
  for (const record of records) {
    const match = record.source.match(/^status:\s*([a-z]+)/m);
    if (!match) {
      errors.push(`${record.path}: missing frontmatter status`);
      continue;
    }
    const status = match[1];
    if (!allowedTaskStatuses.has(status)) {
      errors.push(`${record.path}: invalid task status '${status}'`);
    } else if (activeTaskStatuses.has(status)) {
      activeTasks.push(record.path);
    } else if (status === "done") {
      const frontmatter = record.source.match(
        /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
      )?.[1];
      const verification = frontmatter?.match(
        /^verification:\s*(?!#)(\S.*)$/m,
      )?.[1];
      if (!verification) {
        errors.push(
          `${record.path}: done task is missing verification evidence`,
        );
      }
    }
  }
  if (activeTasks.length > 1) {
    errors.push(`multiple active task briefs: ${activeTasks.join(", ")}`);
  }
  return errors;
}

export function findSecretContent(files) {
  const errors = [];
  for (const file of files) {
    const absolutePath = resolve(repositoryRoot, file);
    if (!existsSync(absolutePath) || statSync(absolutePath).size > 1_000_000) {
      continue;
    }
    if (!textExtensions.has(extname(file).toLowerCase())) continue;
    const source = readFileSync(absolutePath, "utf8");
    if (secretContentPatterns.some((pattern) => pattern.test(source))) {
      errors.push(`${file}: contains a private-key or credential signature`);
    }
  }
  return errors;
}

export function findUiThemeBoundaryViolations(records) {
  const errors = [];
  const importPattern =
    /(?:from\s+|import\s*(?:\(\s*)?|@import\s+(?:url\(\s*)?)["']([^"']+)["']/g;

  for (const record of records) {
    const path = normalizePath(record.path);
    if (!path.startsWith("apps/web/src/")) continue;

    for (const match of record.source.matchAll(importPattern)) {
      const importTarget = normalizePath(match[1]);
      if (importTarget.startsWith(".")) {
        const resolvedTarget = normalizePath(
          resolve(repositoryRoot, dirname(path), importTarget),
        );
        const webSourceRoot = normalizePath(
          resolve(repositoryRoot, "apps/web/src"),
        );

        if (!resolvedTarget.startsWith(`${webSourceRoot}/`)) {
          errors.push(
            `${path}: runtime import outside the web source boundary '${importTarget}'`,
          );
        }
      }

      if (/^(?:https?:)?\/\//i.test(importTarget)) {
        errors.push(
          `${path}: runtime import from an external URL '${importTarget}'`,
        );
      }

      const importsThemeImplementation =
        importTarget.includes("/themes/") ||
        importTarget.startsWith("../themes/");
      const isAllowedImporter =
        path.startsWith("apps/web/src/ui-theme/") ||
        path.startsWith("apps/web/src/themes/") ||
        path.includes(".test.");

      if (importsThemeImplementation && !isAllowedImporter) {
        errors.push(
          `${path}: must use the stable UI facade instead of '${importTarget}'`,
        );
      }
    }
  }

  return errors;
}

export function findAmbiguousContractPhaseReferences(records) {
  const errors = [];
  const ambiguousPhasePattern = /\b[pP]([67])\b(?!\.\d)/g;
  // "项目" may be followed by emphasis, bracketing or the words 第 N 阶段 before the token.
  // Any other filler (e.g. "本项目不使用 P6") keeps the reference ambiguous and is reported.
  const projectQualifierPattern = /项目[\s`*（(【第阶段之的]*$/;

  for (const record of records) {
    const lines = record.source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(ambiguousPhasePattern)) {
        const prefix = line.slice(0, match.index);
        if (projectQualifierPattern.test(prefix)) continue;
        errors.push(
          `${record.path}:${index + 1}: ambiguous phase '${match[0]}'; use 'G${match[1]}' for global-contract task stages or qualify it as a project phase`,
        );
      }
    });
  }

  return errors;
}

export function findMisleadingContractPackageScripts(packageManifest) {
  const contractValidator = "node ../../scripts/validate-contract-schemas.mjs";
  const standardCommands = ["lint", "typecheck", "test", "build"];

  return standardCommands
    .filter(
      (command) => packageManifest.scripts?.[command] === contractValidator,
    )
    .map(
      (command) =>
        `packages/contracts/package.json: '${command}' must not alias contract:check; leave it unconfigured until the capability exists`,
    );
}

function walkFiles(directory, predicate) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath, predicate));
    else if (predicate(absolutePath)) files.push(absolutePath);
  }
  return files;
}

function listTrackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function taskStatusErrors() {
  const taskDirectory = resolve(repositoryRoot, "docs/planning/tasks");
  const taskFiles = readdirSync(taskDirectory)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => resolve(taskDirectory, name));
  return validateTaskStatusRecords(
    taskFiles.map((path) => ({ path, source: readFileSync(path, "utf8") })),
  );
}

export function runRepositoryChecks({ docsOnly = false } = {}) {
  const markdownFiles = walkFiles(repositoryRoot, (path) =>
    path.endsWith(".md"),
  );
  const contractAuthorityFiles = markdownFiles.filter((absolutePath) => {
    const path = normalizePath(absolutePath).replace(
      `${normalizePath(repositoryRoot)}/`,
      "",
    );
    return /^docs\/product\/domain\/(?:.*_CONTRACT_V1|LIFECYCLE_NODE_CATALOG_V1|EVENT_CODES|GLOBAL_CONTRACT_REGISTRY)\.md$/.test(
      path,
    );
  });
  const errors = [
    ...findBrokenMarkdownLinks(markdownFiles),
    ...taskStatusErrors(),
    ...findAmbiguousContractPhaseReferences(
      contractAuthorityFiles.map((path) => ({
        path: normalizePath(path).replace(
          `${normalizePath(repositoryRoot)}/`,
          "",
        ),
        source: readFileSync(path, "utf8"),
      })),
    ),
  ];

  if (!docsOnly) {
    const trackedFiles = listTrackedFiles().filter((path) =>
      existsSync(resolve(repositoryRoot, path)),
    );
    const webSourceFiles = walkFiles(
      resolve(repositoryRoot, "apps/web/src"),
      (path) => [".css", ".ts", ".vue"].includes(extname(path).toLowerCase()),
    );
    errors.push(
      ...findForbiddenTrackedPaths(trackedFiles).map(
        (path) => `${path}: generated or sensitive file is tracked`,
      ),
      ...findSecretContent(trackedFiles),
      ...findUiThemeBoundaryViolations(
        webSourceFiles.map((path) => ({
          path: normalizePath(path).replace(
            `${normalizePath(repositoryRoot)}/`,
            "",
          ),
          source: readFileSync(path, "utf8"),
        })),
      ),
      ...findMisleadingContractPackageScripts(
        JSON.parse(
          readFileSync(
            resolve(repositoryRoot, "packages/contracts/package.json"),
            "utf8",
          ),
        ),
      ),
    );
  }
  return errors;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const errors = runRepositoryChecks({
    docsOnly: process.argv.includes("--docs-only"),
  });
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Repository policy checks passed.");
  }
}
