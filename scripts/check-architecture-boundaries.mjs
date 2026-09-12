import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const normalizePath = (value) => value.replaceAll("\\", "/");

const SOURCE_IMPORT_PATTERN =
  /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*|@import\s+(?:url\(\s*)?)["']([^"']+)["']/g;
const PYTHON_IMPORT_PATTERN =
  /^(?:from\s+(\S+)(?:\s+import\s+)|import\s+(\S+))/gm;

const FRAMEWORK_PACKAGES = [
  "@nestjs/common",
  "@nestjs/core",
  "@nestjs/platform-express",
  "@nestjs/platform-fastify",
  "express",
  "fastify",
];
const PRISMA_PACKAGES = ["@prisma/client", "@prisma/adapter-pg", "prisma"];
const MODEL_VENDOR_PACKAGES = [
  "openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "dashscope",
  "groq-sdk",
  "together-ai",
  "litellm",
];
const BUSINESS_DB_PACKAGES = [
  ...PRISMA_PACKAGES,
  "psycopg",
  "psycopg2",
  "asyncpg",
  "sqlalchemy",
];
const WEB_FORBIDDEN_PACKAGES = ["@logix/api", ...PRISMA_PACKAGES];

const COMPOSITION_ROOTS = new Set([
  "apps/api/src/app.module.ts",
  "apps/api/src/main.ts",
]);

const matchesPackage = (specifier, name) =>
  specifier === name || specifier.startsWith(`${name}/`);

const matchesAnyPackage = (specifier, names) =>
  names.some((name) => matchesPackage(specifier, name));

const isNestjs = (specifier) =>
  specifier === "@nestjs" || specifier.startsWith("@nestjs/");

const isTemporal = (specifier) =>
  specifier.startsWith("@temporalio/") ||
  specifier === "temporalio" ||
  specifier.startsWith("temporalio.");

const isPythonFile = (path) => path.endsWith(".py");

const hasPathSegment = (path, segment) => path.split("/").includes(segment);

const layerOf = (path) => {
  if (hasPathSegment(path, "domain")) return "domain";
  if (hasPathSegment(path, "infrastructure")) return "infrastructure";
  if (hasPathSegment(path, "application")) return "application";
  if (hasPathSegment(path, "presentation") || path.endsWith(".controller.ts")) {
    return "presentation";
  }
  if (path.endsWith(".module.ts")) return "composition";
  if (/^apps\/api\/src\/modules\/[^/]+\/index\.ts$/.test(path)) return "facade";
  return "other";
};

