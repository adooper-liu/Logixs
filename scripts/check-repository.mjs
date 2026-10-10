import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findArchitectureBoundaryViolations,
  toRepositoryRelativePath,
} from "./check-architecture-boundaries.mjs";
import { findModuleManifestViolations } from "./check-module-manifests.mjs";
import { auditApiControllers } from "./check-route-access-metadata.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(resolve(repositoryRoot, "apps/web/package.json"));
const ts = require("typescript");

const ignoredDirectories = new Set([
  ".agents",
  ".claude",
  ".git",
  ".pytest_cache",
  ".venv",
  ".worktrees",
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
const scheduledWriteTaskStatuses = new Set(["design", "coding", "fix"]);
const writeTaskWipStatuses = new Set(["coding", "fix"]);
const allowedTaskRisks = new Set(["low", "medium", "high"]);
const writeTaskLimit = 2;
const reviewTaskLimit = 2;
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

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

export function findStaleWorkbenchBaselineReferences(root, paths) {
  return paths.flatMap((path) => {
    const text = readFileSync(resolve(root, path), "utf8");
    return [
      ...text.matchAll(/(?:20 台工作台|20 个工作台|项目定义的 20 台)/g),
    ].map(
      (match) =>
        `${path}:${lineNumberAt(text, match.index)} stale workbench baseline`,
    );
  });
}

const WORKBENCH_CATALOG_PATH = "apps/web/src/data/workbenchNetwork.ts";
const WORKBENCH_NETWORK_ROUTES_PATH =
  "apps/web/src/modules/workbench-network/routes.ts";
const ROUTER_PATH = "apps/web/src/router/index.ts";
const CURRENT_TECHNICAL_REFERENCE_PATHS = [
  "docs/product/WORKSPACE_UI_INVENTORY.md",
  "docs/product/POST_DEPARTURE_WORKBENCH_DELIVERY_BASELINE.md",
  "doc/cross-border-supply-chain/05-shipment-lifecycle-blueprint.md",
  "doc/cross-border-supply-chain/09-customs-compliance-ai.md",
  "doc/cross-border-supply-chain/13-dcsa-business-map.md",
];
const MATURITY_EVIDENCE_DISCLAIMER =
  "路由、页面或 API 存在不等于 `operational` 或 `validated`。";

function unwrap(expression) {
  return ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
    ? unwrap(expression.expression)
    : expression;
}

function expressionContainsIdentifier(expression, name) {
  let found = false;
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === name) found = true;
    if (!found) ts.forEachChild(node, visit);
  };
  if (expression) visit(expression);
  return found;
}

function mapCallbackUsesStagePath(call) {
  const callback = call.arguments[0];
  if (
    !callback ||
    (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
  )
    return false;
  let found = false;
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === "path" &&
      ts.isPropertyAccessExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "stage" &&
      node.initializer.name.text === "path"
    )
      found = true;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback.body, visit);
  return found;
}
function astSource(source) {
  return ts.createSourceFile(
    "workbenchNetwork.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function topLevelVariable(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration;
    }
  }
  return undefined;
}

