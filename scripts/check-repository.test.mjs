import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { findArchitectureBoundaryViolations } from "./check-architecture-boundaries.mjs";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";
import { analyzeControllerSources } from "./check-route-access-metadata.mjs";
import {
  extractMarkdownTargets,
  findAmbiguousContractPhaseReferences,
  checkWorkbenchCatalogSource,
  inspectWorkbenchCatalogSource,
  inspectWorkbenchRouteSource,
  inspectWorkbenchRouterSource,
  findBrokenMarkdownLinks,
  findStaleWorkbenchBaselineReferences,
  findForbiddenTrackedPaths,
  findMisleadingContractPackageScripts,
  findMissingRequiredPolicyFiles,
  findMissingStyleScaleTokens,
  findRouteAccessViolations,
  findStyleScaleViolations,
  findUiThemeBoundaryViolations,
  runRepositoryChecks,
  validateTaskStatusRecords,
} from "./check-repository.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const CURRENT_WORKBENCH_AUTHORITY_PATHS = [
  "AGENTS.md",
  "doc/cross-border-supply-chain/08-role-workbenches.md",
  "docs/planning/tasks/_template.md",
  "docs/README.md",
  "docs/product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md",
  "docs/product/domain/SHIPMENT_FLOW_OVERVIEW.md",
];

const temporaryDirectories = [];
after(() => {
  temporaryDirectories.forEach((directory) =>
    rmSync(directory, { force: true, recursive: true }),
  );
});

test("current workbench authorities use the approved 23-workbench baseline", () => {
  const violations = findStaleWorkbenchBaselineReferences(
    repositoryRoot,
    CURRENT_WORKBENCH_AUTHORITY_PATHS,
  );
  assert.deepEqual(violations, []);
});

test("workbench catalog declares the approved 23-code baseline", () => {
  const violations = checkWorkbenchCatalogSource(repositoryRoot);
  assert.deepEqual(violations, []);
});

test("repository check entry executes tracked-file checks", () => {
  assert.deepEqual(runRepositoryChecks(), []);
});

test("workbench catalog guard requires the legacy compliance route beside the new stub", () => {
  const root = mkdtempSync(join(tmpdir(), "logixs-workbench-catalog-"));
  temporaryDirectories.push(root);
  const catalogDirectory = join(root, "apps", "web", "src", "data");
  mkdirSync(catalogDirectory, { recursive: true });
  writeFileSync(
    join(catalogDirectory, "workbenchNetwork.ts"),
    readFileSync(
      join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
      "utf8",
    ),
  );
  const routerDirectory = join(root, "apps", "web", "src", "router");
  mkdirSync(routerDirectory, { recursive: true });
  writeFileSync(join(routerDirectory, "index.ts"), "export {}");
  const workbenchNetworkRoutesDirectory = join(
    root,
    "apps",
    "web",
    "src",
    "modules",
    "workbench-network",
  );
  mkdirSync(workbenchNetworkRoutesDirectory, { recursive: true });
  writeFileSync(
    join(workbenchNetworkRoutesDirectory, "routes.ts"),
    readFileSync(
      join(
        repositoryRoot,
        "apps",
        "web",
        "src",
        "modules",
        "workbench-network",
        "routes.ts",
      ),
      "utf8",
    ),
  );
  for (const path of [
    "docs/product/WORKSPACE_UI_INVENTORY.md",
    "docs/product/POST_DEPARTURE_WORKBENCH_DELIVERY_BASELINE.md",
    "doc/cross-border-supply-chain/05-shipment-lifecycle-blueprint.md",
    "doc/cross-border-supply-chain/09-customs-compliance-ai.md",
    "doc/cross-border-supply-chain/13-dcsa-business-map.md",
  ]) {
    const parts = path.split("/");
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(
      join(root, ...parts),
      "路由、页面或 API 存在不等于 `operational` 或 `validated`。",
    );
  }

  assert.deepEqual(checkWorkbenchCatalogSource(root), [
    "apps/web/src/router/index.ts: must retain /compliance separately from /workspaces/compliance-operations",
  ]);
});

test("catalog inspection rejects misleading comments and structural row drift", () => {
  const source = `${readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  )}
// booking export_customs compliance_operations /workspaces/booking
// /workspaces/export-customs /workspaces/compliance-operations
// catalogStage("customs", { title: "进口清关" })`
    .replace(/plannedCatalogStage\(\s*10,[\s\S]*?\n {2}\),/, "")
    .replace(
      'plannedSupportCatalogStage(\n    "compliance_operations"',
      'plannedCatalogStage(\n    21,\n    "compliance_operations"',
    )
    .replace('title: "进口清关"', 'title: "清关"')
    .replace(
      '  catalogStage("charges"),',
      `  plannedSupportCatalogStage(
    "compliance_operations",
    "合规运营",
    "/workspaces/compliance-operations",
    "product",
    "合规运营人员",
    "重复目录桩",
    [],
  ),
  catalogStage("charges"),`,
    );
  const violations = inspectWorkbenchCatalogSource(source);

  for (const expected of [
    "workbenchStages: duplicate code 'compliance_operations'",
    "workbenchStages: duplicate path '/workspaces/compliance-operations'",
    "workbenchStages: code 'booking' is missing",
    "workbenchStages: customs title must be '进口清关', found '清关'",
    "workbenchStages: compliance_operations kind must be 'support', found 'main'",
  ]) {
    assert.ok(violations.includes(expected), `missing violation: ${expected}`);
  }
});

test("catalog route inspection rejects filtered compliance stubs and ignored stage paths", () => {
  const excludedCompliance = `
    export const routes = [...frameworkWorkbenchStages, ...catalogStubWorkbenchStages]
      .filter((stage) => stage.code !== "compliance_operations")
      .map((stage) => ({ path: stage.path }));`;
  const ignoredStagePath = `
    export const routes = [...frameworkWorkbenchStages, ...catalogStubWorkbenchStages].map(
      (stage) => ({ path: "/workspaces/planned" }),
    );`;

  assert.ok(
    inspectWorkbenchRouteSource(excludedCompliance).length > 0,
    "filtered compliance stub route must be rejected",
  );
  assert.ok(
    inspectWorkbenchRouteSource(ignoredStagePath).includes(
      "workbench-network routes: catalog stubs must map each stage.path",
    ),
  );
});

