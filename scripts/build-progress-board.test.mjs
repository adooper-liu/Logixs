import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  loadProgressBoardData,
  normalizeCheckableBoard,
  renderCalibrationPanel,
  renderProgressBoard,
  runBoardCommand,
} from "./build-progress-board.mjs";

const BOARD_TEMPLATE = `
<title>Board fixture</title>
<!--VOLATILE_META_START--><dl><!--__META__--></dl><!--VOLATILE_META_END-->
<div><!--__TILES__--></div>
<section><!--__CALIBRATION__--></section>
<p><!--__MODULE_NOTE__--></p>
<div><!--__MODULES__--></div>
<p><!--__CHAIN_NOTE__--></p>
<div><!--__RAIL__--></div>
<p><!--__PHASE_NOTE__--></p>
<div><!--__PHASES__--></div>
<div><!--__FILTERS__--></div>
<p><!--__LEDGER_NOTE__--></p>
<table><tbody><!--__TASKS__--></tbody></table>
<p><!--__GAP_NOTE__--></p>
<div><!--__GAPS__--></div>
<footer><!--__FOOTER_NOTE__--></footer>
`;

const fixture = {
  generatedAt: "2026-10-11 12:00 UTC",
  commit: "abc1234",
  branch: "feat/calibration",
  dirty: false,
  repoUrl: "https://github.com/example/logixs",
  tasks: [
    {
      id: "calibration",
      title: "Calibration",
      status: "coding",
      branch: "feat/calibration",
      proof: true,
      phase: "—",
    },
  ],
  modules: [
    {
      id: "identity",
      kind: "base",
      depends: [],
      files: 1,
      tests: 1,
      lines: 20,
      state: "built",
      layer: "platform",
    },
  ],
  stations: [
    {
      seq: 1,
      code: "cargo_ready",
      applicability: "required",
      cn: "备货就绪",
      state: "wired",
      by: "fixture",
    },
  ],
  sections: [
    {
      id: "P1",
      name: "基础",
      done: 1,
      na: 0,
      partial: 0,
      todo: 0,
      total: 1,
      settled: 1,
      ratio: 1,
      ledgerDone: 0,
      desynced: false,
    },
  ],
  gaps: [
    {
      sev: "low",
      title: "Fixture gap",
      body: ["Fixture body"],
    },
  ],
  migrationCount: 1,
  calibration: {
    state: "not-observed",
    reason: "TASK_CURRENT_NOT_FOUND",
    otherWorktrees: "not-observed",
    remoteIntegration: "not-observed",
  },
};

const renderFixture = () =>
  renderProgressBoard(fixture, { template: BOARD_TEMPLATE });

const observedProjection = {
  task: {
    path: "docs/planning/tasks/<script>.md",
    title: 'Calibration <img onerror="boom">',
  },
  declared: {
    status: "coding",
    branch: "feat/calibration",
    risk: "high",
    verification: "tests & checks passed",
    writeScopes: ["scripts/<unsafe>/**", 'docs/"quoted".md'],
    authorityRefs: ["AGENTS.md"],
    dependsOn: ["foundation"],
  },
  observed: {
    actualBranch: "feat/calibration",
    baseSha: "base123",
    baseSource: "explicit",
    headSha: "head456",
    committedPaths: [],
    stagedPaths: [],
    unstagedPaths: [],
    untrackedPaths: [],
  },
  derived: {
    trackedChangedPaths: ["scripts/core.mjs"],
    ownedChangedPaths: ["scripts/core.mjs"],
    blockingOutOfScopePaths: ["outside/staged.txt"],
    ownedUntrackedPaths: ["scripts/new.mjs"],
    unownedUntrackedPaths: Array.from(
      { length: 55 },
      (_, index) => `.tmp/path-${String(index).padStart(2, "0")}.json`,
    ),
    dependencies: [
      {
        id: "foundation",
        path: "docs/planning/tasks/foundation.md",
        status: "done",
      },
    ],
    authorities: [{ path: "AGENTS.md", state: "present" }],
    findings: [
      {
        code: "TASK_CHANGED_PATH_OUT_OF_SCOPE",
        severity: "blocking",
        subject: "outside/staged.txt",
        evidence: ["outside/staged.txt"],
        remedy: "move it",
      },
      {
        code: "TASK_UNOWNED_UNTRACKED_PRESENT",
        severity: "warning",
        subject: "55 paths",
        evidence: [".tmp/path-00.json"],
        remedy: "leave untouched",
      },
    ],
    nextGate: "fix-calibration-findings",
  },
  otherWorktrees: "not-observed",
  remoteIntegration: "not-observed",
};

