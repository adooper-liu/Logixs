import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(resolve(repositoryRoot, "apps/api/package.json"));
const ts = require("typescript");

const HTTP_EXPORTS = new Set([
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "Options",
  "Head",
  "All",
]);

export const ROUTE_REPORT_HEADER =
  "method\tpath\thandler\tclassification\tcapabilities\tviolations\tfile";

/**
 * 用 TypeScript AST 枚举 Nest HTTP 路由的访问分类。
 * 同一元数据键上方法级覆盖类级，与 Reflector.getAllAndOverride 一致；
 * 类级和方法级属于不同访问分类时必须报冲突，不能按覆盖顺序静默放行。
 */
export function analyzeControllerSources(files) {
  const routes = files.flatMap((file) =>
    analyzeControllerSource(file.file, file.text),
  );
  routes.sort(compareRoutes);
  return routes;
}

export function auditApiControllers(root = repositoryRoot) {
  return analyzeControllerSources(readControllerSources(root));
}

export function formatRouteLine(route) {
  return [
    route.httpMethod,
    route.path,
    `${route.className}.${route.methodName}`,
    route.classification,
    route.capabilities.length > 0 ? route.capabilities.join(",") : "-",
    route.violations.length > 0 ? route.violations.join(",") : "-",
    route.file,
  ].join("\t");
}

export function summarizeRoutes(routes) {
  const summary = {
    total: routes.length,
    public: 0,
    service: 0,
    capability: 0,
    missing: 0,
    conflict: 0,
  };
  for (const route of routes) {
    summary[route.classification] += 1;
  }
  return summary;
}

export function formatSummary(summary) {
  return `# total=${summary.total} public=${summary.public} service=${summary.service} capability=${summary.capability} missing=${summary.missing} conflict=${summary.conflict}`;
}

function analyzeControllerSource(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = readImports(source);
  const routes = [];
  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    const classDecorators = ts.getDecorators(statement) ?? [];
    const controller = readController(classDecorators, imports);
    if (!controller) continue;
    const className = statement.name?.text ?? "default";
    const classAccess = readAccess(classDecorators, imports);
    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const methodDecorators = ts.getDecorators(member) ?? [];
      const httpRoutes = readHttpRoutes(methodDecorators, imports);
      if (httpRoutes.length === 0) continue;
      const methodName = methodNameOf(member.name);
      const methodAccess = readAccess(methodDecorators, imports);
      const access = combineAccess(classAccess, methodAccess);
      for (const httpRoute of httpRoutes) {
        for (const path of combinePaths(controller, httpRoute)) {
          routes.push({
            file,
            className,
            methodName,
            httpMethod: httpRoute.httpMethod,
            path: path.path,
            classification: access.classification,
            capabilities: access.capabilities,
            violations: uniqueSorted([
              ...access.violations,
              ...path.violations,
            ]),
          });
        }
      }
    }
  }
  return routes;
}

function readControllerSources(root) {
  const sourceRoot = resolve(root, "apps/api/src");
  return listControllerFiles(sourceRoot).map((absolutePath) => ({
    file: relative(root, absolutePath).replaceAll("\\", "/"),
    text: readFileSync(absolutePath, "utf8"),
  }));
}

function listControllerFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listControllerFiles(absolutePath));
    } else if (entry.name.endsWith(".controller.ts")) {
      files.push(absolutePath);
    }
  }
  return files;
}

function readImports(source) {
  const imports = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }
    if (statement.importClause.isTypeOnly) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    const bindings = statement.importClause.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      imports.set(bindings.name.text, { kind: "namespace", moduleName });
      continue;
    }
    for (const specifier of bindings.elements) {
      if (specifier.isTypeOnly) continue;
      imports.set(specifier.name.text, {
        kind: "named",
        moduleName,
        exportName: (specifier.propertyName ?? specifier.name).text,
      });
    }
  }
  return imports;
}

function resolveDecorator(decorator, imports) {
  let expression = decorator.expression;
  const args = [];
  if (ts.isCallExpression(expression)) {
    args.push(...expression.arguments);
    expression = expression.expression;
  }
  expression = unwrapExpression(expression);
  if (ts.isIdentifier(expression)) {
    const binding = imports.get(expression.text);
    if (!binding || binding.kind !== "named") return null;
    return { ...binding, args };
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const binding = imports.get(expression.expression.text);
    if (!binding || binding.kind !== "namespace") return null;
    return {
      kind: "named",
      moduleName: binding.moduleName,
      exportName: expression.name.text,
      args,
    };
  }
  return null;
}

function readController(decorators, imports) {
  for (const decorator of decorators) {
    const resolved = resolveDecorator(decorator, imports);
    if (
      !resolved ||
      resolved.exportName !== "Controller" ||
      resolved.moduleName !== "@nestjs/common"
    ) {
      continue;
    }
    return parseRoutePaths(resolved.args[0]);
  }
  return null;
}

function readHttpRoutes(decorators, imports) {
  const routes = [];
  for (const decorator of decorators) {
    const resolved = resolveDecorator(decorator, imports);
    if (
      !resolved ||
      !HTTP_EXPORTS.has(resolved.exportName) ||
      resolved.moduleName !== "@nestjs/common"
    ) {
      continue;
    }
    const parsed = parseRoutePaths(resolved.args[0]);
    const httpMethod = resolved.exportName.toUpperCase();
    if (!parsed.ok) {
      routes.push({
        httpMethod,
        paths: ["<unresolved>"],
        violations: ["ROUTE_ARGUMENT_UNRESOLVED"],
      });
      continue;
    }
    routes.push({
      httpMethod,
      paths: parsed.paths,
      violations: [],
    });
  }
  return routes.flatMap((route) =>
    route.paths.map((path) => ({
      httpMethod: route.httpMethod,
      path,
      violations: route.violations,
    })),
  );
}