test("catalog inspection ignores commented constructor decoys", () => {
  const source = readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  )
    .replace(
      /plannedCatalogStage\(\s*10,[\s\S]*?\n {2}\),/,
      `// plannedCatalogStage(
    10,
    "booking",
    "订舱",
    "/workspaces/booking",
    "shipment",
    "订舱运营人员",
    "注释诱饵",
    [],
  ),`,
    )
    .replace(
      '  catalogStage("charges"),',
      `  /* plannedCatalogStage(
    10,
    "booking",
    "订舱",
    "/workspaces/booking",
    "shipment",
    "订舱运营人员",
    "块注释诱饵",
    [],
  ), */
  catalogStage("charges"),`,
    );

  const violations = inspectWorkbenchCatalogSource(source);
  assert.ok(violations.includes("workbenchStages: code 'booking' is missing"));
});

test("catalog inspection ignores quoted and template constructor decoys", () => {
  const source = `${readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  ).replace(/plannedCatalogStage\(\s*10,[\s\S]*?\n {2}\),/, "")}
const stringDecoy = 'plannedCatalogStage(10, "booking", "订舱", "/workspaces/booking")';
const templateDecoy = \`plannedCatalogStage(10, "booking", "订舱", "/workspaces/booking")\`;`;

  const violations = inspectWorkbenchCatalogSource(source);
  assert.ok(violations.includes("workbenchStages: code 'booking' is missing"));
});

test("catalog inspection rejects unsupported row shapes", () => {
  const catalog = readWorkbenchCatalogSource();
  const unknownRow = catalog.replace(
    "export const workbenchStages = [",
    "export const workbenchStages = [...extraStages,",
  );

  assert.ok(
    inspectWorkbenchCatalogSource(unknownRow).includes(
      "workbenchStages: unsupported element 'SpreadElement'",
    ),
  );
});

test("catalog inspection rejects spread overrides", () => {
  const spreadOverride = readWorkbenchCatalogSource().replace(
    'catalogStage("customs", { sequence: 16, title: "进口清关" })',
    'catalogStage("customs", { ...customsOverride, sequence: 16, title: "进口清关" })',
  );

  assert.ok(
    inspectWorkbenchCatalogSource(spreadOverride).includes(
      "workbenchStages: catalogStage overrides must not use spread properties",
    ),
  );
});

test("catalog inspection rejects dynamic override values", () => {
  const dynamicOverride = readWorkbenchCatalogSource().replace(
    'catalogStage("market_signals")',
    'catalogStage("market_signals", { sequence: currentSequence })',
  );

  assert.ok(
    inspectWorkbenchCatalogSource(dynamicOverride).includes(
      "workbenchStages: catalogStage override 'sequence' must be a literal",
    ),
  );
});

function readWorkbenchCatalogSource() {
  return readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  );
}

test("route inspection ignores decoy snippets outside the exported route initializer", () => {
  const commentDecoy = `
    // export const decoy = [...frameworkWorkbenchStages, ...catalogStubWorkbenchStages].map(
    //   (stage) => ({ path: stage.path }),
    // );
    export const workbenchNetworkRoutes = [{ path: "/workspaces" }];`;
  const deadDecoy = `
    const decoy = [...frameworkWorkbenchStages, ...catalogStubWorkbenchStages].map(
      (stage) => ({ path: stage.path }),
    );
    export const workbenchNetworkRoutes = [...catalogStubWorkbenchStages].map(
      (stage) => ({ path: "/workspaces/planned" }),
    );`;

  assert.ok(
    inspectWorkbenchRouteSource(commentDecoy).includes(
      "workbench-network routes: catalog stubs must map catalogStubWorkbenchStages",
    ),
  );
  assert.ok(
    inspectWorkbenchRouteSource(deadDecoy).includes(
      "workbench-network routes: catalog stubs must map each stage.path",
    ),
  );
});

test("route inspection rejects array transforms other than map", () => {
  const transformed = `
    export const workbenchNetworkRoutes = [
      ...frameworkWorkbenchStages,
      ...catalogStubWorkbenchStages,
    ]
      .filter(() => true)
      .map((stage) => ({ path: stage.path }));`;

  assert.ok(
    inspectWorkbenchRouteSource(transformed).includes(
      "workbench-network routes: unsupported array transform 'filter'",
    ),
  );
});

test("route inspection rejects transforms applied only to framework stages", () => {
  const transformed = `
    export const workbenchNetworkRoutes = [
      ...frameworkWorkbenchStages.filter((stage) => stage.code !== "booking"),
      ...catalogStubWorkbenchStages,
    ].map((stage) => ({ path: stage.path }));`;

  assert.ok(
    inspectWorkbenchRouteSource(transformed).includes(
      "workbench-network routes: unsupported array transform 'filter'",
    ),
  );
});

test("route inspection rejects slice applied to catalog stub stages", () => {
  const transformed = `
    export const workbenchNetworkRoutes = [
      ...frameworkWorkbenchStages,
      ...catalogStubWorkbenchStages.slice(0, 1),
    ].map((stage) => ({ path: stage.path }));`;

  assert.ok(
    inspectWorkbenchRouteSource(transformed).includes(
      "workbench-network routes: unsupported array transform 'slice'",
    ),
  );
});

test("router inspection ignores a nested router that shadows the top-level router", () => {
  const source = `
    function decoy() { const router = createRouter({ routes: [{ path: "/compliance" }] }); }
    // { path: "/compliance" }
    const router = createRouter({ routes: [{ path: "/tasks" }] });`;

  assert.deepEqual(inspectWorkbenchRouterSource(source), [
    "router: must retain /compliance separately from /workspaces/compliance-operations",
  ]);
});