function objectProperty(object, name) {
  return object.properties.find(
    (item) =>
      ts.isPropertyAssignment(item) &&
      (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
      item.name.text === name,
  );
}

function stringLiteral(node) {
  if (!node) return null;
  const expression = unwrap(node);
  return expression &&
    (ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : null;
}

function numericLiteral(node) {
  return node && ts.isNumericLiteral(node) ? Number(node.text) : null;
}

const catalogOverrideProperties = new Set([
  "path",
  "kind",
  "phase",
  "sequence",
  "assessmentState",
  "maturity",
  "surface",
  "ownerRole",
  "requiredFacts",
]);

function isStaticLiteral(node) {
  const expression = unwrap(node);
  return (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isArrayLiteralExpression(expression) &&
      expression.elements.every(
        (element) => !ts.isSpreadElement(element) && isStaticLiteral(element),
      ))
  );
}

function validateCatalogOverrides(overrides, errors) {
  for (const property of overrides.properties) {
    if (ts.isSpreadAssignment(property)) {
      errors.push(
        "workbenchStages: catalogStage overrides must not use spread properties",
      );
      continue;
    }
    if (
      !ts.isPropertyAssignment(property) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
    ) {
      errors.push(
        `workbenchStages: catalogStage has unsupported override '${ts.SyntaxKind[property.kind]}'`,
      );
      continue;
    }
    const name = property.name.text;
    if (!catalogOverrideProperties.has(name)) {
      errors.push(
        `workbenchStages: catalogStage has unsupported override '${name}'`,
      );
    } else if (!isStaticLiteral(property.initializer)) {
      errors.push(
        `workbenchStages: catalogStage override '${name}' must be a literal`,
      );
    }
  }
}

function helperKind(sourceFile, name) {
  const variable = topLevelVariable(sourceFile, name);
  const arrow = variable?.initializer;
  if (arrow && ts.isArrowFunction(arrow)) {
    const result = unwrap(arrow.body);
    return result && ts.isObjectLiteralExpression(result)
      ? stringLiteral(objectProperty(result, "kind")?.initializer)
      : null;
  }
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  const result = declaration?.body?.statements.find(
    (statement) =>
      ts.isReturnStatement(statement) &&
      statement.expression &&
      ts.isObjectLiteralExpression(statement.expression),
  )?.expression;
  return result && ts.isObjectLiteralExpression(result)
    ? stringLiteral(objectProperty(result, "kind")?.initializer)
    : null;
}

function callName(expression) {
  return ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : null;
}

function effectiveStages(sourceFile, errors) {
  const legacy = new Map();
  const network = topLevelVariable(sourceFile, "workbenchNetwork");
  for (const expression of ts.isArrayLiteralExpression(
    unwrap(network?.initializer),
  )
    ? unwrap(network.initializer).elements
    : []) {
    const name = callName(expression);
    if (!name) continue;
    const offset = name === "supportStage" ? 0 : 1;
    const code = stringLiteral(expression.arguments?.[offset]);
    if (code)
      legacy.set(code, {
        code,
        title: stringLiteral(expression.arguments?.[offset + 1]),
        path: stringLiteral(expression.arguments?.[offset + 2]),
        kind: helperKind(
          sourceFile,
          name === "supportStage" ? "supportStage" : "stage",
        ),
      });
  }
  const catalog = topLevelVariable(sourceFile, "workbenchStages");
  const catalogInitializer = unwrap(catalog?.initializer);
  if (!catalog || !ts.isArrayLiteralExpression(catalogInitializer)) return [];
  return catalogInitializer.elements.flatMap((expression) => {
    const name = callName(expression);
    if (name === "catalogStage") {
      const base = legacy.get(stringLiteral(expression.arguments[0]));
      if (!base) return [];
      const overrides = expression.arguments[1];
      const overrideObject =
        overrides && ts.isObjectLiteralExpression(overrides)
          ? overrides
          : undefined;
      if (overrides && !overrideObject) {
        errors.push(
          "workbenchStages: catalogStage overrides must be an object literal",
        );
      } else if (overrideObject) {
        validateCatalogOverrides(overrideObject, errors);
      }
      return [
        {
          ...base,
          path:
            stringLiteral(
              overrideObject &&
                objectProperty(overrideObject, "path")?.initializer,
            ) ?? base.path,
          kind:
            stringLiteral(
              overrideObject &&
                objectProperty(overrideObject, "kind")?.initializer,
            ) ?? base.kind,
        },
      ];
    }
    if (
      name === "plannedCatalogStage" ||
      name === "plannedSupportCatalogStage"
    ) {
      const offset = name === "plannedCatalogStage" ? 1 : 0;
      return [
        {
          code: stringLiteral(expression.arguments[offset]),
          path: stringLiteral(expression.arguments[offset + 1]),
          kind: helperKind(sourceFile, name),
        },
      ];
    }
    errors.push(
      `workbenchStages: unsupported element '${ts.SyntaxKind[expression.kind]}'`,
    );
    return [];
  });
}

const EXPECTED_WORKBENCH_PATHS = new Map([
  ["market_signals", "/workspaces/market-signals"],
  ["product_selection", "/workspaces/product-selection"],
  ["product_npi", "/workspaces/product-npi"],
  ["master_data", "/workspaces/master-data"],
  ["sourcing", "/workspaces/sourcing"],
  ["demand_replenishment", "/workspaces/demand-replenishment"],
  ["procurement", "/workspaces/procurement"],
  ["supply_readiness", "/workspaces/supply-readiness"],
  ["shipment_planning", "/workspaces/shipment-planning"],
  ["booking", "/workspaces/booking"],
  ["cargo_ready", "/workspaces/cargo-ready"],
  ["stuffing", "/workspaces/stuffing"],
  ["export_customs", "/workspaces/export-customs"],
  ["dispatch", "/workspaces/dispatch"],
  ["ocean_operations", "/workspaces/ocean-operations"],
  ["customs", "/workspaces/customs"],
  ["pickup", "/workspaces/pickup"],
  ["delivery", "/workspaces/delivery"],
  ["unloading", "/workspaces/unloading"],
  ["empty_return", "/workspaces/empty-return"],
  ["compliance_operations", "/workspaces/compliance-operations"],
  ["charges", "/workspaces/charges"],
  ["exceptions", "/workspaces/exceptions"],
]);

export function inspectWorkbenchCatalogSource(source) {
  const sourceFile = astSource(source);
  const errors = [];
  const baseline = unwrap(
    topLevelVariable(sourceFile, "workbenchBaseline")?.initializer,
  );
  for (const [name, expected] of [
    ["total", 23],
    ["main", 20],
    ["support", 3],
  ]) {
    const actual = ts.isObjectLiteralExpression(baseline)
      ? numericLiteral(objectProperty(baseline, name)?.initializer)
      : null;
    if (actual !== expected)
      errors.push(
        `workbenchBaseline: ${name} must be ${expected}, found '${actual ?? "missing"}'`,
      );
  }
  const stages = effectiveStages(sourceFile, errors);
  if (stages.length !== 23)
    errors.push(`workbenchStages: expected 23 rows, found ${stages.length}`);
  for (const [kind, expected] of [
    ["main", 20],
    ["support", 3],
  ]) {
    const actual = stages.filter((stage) => stage.kind === kind).length;
    if (actual !== expected)
      errors.push(
        `workbenchStages: expected ${expected} ${kind} rows, found ${actual}`,
      );
  }
  for (const field of ["code", "path"]) {
    const seen = new Set();
    for (const stage of stages) {
      if (stage[field] && seen.has(stage[field]))
        errors.push(`workbenchStages: duplicate ${field} '${stage[field]}'`);
      seen.add(stage[field]);
    }
  }
  for (const [code, path] of EXPECTED_WORKBENCH_PATHS) {
    const stage = stages.find((item) => item.code === code);
    if (!stage) errors.push(`workbenchStages: code '${code}' is missing`);
    else if (stage.path !== path)
      errors.push(
        `workbenchStages: ${code} path must be '${path}', found '${stage.path}'`,
      );
  }
  const customs = stages.find((stage) => stage.code === "customs");
  const compliance = stages.find(
    (stage) => stage.code === "compliance_operations",
  );
  if (compliance && compliance.kind !== "support")
    errors.push(
      `workbenchStages: compliance_operations kind must be 'support', found '${compliance.kind}'`,
    );
  return errors;
}

export function inspectWorkbenchRouteSource(source) {
  const initializer = topLevelVariable(
    astSource(source),
    "workbenchNetworkRoutes",
  )?.initializer;
  const errors = [];
  const hasStubSpread = expressionContainsIdentifier(
    initializer,
    "catalogStubWorkbenchStages",
  );
  const mapCalls = [];
  const unsupportedTransforms = new Set();
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const receiver = node.expression.expression;
      const usesCatalogStages = expressionContainsIdentifier(
        receiver,
        "catalogStubWorkbenchStages",
      );
      const usesFrameworkStages = expressionContainsIdentifier(
        receiver,
        "frameworkWorkbenchStages",
      );
      if (node.expression.name.text === "map") {
        if (usesCatalogStages) mapCalls.push(node);
      } else if (usesCatalogStages || usesFrameworkStages) {
        unsupportedTransforms.add(node.expression.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  if (initializer) visit(initializer);
  if (!hasStubSpread || mapCalls.length === 0)
    errors.push(
      "workbench-network routes: catalog stubs must map catalogStubWorkbenchStages",
    );
  const filteredCompliance =
    initializer &&
    /compliance_operations/.test(initializer.getText()) &&
    /\.filter\s*\(/.test(initializer.getText());
  if (filteredCompliance)
    errors.push(
      "workbench-network routes: must not exclude compliance_operations from catalog stubs",
    );
  if (!mapCalls.some(mapCallbackUsesStagePath))
    errors.push(
      "workbench-network routes: catalog stubs must map each stage.path",
    );
  for (const transform of unsupportedTransforms) {
    errors.push(
      `workbench-network routes: unsupported array transform '${transform}'`,
    );
  }
  return errors;
}

export function inspectWorkbenchRouterSource(source) {
  const router = topLevelVariable(astSource(source), "router")?.initializer;
  let hasCompliancePath = false;
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === "path" &&
      stringLiteral(unwrap(node.initializer)) === "/compliance"
    )
      hasCompliancePath = true;
    if (!hasCompliancePath) ts.forEachChild(node, visit);
  };
  if (router) visit(router);
  return hasCompliancePath
    ? []
    : [
        "router: must retain /compliance separately from /workspaces/compliance-operations",
      ];
}

function hasComplianceRoute(source) {
  return inspectWorkbenchRouterSource(source).length === 0;
}
export function checkWorkbenchCatalogSource(root) {
  const source = readFileSync(resolve(root, WORKBENCH_CATALOG_PATH), "utf8");
  const routerSource = readFileSync(resolve(root, ROUTER_PATH), "utf8");
  const routesSource = readFileSync(
    resolve(root, WORKBENCH_NETWORK_ROUTES_PATH),
    "utf8",
  );
  const errors = inspectWorkbenchCatalogSource(source).map(
    (error) => `${WORKBENCH_CATALOG_PATH}: ${error}`,
  );
  if (!hasComplianceRoute(routerSource))
    errors.push(
      `${ROUTER_PATH}: must retain /compliance separately from /workspaces/compliance-operations`,
    );
  errors.push(
    ...inspectWorkbenchRouteSource(routesSource).map(
      (error) => `${WORKBENCH_NETWORK_ROUTES_PATH}: ${error}`,
    ),
  );
  for (const path of CURRENT_TECHNICAL_REFERENCE_PATHS) {
    if (
      !readFileSync(resolve(root, path), "utf8").includes(
        MATURITY_EVIDENCE_DISCLAIMER,
      )
    )
      errors.push(`${path}: missing catalog maturity evidence disclaimer`);
  }
  return errors;
}

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

function taskId(path) {
  return normalizePath(path).split("/").at(-1)?.replace(/\.md$/, "") ?? path;
}

function cleanFrontmatterScalar(value) {
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
  if (!inner) return [];
  return inner.split(",").map((item) => cleanFrontmatterScalar(item));
}

function parseTaskFrontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (block === undefined) return null;

  const result = {};
  const lines = block.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    const value = cleanFrontmatterScalar(rawValue);

    if (value === "|" || value === ">") {
      const content = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        content.push(lines[index + 1].trim());
        index += 1;
      }
      result[key] = content.join("\n").trim();
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = parseInlineList(value);
      continue;
    }

    if (!value) {
      const items = [];
      while (index + 1 < lines.length) {
        const item = lines[index + 1].match(/^\s+-\s+(.+)$/);
        if (!item) break;
        items.push(cleanFrontmatterScalar(item[1]));
        index += 1;
      }
      result[key] = items.length > 0 ? items : "";
      continue;
    }

    result[key] = value;
  }
  return result;
}

