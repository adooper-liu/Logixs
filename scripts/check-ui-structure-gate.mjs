import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  normalizeRepositoryPath,
  normalizeTaskRecord,
  scopeOwnsPath,
} from "./task-brief-state.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const taskDirectory = resolve(repositoryRoot, "docs/planning/tasks");
const activeStatuses = new Set(["design", "coding", "fix"]);
const mandatoryUiFields = [
  "uiStructure",
  "uiMustStayVisible",
  "uiProgressiveDisclosure",
  "uiForbidden",
  "uiViewportEvidence",
];

export function parseUiTaskRecord(record) {
  const task = normalizeTaskRecord(record);
  return {
    path: task.path,
    status: task.status,
    writeScopes: task.frontmatter.writeScopes,
    uiStructure: task.frontmatter.uiStructure,
    uiMustStayVisible: task.frontmatter.uiMustStayVisible,
    uiProgressiveDisclosure: task.frontmatter.uiProgressiveDisclosure,
    uiForbidden: task.frontmatter.uiForbidden,
    uiViewportEvidence: task.frontmatter.uiViewportEvidence,
    parseErrors: task.parseErrors,
  };
}

function isBusinessVue(filePath) {
  const normalized = normalizeRepositoryPath(filePath).toLowerCase();
  return normalized.startsWith("apps/web/src/") && normalized.endsWith(".vue");
}

export function evaluateUiStructureGate({ filePath, records }) {
  const normalizedFile = normalizeRepositoryPath(filePath);
  if (!isBusinessVue(normalizedFile)) return { allowed: true };

  const parsed = records.map(parseUiTaskRecord);
  const malformed = parsed.filter(
    (record) =>
      activeStatuses.has(record.status) && record.parseErrors.length > 0,
  );
  if (malformed.length > 0) {
    return {
      allowed: false,
      reason: `UI edit blocked: ${malformed
        .flatMap(({ parseErrors }) =>
          parseErrors.map(({ code, path, line }) => `${code} ${path}:${line}`),
        )
        .join(", ")}`,
    };
  }

  const owners = parsed.filter(
    (record) =>
      activeStatuses.has(record.status) &&
      Array.isArray(record.writeScopes) &&
      record.writeScopes.some((scope) => scopeOwnsPath(scope, normalizedFile)),
  );

  if (owners.length === 0) {
    return {
      allowed: false,
      reason: `UI edit blocked: no active design/coding/fix brief owns ${normalizedFile}`,
    };
  }
  if (owners.length > 1) {
    return {
      allowed: false,
      reason: `UI edit blocked: multiple active briefs own ${normalizedFile}: ${owners.map(({ path }) => path).join(", ")}`,
    };
  }

  const [owner] = owners;
  const missing = mandatoryUiFields.filter(
    (field) => !Array.isArray(owner[field]) || owner[field].length === 0,
  );
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `UI edit blocked: ${owner.path} is missing ${missing.join(", ")}`,
    };
  }
  return { allowed: true, briefPath: owner.path };
}

function loadTaskRecords() {
  if (!existsSync(taskDirectory)) return [];
  return readdirSync(taskDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const absolutePath = resolve(taskDirectory, entry.name);
      return {
        path: normalizeRepositoryPath(relative(repositoryRoot, absolutePath)),
        source: readFileSync(absolutePath, "utf8"),
      };
    });
}

function repositoryRelativeFilePath(filePath) {
  const absolutePath = resolve(repositoryRoot, filePath);
  return normalizeRepositoryPath(relative(repositoryRoot, absolutePath));
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== "string" || !filePath) return;

  const result = evaluateUiStructureGate({
    filePath: repositoryRelativeFilePath(filePath),
    records: loadTaskRecords(),
  });
  if (result.allowed) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: result.reason,
      },
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