test("router inspection ignores quoted and template path decoys", () => {
  const source = `
    const router = createRouter({
      routes: [{
        path: "/tasks",
        stringDecoy: 'path: "/compliance"',
        templateDecoy: \`path: "/compliance"\`,
      }],
    });`;

  assert.deepEqual(inspectWorkbenchRouterSource(source), [
    "router: must retain /compliance separately from /workspaces/compliance-operations",
  ]);
});

test("catalog inspection validates baseline values", () => {
  const source = readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  ).replace("total: 23", "total: 20");
  const violations = inspectWorkbenchCatalogSource(source);

  assert.ok(
    violations.includes("workbenchBaseline: total must be 23, found '20'"),
  );
});

test("catalog inspection reads kind from an arrow helper return value", () => {
  const source = readFileSync(
    join(repositoryRoot, "apps", "web", "src", "data", "workbenchNetwork.ts"),
    "utf8",
  ).replace('kind: "support",\n  phase,', 'kind: "main",\n  phase,');
  const violations = inspectWorkbenchCatalogSource(source);

  assert.ok(violations.some((violation) => violation.includes("support rows")));
});

test("requires every style scale token to be defined", () => {
  assert.deepEqual(
    findMissingStyleScaleTokens(`
      :root[data-ui-theme="logix"] {
        --text-page: 20px;
        --text-title: 15px;
        --text-body: 14px;
        --space-1: 4px;
      }
    `),
    [
      "tokens.css 缺少 --text-meta",
      "tokens.css 缺少 --text-label",
      "tokens.css 缺少 --text-micro",
      "tokens.css 缺少 --leading-tight",
      "tokens.css 缺少 --leading-title",
      "tokens.css 缺少 --leading-dense",
      "tokens.css 缺少 --leading-body",
      "tokens.css 缺少 --leading-prose",
      "tokens.css 缺少 --space-2",
      "tokens.css 缺少 --space-3",
      "tokens.css 缺少 --space-4",
      "tokens.css 缺少 --space-5",
      "tokens.css 缺少 --space-6",
      "tokens.css 缺少 --space-8",
    ],
  );
});

test("accepts a complete style scale token set", () => {
  const complete = [
    "--text-page: 20px",
    "--text-title: 15px",
    "--text-body: 14px",
    "--text-meta: 13px",
    "--text-label: 12px",
    "--text-micro: 11px",
    "--leading-tight: 1.1",
    "--leading-title: 1.3",
    "--leading-dense: 1.4",
    "--leading-body: 1.55",
    "--leading-prose: 1.6",
    "--space-1: 4px",
    "--space-2: 8px",
    "--space-3: 12px",
    "--space-4: 16px",
    "--space-5: 20px",
    "--space-6: 24px",
    "--space-8: 32px",
  ].join(";\n");
  assert.deepEqual(findMissingStyleScaleTokens(complete), []);
});

test("rejects literal font sizes and off-scale spacing", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Demo.vue",
        source: `<template><div /></template>
<style scoped>
.a { font-size: 14px; padding: 10px; }
.b { font-size: var(--text-body); padding: var(--space-3); }
</style>`,
      },
    ]),
    [
      "apps/web/src/views/Demo.vue: font-size 不得写裸值 '14px'，请改用 var(--text-*) 令牌",
      "apps/web/src/views/Demo.vue: padding 不得写裸值 '10px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
    ],
  );
});

test("accepts tokens, zero, auto and calc over space tokens", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Ok.vue",
        source: `<style scoped>
.a { margin: 0 auto; gap: var(--space-2); padding: var(--space-1) var(--space-3); }
.b { margin-top: calc(var(--space-2) * -1); }
</style>`,
      },
    ]),
    [],
  );
});

test("checks every part of a shorthand（裸 px 一律不认，含在档上的 12px）", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Short.vue",
        source: "<style scoped>\n.a { margin: 12px 10px 6px; }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Short.vue: margin 不得写裸值 '12px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
      "apps/web/src/views/Short.vue: margin 不得写裸值 '10px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
      "apps/web/src/views/Short.vue: margin 不得写裸值 '6px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
    ],
  );
});

test("catches declarations packed onto one line", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Packed.vue",
        source:
          "<style scoped>\n.a { position: relative; font-size: 10px; gap: 10px; }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Packed.vue: font-size 不得写裸值 '10px'，请改用 var(--text-*) 令牌",
      "apps/web/src/views/Packed.vue: gap 不得写裸值 '10px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
    ],
  );
});

test("checks logical spacing properties too", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Logical.vue",
        source:
          "<style scoped>\n.a { padding-inline: 14px; margin-block-start: var(--space-2); }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Logical.vue: padding-inline 不得写裸值 '14px'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
    ],
  );
});

test("rejects a font shorthand that hides a literal size", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Shorthand.vue",
        source:
          "<style scoped>\n.a { font: 10px var(--font-mono); }\n.b { font: inherit; }\n.c { font: var(--text-body) var(--font-sans); }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Shorthand.vue: font 简写里的字号不得写裸值，请改用 var(--text-*) 令牌（当前为 '10px var(--font-mono)'）",
    ],
  );
});

test("accepts approved font weights and rejects removed tokens or unsupported values", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Weight.vue",
        source: `<style scoped>
.a { font-weight: 400; }
.b { font-weight: 600; }
.c { font-weight: 700; }
.d { font-weight: inherit; }
.e { font-weight: normal; }
.f { font-weight: bold; }
.g { font-weight: var(--weight-strong); }
.h { font-weight: 650; }
.i { font-weight: 500; }
</style>`,
      },
    ]),
    [
      "apps/web/src/views/Weight.vue: font-weight 只允许 400 / 600 / 700（或 inherit / normal / bold），当前为 'var(--weight-strong)'",
      "apps/web/src/views/Weight.vue: font-weight 只允许 400 / 600 / 700（或 inherit / normal / bold），当前为 '650'",
      "apps/web/src/views/Weight.vue: font-weight 只允许 400 / 600 / 700（或 inherit / normal / bold），当前为 '500'",
    ],
  );
});

