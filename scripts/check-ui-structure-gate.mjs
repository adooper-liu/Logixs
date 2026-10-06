import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const normalizePath = (value) => value.replaceAll("\\", "/");

function cleanScalar(value) {
  const withoutComment = value.replace(/\s+#.*$/, "").trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function parseInlineList(value) {
  const inner = value.slice(1, -1).trim();
  return inner ? inner.split(",").map(cleanScalar) : [];
}

function parseFrontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (block === undefined) return null;

  const result = {};
  const lines = block.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    const value = cleanScalar(rawValue);
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = parseInlineList(value);
      continue;
    }
    if (!value) {
      const items = [];
      while (index + 1 < lines.length) {
        const item = lines[index + 1].match(/^\s+-\s+(.+)$/);
        if (!item) break;
        items.push(cleanScalar(item[1]));
        index += 1;
      }
      result[key] = items.length > 0 ? items : "";
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function parseUiTaskRecord(record) {
  const metadata = parseFrontmatter(record.source) ?? {};
  return {
    path: normalizePath(record.path),
    status: metadata.status,
    writeScopes: metadata.writeScopes,
    uiStructure: metadata.uiStructure,
    uiMustStayVisible: metadata.uiMustStayVisible,
    uiProgressiveDisclosure: metadata.uiProgressiveDisclosure,
    uiForbidden: metadata.uiForbidden,
    uiViewportEvidence: metadata.uiViewportEvidence,
  };
}

function scopeOwnsPath(scope, filePath) {
  const normalizedScope = normalizePath(scope).toLowerCase();
  const normalizedFile = normalizePath(filePath).toLowerCase();
  if (normalizedScope.endsWith("/**")) {
    const prefix = normalizedScope.slice(0, -3).replace(/\/$/, "");
    return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
  }
  return normalizedFile === normalizedScope;
}

function isBusinessVue(filePath) {
  const normalized = normalizePath(filePath).toLowerCase();
  return normalized.startsWith("apps/web/src/") && normalized.endsWith(".vue");
}

export function evaluateUiStructureGate({ filePath, records }) {
  const normalizedFile = normalizePath(filePath);
  if (!isBusinessVue(normalizedFile)) return { allowed: true };

  const owners = records
    .map(parseUiTaskRecord)
    .filter(
      (record) =>
        activeStatuses.has(record.status) &&
        Array.isArray(record.writeScopes) &&
        record.writeScopes.some((scope) =>
          scopeOwnsPath(scope, normalizedFile),
        ),
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
        path: normalizePath(relative(repositoryRoot, absolutePath)),
        source: readFileSync(absolutePath, "utf8"),
      };
    });
}

function repositoryRelativeFilePath(filePath) {
  const absolutePath = resolve(repositoryRoot, filePath);
  return normalizePath(relative(repositoryRoot, absolutePath));
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
