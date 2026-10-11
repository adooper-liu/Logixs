import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeTaskRecord,
  parseTaskFrontmatter,
  parseWriteScope,
  scopeOwnsPath,
  writeScopesOverlap,
} from "./task-brief-state.mjs";

const completeSource = `---\r
status: coding # machine value\r
branch: "docs/transparent-development-calibration-v1"\r
verification: >\r
  focused tests passed\r
  repo check passed\r
dependsOn: [universal-workbench-layout-standard-v1]\r
writeScopes:\r
  - scripts/task-brief-state.mjs\r
  - scripts/calibration/**\r
exclusiveLocks: []\r
sharedIntegrationScopes:\r
  - package.json\r
authorityRefs:\r
  - AGENTS.md\r
---\r
# 任务：校准\r
`;

test("parses the supported task frontmatter subset deterministically", () => {
  const parsed = parseTaskFrontmatter(completeSource, {
    path: "docs/planning/tasks/calibration.md",
  });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.values.status, "coding");
  assert.equal(
    parsed.values.branch,
    "docs/transparent-development-calibration-v1",
  );
  assert.equal(
    parsed.values.verification,
    "focused tests passed\nrepo check passed",
  );
  assert.deepEqual(parsed.values.dependsOn, [
    "universal-workbench-layout-standard-v1",
  ]);
  assert.deepEqual(parsed.values.writeScopes, [
    "scripts/task-brief-state.mjs",
    "scripts/calibration/**",
  ]);
  assert.deepEqual(parsed.values.exclusiveLocks, []);

  const quotedHash = parseTaskFrontmatter(
    `---\nbranch: "docs/calibration#slice"\n---`,
    { path: "quoted.md" },
  );
  assert.equal(quotedHash.values.branch, "docs/calibration#slice");
});

test("normalizes a task record once for every consumer", () => {
  const task = normalizeTaskRecord({
    path: "docs\\planning\\tasks\\calibration.md",
    source: completeSource,
  });
  assert.equal(task.id, "calibration");
  assert.equal(task.path, "docs/planning/tasks/calibration.md");
  assert.equal(task.title, "校准");
  assert.deepEqual(task.writeScopes, [
    "scripts/task-brief-state.mjs",
    "scripts/calibration/**",
  ]);
});

test("fails closed on duplicate keys, nested mappings, and malformed list fields", () => {
  const parsed = parseTaskFrontmatter(
    `---\nstatus: coding\nstatus: fix\nwriteScopes:\n  nested: value\nauthorityRefs: AGENTS.md\n---`,
    { path: "bad.md" },
  );
  assert.ok(parsed.errors.length >= 3);
  assert.ok(
    parsed.errors.every(
      ({ code, path, line }) =>
        code === "TASK_PARSE_INVALID" && path === "bad.md" && line > 0,
    ),
  );
});

test("normalizes file paths but rejects unsafe declared scopes", () => {
  assert.deepEqual(parseWriteScope("Apps/API/**"), {
    kind: "directory",
    path: "apps/api",
    raw: "Apps/API/**",
  });
  assert.equal(scopeOwnsPath("Apps/API/**", "apps\\api\\src\\main.ts"), true);
  assert.equal(
    scopeOwnsPath("apps/api/src/main.ts", "APPS/API/src/main.ts"),
    true,
  );
  assert.deepEqual(parseWriteScope("../outside/**"), {
    error: "outside",
    raw: "../outside/**",
  });
  assert.deepEqual(parseWriteScope("apps/*/src/**"), {
    error: "pattern",
    raw: "apps/*/src/**",
  });
  assert.deepEqual(parseWriteScope("C:/repo/file.ts"), {
    error: "outside",
    raw: "C:/repo/file.ts",
  });
  assert.deepEqual(parseWriteScope("apps\\api\\main.ts"), {
    error: "outside",
    raw: "apps\\api\\main.ts",
  });
});

test("uses one overlap rule for exact and directory scopes", () => {
  assert.equal(
    writeScopesOverlap(
      parseWriteScope("apps/api/**"),
      parseWriteScope("apps/api/src/main.ts"),
    ),
    true,
  );
  assert.equal(
    writeScopesOverlap(
      parseWriteScope("apps/api/src/contracts/**"),
      parseWriteScope("apps/api/**"),
    ),
    true,
  );
  assert.equal(
    writeScopesOverlap(
      parseWriteScope("apps/web/**"),
      parseWriteScope("apps/api/**"),
    ),
    false,
  );
});