test("rejects every literal line-height, including unitless ratios", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Leading.vue",
        source: `<style scoped>
.a { line-height: var(--leading-body); }
.b { line-height: inherit; }
.c { line-height: 1.5; }
.d { line-height: 24px; }
</style>`,
      },
    ]),
    [
      "apps/web/src/views/Leading.vue: line-height 不得写裸值 '1.5'，请改用 var(--leading-*) 令牌（title 1.3 / dense 1.4 / body 1.55 / prose 1.6）",
      "apps/web/src/views/Leading.vue: line-height 不得写裸值 '24px'，请改用 var(--leading-*) 令牌（title 1.3 / dense 1.4 / body 1.55 / prose 1.6）",
    ],
  );
});

test("accepts an exemption on a font-weight or line-height line", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Exempt.vue",
        source: `<style scoped>
.a { line-height: 14px; /* style-scale-exempt: 与状态点垂直对齐 */ }
.b { font-weight: 800; /* style-scale-exempt: 装饰性品牌符号 */ }
</style>`,
      },
    ]),
    [],
  );
});

test("accepts fluid functions but still rejects calc over bare px", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Fluid.vue",
        source:
          "<style scoped>\n.a { padding: min(16vh, 140px) var(--space-4); }\n.b { padding: calc(10px); }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Fluid.vue: padding 不得写裸值 'calc(10px)'，请改用 var(--space-*) 令牌（4/8/12/16/20/24/32）",
    ],
  );
});

test("accepts an exemption that states a reason", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Ok.vue",
        source:
          "<style scoped>\n.a { margin-top: -1px; /* style-scale-exempt: 与 1px 边框对齐 */ }\n</style>",
      },
    ]),
    [],
  );
});

test("rejects an exemption without a real reason", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Bad.vue",
        source:
          "<style scoped>\n.a { margin-top: -1px; /* style-scale-exempt: 先这样 */ }\n</style>",
      },
    ]),
    ["apps/web/src/views/Bad.vue: 豁免必须写明理由（≥4 字），当前为 '先这样'"],
  );
});

test("ignores token definitions, tests and non-web files", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/themes/logix/tokens.css",
        source: ":root { --space-9: 36px; font-size: 10px; }",
      },
      {
        path: "apps/web/src/views/Demo.test.ts",
        source: "const a = 'font-size: 10px';",
      },
      {
        path: "docs/notes.md",
        source: "font-size: 10px",
      },
    ]),
    [],
  );
});

test("reports every violation now that the migration baseline is gone", () => {
  assert.deepEqual(
    findStyleScaleViolations([
      {
        path: "apps/web/src/views/Legacy.vue",
        source: "<style scoped>\n.a { font-size: 10px; }\n</style>",
      },
    ]),
    [
      "apps/web/src/views/Legacy.vue: font-size 不得写裸值 '10px'，请改用 var(--text-*) 令牌",
    ],
  );
});

test("db:migrate applies pending history without a shadow database", () => {
  const manifest = JSON.parse(readFileSync(join("package.json"), "utf8"));
  const migrationRunner = readFileSync(
    join("scripts", "migrate-deploy.mjs"),
    "utf8",
  );
  assert.equal(
    manifest.scripts["db:migrate"],
    "node scripts/migrate-deploy.mjs",
  );
  assert.match(migrationRunner, /"migrate", "deploy"/);
  assert.doesNotMatch(manifest.scripts["db:migrate"], /migrate dev/);
});

test("migration recovery matches only the immutable empty-database failure", () => {
  const knownFailure = `
Migration name: 20260913011044_inbox
Database error code: 42P01
ERROR: relation "outbox_replay_request" does not exist`;
  assert.equal(isKnownEmptyDatabaseFailure(knownFailure), true);
  assert.equal(
    isKnownEmptyDatabaseFailure(knownFailure.replace("42P01", "42501")),
    false,
  );
  assert.equal(
    isKnownEmptyDatabaseFailure(
      knownFailure.replace("20260913011044_inbox", "another_migration"),
    ),
    false,
  );
  assert.equal(
    isKnownEmptyDatabaseFailure(
      "P3009: 20260913011044_inbox previously failed",
    ),
    false,
  );
});

test("retained import source metadata cannot contain null columns", () => {
  const migrationRoot = join("database", "migrations");
  const sourceRetentionSql = readdirSync(migrationRoot)
    .filter((name) => name.includes("import_source_file"))
    .map((name) =>
      readFileSync(join(migrationRoot, name, "migration.sql"), "utf8"),
    )
    .join("\n");

  for (const column of [
    "source_object_key",
    "source_content_type",
    "source_size_bytes",
    "source_retained_at",
  ]) {
    assert.match(sourceRetentionSql, new RegExp(`"${column}" IS NOT NULL`));
  }
});

test("requires CODEOWNERS as a tracked policy file", () => {
  assert.deepEqual(findMissingRequiredPolicyFiles(["README.md"]), [
    ".github/CODEOWNERS: required repository policy file is missing",
  ]);
  assert.deepEqual(
    findMissingRequiredPolicyFiles([".github/CODEOWNERS", "README.md"]),
    [],
  );
});

test("rejects generated output, evidence scratch files, competing lockfiles, logs, and real env files", () => {
  assert.deepEqual(
    findForbiddenTrackedPaths([
      "apps/web/src/main.ts",
      "apps/web/node_modules/vue/index.js",
      "apps/web/dist/index.html",
      "generated/prisma/index.d.ts",
      "tmp/pdfs/customs-batch-012/customs-1.png",
      "server.log",
      "apps/web/package-lock.json",
      "packages/domain/pnpm-lock.yaml",
      ".env.production",
      ".env.example",
    ]),
    [
      "apps/web/node_modules/vue/index.js",
      "apps/web/dist/index.html",
      "generated/prisma/index.d.ts",
      "tmp/pdfs/customs-batch-012/customs-1.png",
      "server.log",
      "apps/web/package-lock.json",
      "packages/domain/pnpm-lock.yaml",
      ".env.production",
    ],
  );
});