const apiModuleOf = (path) => {
  const match = path.match(/^apps\/api\/src\/modules\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;
  return { module: match[1], rest: match[2] ?? "" };
};

const isModulePublicEntry = (path) => {
  const info = apiModuleOf(path);
  if (!info) return false;
  return (
    info.rest === "" ||
    info.rest === "index" ||
    info.rest === "index.ts" ||
    info.rest === "index.js"
  );
};

const isCompositionRoot = (path) => COMPOSITION_ROOTS.has(path);

const isGeneratedPrismaClient = (resolved) =>
  /(^|\/)generated\/prisma(\/|$)/.test(normalizePath(resolved));

const isPrismaAllowedImporter = (path) =>
  path.startsWith("apps/api/src/prisma/") ||
  path.startsWith("apps/api/src/health/") ||
  hasPathSegment(path, "infrastructure");

const isTemporalAllowedImporter = (path) =>
  path.startsWith("apps/api/src/modules/workflow/") ||
  path.startsWith("workers/business-worker/") ||
  path.startsWith("workers/ai-worker/");

const isAiSurface = (path) =>
  path.startsWith("apps/ai-service/") || path.startsWith("workers/ai-worker/");

export const toRepositoryRelativePath = (absolutePath) => {
  const normalized = normalizePath(absolutePath).replace(/\/+$/, "");
  const root = normalizePath(repositoryRoot).replace(/\/+$/, "");
  if (normalized.toLowerCase() === root.toLowerCase()) return "";
  if (normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return normalized.slice(root.length + 1);
  }
  return normalized;
};

const resolveRelativeSpecifier = (importerPath, specifier) => {
  const absolute = resolve(repositoryRoot, dirname(importerPath), specifier);
  return toRepositoryRelativePath(absolute);
};

const extractSpecifiers = (path, source) => {
  const specifiers = [];
  if (isPythonFile(path)) {
    for (const match of source.matchAll(PYTHON_IMPORT_PATTERN)) {
      const raw = match[1] ?? match[2];
      if (!raw || raw === "__future__") continue;
      specifiers.push(raw.replace(/,$/, ""));
    }
    return specifiers;
  }
  for (const match of source.matchAll(SOURCE_IMPORT_PATTERN)) {
    specifiers.push(normalizePath(match[1]));
  }
  return specifiers;
};

const classifySpecifier = (importerPath, specifier) => {
  if (isPythonFile(importerPath)) {
    if (specifier.startsWith(".")) {
      return {
        kind: "path",
        value: resolveRelativeSpecifier(importerPath, specifier),
      };
    }
    return { kind: "package", value: specifier.split(".")[0] };
  }
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return {
      kind: "path",
      value: resolveRelativeSpecifier(importerPath, specifier),
    };
  }
  return { kind: "package", value: specifier };
};

const report = (path, specifier, message) =>
  `${path}: ${message} '${specifier}'`;

function collectPackageViolations(path, specifier) {
  const errors = [];
  const layer = layerOf(path);
  const moduleInfo = apiModuleOf(path);

  if (
    path.startsWith("apps/web/") &&
    (isNestjs(specifier) ||
      matchesAnyPackage(specifier, WEB_FORBIDDEN_PACKAGES))
  ) {
    errors.push(
      report(
        path,
        specifier,
        "web must reach the business API over HTTP, not import",
      ),
    );
  }

  if (
    path.startsWith("packages/") &&
    (isNestjs(specifier) || matchesAnyPackage(specifier, PRISMA_PACKAGES))
  ) {
    errors.push(
      report(
        path,
        specifier,
        "shared packages cannot depend on app frameworks",
      ),
    );
  }

  if (
    layer === "domain" &&
    (isNestjs(specifier) || matchesAnyPackage(specifier, FRAMEWORK_PACKAGES))
  ) {
    errors.push(
      report(
        path,
        specifier,
        "domain cannot import web or application frameworks",
      ),
    );
  }

  if (
    matchesAnyPackage(specifier, PRISMA_PACKAGES) &&
    !isPrismaAllowedImporter(path)
  ) {
    errors.push(
      report(
        path,
        specifier,
        "Prisma is limited to infrastructure, prisma, and health",
      ),
    );
  }

  if (isTemporal(specifier) && !isTemporalAllowedImporter(path)) {
    errors.push(
      report(
        path,
        specifier,
        "only the workflow module and workers may import Temporal",
      ),
    );
  }

  if (isAiSurface(path) && matchesAnyPackage(specifier, BUSINESS_DB_PACKAGES)) {
    errors.push(
      report(path, specifier, "AI surfaces cannot import business persistence"),
    );
  }

  const mayImportModelVendor =
    path.startsWith("apps/ai-service/") ||
    path.startsWith("workers/ai-worker/");
  if (
    !mayImportModelVendor &&
    matchesAnyPackage(specifier, MODEL_VENDOR_PACKAGES)
  ) {
    errors.push(
      report(
        path,
        specifier,
        "business code cannot call model vendors; use AI Gateway / AI Service",
      ),
    );
  }

  if (
    moduleInfo &&
    layer === "domain" &&
    (matchesAnyPackage(specifier, PRISMA_PACKAGES) || isTemporal(specifier))
  ) {
    errors.push(
      report(
        path,
        specifier,
        "domain cannot import persistence or workflow runtimes",
      ),
    );
  }

  return errors;
}

