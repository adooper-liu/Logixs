import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const contractRoot = resolve(root, "packages/contracts");
const schemaRoot = resolve(contractRoot, "schemas/v1");
const catalogRoot = resolve(contractRoot, "catalogs/v1");
const fixtureRoot = resolve(contractRoot, "fixtures/v1");
const draft = "https://json-schema.org/draft/2020-12/schema";
const errors = [];

const jsonFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? jsonFiles(path) : path.endsWith(".json") ? [path] : [];
  });

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${relative(root, path)}: invalid JSON: ${error.message}`);
    return null;
  }
};

const visit = (value, callback) => {
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const child of Object.values(value)) visit(child, callback);
};

const resolvePointer = (document, fragment) => {
  if (!fragment || fragment === "#") return document;
  if (!fragment.startsWith("#/")) return undefined;
  return fragment
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], document);
};

const schemaFiles = jsonFiles(schemaRoot);
const ids = new Set();
for (const path of schemaFiles) {
  const schema = readJson(path);
  if (!schema) continue;
  if (schema.$schema !== draft) errors.push(`${relative(root, path)}: expected JSON Schema 2020-12`);
  if (!schema.$id) errors.push(`${relative(root, path)}: missing $id`);
  else if (ids.has(schema.$id)) errors.push(`${relative(root, path)}: duplicate $id ${schema.$id}`);
  else ids.add(schema.$id);
  visit(schema, (value) => {
    if (typeof value.$ref !== "string") return;
    const hashAt = value.$ref.indexOf("#");
    const targetPart = hashAt < 0 ? value.$ref : value.$ref.slice(0, hashAt);
    const fragment = hashAt < 0 ? "" : value.$ref.slice(hashAt);
    const targetPath = targetPart ? resolve(dirname(path), targetPart) : path;
    if (!existsSync(targetPath)) {
      errors.push(`${relative(root, path)}: unresolved $ref ${value.$ref}`);
      return;
    }
    const target = readJson(targetPath);
    if (target && resolvePointer(target, fragment) === undefined) {
      errors.push(`${relative(root, path)}: unresolved pointer ${value.$ref}`);
    }
  });
}

const common = readJson(resolve(schemaRoot, "common.schema.json"));
const nodes = readJson(resolve(catalogRoot, "lifecycle-nodes.json"));
const events = readJson(resolve(catalogRoot, "canonical-events.json"));
const nodeCodes = common?.$defs?.LifecycleNodeCode?.enum ?? [];
const eventCodes = common?.$defs?.CanonicalEventCode?.enum ?? [];

if (nodes?.length !== 14) errors.push("lifecycle node catalog must contain 14 entries");
if (new Set(nodeCodes).size !== nodeCodes.length) errors.push("LifecycleNodeCode contains duplicates");
if (new Set(eventCodes).size !== eventCodes.length) errors.push("CanonicalEventCode contains duplicates");
if (JSON.stringify(nodes?.map((item) => item.sequence)) !== JSON.stringify(Array.from({ length: 14 }, (_, index) => index + 1))) {
  errors.push("lifecycle node sequence must be exactly 1..14");
}
if (JSON.stringify(nodes?.map((item) => item.nodeCode)) !== JSON.stringify(nodeCodes)) {
  errors.push("node catalog and LifecycleNodeCode enum differ");
}
if (JSON.stringify(events?.map((item) => item.eventCode)) !== JSON.stringify(eventCodes)) {
  errors.push("event catalog and CanonicalEventCode enum differ");
}
for (const event of events ?? []) {
  if (event.eventVersion !== 1) errors.push(`${event.eventCode}: eventVersion must be 1`);
  if (new Set(event.completionEligibleNodeCodes).size !== event.completionEligibleNodeCodes.length) {
    errors.push(`${event.eventCode}: duplicate completion target`);
  }
  for (const nodeCode of event.completionEligibleNodeCodes) {
    if (!nodeCodes.includes(nodeCode)) errors.push(`${event.eventCode}: unknown node ${nodeCode}`);
  }
}

const manifest = readJson(resolve(fixtureRoot, "manifest.json"));
const requiredScenarios = new Set(["success", "rejection", "boundary", "duplicate", "out_of_order", "correction", "revocation", "conflict"]);
for (const file of manifest?.fixtures ?? []) {
  const path = resolve(fixtureRoot, file);
  if (!existsSync(path)) {
    errors.push(`missing fixture ${file}`);
    continue;
  }
  const fixture = readJson(path);
  if (!fixture) continue;
  requiredScenarios.delete(fixture.scenario);
  if (!fixture.description || !Array.isArray(fixture.inputs) || fixture.inputs.length === 0 || !fixture.expected?.outcome) {
    errors.push(`${file}: incomplete fixture`);
  }
  for (const nodeCode of fixture.expected?.appliedNodeCodes ?? []) {
    if (!nodeCodes.includes(nodeCode)) errors.push(`${file}: unknown applied node ${nodeCode}`);
  }
}
if (requiredScenarios.size) errors.push(`missing scenarios: ${[...requiredScenarios].join(", ")}`);

const compatibilitySurface = (value, pointer = "#", output = new Map()) => {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.enum)) output.set(`${pointer}/enum`, new Set(value.enum));
  if (Array.isArray(value.required)) output.set(`${pointer}/required`, new Set(value.required));
  if (typeof value.type === "string") output.set(`${pointer}/type`, value.type);
  for (const [key, child] of Object.entries(value)) {
    compatibilitySurface(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, output);
  }
  return output;
};

for (const path of schemaFiles) {
  const repositoryPath = relative(root, path).replaceAll("\\", "/");
  let previous;
  try {
    previous = JSON.parse(execFileSync("git", ["show", `HEAD:${repositoryPath}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    continue;
  }
  const before = compatibilitySurface(previous);
  const after = compatibilitySurface(readJson(path));
  for (const [pointer, oldValue] of before) {
    const newValue = after.get(pointer);
    if (oldValue instanceof Set) {
      for (const item of oldValue) {
        if (!(newValue instanceof Set) || !newValue.has(item)) errors.push(`${repositoryPath}: breaking removal at ${pointer}: ${item}`);
      }
    } else if (newValue !== oldValue) {
      errors.push(`${repositoryPath}: breaking type change at ${pointer}: ${oldValue} -> ${newValue}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Contract schemas valid: ${schemaFiles.length} schemas, ${nodes.length} nodes, ${events.length} events, ${manifest.fixtures.length} fixtures.`);
}