const taskRecord = ({
  path,
  status,
  writer,
  dependsOn = [],
  writeScopes = [],
  exclusiveLocks = [],
  sharedIntegrationScopes = [],
}) => ({
  path: `${path}.md`,
  source: `---
status: ${status}
branch: feat/${path}
owner: codex
${writer ? `writer: ${writer}\n` : ""}risk: medium
dependsOn: [${dependsOn.join(", ")}]
writeScopes:${writeScopes.length === 0 ? " []" : `\n${writeScopes.map((scope) => `  - ${scope}`).join("\n")}`}
exclusiveLocks:${exclusiveLocks.length === 0 ? " []" : `\n${exclusiveLocks.map((lock) => `  - ${lock}`).join("\n")}`}
sharedIntegrationScopes:${sharedIntegrationScopes.length === 0 ? " []" : `\n${sharedIntegrationScopes.map((scope) => `  - ${scope}`).join("\n")}`}
authorityRefs:
  - AGENTS.md
---`,
});

test("allows two non-conflicting write tasks plus design and read-only review", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "authz",
        status: "fix",
        writer: "cursor",
        writeScopes: ["apps/api/src/modules/identity/**"],
        exclusiveLocks: ["authz-control-plane"],
        sharedIntegrationScopes: ["package.json"],
      }),
      taskRecord({
        path: "dictionary",
        status: "coding",
        writer: "codex",
        writeScopes: ["database/dictionary/**"],
        exclusiveLocks: ["database-dictionary"],
        sharedIntegrationScopes: ["package.json"],
      }),
      taskRecord({
        path: "design",
        status: "design",
        writer: "architect",
        writeScopes: ["docs/architecture/decisions/new-decision.md"],
        exclusiveLocks: ["business-policy:new-decision"],
      }),
      taskRecord({ path: "review-one", status: "review" }),
      taskRecord({ path: "review-two", status: "review" }),
    ]),
    [],
  );
});

test("requires scheduling metadata for design tasks that may write authority", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      { path: "design.md", source: "---\nstatus: design\n---" },
    ]),
    [
      "design.md: active write task is missing owner",
      "design.md: active write task is missing writer",
      "design.md: active write task is missing risk",
      "design.md: active write task is missing dependsOn",
      "design.md: active write task is missing writeScopes",
      "design.md: active write task is missing exclusiveLocks",
      "design.md: active write task is missing sharedIntegrationScopes",
      "design.md: active write task is missing authorityRefs",
    ],
  );
});

test("checks design tasks for writer, scope, and lock conflicts without counting them toward write WIP", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "cursor",
        writeScopes: ["apps/api/**"],
        exclusiveLocks: ["public-contracts"],
      }),
      taskRecord({
        path: "two",
        status: "fix",
        writer: "codex",
        writeScopes: ["apps/web/**"],
        exclusiveLocks: ["module:web"],
      }),
      taskRecord({
        path: "design",
        status: "design",
        writer: "cursor",
        writeScopes: ["apps/api/src/contracts/**"],
        exclusiveLocks: ["public-contracts"],
      }),
    ]),
    [
      "active write tasks share writer 'cursor': one.md, design.md",
      "active write task scopes overlap 'apps/api/**' and 'apps/api/src/contracts/**': one.md, design.md",
      "active write tasks share exclusive lock 'public-contracts': one.md, design.md",
    ],
  );
});

test("rejects a third write task and a third review task", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "cursor",
        writeScopes: ["apps/api/**"],
        exclusiveLocks: ["module:api"],
      }),
      taskRecord({
        path: "two",
        status: "fix",
        writer: "codex",
        writeScopes: ["apps/web/**"],
        exclusiveLocks: ["module:web"],
      }),
      taskRecord({
        path: "three",
        status: "coding",
        writer: "other",
        writeScopes: ["workers/**"],
        exclusiveLocks: ["module:worker"],
      }),
      taskRecord({ path: "review-one", status: "review" }),
      taskRecord({ path: "review-two", status: "review" }),
      taskRecord({ path: "review-three", status: "review" }),
    ]),
    [
      "write task WIP limit exceeded (max 2): one.md, two.md, three.md",
      "review task WIP limit exceeded (max 2): review-one.md, review-two.md, review-three.md",
    ],
  );
});

test("rejects missing scheduling metadata for coding and fix tasks", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      { path: "one.md", source: "---\nstatus: coding\n---" },
    ]),
    [
      "one.md: active write task is missing owner",
      "one.md: active write task is missing writer",
      "one.md: active write task is missing risk",
      "one.md: active write task is missing dependsOn",
      "one.md: active write task is missing writeScopes",
      "one.md: active write task is missing exclusiveLocks",
      "one.md: active write task is missing sharedIntegrationScopes",
      "one.md: active write task is missing authorityRefs",
    ],
  );
});

test("rejects overlapping write scopes, locks, writers, and unfinished dependencies", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "cursor",
        writeScopes: ["apps/api/**"],
        exclusiveLocks: ["public-contracts"],
        dependsOn: ["foundation"],
      }),
      taskRecord({
        path: "two",
        status: "fix",
        writer: "cursor",
        writeScopes: ["apps/api/src/modules/identity/**"],
        exclusiveLocks: ["public-contracts"],
      }),
      taskRecord({ path: "foundation", status: "blocked" }),
    ]),
    [
      "one.md: dependency 'foundation' is not done (status: blocked)",
      "active write tasks share writer 'cursor': one.md, two.md",
      "active write task scopes overlap 'apps/api/**' and 'apps/api/src/modules/identity/**': one.md, two.md",
      "active write tasks share exclusive lock 'public-contracts': one.md, two.md",
    ],
  );
});

