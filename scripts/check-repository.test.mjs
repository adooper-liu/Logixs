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
import { after, test } from "node:test";
import { findArchitectureBoundaryViolations } from "./check-architecture-boundaries.mjs";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";
import {
  extractMarkdownTargets,
  findAmbiguousContractPhaseReferences,
  findBrokenMarkdownLinks,
  findForbiddenTrackedPaths,
  findMisleadingContractPackageScripts,
  findMissingRequiredPolicyFiles,
  findMissingStyleScaleTokens,
  findStyleScaleViolations,
  findUiThemeBoundaryViolations,
  validateTaskStatusRecords,
} from "./check-repository.mjs";

const temporaryDirectories = [];
after(() => {
  temporaryDirectories.forEach((directory) =>
    rmSync(directory, { force: true, recursive: true }),
  );
});

// 冻结快照：由 `node scripts/check-repository.mjs --write-style-baseline` 产出后回填。
// 新增条目或调大某个计数都必须先改这里，让「把基线改大蒙混过关」在 review 里显形。
const FROZEN_BASELINE_PATHS = [
  "apps/web/src/components/assistant/OpsAssistantPanel.vue",
  "apps/web/src/components/cargo-ready/CargoReadyActionPanel.vue",
  "apps/web/src/components/cargo-ready/CargoReadySummary.vue",
  "apps/web/src/components/cargo-ready/CargoReadyWorkQueue.vue",
  "apps/web/src/components/compliance/ComplianceAssessmentPanel.vue",
  "apps/web/src/components/compliance/ComplianceReviewForm.vue",
  "apps/web/src/components/container/EventEvidenceTimeline.vue",
  "apps/web/src/components/container/LifecycleRail.vue",
  "apps/web/src/components/container/LiveMiniRail.vue",
  "apps/web/src/components/container/LiveNodeRail.vue",
  "apps/web/src/components/container/NodeFactPanel.vue",
  "apps/web/src/components/container/NodeTimeTrackCard.vue",
  "apps/web/src/components/container/ObjectActivityPanel.vue",
  "apps/web/src/components/container/ObjectActivityTimeline.vue",
  "apps/web/src/components/container/ObjectContextBar.vue",
  "apps/web/src/components/container/StatusTriplet.vue",
  "apps/web/src/components/customs/CustomsActionPanel.vue",
  "apps/web/src/components/customs/CustomsCasePanel.vue",
  "apps/web/src/components/customs/CustomsWorkQueue.vue",
  "apps/web/src/components/date-review/DateFactReviewActionPanel.vue",
  "apps/web/src/components/date-review/DateFactReviewContext.vue",
  "apps/web/src/components/date-review/DateFactReviewQueue.vue",
  "apps/web/src/components/delivery/DeliveryActionPanel.vue",
  "apps/web/src/components/delivery/DeliveryFactsPanel.vue",
  "apps/web/src/components/delivery/DeliveryInstructionPanel.vue",
  "apps/web/src/components/delivery/DeliveryWorkQueue.vue",
  "apps/web/src/components/dispatch/DispatchActionPanel.vue",
  "apps/web/src/components/dispatch/DispatchSnapshotPanel.vue",
  "apps/web/src/components/dispatch/DispatchWorkQueue.vue",
  "apps/web/src/components/imports/ImportMappingEditor.vue",
  "apps/web/src/components/imports/ImportReplacementUploader.vue",
  "apps/web/src/components/management/AchievementCalendar.vue",
  "apps/web/src/components/management/AnalysisClosurePanel.vue",
  "apps/web/src/components/management/ContainerFlowTable.vue",
  "apps/web/src/components/management/DecisionQueue.vue",
  "apps/web/src/components/management/KpiSignalStrip.vue",
  "apps/web/src/components/management/ManagementSignalStrip.vue",
  "apps/web/src/components/management/OperationsAnalytics.vue",
  "apps/web/src/components/management/OperationsFlowMap.vue",
  "apps/web/src/components/management/PlanningExecutionPanel.vue",
  "apps/web/src/components/management/RaciMatrixPanel.vue",
  "apps/web/src/components/pickup/PickupActionPanel.vue",
  "apps/web/src/components/pickup/PickupFactsPanel.vue",
  "apps/web/src/components/pickup/PickupWorkQueue.vue",
  "apps/web/src/components/shell/AppTopbar.vue",
  "apps/web/src/components/shell/CommandPalette.vue",
  "apps/web/src/components/stuffing/StuffingActionPanel.vue",
  "apps/web/src/components/stuffing/StuffingActualTimeForm.vue",
  "apps/web/src/components/stuffing/StuffingSnapshotForm.vue",
  "apps/web/src/components/stuffing/StuffingSnapshotPanel.vue",
  "apps/web/src/components/stuffing/StuffingWorkQueue.vue",
  "apps/web/src/components/task/SubmissionProgress.vue",
  "apps/web/src/components/task/TaskContextHeader.vue",
  "apps/web/src/components/task/TaskEvidencePanel.vue",
  "apps/web/src/components/task/TaskExecutionPanel.vue",
  "apps/web/src/components/task/TaskFocusFlow.vue",
  "apps/web/src/components/task/TaskInputPanel.vue",
  "apps/web/src/components/task/TaskPreconditionPanel.vue",
  "apps/web/src/components/task/TaskQueue.vue",
  "apps/web/src/components/task/TaskResultPanel.vue",
  "apps/web/src/components/ui/DynamicDataTable.vue",
  "apps/web/src/components/ui/DynamicDataTablePagination.vue",
  "apps/web/src/components/ui/DynamicDataTableToolbar.vue",
  "apps/web/src/components/ui/DynamicFieldPanel.vue",
  "apps/web/src/components/ui/DynamicTableCell.vue",
  "apps/web/src/components/ui/InfoTooltip.vue",
  "apps/web/src/components/unloading/UnloadingActionPanel.vue",
  "apps/web/src/components/unloading/UnloadingFactsPanel.vue",
  "apps/web/src/components/unloading/UnloadingProgressPanel.vue",
  "apps/web/src/components/unloading/UnloadingWorkQueue.vue",
  "apps/web/src/components/workbench/RoleWorkbenchFrame.vue",
  "apps/web/src/styles/base.css",
  "apps/web/src/styles/utilities.css",
  "apps/web/src/themes/logix/LogixPageHeader.vue",
  "apps/web/src/views/ComplianceWorkbench.vue",
  "apps/web/src/views/ContainerList.vue",
  "apps/web/src/views/ContainerUnloadingWorkbench.vue",
  "apps/web/src/views/DashboardGlobal.vue",
  "apps/web/src/views/DateFactReviewWorkbench.vue",
  "apps/web/src/views/DeadLetterQueue.vue",
  "apps/web/src/views/DevConsole.vue",
  "apps/web/src/views/ImportBatchDetail.vue",
  "apps/web/src/views/ImportUpload.vue",
  "apps/web/src/views/MesoPaper.vue",
  "apps/web/src/views/MicroWorkbench.vue",
  "apps/web/src/views/NotificationCenter.vue",
  "apps/web/src/views/RealContainerList.vue",
  "apps/web/src/views/RealOperations.vue",
  "apps/web/src/views/RealTaskWorkbench.vue",
  "apps/web/src/views/TaskWorkbench.vue",
  "apps/web/src/views/WarehouseDeliveryWorkbench.vue",
];
const FROZEN_BASELINE_COUNTS = {
  "apps/web/src/components/assistant/OpsAssistantPanel.vue": 22,
  "apps/web/src/components/cargo-ready/CargoReadyActionPanel.vue": 31,
  "apps/web/src/components/cargo-ready/CargoReadySummary.vue": 38,
  "apps/web/src/components/cargo-ready/CargoReadyWorkQueue.vue": 43,
  "apps/web/src/components/compliance/ComplianceAssessmentPanel.vue": 25,
  "apps/web/src/components/compliance/ComplianceReviewForm.vue": 14,
  "apps/web/src/components/container/EventEvidenceTimeline.vue": 30,
  "apps/web/src/components/container/LifecycleRail.vue": 9,
  "apps/web/src/components/container/LiveMiniRail.vue": 4,
  "apps/web/src/components/container/LiveNodeRail.vue": 7,
  "apps/web/src/components/container/NodeFactPanel.vue": 24,
  "apps/web/src/components/container/NodeTimeTrackCard.vue": 13,
  "apps/web/src/components/container/ObjectActivityPanel.vue": 12,
  "apps/web/src/components/container/ObjectActivityTimeline.vue": 23,
  "apps/web/src/components/container/ObjectContextBar.vue": 12,
  "apps/web/src/components/container/StatusTriplet.vue": 17,
  "apps/web/src/components/customs/CustomsActionPanel.vue": 16,
  "apps/web/src/components/customs/CustomsCasePanel.vue": 13,
  "apps/web/src/components/customs/CustomsWorkQueue.vue": 11,
  "apps/web/src/components/date-review/DateFactReviewActionPanel.vue": 17,
  "apps/web/src/components/date-review/DateFactReviewContext.vue": 20,
  "apps/web/src/components/date-review/DateFactReviewQueue.vue": 16,
  "apps/web/src/components/delivery/DeliveryActionPanel.vue": 16,
  "apps/web/src/components/delivery/DeliveryFactsPanel.vue": 13,
  "apps/web/src/components/delivery/DeliveryInstructionPanel.vue": 13,
  "apps/web/src/components/delivery/DeliveryWorkQueue.vue": 11,
  "apps/web/src/components/dispatch/DispatchActionPanel.vue": 18,
  "apps/web/src/components/dispatch/DispatchSnapshotPanel.vue": 13,
  "apps/web/src/components/dispatch/DispatchWorkQueue.vue": 11,
  "apps/web/src/components/imports/ImportMappingEditor.vue": 13,
  "apps/web/src/components/imports/ImportReplacementUploader.vue": 3,
  "apps/web/src/components/management/AchievementCalendar.vue": 15,
  "apps/web/src/components/management/AnalysisClosurePanel.vue": 16,
  "apps/web/src/components/management/ContainerFlowTable.vue": 7,
  "apps/web/src/components/management/DecisionQueue.vue": 14,
  "apps/web/src/components/management/KpiSignalStrip.vue": 11,
  "apps/web/src/components/management/ManagementSignalStrip.vue": 10,
  "apps/web/src/components/management/OperationsAnalytics.vue": 19,
  "apps/web/src/components/management/OperationsFlowMap.vue": 19,
  "apps/web/src/components/management/PlanningExecutionPanel.vue": 19,
  "apps/web/src/components/management/RaciMatrixPanel.vue": 15,
  "apps/web/src/components/pickup/PickupActionPanel.vue": 16,
  "apps/web/src/components/pickup/PickupFactsPanel.vue": 14,
  "apps/web/src/components/pickup/PickupWorkQueue.vue": 11,
  "apps/web/src/components/shell/AppTopbar.vue": 16,
  "apps/web/src/components/shell/CommandPalette.vue": 17,
  "apps/web/src/components/stuffing/StuffingActionPanel.vue": 18,
  "apps/web/src/components/stuffing/StuffingActualTimeForm.vue": 16,
  "apps/web/src/components/stuffing/StuffingSnapshotForm.vue": 19,
  "apps/web/src/components/stuffing/StuffingSnapshotPanel.vue": 26,
  "apps/web/src/components/stuffing/StuffingWorkQueue.vue": 30,
  "apps/web/src/components/task/SubmissionProgress.vue": 30,
  "apps/web/src/components/task/TaskContextHeader.vue": 25,
  "apps/web/src/components/task/TaskEvidencePanel.vue": 33,
  "apps/web/src/components/task/TaskExecutionPanel.vue": 15,
  "apps/web/src/components/task/TaskFocusFlow.vue": 15,
  "apps/web/src/components/task/TaskInputPanel.vue": 17,
  "apps/web/src/components/task/TaskPreconditionPanel.vue": 17,
  "apps/web/src/components/task/TaskQueue.vue": 29,
  "apps/web/src/components/task/TaskResultPanel.vue": 20,
  "apps/web/src/components/ui/DynamicDataTable.vue": 7,
  "apps/web/src/components/ui/DynamicDataTablePagination.vue": 4,
  "apps/web/src/components/ui/DynamicDataTableToolbar.vue": 20,
  "apps/web/src/components/ui/DynamicFieldPanel.vue": 22,
  "apps/web/src/components/ui/DynamicTableCell.vue": 6,
  "apps/web/src/components/ui/InfoTooltip.vue": 3,
  "apps/web/src/components/unloading/UnloadingActionPanel.vue": 18,
  "apps/web/src/components/unloading/UnloadingFactsPanel.vue": 13,
  "apps/web/src/components/unloading/UnloadingProgressPanel.vue": 15,
  "apps/web/src/components/unloading/UnloadingWorkQueue.vue": 11,
  "apps/web/src/components/workbench/RoleWorkbenchFrame.vue": 20,
  "apps/web/src/styles/base.css": 1,
  "apps/web/src/styles/utilities.css": 7,
  "apps/web/src/themes/logix/LogixPageHeader.vue": 10,
  "apps/web/src/views/ComplianceWorkbench.vue": 9,
  "apps/web/src/views/ContainerList.vue": 1,
  "apps/web/src/views/ContainerUnloadingWorkbench.vue": 1,
  "apps/web/src/views/DashboardGlobal.vue": 5,
  "apps/web/src/views/DateFactReviewWorkbench.vue": 6,
  "apps/web/src/views/DeadLetterQueue.vue": 14,
  "apps/web/src/views/DevConsole.vue": 18,
  "apps/web/src/views/ImportBatchDetail.vue": 21,
  "apps/web/src/views/ImportUpload.vue": 6,
  "apps/web/src/views/MesoPaper.vue": 4,
  "apps/web/src/views/MicroWorkbench.vue": 12,
  "apps/web/src/views/NotificationCenter.vue": 6,
  "apps/web/src/views/RealContainerList.vue": 4,
  "apps/web/src/views/RealOperations.vue": 10,
  "apps/web/src/views/RealTaskWorkbench.vue": 22,
  "apps/web/src/views/TaskWorkbench.vue": 6,
  "apps/web/src/views/WarehouseDeliveryWorkbench.vue": 1,
};