function isRepositoryRelativeScope(scope) {
  const segments = scope.split("/");
  return (
    scope.length > 0 &&
    !scope.includes("\\") &&
    !scope.startsWith("/") &&
    !/^[A-Za-z]:/.test(scope) &&
    !segments.includes("") &&
    !segments.includes(".") &&
    !segments.includes("..")
  );
}

function parseWriteScope(scope) {
  if (!isRepositoryRelativeScope(scope)) return { error: "outside" };
  if (scope.endsWith("/**")) {
    const prefix = scope.slice(0, -3).replace(/\/$/, "");
    if (!prefix || /[*?[\]]/.test(prefix)) return { error: "pattern" };
    return { kind: "directory", path: prefix.toLowerCase() };
  }
  if (/[*?[\]]/.test(scope)) return { error: "pattern" };
  return { kind: "exact", path: scope.toLowerCase() };
}

function writeScopesOverlap(left, right) {
  if (left.kind === "exact" && right.kind === "exact") {
    return left.path === right.path;
  }
  if (left.kind === "directory") {
    return right.path === left.path || right.path.startsWith(`${left.path}/`);
  }
  return left.path === right.path || left.path.startsWith(`${right.path}/`);
}

const uiStructureFields = [
  "uiStructure",
  "uiMustStayVisible",
  "uiProgressiveDisclosure",
  "uiForbidden",
  "uiViewportEvidence",
];