test("board loader observes an explicit synthetic PR identity", () => {
  const calls = [];
  const output = new Map([
    ["rev-parse --short HEAD", "head456"],
    ["rev-parse --abbrev-ref HEAD", "HEAD"],
    ["status --porcelain", ""],
    ["remote get-url origin", ""],
    ["rev-parse --verify base123", "base123"],
    ["rev-parse --verify head456", "head456"],
    ["diff --name-status -z --diff-filter=ACMRD base123...head456", ""],
    ["diff --name-status -z --cached --diff-filter=ACMRD", ""],
    ["diff --name-status -z --diff-filter=ACMRD", ""],
    ["ls-files --others --exclude-standard", ""],
  ]);

  const data = loadProgressBoardData({
    calibrationIdentity: {
      base: "base123",
      head: "head456",
      branch: "feat/calibration",
    },
    git: (args, fallback = "") => {
      const key = args.join(" ");
      calls.push(key);
      return output.get(key) ?? fallback;
    },
  });

  assert.equal(data.calibration.state, "not-observed");
  assert.equal(data.calibration.reason, "TASK_CURRENT_NOT_FOUND");
  assert.ok(calls.includes("rev-parse --verify base123"));
  assert.ok(calls.includes("rev-parse --verify head456"));
  assert.ok(!calls.includes("branch --show-current"));
});

test("board loader rejects invalid synthetic head and diff reads", () => {
  const baseOutputs = new Map([
    ["rev-parse --short HEAD", "head456"],
    ["rev-parse --abbrev-ref HEAD", "HEAD"],
    ["status --porcelain", ""],
    ["remote get-url origin", ""],
    ["rev-parse --verify base123", "base123"],
    ["rev-parse --verify head456", "head456"],
    ["diff --name-status -z --diff-filter=ACMRD base123...head456", ""],
    ["diff --name-status -z --cached --diff-filter=ACMRD", ""],
    ["diff --name-status -z --diff-filter=ACMRD", ""],
    ["ls-files --others --exclude-standard", ""],
  ]);
  const load = (failedCall) =>
    loadProgressBoardData({
      taskRecordSources: [
        {
          path: "docs/planning/tasks/calibration.md",
          source: `---
status: coding
branch: feat/calibration
verification:
owner: main
writer: main
risk: high
dependsOn: []
writeScopes:
  - scripts/**
exclusiveLocks: []
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
---
# 任务：校准
`,
        },
      ],
      calibrationIdentity: {
        base: "base123",
        head: "head456",
        branch: "feat/calibration",
      },
      git: (args, fallback = "") => {
        const key = args.join(" ");
        if (key === failedCall) throw new Error("git read failed");
        return baseOutputs.get(key) ?? fallback;
      },
    });

  assert.deepEqual(load("rev-parse --verify base123").calibration, {
    state: "not-observed",
    reason: "TASK_BASE_UNKNOWN",
  });
  assert.deepEqual(load("rev-parse --verify head456").calibration, {
    state: "not-observed",
    reason: "GIT_READ_FAILED",
  });
  assert.deepEqual(
    load("diff --name-status -z --diff-filter=ACMRD base123...head456")
      .calibration,
    { state: "not-observed", reason: "GIT_READ_FAILED" },
  );
});

test("check normalization ignores only the unowned-untracked warning", () => {
  const html = renderCalibrationPanel(observedProjection);
  assert.equal(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(html.replace("55 paths", "0 paths")),
  );
  assert.notEqual(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(
      html.replace("TASK_CHANGED_PATH_OUT_OF_SCOPE", "TASK_BRANCH_MISMATCH"),
    ),
  );
});

test("calibration panel keeps the declared to observed to gate causal order", () => {
  const html = renderCalibrationPanel(observedProjection);
  const headings = [
    "任务与声明",
    "正式权威与依赖",
    "Checkout 与范围",
    "Finding 与下一门禁",
  ].map((heading) => html.indexOf(heading));
  assert.ok(headings.every((index) => index >= 0));
  assert.deepEqual(
    headings,
    headings.slice().sort((left, right) => left - right),
  );
  for (const kind of ["declared", "computed", "unknown", "editorial"]) {
    assert.match(html, new RegExp(`data-fact-kind="${kind}"`));
  }
});

