import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const modulesRoot = resolve(repositoryRoot, "apps/api/src/modules");

const normalizePath = (value) => value.replaceAll("\\", "/");

const INTERNAL_SEGMENTS = new Set([
  "domain",
  "application",
  "infrastructure",
  "presentation",
  "security",
  "engines",
]);

/**
 * Edges that already exist. Do not add keys. Delete a key only after the
 * base module no longer imports or depends on that incremental module.
 */
export const existingBaseOnIncremental = new Set([
  "lifecycle-control>compliance-management",
  "lifecycle-control>customs-compliance",
  "lifecycle-control>document-records",
  "lifecycle-control>inland-fulfillment",
  "work-execution>document-records",
]);

const extractStringArray = (source, field) => {
  const match = source.match(
    new RegExp(`${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m"),
  );
  if (!match) return null;
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
};

const extractStringField = (source, field) => {
  const match = source.match(
    new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`, "m"),
  );
  return match?.[1] ?? null;
};

const walkProductionTypeScript = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      walkProductionTypeScript(fullPath, files);
      continue;
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const siblingReferences = (moduleDir, modulesDirectory, moduleIds, selfId) => {
  const referenced = new Set();
  const internalPaths = [];
  const modulesRootPath = normalizePath(modulesDirectory);
  for (const file of walkProductionTypeScript(moduleDir)) {
    const text = readFileSync(file, "utf8");
    const relativeFile = `apps/api/src/modules/${normalizePath(file).slice(modulesRootPath.length + 1)}`;
    for (const match of text.matchAll(
      /(?:from|import)\s*(?:\(\s*)?["'](\.[^"']+)["']/g,
    )) {
      const target = normalizePath(resolve(dirname(file), match[1]));
      if (!target.startsWith(`${modulesRootPath}/`)) continue;
      const parts = target.slice(modulesRootPath.length + 1).split("/");
      const targetId = parts[0];
      if (!targetId || targetId === selfId || !moduleIds.has(targetId))
        continue;
      referenced.add(targetId);
      if (INTERNAL_SEGMENTS.has(parts[1])) {
        internalPaths.push(
          `${relativeFile}: imports internal path '${targetId}/${parts[1]}' of another module`,
        );
      }
    }
  }
  return { referenced, internalPaths };
};

/**
 * Every Nest module directory must ship module.manifest.ts with a valid depends graph.
 * Production sibling imports must be declared, stay on the public entry, and must not
 * add a new base-to-incremental edge.
 */
export function findModuleManifestViolations({
  modulesDirectory = modulesRoot,
  baseOnIncrementalAllowlist = existingBaseOnIncremental,
} = {}) {
  const errors = [];
  if (!existsSync(modulesDirectory)) {
    return [`${normalizePath(modulesDirectory)}: modules directory is missing`];
  }

  const entries = readdirSync(modulesDirectory, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );
  const moduleIds = new Set(entries.map((entry) => entry.name));
  const parsed = [];

  for (const entry of entries) {
    const moduleDir = resolve(modulesDirectory, entry.name);
    const relativeDir = normalizePath(`apps/api/src/modules/${entry.name}`);
    const nestModules = readdirSync(moduleDir).filter((name) =>
      name.endsWith(".module.ts"),
    );
    if (nestModules.length === 0) continue;

    const manifestPath = resolve(moduleDir, "module.manifest.ts");
    const relativeManifest = `${relativeDir}/module.manifest.ts`;
    if (!existsSync(manifestPath)) {
      errors.push(
        `${relativeManifest}: missing module.manifest.ts for Nest module directory`,
      );
      continue;
    }

    const source = readFileSync(manifestPath, "utf8");
    const id = extractStringField(source, "id");
    const kind = extractStringField(source, "kind");
    const depends = extractStringArray(source, "depends");
    const permissions = extractStringArray(source, "permissions");

    if (!id) {
      errors.push(`${relativeManifest}: missing id field`);
      continue;
    }
    if (id !== entry.name) {
      errors.push(
        `${relativeManifest}: id '${id}' must equal directory name '${entry.name}'`,
      );
    }
    if (kind !== "base" && kind !== "incremental") {
      errors.push(`${relativeManifest}: kind must be 'base' or 'incremental'`);
    }
    if (!depends) {
      errors.push(`${relativeManifest}: missing depends array`);
      continue;
    }
    if (!permissions) {
      errors.push(`${relativeManifest}: missing permissions array`);
    }
    if (depends.includes(id)) {
      errors.push(`${relativeManifest}: depends cannot include self`);
    }
    for (const dependency of depends) {
      if (!moduleIds.has(dependency)) {
        errors.push(
          `${relativeManifest}: depends references unknown module '${dependency}'`,
        );
      }
    }
    parsed.push({
      id: entry.name,
      kind,
      depends,
      relativeManifest,
      moduleDir,
    });
  }

  const kindById = new Map(
    parsed
      .filter((item) => item.kind === "base" || item.kind === "incremental")
      .map((item) => [item.id, item.kind]),
  );

  for (const item of parsed) {
    const { referenced, internalPaths } = siblingReferences(
      item.moduleDir,
      modulesDirectory,
      moduleIds,
      item.id,
    );
    errors.push(...internalPaths);
    for (const dependency of referenced) {
      if (!item.depends.includes(dependency)) {
        errors.push(
          `${item.relativeManifest}: sibling import '${dependency}' is missing from depends`,
        );
      }
    }
    if (item.kind !== "base") continue;
    const edges = new Set([...item.depends, ...referenced]);
    for (const dependency of edges) {
      if (kindById.get(dependency) !== "incremental") continue;
      const edge = `${item.id}>${dependency}`;
      if (baseOnIncrementalAllowlist.has(edge)) continue;
      errors.push(
        `${item.relativeManifest}: base module cannot depend on incremental '${dependency}'`,
      );
    }
  }

  return errors;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const errors = findModuleManifestViolations();
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Module manifest checks passed.");
  }
}
