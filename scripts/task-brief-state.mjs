import { basename } from "node:path";

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

const cleanScalar = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
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
      values[key] = inner ? inner.split(",").map(cleanScalar) : [];
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
    if (Object.hasOwn(values, field) && !Array.isArray(values[field])) {
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
  if (left.kind === "directory") {
    return right.path === left.path || right.path.startsWith(`${left.path}/`);
  }
  return left.path === right.path || left.path.startsWith(`${right.path}/`);
}