test("rejects unsupported write scope patterns", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "cursor",
        writeScopes: ["apps/*/src/**", "../outside/**"],
        exclusiveLocks: ["module:api"],
      }),
    ]),
    [
      "one.md: writeScopes entry 'apps/*/src/**' must be an exact repository path or a directory ending in /**",
      "one.md: writeScopes entry '../outside/**' must stay within the repository",
    ],
  );
});

test("normalizes Windows path casing when checking scope overlap", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "cursor",
        writeScopes: ["Apps/API/**"],
        exclusiveLocks: ["module:one"],
      }),
      taskRecord({
        path: "two",
        status: "fix",
        writer: "codex",
        writeScopes: ["apps/api/src/main.ts"],
        exclusiveLocks: ["module:two"],
      }),
    ]),
    [
      "active write task scopes overlap 'Apps/API/**' and 'apps/api/src/main.ts': one.md, two.md",
    ],
  );
});

test("rejects unstable writer, lock, and repeated path separator values", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      taskRecord({
        path: "one",
        status: "coding",
        writer: "Cursor",
        writeScopes: ["apps//api/**"],
        exclusiveLocks: ["Module API"],
      }),
    ]),
    [
      "one.md: writer 'Cursor' must be a stable lowercase code",
      "one.md: writeScopes entry 'apps//api/**' must stay within the repository",
      "one.md: exclusiveLocks entry 'Module API' must be a stable lowercase code",
    ],
  );
});

test("requires traceable verification evidence before a task is done", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      { path: "done.md", source: "---\nstatus: done\nverification:\n---" },
    ]),
    ["done.md: done task is missing verification evidence"],
  );
});

test("extracts inline and reference markdown targets", () => {
  assert.deepEqual(
    extractMarkdownTargets(
      "[one](./one.md)\n[two]: <../two.md>\n![img](a.png)",
    ),
    ["./one.md", "a.png", "../two.md"],
  );
});

test("reports missing relative markdown targets and ignores external links", () => {
  const directory = mkdtempSync(join(tmpdir(), "logixs-repo-check-"));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, "docs"));
  writeFileSync(join(directory, "exists.md"), "# Exists\n");
  const sourcePath = join(directory, "docs", "source.md");
  writeFileSync(
    sourcePath,
    "[ok](../exists.md) [missing](./missing.md) [web](https://example.com)",
  );

  const errors = findBrokenMarkdownLinks([sourcePath]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing\.md/);
});

test("rejects ambiguous P6/P7 references in global contract authorities", () => {
  assert.deepEqual(
    findAmbiguousContractPhaseReferences([
      {
        path: "node-catalog.md",
        source: "P6 creates schemas; types remain for P7.",
      },
      {
        path: "qualified.md",
        source: "项目 `P6` is a vertical slice; P6.1 is a sign-off record.",
      },
    ]),
    [
      "node-catalog.md:1: ambiguous phase 'P6'; use 'G6' for global-contract task stages or qualify it as a project phase",
      "node-catalog.md:1: ambiguous phase 'P7'; use 'G7' for global-contract task stages or qualify it as a project phase",
    ],
  );
});

test("qualifies explicit project phases and still catches lowercase tokens", () => {
  assert.deepEqual(
    findAmbiguousContractPhaseReferences([
      {
        path: "qualified.md",
        source:
          "项目阶段 P6 与项目**P7** 顺序固定；见（项目 P6）记录；G6 建源，G7 派生；P6.1 已签署。",
      },
      {
        path: "ambiguous.md",
        source: "该项目不使用 p6 阶段号。",
      },
    ]),
    [
      "ambiguous.md:1: ambiguous phase 'p6'; use 'G6' for global-contract task stages or qualify it as a project phase",
    ],
  );
});

test("rejects contract schema validation aliases for unimplemented package capabilities", () => {
  assert.deepEqual(
    findMisleadingContractPackageScripts({
      scripts: {
        "contract:check": "node ../../scripts/validate-contract-schemas.mjs",
        lint: "node ../../scripts/validate-contract-schemas.mjs",
        typecheck: "tsc --noEmit",
        test: "node --test",
      },
    }),
    [
      "packages/contracts/package.json: 'lint' must not alias contract:check; leave it unconfigured until the capability exists",
    ],
  );
  assert.deepEqual(
    findMisleadingContractPackageScripts({
      scripts: {
        "contract:check": "node ../../scripts/validate-contract-schemas.mjs",
      },
    }),
    [],
  );
});

test("enforces the stable UI theme boundary", () => {
  assert.deepEqual(
    findUiThemeBoundaryViolations([
      {
        path: "apps/web/src/views/Tasks.vue",
        source: 'import Shell from "../themes/logix/LogixAppShell.vue";',
      },
      {
        path: "apps/web/src/components/Status.vue",
        source: 'import "../../../workspace-reference/style.css";',
      },
      {
        path: "apps/web/src/components/Remote.vue",
        source: 'import "https://cdn.example.com/template.css";',
      },
      {
        path: "apps/web/src/styles/legacy.css",
        source: '@import url("../../../../workspace-reference/style.css");',
      },
      {
        path: "apps/web/src/views/Lazy.vue",
        source: 'const shell = import("../themes/logix/LogixAppShell.vue");',
      },
      {
        path: "apps/web/src/ui-theme/activeTheme.ts",
        source: 'import { logixTheme } from "../themes/logix";',
      },
      {
        path: "apps/web/src/themes/logix/theme.test.ts",
        source: 'import Header from "./LogixPageHeader.vue";',
      },
    ]),
    [
      "apps/web/src/views/Tasks.vue: must use the stable UI facade instead of '../themes/logix/LogixAppShell.vue'",
      "apps/web/src/components/Status.vue: runtime import outside the web source boundary '../../../workspace-reference/style.css'",
      "apps/web/src/components/Remote.vue: runtime import from an external URL 'https://cdn.example.com/template.css'",
      "apps/web/src/styles/legacy.css: runtime import outside the web source boundary '../../../../workspace-reference/style.css'",
      "apps/web/src/views/Lazy.vue: must use the stable UI facade instead of '../themes/logix/LogixAppShell.vue'",
    ],
  );
});

