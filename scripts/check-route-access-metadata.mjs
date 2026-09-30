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

const OFFICIAL_ACCESS_FILES = new Map([
  [
    "apps/api/src/security/route-access.decorator.ts",
    new Set(["PublicEndpoint", "ServiceEndpoint"]),
  ],
  [
    "apps/api/src/security/require-capabilities.decorator.ts",
    new Set(["RequireCapabilities"]),
  ],
]);

/**
 * 用 TypeScript AST 枚举 Nest HTTP 路由的访问分类。
 * 三个访问装饰器只认控制器源码里指向上述两个 security 文件的具名相对导入；
 * 其它来源直接忽略。同一作用域出现多个访问装饰器时报 ACCESS_METADATA_DUPLICATE，
 * 不再选择其中一个。不同作用域仍按方法级覆盖类级；分类不一致则报冲突。
 * 同一方法多个 HTTP 装饰器只保留源码中最上方那条：experimentalDecorators
 * 自下而上执行，最上方的最后写入 METHOD/PATH，是运行时有效的一条。
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
    const classAccess = readAccess(classDecorators, imports, file);
    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const methodDecorators = ts.getDecorators(member) ?? [];
      const httpRoutes = readHttpRoutes(methodDecorators, imports);
      if (httpRoutes.length === 0) continue;
      const methodName = methodNameOf(member.name);
      const methodAccess = readAccess(methodDecorators, imports, file);
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
        renamed: specifier.propertyName !== undefined,
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
    return { ...binding, args, directNamed: true };
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
  const matches = [];
  for (const decorator of decorators) {
    const resolved = resolveDecorator(decorator, imports);
    if (
      !resolved ||
      !HTTP_EXPORTS.has(resolved.exportName) ||
      resolved.moduleName !== "@nestjs/common"
    ) {
      continue;
    }
    matches.push(resolved);
  }
  if (matches.length === 0) return [];
  const effective = matches[0];
  const violations = matches.length > 1 ? ["HTTP_DECORATOR_DUPLICATE"] : [];
  const parsed = parseRoutePaths(effective.args[0]);
  const httpMethod = effective.exportName.toUpperCase();
  if (!parsed.ok) {
    return [
      {
        httpMethod,
        path: "<unresolved>",
        violations: uniqueSorted([...violations, "ROUTE_ARGUMENT_UNRESOLVED"]),
      },
    ];
  }
  return parsed.paths.map((path) => ({
    httpMethod,
    path,
    violations,
  }));
}

function readAccess(decorators, imports, controllerFile) {
  const hits = [];
  for (const decorator of decorators) {
    const resolved = resolveDecorator(decorator, imports);
    const exportName = officialAccessExport(controllerFile, resolved);
    if (!exportName) continue;
    hits.push({ exportName, args: resolved.args });
  }
  if (hits.length > 1) {
    return {
      duplicate: true,
      categories: [],
      capabilities: undefined,
      violations: ["ACCESS_METADATA_DUPLICATE"],
    };
  }
  const access = {
    duplicate: false,
    categories: [],
    capabilities: undefined,
    violations: [],
  };
  const hit = hits[0];
  if (!hit) return access;
  if (hit.exportName === "PublicEndpoint") {
    addCategory(access, "public");
  } else if (hit.exportName === "ServiceEndpoint") {
    addCategory(access, "service");
  } else if (hit.exportName === "RequireCapabilities") {
    addCategory(access, "capability");
    const parsed = parseCapabilities(hit.args);
    access.capabilities = parsed.capabilities;
    access.violations.push(...parsed.violations);
  }
  access.violations = uniqueSorted(access.violations);
  return access;
}

function officialAccessExport(controllerFile, resolved) {
  if (!resolved?.directNamed || resolved.renamed) return null;
  const target = resolveRelativeSpecifier(controllerFile, resolved.moduleName);
  const allowed = OFFICIAL_ACCESS_FILES.get(target);
  if (!allowed || !allowed.has(resolved.exportName)) return null;
  return resolved.exportName;
}

function resolveRelativeSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const fromDir = fromFile.split("/").slice(0, -1);
  const parts = [...fromDir, ...specifier.split("/")];
  const stack = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const resolved = stack.join("/");
  return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

function addCategory(access, category) {
  if (!access.categories.includes(category)) {
    access.categories.push(category);
  }
}

function combineAccess(classAccess, methodAccess) {
  if (classAccess.duplicate || methodAccess.duplicate) {
    return {
      classification: "conflict",
      capabilities: [],
      violations: ["ACCESS_METADATA_DUPLICATE"],
    };
  }
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