function isUiImplementationScope(scope) {
  const normalized = normalizePath(scope).toLowerCase();
  return (
    normalized.startsWith("apps/web/src/") &&
    (normalized.endsWith(".vue") || normalized.endsWith("/**"))
  );
}

function requireUiStructureMetadata(record, metadata, errors) {
  if (
    !Array.isArray(metadata.writeScopes) ||
    !metadata.writeScopes.some(isUiImplementationScope)
  ) {
    return;
  }

  for (const field of uiStructureFields) {
    if (!Array.isArray(metadata[field])) {
      errors.push(`${record.path}: active UI task is missing ${field}`);
    } else if (metadata[field].length === 0) {
      errors.push(`${record.path}: active UI task ${field} must not be empty`);
    }
  }
}

function requireWriteTaskMetadata(record, metadata, errors) {
  for (const field of ["owner", "writer", "risk"]) {
    if (typeof metadata[field] !== "string" || !metadata[field]) {
      errors.push(`${record.path}: active write task is missing ${field}`);
    }
  }
  for (const field of [
    "dependsOn",
    "writeScopes",
    "exclusiveLocks",
    "sharedIntegrationScopes",
    "authorityRefs",
  ]) {
    if (!Array.isArray(metadata[field])) {
      errors.push(`${record.path}: active write task is missing ${field}`);
    }
  }
  if (
    typeof metadata.risk === "string" &&
    metadata.risk &&
    !allowedTaskRisks.has(metadata.risk)
  ) {
    errors.push(`${record.path}: invalid task risk '${metadata.risk}'`);
  }
  if (
    typeof metadata.writer === "string" &&
    metadata.writer &&
    !/^[a-z0-9][a-z0-9:-]*$/.test(metadata.writer)
  ) {
    errors.push(
      `${record.path}: writer '${metadata.writer}' must be a stable lowercase code`,
    );
  }
  if (
    Array.isArray(metadata.writeScopes) &&
    metadata.writeScopes.length === 0
  ) {
    errors.push(`${record.path}: active write task must declare writeScopes`);
  }
  if (
    Array.isArray(metadata.authorityRefs) &&
    metadata.authorityRefs.length === 0
  ) {
    errors.push(`${record.path}: active write task must declare authorityRefs`);
  }
  requireUiStructureMetadata(record, metadata, errors);
}