function collectPathViolations(path, specifier, resolved) {
  const errors = [];
  const layer = layerOf(path);
  const importerModule = apiModuleOf(path);
  const targetModule = apiModuleOf(resolved);

  if (
    (path.endsWith(".ts") ||
      path.endsWith(".tsx") ||
      path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".vue")) &&
    specifier.endsWith(".py")
  ) {
    errors.push(
      report(
        path,
        specifier,
        "TypeScript cannot import Python runtime modules",
      ),
    );
  }
  if (isPythonFile(path) && /\.(?:ts|tsx|js|mjs|vue)$/.test(specifier)) {
    errors.push(
      report(
        path,
        specifier,
        "Python cannot import TypeScript runtime modules",
      ),
    );
  }

  if (
    path.startsWith("apps/web/") &&
    (resolved.startsWith("apps/api/") ||
      resolved.startsWith("database/") ||
      isGeneratedPrismaClient(resolved))
  ) {
    errors.push(
      report(path, specifier, "web cannot import the business API or database"),
    );
  }

  if (
    path.startsWith("packages/") &&
    (resolved.startsWith("apps/") ||
      resolved.startsWith("workers/") ||
      isGeneratedPrismaClient(resolved))
  ) {
    errors.push(
      report(path, specifier, "packages cannot depend on apps or workers"),
    );
  }

  if (
    isAiSurface(path) &&
    (resolved.startsWith("apps/api/") ||
      resolved.startsWith("database/") ||
      resolved.startsWith("apps/api/src/prisma/") ||
      isGeneratedPrismaClient(resolved))
  ) {
    errors.push(
      report(path, specifier, "AI surfaces cannot import business persistence"),
    );
  }

  if (
    (resolved.startsWith("apps/api/src/prisma/") ||
      isGeneratedPrismaClient(resolved)) &&
    !isPrismaAllowedImporter(path) &&
    !isCompositionRoot(path)
  ) {
    errors.push(
      report(
        path,
        specifier,
        "Prisma is limited to infrastructure, prisma, and health",
      ),
    );
  }

  if (!importerModule || !targetModule) return errors;
  if (importerModule.module === targetModule.module) {
    if (
      layer === "domain" &&
      (hasPathSegment(resolved, "infrastructure") ||
        hasPathSegment(resolved, "application") ||
        hasPathSegment(resolved, "presentation") ||
        resolved.endsWith(".module.ts") ||
        resolved.endsWith(".controller.ts"))
    ) {
      errors.push(
        report(
          path,
          specifier,
          "domain cannot depend on application, presentation, or infrastructure",
        ),
      );
    }
    return errors;
  }

  if (isModulePublicEntry(resolved)) {
    if (layer === "domain") {
      errors.push(
        report(path, specifier, "domain cannot import other modules"),
      );
    } else if (layer === "presentation") {
      errors.push(
        report(
          path,
          specifier,
          "controllers cannot import other modules; call the local use case",
        ),
      );
    } else if (layer === "facade") {
      errors.push(
        report(
          path,
          specifier,
          "module public entry can only re-export the same module",
        ),
      );
    }
    return errors;
  }

  if (!isCompositionRoot(path)) {
    errors.push(
      report(path, specifier, "cannot import another module's internal path"),
    );
  }

  return errors;
}

export function findArchitectureBoundaryViolations(records) {
  const errors = [];
  for (const record of records) {
    const path = normalizePath(record.path);
    for (const specifier of extractSpecifiers(path, record.source)) {
      const classified = classifySpecifier(path, specifier);
      if (classified.kind === "package") {
        errors.push(...collectPackageViolations(path, classified.value));
        continue;
      }
      errors.push(...collectPathViolations(path, specifier, classified.value));
    }
  }
  return errors;
}