test("style scale baseline only shrinks", () => {
  const baseline = JSON.parse(
    readFileSync(join("scripts", "style-scale-baseline.json"), "utf8"),
  );
  assert.deepEqual(
    Object.keys(baseline.files).sort(),
    [...FROZEN_BASELINE_PATHS].sort(),
  );
  for (const [path, count] of Object.entries(baseline.files)) {
    assert.ok(
      count <= (FROZEN_BASELINE_COUNTS[path] ?? 0),
      `基线不得增大：${path} 从 ${FROZEN_BASELINE_COUNTS[path]} 涨到 ${count}`,
    );
  }
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

test("allows within-baseline counts and rejects going over", () => {
  const record = {
    path: "apps/web/src/views/Legacy.vue",
    source: "<style scoped>\n.a { font-size: 10px; }\n</style>",
  };
  assert.deepEqual(
    findStyleScaleViolations([record], {
      files: { "apps/web/src/views/Legacy.vue": 1 },
    }),
    [],
  );
  assert.deepEqual(
    findStyleScaleViolations([record], {
      files: { "apps/web/src/views/Legacy.vue": 0 },
    }),
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

test("allows only one active task brief", () => {
  assert.deepEqual(
    validateTaskStatusRecords([
      { path: "one.md", source: "---\nstatus: coding\n---" },
      { path: "two.md", source: "---\nstatus: review\n---" },
    ]),
    ["multiple active task briefs: one.md, two.md"],
  );
  assert.deepEqual(
    validateTaskStatusRecords([
      { path: "one.md", source: "---\nstatus: coding\n---" },
      {
        path: "two.md",
        source:
          "---\nstatus: done\nverification: https://ci.example/run/42\n---",
      },
    ]),
    [],
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