test("calibration panel escapes repository values and caps path rows", () => {
  const html = renderCalibrationPanel(observedProjection);
  assert.doesNotMatch(html, /<img onerror=/);
  assert.doesNotMatch(html, /<unsafe>/);
  assert.match(html, /&lt;img onerror=&quot;boom&quot;&gt;/);
  assert.match(html, /tests &amp; checks passed/);
  assert.match(html, /55 total/);
  assert.match(html, /5 more/);
  assert.equal((html.match(/class="cal-path"/g) || []).length, 53);
});

test("calibration findings expose severity and code as text", () => {
  const html = renderCalibrationPanel(observedProjection);
  assert.match(html, />blocking</);
  assert.match(html, />warning</);
  assert.match(html, /TASK_CHANGED_PATH_OUT_OF_SCOPE/);
  assert.match(html, /TASK_UNOWNED_UNTRACKED_PRESENT/);
});

test("calibration normalization keeps stable task and finding drift visible", () => {
  const html = `stable ${renderCalibrationPanel(observedProjection)}`;
  assert.notEqual(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(html.replace("Calibration", "Changed title")),
  );
  assert.notEqual(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(
      html.replace("TASK_CHANGED_PATH_OUT_OF_SCOPE", "TASK_BASE_UNKNOWN"),
    ),
  );
});

test("progress board template contains the responsive calibration structure", () => {
  const template = readFileSync(
    new URL("./progress-board.template.html", import.meta.url),
    "utf8",
  );
  assert.match(
    template,
    /\.cal-board\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/,
  );
  assert.match(
    template,
    /@media \(max-width:\s*760px\)[\s\S]*\.cal-board\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
  assert.match(template, /\.cal-paths\s*\{[\s\S]*(overflow-wrap|word-break):/);
  assert.match(template, /body\s*\{[\s\S]*overflow-x:\s*hidden/);
});

test("check mode compares the board without writing the committed artifact", async () => {
  const writes = [];
  const result = await runBoardCommand(["--check"], {
    load: () => fixture,
    readTemplate: () => BOARD_TEMPLATE,
    readOutput: () => renderFixture(),
    writeOutput: (...args) => writes.push(args),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(writes, []);
});

test("the same data and template render identical bytes", () => {
  assert.equal(renderFixture(), renderFixture());
});

test("check normalization ignores commit-only links and snapshot metadata", () => {
  const before = renderFixture();
  const after = renderProgressBoard(
    { ...fixture, commit: "def5678" },
    { template: BOARD_TEMPLATE },
  );
  assert.equal(normalizeCheckableBoard(before), normalizeCheckableBoard(after));
});

test("check normalization ignores only named volatile blocks", () => {
  const html = renderFixture();
  const changedMeta = html.replace("abc1234", "def5678");
  assert.equal(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(changedMeta),
  );

  const changedTask = html.replace("Calibration", "Changed task title");
  assert.notEqual(
    normalizeCheckableBoard(html),
    normalizeCheckableBoard(changedTask),
  );
});

test("check normalization rejects malformed volatile markers", () => {
  assert.throws(
    () =>
      normalizeCheckableBoard(
        "<!--VOLATILE_META_START-->one<!--VOLATILE_META_START-->two<!--VOLATILE_META_END-->",
      ),
    /invalid volatile marker pair: META/,
  );
  assert.throws(
    () =>
      normalizeCheckableBoard(
        "<!--VOLATILE_META_END-->wrong order<!--VOLATILE_META_START-->",
      ),
    /invalid volatile marker pair: META/,
  );
});

test("stale check reports drift and performs zero writes", async () => {
  const writes = [];
  const result = await runBoardCommand(["--check"], {
    load: () => fixture,
    readTemplate: () => BOARD_TEMPLATE,
    readOutput: () => renderFixture().replace("Calibration", "Stale task"),
    writeOutput: (...args) => writes.push(args),
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /progress board is stale/);
  assert.deepEqual(writes, []);
});

test("unknown command flags fail without writing", async () => {
  const writes = [];
  const result = await runBoardCommand(["--wat"], {
    load: () => fixture,
    readTemplate: () => BOARD_TEMPLATE,
    readOutput: () => renderFixture(),
    writeOutput: (...args) => writes.push(args),
  });

  assert.equal(result.exitCode, 2);
  assert.deepEqual(writes, []);
});