function readAccess(decorators, imports) {
  const access = {
    categories: [],
    capabilities: undefined,
    violations: [],
  };
  for (const decorator of decorators) {
    const resolved = resolveDecorator(decorator, imports);
    if (!resolved) continue;
    if (resolved.exportName === "PublicEndpoint") {
      addCategory(access, "public");
    } else if (resolved.exportName === "ServiceEndpoint") {
      addCategory(access, "service");
    } else if (resolved.exportName === "RequireCapabilities") {
      addCategory(access, "capability");
      const parsed = parseCapabilities(resolved.args);
      access.capabilities = parsed.capabilities;
      access.violations.push(...parsed.violations);
    }
  }
  access.violations = uniqueSorted(access.violations);
  return access;
}

function addCategory(access, category) {
  if (!access.categories.includes(category)) {
    access.categories.push(category);
  }
}

function combineAccess(classAccess, methodAccess) {
  const classCategories = classAccess.categories;
  const methodCategories = methodAccess.categories;
  const conflict =
    classCategories.length > 1 ||
    methodCategories.length > 1 ||
    (classCategories.length === 1 &&
      methodCategories.length === 1 &&
      classCategories[0] !== methodCategories[0]);
  const capabilities =
    methodAccess.capabilities !== undefined
      ? methodAccess.capabilities
      : (classAccess.capabilities ?? []);
  if (conflict) {
    return {
      classification: "conflict",
      capabilities,
      violations: uniqueSorted([
        "ACCESS_CLASSIFICATION_CONFLICT",
        ...classAccess.violations,
        ...methodAccess.violations,
      ]),
    };
  }
  const classification = methodCategories[0] ?? classCategories[0] ?? "missing";
  const shapeViolations =
    methodAccess.capabilities !== undefined
      ? methodAccess.violations
      : classAccess.violations;
  const violations = [...shapeViolations];
  if (classification === "missing") {
    violations.push("ACCESS_CLASSIFICATION_MISSING");
  }
  return {
    classification,
    capabilities,
    violations: uniqueSorted(violations),
  };
}

function parseCapabilities(args) {
  if (args.length === 0) {
    return { capabilities: [], violations: ["CAPABILITY_EMPTY"] };
  }
  const capabilities = [];
  const violations = [];
  const seen = new Set();
  for (const arg of args) {
    const literal = stringLiteral(unwrapExpression(arg));
    if (literal === null) {
      violations.push("CAPABILITY_NON_LITERAL");
      continue;
    }
    if (literal.trim() === "") {
      violations.push("CAPABILITY_BLANK");
      continue;
    }
    if (seen.has(literal)) {
      violations.push("CAPABILITY_DUPLICATE");
      continue;
    }
    seen.add(literal);
    capabilities.push(literal);
  }
  return { capabilities, violations };
}

function parseRoutePaths(argument) {
  if (argument === undefined) return { ok: true, paths: [""] };
  const expression = unwrapExpression(argument);
  const literal = stringLiteral(expression);
  if (literal !== null) return { ok: true, paths: [literal] };
  if (!ts.isArrayLiteralExpression(expression)) return { ok: false };
  if (expression.elements.length === 0) return { ok: false };
  const paths = [];
  for (const element of expression.elements) {
    const value = stringLiteral(unwrapExpression(element));
    if (value === null) return { ok: false };
    paths.push(value);
  }
  return { ok: true, paths };
}

function combinePaths(controller, httpRoute) {
  if (!controller.ok || httpRoute.path === "<unresolved>") {
    return [
      {
        path: "<unresolved>",
        violations: uniqueSorted([
          "ROUTE_ARGUMENT_UNRESOLVED",
          ...httpRoute.violations,
        ]),
      },
    ];
  }
  return controller.paths.map((prefix) => ({
    path: joinRoutePath(prefix, httpRoute.path),
    violations: httpRoute.violations,
  }));
}

function joinRoutePath(prefix, methodPath) {
  const left = trimSlashes(prefix);
  const right = trimSlashes(methodPath);
  if (!left && !right) return "/";
  if (!left) return `/${right}`;
  if (!right) return `/${left}`;
  return `/${left}/${right}`;
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function stringLiteral(expression) {
  if (
    expression &&
    (ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression))
  ) {
    return expression.text;
  }
  return null;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function methodNameOf(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isPrivateIdentifier(name)) return name.text;
  return "<computed>";
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function compareRoutes(left, right) {
  return (
    left.file.localeCompare(right.file) ||
    left.className.localeCompare(right.className) ||
    left.methodName.localeCompare(right.methodName) ||
    left.httpMethod.localeCompare(right.httpMethod) ||
    left.path.localeCompare(right.path)
  );
}

function runCli() {
  const routes = auditApiControllers(repositoryRoot);
  const summary = summarizeRoutes(routes);
  console.log(ROUTE_REPORT_HEADER);
  for (const route of routes) console.log(formatRouteLine(route));
  console.log(formatSummary(summary));
  if (routes.some((route) => route.violations.length > 0)) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) runCli();