export function validateTaskStatusRecords(records) {
  const errors = [];
  const parsedRecords = records.map((record) => ({
    ...record,
    id: taskId(record.path),
    metadata: parseTaskFrontmatter(record.source),
  }));
  const recordsById = new Map(
    parsedRecords.map((record) => [record.id, record]),
  );
  const writeTasks = [];
  const reviewTasks = [];

  for (const record of parsedRecords) {
    if (!record.metadata || typeof record.metadata.status !== "string") {
      errors.push(`${record.path}: missing frontmatter status`);
      continue;
    }
    const status = record.metadata.status;
    if (!allowedTaskStatuses.has(status)) {
      errors.push(`${record.path}: invalid task status '${status}'`);
      continue;
    }
    if (scheduledWriteTaskStatuses.has(status)) {
      requireWriteTaskMetadata(record, record.metadata, errors);
      writeTasks.push(record);
    } else if (status === "review") {
      reviewTasks.push(record);
    } else if (status === "done" && !record.metadata.verification) {
      errors.push(`${record.path}: done task is missing verification evidence`);
    }
  }

  for (const record of writeTasks) {
    if (!Array.isArray(record.metadata.dependsOn)) continue;
    for (const dependencyId of record.metadata.dependsOn) {
      const dependency = recordsById.get(dependencyId);
      if (!dependency) {
        errors.push(
          `${record.path}: dependency '${dependencyId}' does not exist`,
        );
      } else if (dependency.metadata?.status !== "done") {
        errors.push(
          `${record.path}: dependency '${dependencyId}' is not done (status: ${dependency.metadata?.status ?? "missing"})`,
        );
      }
    }
  }

  const writeTaskWip = writeTasks.filter((record) =>
    writeTaskWipStatuses.has(record.metadata.status),
  );
  if (writeTaskWip.length > writeTaskLimit) {
    errors.push(
      `write task WIP limit exceeded (max ${writeTaskLimit}): ${writeTaskWip.map((record) => record.path).join(", ")}`,
    );
  }
  if (reviewTasks.length > reviewTaskLimit) {
    errors.push(
      `review task WIP limit exceeded (max ${reviewTaskLimit}): ${reviewTasks.map((record) => record.path).join(", ")}`,
    );
  }

  const writerGroups = new Map();
  for (const record of writeTasks) {
    if (typeof record.metadata.writer !== "string" || !record.metadata.writer)
      continue;
    const group = writerGroups.get(record.metadata.writer) ?? [];
    group.push(record.path);
    writerGroups.set(record.metadata.writer, group);
  }
  for (const [writer, paths] of writerGroups) {
    if (paths.length > 1) {
      errors.push(
        `active write tasks share writer '${writer}': ${paths.join(", ")}`,
      );
    }
  }

  for (let leftIndex = 0; leftIndex < writeTasks.length; leftIndex += 1) {
    const left = writeTasks[leftIndex];
    const leftScopes = Array.isArray(left.metadata.writeScopes)
      ? left.metadata.writeScopes
      : [];
    const parsedLeftScopes = leftScopes.map((scope) => ({
      raw: scope,
      parsed: parseWriteScope(scope),
    }));
    for (const scope of parsedLeftScopes) {
      if (scope.parsed.error === "outside") {
        errors.push(
          `${left.path}: writeScopes entry '${scope.raw}' must stay within the repository`,
        );
      } else if (scope.parsed.error) {
        errors.push(
          `${left.path}: writeScopes entry '${scope.raw}' must be an exact repository path or a directory ending in /**`,
        );
      }
    }
    const leftLocks = Array.isArray(left.metadata.exclusiveLocks)
      ? left.metadata.exclusiveLocks
      : [];
    for (const lock of leftLocks) {
      if (!/^[a-z0-9][a-z0-9:-]*$/.test(lock)) {
        errors.push(
          `${left.path}: exclusiveLocks entry '${lock}' must be a stable lowercase code`,
        );
      }
    }

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < writeTasks.length;
      rightIndex += 1
    ) {
      const right = writeTasks[rightIndex];
      const rightScopes = Array.isArray(right.metadata.writeScopes)
        ? right.metadata.writeScopes
        : [];
      for (const leftScope of parsedLeftScopes) {
        if (leftScope.parsed.error) continue;
        for (const rawRightScope of rightScopes) {
          const rightScope = parseWriteScope(rawRightScope);
          if (
            !rightScope.error &&
            writeScopesOverlap(leftScope.parsed, rightScope)
          ) {
            errors.push(
              `active write task scopes overlap '${leftScope.raw}' and '${rawRightScope}': ${left.path}, ${right.path}`,
            );
          }
        }
      }

      const rightLocks = new Set(
        Array.isArray(right.metadata.exclusiveLocks)
          ? right.metadata.exclusiveLocks
          : [],
      );
      for (const lock of leftLocks) {
        if (rightLocks.has(lock)) {
          errors.push(
            `active write tasks share exclusive lock '${lock}': ${left.path}, ${right.path}`,
          );
        }
      }
    }
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
  "--leading-tight",
  "--leading-title",
  "--leading-dense",
  "--leading-body",
  "--leading-prose",
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
// 字重的合法档位：只有这三个通用值。不入令牌 —— 包装不增加信息，
// 且角色命名（如 --weight-page）会在 51 处非页名的位置说谎。
const WEIGHT_VALUES = new Set(["400", "600", "700"]);
const LEADING_TOKEN_VALUE =
  /^var\(--leading-(?:tight|title|dense|body|prose)\)$/;
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
// 迁移已完成、基线已删除，这里是硬门禁：任何越界直接失败。
export function findStyleScaleViolations(records) {
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

          if (property === "font-weight") {
            // normal / bold 语义等价于 400 / 700，放行。
            // 其余只认 400 / 600 / 700 —— 字体渲染不出中间字重时会被就近取整，
            // 源码写着 650、界面显示 700，这种"看不见的失真"正是要拦的。
            const keyword = ["inherit", "normal", "bold"];
            if (keyword.includes(value) || WEIGHT_VALUES.has(value)) continue;
            fileErrors.push(
              `${path}: font-weight 只允许 400 / 600 / 700（或 inherit / normal / bold），当前为 '${value}'`,
            );
            continue;
          }

          if (property === "line-height") {
            // 比例与绝对长度都必须走令牌：允许写 1.2 就等于允许任意值，档位就收不紧。
            // 布局对齐需要的绝对行高（如与状态点对齐）走 style-scale-exempt 豁免。
            if (value === "inherit" || LEADING_TOKEN_VALUE.test(value))
              continue;
            fileErrors.push(
              `${path}: line-height 不得写裸值 '${value}'，请改用 var(--leading-*) 令牌（title 1.3 / dense 1.4 / body 1.55 / prose 1.6）`,
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

    errors.push(...fileErrors);
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

// 路由访问分类的硬门禁：直接消费 AST 审计结果，不设数量基线或豁免清单。
export function findRouteAccessViolations(routes) {
  return routes
    .filter((route) => route.violations.length > 0)
    .map(
      (route) =>
        `${route.file}: ${route.httpMethod} ${route.path} (${route.className}.${route.methodName}) route access ${route.classification}: ${route.violations.join(",")}`,
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

const WISDOM_BASELINE_DIRECTORY =
  "doc/cross-border-supply-chain/wisdom-baseline/";

// 基线原文须逐字保留（AGENTS.md §1.2.1 第 13 条），其中指向当时本机路径的链接不能修正；目录说明仍受链接检查。
export function isVerbatimWisdomBaseline(path) {
  return (
    path.startsWith(WISDOM_BASELINE_DIRECTORY) &&
    path !== `${WISDOM_BASELINE_DIRECTORY}README.md`
  );
}

export function runRepositoryChecks({ docsOnly = false } = {}) {
  const markdownFiles = walkFiles(repositoryRoot, (path) =>
    path.endsWith(".md"),
  );
  const linkCheckedMarkdownFiles = markdownFiles.filter(
    (absolutePath) =>
      !isVerbatimWisdomBaseline(toRepositoryRelativePath(absolutePath)),
  );
  const contractAuthorityFiles = markdownFiles.filter((absolutePath) => {
    const path = toRepositoryRelativePath(absolutePath);
    return /^docs\/product\/domain\/(?:.*_CONTRACT_V1|LIFECYCLE_NODE_CATALOG_V1|EVENT_CODES|GLOBAL_CONTRACT_REGISTRY)\.md$/.test(
      path,
    );
  });
  const errors = [
    ...findBrokenMarkdownLinks(linkCheckedMarkdownFiles),
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
      ),
      ...findArchitectureBoundaryViolations(architectureSourceFiles()),
      ...findModuleManifestViolations(),
      ...findRouteAccessViolations(auditApiControllers()),
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
