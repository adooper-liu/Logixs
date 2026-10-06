import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateUiStructureGate,
  parseUiTaskRecord,
} from "./check-ui-structure-gate.mjs";

const completeUiFields = `
uiStructure:
  - queue -> facts -> action
uiMustStayVisible:
  - status and recovery
uiProgressiveDisclosure:
  - audit details
uiForbidden:
  - duplicate status
uiViewportEvidence:
  - 1440x900
  - 1024x768
  - 390x844`;

function task({
  path = "docs/planning/tasks/ui.md",
  status = "coding",
  scopes = ["apps/web/src/views/Workbench.vue"],
  ui = completeUiFields,
} = {}) {
  return {
    path,
    source: `---
status: ${status}
writeScopes:
${scopes.map((scope) => `  - ${scope}`).join("\n")}${ui}
---`,
  };
}

test("non-Vue edits bypass the UI structure gate", () => {
  assert.deepEqual(
    evaluateUiStructureGate({
      filePath: "apps/web/src/data/workbench.ts",
      records: [],
    }),
    { allowed: true },
  );
});

test("Vue edits require one active owning brief", () => {
  assert.deepEqual(
    evaluateUiStructureGate({
      filePath: "apps/web/src/views/Workbench.vue",
      records: [],
    }),
    {
      allowed: false,
      reason:
        "UI edit blocked: no active design/coding/fix brief owns apps/web/src/views/Workbench.vue",
    },
  );
});

test("Vue edits reject an owning brief without mandatory structure", () => {
  assert.deepEqual(
    evaluateUiStructureGate({
      filePath: "apps/web/src/views/Workbench.vue",
      records: [task({ ui: "" })],
    }),
    {
      allowed: false,
      reason:
        "UI edit blocked: docs/planning/tasks/ui.md is missing uiStructure, uiMustStayVisible, uiProgressiveDisclosure, uiForbidden, uiViewportEvidence",
    },
  );
});

test("Vue edits allow one active owning brief with complete structure", () => {
  assert.deepEqual(
    evaluateUiStructureGate({
      filePath: "apps/web/src/views/Workbench.vue",
      records: [task()],
    }),
    { allowed: true, briefPath: "docs/planning/tasks/ui.md" },
  );
});

test("Vue edits reject ambiguous ownership", () => {
  assert.deepEqual(
    evaluateUiStructureGate({
      filePath: "apps/web/src/views/Workbench.vue",
      records: [task(), task({ path: "docs/planning/tasks/other.md" })],
    }),
    {
      allowed: false,
      reason:
        "UI edit blocked: multiple active briefs own apps/web/src/views/Workbench.vue: docs/planning/tasks/ui.md, docs/planning/tasks/other.md",
    },
  );
});

test("parser retains active status, scopes, and mandatory UI lists", () => {
  assert.deepEqual(parseUiTaskRecord(task()), {
    path: "docs/planning/tasks/ui.md",
    status: "coding",
    writeScopes: ["apps/web/src/views/Workbench.vue"],
    uiStructure: ["queue -> facts -> action"],
    uiMustStayVisible: ["status and recovery"],
    uiProgressiveDisclosure: ["audit details"],
    uiForbidden: ["duplicate status"],
    uiViewportEvidence: ["1440x900", "1024x768", "390x844"],
  });
});
