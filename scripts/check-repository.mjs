import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findArchitectureBoundaryViolations,
  toRepositoryRelativePath,
} from "./check-architecture-boundaries.mjs";
import { findModuleManifestViolations } from "./check-module-manifests.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const styleBaselinePath = resolve(
  repositoryRoot,
  "scripts/style-scale-baseline.json",
);

function readStyleBaseline() {
  if (!existsSync(styleBaselinePath)) return { files: {} };
  return JSON.parse(readFileSync(styleBaselinePath, "utf8"));
}

const ignoredDirectories = new Set([
  ".agents",
  ".claude",
  ".git",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "generated",
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
  /(^|\/)(node_modules|dist|coverage|playwright-report|test-results|tmp|\.venv|__pycache__)(\/|$)/;
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
      path === "generated" ||
      path.startsWith("generated/") ||
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

// 排版与间距的唯一合法档位。页面只能用这些令牌，不得写裸 px。
// 权威：docs/product/UI_SYSTEM.md §7.2 / §7.3（本清单是它们的可执行副本）。
export const STYLE_SCALE_TOKENS = [
  "--text-page",
  "--text-title",
  "--text-body",
  "--text-meta",
  "--text-label",
  "--text-micro",
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-8",
];

export function findMissingStyleScaleTokens(tokensSource) {
  return STYLE_SCALE_TOKENS.filter(
    (token) => !new RegExp(`${token}\\s*:`).test(tokensSource),
  ).map((token) => `tokens.css 缺少 ${token}`);
}

const TEXT_TOKEN_VALUE = /^var\(--text-(?:page|title|body|meta|label|micro)\)$/;
const SPACE_TOKEN_VALUE = /^var\(--space-(?:1|2|3|4|5|6|8)\)$/;
const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
]);
const EXEMPTION_COMMENT = /\/\*\s*style-scale-exempt:\s*(.*?)\s*\*\//;
const MIN_EXEMPTION_REASON_LENGTH = 4;

