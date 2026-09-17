import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const modulesRoot = resolve(repositoryRoot, "apps/api/src/modules");

const normalizePath = (value) => value.replaceAll("\\", "/");

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

/**
 * Every Nest module directory must ship module.manifest.ts with a valid depends graph.
 */
export function findModuleManifestViolations({
  modulesDirectory = modulesRoot,
} = {}) {
  const errors = [];
  if (!existsSync(modulesDirectory)) {
    return [`${normalizePath(modulesDirectory)}: modules directory is missing`];
  }

  const entries = readdirSync(modulesDirectory, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );
  const moduleIds = new Set(entries.map((entry) => entry.name));

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