test("allows the current composition-root and shipment-registry skeleton", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/app.module.ts",
        source:
          'import { ShipmentRegistryModule } from "./modules/shipment-registry";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/domain/container-summary.ts",
        source:
          'import type { ContainerLifecycleState } from "@logix/contracts";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/application/list-containers.service.ts",
        source:
          'import { Inject, Injectable } from "@nestjs/common";\nimport type { ContainerSummary } from "../domain/container-summary";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts",
        source:
          'import { PrismaService } from "../../../prisma/prisma.service";\nimport { PrismaClient } from "../../../../../generated/prisma";',
      },
      {
        path: "apps/api/src/prisma/prisma.service.ts",
        source: 'import { PrismaClient } from "../../../../generated/prisma";',
      },
      {
        path: "apps/api/src/modules/workflow/workflow.service.ts",
        source: 'import { Client } from "@temporalio/client";',
      },
      {
        path: "apps/web/src/api/containers.ts",
        source:
          'import type { ContainerLifecycleState } from "@logix/contracts";',
      },
      {
        path: "apps/ai-service/app/main.py",
        source:
          "from fastapi import FastAPI\nfrom .capabilities import CAPABILITIES",
      },
      {
        path: "apps/api/src/modules/shipment-registry/application/list-containers.service.ts",
        source: 'import type { PublicPort } from "../../lifecycle-control";',
      },
    ]),
    [],
  );
});

test("rejects domain frameworks, Prisma leaks, and cross-module internals", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/modules/shipment-registry/domain/container-summary.ts",
        source: 'import { Injectable } from "@nestjs/common";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/domain/container-summary.ts",
        source: 'import { PrismaClient } from "@prisma/client";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/domain/container-summary.ts",
        source:
          'import { PrismaClient } from "../../../../../../generated/prisma";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/application/list-containers.service.ts",
        source:
          'import { PrismaContainerRepository } from "../../lifecycle-control/infrastructure/store";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/domain/rules.ts",
        source:
          'import { LifecycleControlModule } from "../../lifecycle-control";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/domain/rules.ts",
        source:
          'import { PrismaContainerRepository } from "../infrastructure/prisma-container.repository";',
      },
    ]),
    [
      "apps/api/src/modules/shipment-registry/domain/container-summary.ts: domain cannot import web or application frameworks '@nestjs/common'",
      "apps/api/src/modules/shipment-registry/domain/container-summary.ts: Prisma is limited to infrastructure, prisma, and health '@prisma/client'",
      "apps/api/src/modules/shipment-registry/domain/container-summary.ts: domain cannot import persistence or workflow runtimes '@prisma/client'",
      "apps/api/src/modules/shipment-registry/domain/container-summary.ts: Prisma is limited to infrastructure, prisma, and health '../../../../../../generated/prisma'",
      "apps/api/src/modules/shipment-registry/application/list-containers.service.ts: cannot import another module's internal path '../../lifecycle-control/infrastructure/store'",
      "apps/api/src/modules/shipment-registry/domain/rules.ts: domain cannot import other modules '../../lifecycle-control'",
      "apps/api/src/modules/shipment-registry/domain/rules.ts: domain cannot depend on application, presentation, or infrastructure '../infrastructure/prisma-container.repository'",
    ],
  );
});

test("rejects web, package, AI, vendor, and Temporal boundary leaks", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/web/src/api/containers.ts",
        source: 'import { PrismaClient } from "@prisma/client";',
      },
      {
        path: "apps/web/src/views/RealContainerList.vue",
        source:
          'import { ContainersController } from "../../../api/src/modules/shipment-registry/presentation/containers.controller";',
      },
      {
        path: "packages/contracts/index.d.ts",
        source: 'import { AppModule } from "../../apps/api/src/app.module";',
      },
      {
        path: "apps/ai-service/app/main.py",
        source: "from prisma import Client",
      },
      {
        path: "apps/api/src/modules/customs-compliance/customs-compliance.module.ts",
        source: 'import OpenAI from "openai";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/application/list-containers.service.ts",
        source: 'import { Client } from "@temporalio/client";',
      },
      {
        path: "apps/api/src/modules/shipment-registry/presentation/containers.controller.ts",
        source: 'import { WorkflowModule } from "../../workflow";',
      },
    ]),
    [
      "apps/web/src/api/containers.ts: web must reach the business API over HTTP, not import '@prisma/client'",
      "apps/web/src/api/containers.ts: Prisma is limited to infrastructure, prisma, and health '@prisma/client'",
      "apps/web/src/views/RealContainerList.vue: web cannot import the business API or database '../../../api/src/modules/shipment-registry/presentation/containers.controller'",
      "packages/contracts/index.d.ts: packages cannot depend on apps or workers '../../apps/api/src/app.module'",
      "apps/ai-service/app/main.py: Prisma is limited to infrastructure, prisma, and health 'prisma'",
      "apps/ai-service/app/main.py: AI surfaces cannot import business persistence 'prisma'",
      "apps/api/src/modules/customs-compliance/customs-compliance.module.ts: business code cannot call model vendors; use AI Gateway / AI Service 'openai'",
      "apps/api/src/modules/shipment-registry/application/list-containers.service.ts: only the workflow module and workers may import Temporal '@temporalio/client'",
      "apps/api/src/modules/shipment-registry/presentation/containers.controller.ts: controllers cannot import other modules; call the local use case '../../workflow'",
    ],
  );
});