function styleBlocksOf(record) {
  const path = normalizePath(record.path);
  if (path.endsWith(".css")) return [record.source];
  if (!path.endsWith(".vue")) return [];
  return [...record.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
}

function isAllowedSpacingPart(part) {
  if (part === "0" || part === "auto") return true;
  if (part.endsWith("%")) return true;
  return SPACE_TOKEN_VALUE.test(part);
}

// 把整个函数表达式（calc / min / max / clamp）折叠成一个可判定片段，
// 避免其中的空格与逗号被当成多个值拆开。括号要配对计数：
// calc(var(--space-2) * -1) 与 min(16vh, 140px) 都有括号。
const SPACING_FUNCTIONS = ["calc(", "min(", "max(", "clamp("];

function foldFunctionExpressions(value) {
  let out = "";
  let index = 0;
  while (index < value.length) {
    const fn = SPACING_FUNCTIONS.find((name) => value.startsWith(name, index));
    if (!fn) {
      out += value[index];
      index += 1;
      continue;
    }
    let depth = 0;
    let end = index + fn.length - 1;
    for (; end < value.length; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const expression = value.slice(index, end + 1);
    // calc 必须引用令牌，否则 calc(10px) 就成了绕过门禁的后门；
    // min / max / clamp 是流体布局表达式（如 min(16vh, 140px)），无法用单一令牌表达，整体放行。
    const allowed =
      expression.includes("var(--") || !expression.startsWith("calc(");
    out += allowed ? "0" : expression;
    index = end + 1;
  }
  return out;
}

// 扫描 web 源码里的裸 px 字号与越界间距。
// baseline.files 按文件记存量违规数：不超基线放行，超了报错 —— 存量可收敛，新漂移写不进来。
export function findStyleScaleViolations(records, baseline = { files: {} }) {
  const allowedCounts = baseline?.files ?? {};
  const errors = [];

  for (const record of records) {
    const path = normalizePath(record.path);
    if (!path.startsWith("apps/web/src/")) continue;
    if (path.endsWith("themes/logix/tokens.css")) continue;
    if (path.includes(".test.")) continue;

    const fileErrors = [];
    for (const block of styleBlocksOf(record)) {
      for (const line of block.split("\n")) {
        // 豁免按「行」判定：注释在行尾，拆声明后会与声明分开。
        const exemption = EXEMPTION_COMMENT.exec(line);
        if (exemption) {
          if (exemption[1].trim().length >= MIN_EXEMPTION_REASON_LENGTH) {
            continue;
          }
          fileErrors.push(
            `${path}: 豁免必须写明理由（≥${MIN_EXEMPTION_REASON_LENGTH} 字），当前为 '${exemption[1].trim()}'`,
          );
          continue;
        }

        // 去掉选择器：取最后一个 '{' 之后的部分，这样单行多声明
        // （.a { font-size: 14px; padding: 10px; }）也能逐条查到，
        // 不依赖「代码已被 Prettier 展开成一行一条」这个假设。
        const brace = line.lastIndexOf("{");
        const body = brace === -1 ? line : line.slice(brace + 1);

        for (const chunk of body.split(";")) {
          const declaration = /^\s*([a-z-]+)\s*:\s*(.+?)\s*\}?\s*$/.exec(chunk);
          if (!declaration) continue;
          const property = declaration[1];
          const value = declaration[2].trim();

          if (property === "font") {
            // font 简写里可能藏着字号：font: 10px var(--font-mono)。
            // 只允许 inherit，或引用了 --text-* 令牌的写法。
            if (value === "inherit" || value.includes("var(--text-")) continue;
            fileErrors.push(
              `${path}: font 简写里的字号不得写裸值，请改用 var(--text-*) 令牌（当前为 '${value}'）`,
            );
            continue;
          }

          if (property === "font-size") {
            if (value === "inherit" || TEXT_TOKEN_VALUE.test(value)) continue;
            fileErrors.push(
              `${path}: font-size 不得写裸值 '${value}'，请改用 var(--text-*) 令牌`,
            );
            continue;
          }

          if (!SPACING_PROPERTIES.has(property)) continue;
          for (const part of foldFunctionExpressions(value).split(/\s+/)) {
            if (!part || isAllowedSpacingPart(part)) continue;
            fileErrors.push(
              `${path}: ${property} 不得写裸值 '${part}'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）`,
            );
          }
        }
      }
    }

    if (!fileErrors.length) continue;
    const allowed = allowedCounts[path] ?? 0;
    if (fileErrors.length <= allowed) continue;
    errors.push(...fileErrors.slice(allowed));
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

const requiredPolicyFiles = [".github/CODEOWNERS"];

export function findMissingRequiredPolicyFiles(paths) {
  const normalized = new Set(paths.map((path) => normalizePath(path)));
  return requiredPolicyFiles
    .filter((file) => !normalized.has(file))
    .map((file) => `${file}: required repository policy file is missing`);
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

const architectureSourceExtensions = new Set([
  ".js",
  ".mjs",
  ".py",
  ".ts",
  ".tsx",
  ".vue",
]);

function architectureSourceFiles() {
  const roots = [
    "apps/api/src",
    "apps/web/src",
    "apps/ai-service",
    "workers",
    "packages",
  ];
  const files = [];
  for (const root of roots) {
    const absoluteRoot = resolve(repositoryRoot, root);
    if (!existsSync(absoluteRoot)) continue;
    files.push(
      ...walkFiles(absoluteRoot, (path) =>
        architectureSourceExtensions.has(extname(path).toLowerCase()),
      ),
    );
  }
  return files.map((absolutePath) => ({
    path: toRepositoryRelativePath(absolutePath),
    source: readFileSync(absolutePath, "utf8"),
  }));
}

export function runRepositoryChecks({ docsOnly = false } = {}) {
  const markdownFiles = walkFiles(repositoryRoot, (path) =>
    path.endsWith(".md"),
  );
  const contractAuthorityFiles = markdownFiles.filter((absolutePath) => {
    const path = toRepositoryRelativePath(absolutePath);
    return /^docs\/product\/domain\/(?:.*_CONTRACT_V1|LIFECYCLE_NODE_CATALOG_V1|EVENT_CODES|GLOBAL_CONTRACT_REGISTRY)\.md$/.test(
      path,
    );
  });
  const errors = [
    ...findBrokenMarkdownLinks(markdownFiles),
    ...taskStatusErrors(),
    ...findAmbiguousContractPhaseReferences(
      contractAuthorityFiles.map((path) => ({
        path: toRepositoryRelativePath(path),
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
      ...findMissingRequiredPolicyFiles([
        ...trackedFiles,
        ...requiredPolicyFiles.filter((file) =>
          existsSync(resolve(repositoryRoot, file)),
        ),
      ]),
      ...findForbiddenTrackedPaths(trackedFiles).map(
        (path) => `${path}: generated or sensitive file is tracked`,
      ),
      ...findSecretContent(trackedFiles),
      ...findUiThemeBoundaryViolations(
        webSourceFiles.map((path) => ({
          path: toRepositoryRelativePath(path),
          source: readFileSync(path, "utf8"),
        })),
      ),
      ...findMissingStyleScaleTokens(
        readFileSync(
          resolve(repositoryRoot, "apps/web/src/themes/logix/tokens.css"),
          "utf8",
        ),
      ),
      ...findStyleScaleViolations(
        webSourceFiles.map((path) => ({
          path: toRepositoryRelativePath(path),
          source: readFileSync(path, "utf8"),
        })),
        readStyleBaseline(),
      ),
      ...findArchitectureBoundaryViolations(architectureSourceFiles()),
      ...findModuleManifestViolations(),
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

// 生成模式：把当前全部存量违规按文件计数写进基线。
// 只在迁移期用；基线清空后连同冻结快照一起删除。
function writeStyleBaseline() {
  const files = {};
  const records = walkFiles(
    resolve(repositoryRoot, "apps/web/src"),
    (path) => [".css", ".vue"].includes(extname(path).toLowerCase()),
  ).map((path) => ({
    path: toRepositoryRelativePath(path),
    source: readFileSync(path, "utf8"),
  }));
  for (const record of records) {
    const path = normalizePath(record.path);
    const count = findStyleScaleViolations([{ path, source: record.source }], {
      files: {},
    }).length;
    if (count > 0) files[path] = count;
  }
  writeFileSync(
    styleBaselinePath,
    `${JSON.stringify(
      {
        note: "样式比例迁移基线：每迁完一个目录就删掉对应条目；清空后删除本文件、生成模式与测试里的冻结快照。只减不增。",
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `style-scale-baseline.json 已写入 ${Object.keys(files).length} 个文件`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  if (process.argv.includes("--write-style-baseline")) {
    writeStyleBaseline();
  } else {
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
}
