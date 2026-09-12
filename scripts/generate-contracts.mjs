import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

// 单一权威源：14 个 JSON Schema 2020-12 文件。本脚本把它们打包成一个自洽根 Schema，
// 再由 json-schema-to-typescript 生成一份去重后的 TypeScript 类型（共享类型只定义一次）。
// 生成文件是派生产物，禁止手工修改；漂移由 `--check` 模式在 CI 阻断。

const root = fileURLToPath(new URL("..", import.meta.url));
const schemaRoot = resolve(root, "packages/contracts/schemas/v1");
const outDir = resolve(root, "packages/contracts/generated");
const outFile = resolve(outDir, "contracts.d.ts");

// 参与类型生成的是 11 份公共契约 Schema；index.json 只是治理索引，
// scenario-fixture / schema-fixture-suite 是测试基础设施，均不生成业务类型。
const CONTRACT_FILES = [
  "common.schema.json",
  "lifecycle-state-machine.schema.json",
  "canonical-event-envelope.schema.json",
  "lifecycle-timeline.schema.json",
  "work-execution.schema.json",
  "evidence-record.schema.json",
  "cross-module-reference.schema.json",
  "action-command.schema.json",
  "client-operation.schema.json",
  "container-operational-view.schema.json",
  "error-response.schema.json",
];

const pascalName = (filename) =>
  filename
    .replace(/\.schema\.json$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const loadSchemas = () => {
  const schemas = new Map();
  for (const filename of CONTRACT_FILES) {
    schemas.set(filename, readJson(resolve(schemaRoot, filename)));
  }
  return schemas;
};

// 顶层是 `type: object` 的文件需要为整份 DTO 生成一个命名类型；其余文件只是 $defs 容器。
const topLevelTypeName = (schema, filename) =>
  schema.type === "object" ? pascalName(filename) : undefined;

const buildTopLevelNames = (schemas) => {
  const names = new Map();
  for (const [filename, schema] of schemas) {
    const name = topLevelTypeName(schema, filename);
    if (name) names.set(filename, name);
  }
  return names;
};

const pascalProperty = (name) =>
  name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

// 收集被 `#/properties/X` 引用的属性目标，统一为其注入 title，
// 避免 jstt 对内联对象自动命名为 Source/Source1 之类无意义名字。
const collectPropertyRefTargets = (schemas) => {
  const targets = new Map(); // file -> Set(propName)
  const record = (file, prop) => {
    if (!targets.has(file)) targets.set(file, new Set());
    targets.get(file).add(prop);
  };
  const walk = (value, currentFile) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") {
      const hashAt = value.$ref.indexOf("#");
      const targetFile = hashAt < 0 ? value.$ref : value.$ref.slice(0, hashAt);
      const fragment = hashAt < 0 ? "" : value.$ref.slice(hashAt);
      const match = fragment.match(/^#\/properties\/([^/]+)$/);
      if (match) record(targetFile || currentFile, match[1]);
    }
    for (const child of Object.values(value)) walk(child, currentFile);
  };
  for (const [filename, schema] of schemas) walk(schema, filename);
  return targets;
};

const injectPropertyTitles = (schemas, topLevelNames) => {
  const targets = collectPropertyRefTargets(schemas);
  for (const [filename, propNames] of targets) {
    const schema = schemas.get(filename);
    for (const prop of propNames) {
      const propSchema = schema?.properties?.[prop];
      if (propSchema && typeof propSchema === "object") {
        propSchema.title = `${topLevelNames.get(filename)}${pascalProperty(prop)}`;
      }
    }
  }
};

const stripMeta = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripMeta);
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$schema" || key === "$id" || key.startsWith("x-")) continue;
    out[key] = stripMeta(child);
  }
  return out;
};

const rewriteRef = (ref, currentFilename, topLevelNames) => {
  if (typeof ref !== "string") return ref;
  const hashAt = ref.indexOf("#");
  const targetFile = hashAt < 0 ? ref : ref.slice(0, hashAt);
  const fragment = hashAt < 0 ? "" : ref.slice(hashAt);

  const syntheticNameFor = (filename) =>
    topLevelNames.get(filename) ?? pascalName(filename);

  if (!targetFile) {
    // 同文件本地引用
    if (!fragment || fragment === "#") return ref;
    if (fragment.startsWith("#/$defs/")) return ref; // 扁平合并后仍指向根 $defs
    // 本地属性级引用（如 #/properties/source）：改指本文件的顶层合成类型
    return `#/$defs/${syntheticNameFor(currentFilename)}${fragment.slice(1)}`;
  }

  // 跨文件引用
  if (!fragment || fragment === "#") {
    return `#/$defs/${syntheticNameFor(targetFile)}`;
  }
  if (fragment.startsWith("#/$defs/")) {
    return `#/$defs/${fragment.slice("#/$defs/".length)}`;
  }
  return `#/$defs/${syntheticNameFor(targetFile)}${fragment.slice(1)}`;
};

const deepRewrite = (value, currentFilename, topLevelNames) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) =>
      deepRewrite(item, currentFilename, topLevelNames),
    );
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] =
      key === "$ref"
        ? rewriteRef(child, currentFilename, topLevelNames)
        : deepRewrite(child, currentFilename, topLevelNames);
  }
  return out;
};

const buildBundle = (schemas, topLevelNames) => {
  const defs = {};
  for (const [filename, schema] of schemas) {
    for (const [defName, defValue] of Object.entries(schema.$defs ?? {})) {
      if (defName in defs) throw new Error(`duplicate $defs name: ${defName}`);
      defs[defName] = deepRewrite(stripMeta(defValue), filename, topLevelNames);
    }
  }
  for (const [filename, name] of topLevelNames) {
    const schema = schemas.get(filename);
    const topLevel = deepRewrite(stripMeta(schema), filename, topLevelNames);
    delete topLevel.$defs;
    delete topLevel.title; // 用 $defs 键名统一命名，避免 title 的 V1 后缀产生不一致
    defs[name] = topLevel;
  }
  return { title: "LogixContractsV1", type: "object", $defs: defs };
};

const banner = `/* eslint-disable */\n/* prettier-ignore */\n// 由 scripts/generate-contracts.mjs 生成，禁止手工修改。\n// 权威源：packages/contracts/schemas/v1/*.schema.json\n`;

const generateTs = async () => {
  const schemas = loadSchemas();
  const topLevelNames = buildTopLevelNames(schemas);
  injectPropertyTitles(schemas, topLevelNames);
  const bundle = buildBundle(schemas, topLevelNames);
  const ts = await compile(bundle, "LogixContractsV1", {
    bannerComment: "",
    unreachableDefinitions: true,
    format: false,
  });
  return `${banner}${ts.replace(/^\/\*\*[\s\S]*?\*\/\n\n/gm, "")}`;
};

const main = async () => {
  const checkOnly = process.argv.includes("--check");
  const generated = await generateTs();

  if (checkOnly) {
    if (!existsSync(outFile)) {
      console.error(
        "contracts.d.ts missing; run `pnpm contract:generate` first",
      );
      process.exitCode = 1;
      return;
    }
    const committed = readFileSync(outFile, "utf8");
    if (committed !== generated) {
      console.error(
        "contracts.d.ts drift detected; run `pnpm contract:generate` and commit the result",
      );
      process.exitCode = 1;
    } else {
      console.log("Contract types in sync with JSON Schema authority.");
    }
    return;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, generated);
  console.log(
    `Generated ${relative(root, outFile)} (${generated.split("\n").length} lines).`,
  );
};

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