test("keeps engines pure and isolated from each other", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/modules/inland-fulfillment/application/draft-inland-plan.service.ts",
        source:
          'import { draftInlandPlan } from "../engines/inland-plan";\nimport { evaluateDailySlots } from "../engines/occupancy-slot";\nimport { COMPUTE_OVERDUE_DEADLINES } from "../../charges-settlement";',
      },
      {
        path: "apps/api/src/modules/charges-settlement/application/compute-overdue-accrual.service.ts",
        source:
          'import { applyFreePeriod } from "../engines/overdue-deadlines";\nimport { computeOverdueAccrual } from "../engines/overdue-accrual";',
      },
      {
        path: "apps/api/src/modules/charges-settlement/engines/overdue-deadlines/compute-overdue-deadlines.ts",
        source: 'import { applyFreePeriod } from "./apply-free-period";',
      },
    ]),
    [],
  );

  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts",
        source: 'import { Injectable } from "@nestjs/common";',
      },
      {
        path: "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts",
        source:
          'import { computeOverdueDeadlines } from "../../../charges-settlement/engines/overdue-deadlines";',
      },
      {
        path: "apps/api/src/modules/charges-settlement/engines/overdue-accrual/compute-overdue-accrual.ts",
        source: 'import { applyFreePeriod } from "../overdue-deadlines";',
      },
      {
        path: "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts",
        source: 'import { evaluateDailySlots } from "../occupancy-slot";',
      },
      {
        path: "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts",
        source:
          'import { COMPUTE_OVERDUE_DEADLINES } from "../../../charges-settlement";',
      },
    ]),
    [
      "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts: engine cannot import web or application frameworks '@nestjs/common'",
      "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts: engines cannot import other engines; the use case orchestrates '../../../charges-settlement/engines/overdue-deadlines'",
      "apps/api/src/modules/charges-settlement/engines/overdue-accrual/compute-overdue-accrual.ts: engines cannot import other engines; the use case orchestrates '../overdue-deadlines'",
      "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts: engines cannot import other engines; the use case orchestrates '../occupancy-slot'",
      "apps/api/src/modules/inland-fulfillment/engines/inland-plan/draft-inland-plan.ts: engines cannot import other modules; the use case orchestrates '../../../charges-settlement'",
    ],
  );
});

test("module manifests must exist and reference known module ids", async () => {
  const { findModuleManifestViolations } =
    await import("./check-module-manifests.mjs");
  const root = mkdtempSync(join(tmpdir(), "logix-manifests-"));
  temporaryDirectories.push(root);
  const modulesDir = join(root, "modules");
  mkdirSync(join(modulesDir, "identity"), { recursive: true });
  writeFileSync(
    join(modulesDir, "identity", "identity.module.ts"),
    "export {}",
  );
  writeFileSync(
    join(modulesDir, "identity", "module.manifest.ts"),
    `export const moduleManifest = {
  id: "identity",
  kind: "base",
  version: "1.0.0",
  depends: [],
  permissions: [],
};`,
  );
  mkdirSync(join(modulesDir, "broken"), { recursive: true });
  writeFileSync(join(modulesDir, "broken", "broken.module.ts"), "export {}");
  writeFileSync(
    join(modulesDir, "broken", "module.manifest.ts"),
    `export const moduleManifest = {
  id: "wrong",
  kind: "incremental",
  version: "1.0.0",
  depends: ["missing-mod", "wrong"],
  permissions: [],
};`,
  );
  mkdirSync(join(modulesDir, "orphan"), { recursive: true });
  writeFileSync(join(modulesDir, "orphan", "orphan.module.ts"), "export {}");

  const errors = findModuleManifestViolations({
    modulesDirectory: modulesDir,
  }).sort();
  assert.deepEqual(errors, [
    "apps/api/src/modules/broken/module.manifest.ts: depends cannot include self",
    "apps/api/src/modules/broken/module.manifest.ts: depends references unknown module 'missing-mod'",
    "apps/api/src/modules/broken/module.manifest.ts: depends references unknown module 'wrong'",
    "apps/api/src/modules/broken/module.manifest.ts: id 'wrong' must equal directory name 'broken'",
    "apps/api/src/modules/orphan/module.manifest.ts: missing module.manifest.ts for Nest module directory",
  ]);
});

const ROUTE_FIXTURE_FILE =
  "apps/api/src/modules/example/presentation/fixture.controller.ts";
const ROUTE_FIXTURE_IMPORTS = `import { Controller, Get, Post } from "@nestjs/common";
import { PublicEndpoint } from "../../../security/route-access.decorator";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
`;

function auditRouteFixture(body) {
  return analyzeControllerSources([
    { file: ROUTE_FIXTURE_FILE, text: `${ROUTE_FIXTURE_IMPORTS}\n${body}` },
  ]);
}

test("route access gate accepts an audit result without violations", () => {
  const routes = auditRouteFixture(`
    @Controller("items")
    export class ItemsController {
      @Get()
      @RequireCapabilities("planning.read")
      list() {}

      @Get("health")
      @PublicEndpoint()
      health() {}
    }
  `);

  assert.equal(routes.length, 2);
  assert.deepEqual(findRouteAccessViolations(routes), []);
  assert.deepEqual(findRouteAccessViolations([]), []);
});

test("route access gate rejects every audited violation", () => {
  const routes = auditRouteFixture(`
    @Controller("items")
    export class ItemsController {
      @Get()
      @RequireCapabilities("planning.read")
      list() {}

      @Post()
      create() {}

      @Post("empty")
      @RequireCapabilities()
      empty() {}
    }
  `);

  assert.deepEqual(findRouteAccessViolations(routes), [
    `${ROUTE_FIXTURE_FILE}: POST /items (ItemsController.create) route access missing: ACCESS_CLASSIFICATION_MISSING`,
    `${ROUTE_FIXTURE_FILE}: POST /items/empty (ItemsController.empty) route access capability: CAPABILITY_EMPTY`,
  ]);
});
