import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

const staticJob =
  workflow.match(/\n {2}static:\n([\s\S]*?)\n {2}unit:\n/)?.[1] ?? "";

const indexOfCommand = (command) => {
  const index = staticJob.indexOf(command);
  assert.notEqual(index, -1, `static job is missing ${command}`);
  return index;
};

test("static job calibrates PR head identity before board and format checks", () => {
  assert.match(staticJob, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
  assert.match(
    staticJob,
    /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(
    staticJob,
    /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  );
  assert.match(
    staticJob,
    /HEAD_BRANCH: \$\{\{ github\.event\.pull_request\.head\.ref \}\}/,
  );
  assert.match(
    staticJob,
    /pnpm calibration:check -- --ci --base "\$env:BASE_SHA" --head "\$env:HEAD_SHA" --branch "\$env:HEAD_BRANCH"/,
  );

  const order = [
    "pnpm repo:check",
    "pnpm calibration:check",
    "pnpm board:check",
    "pnpm format:check",
  ].map(indexOfCommand);
  assert.deepEqual(
    order,
    order.slice().sort((left, right) => left - right),
  );
  assert.doesNotMatch(
    staticJob,
    /board:build|git\s+(checkout|reset|clean|stash|add|commit|push|merge)\b/,
  );
});

test("static job uses merge-base calibration for manual dispatch only", () => {
  assert.match(
    staticJob,
    /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0/,
  );
  assert.match(
    staticJob,
    /CODE_CHANGED: \$\{\{ needs\.changes\.outputs\.code \}\}/,
  );
  assert.match(
    staticJob,
    /if \(\$env:EVENT_NAME -eq "pull_request" -and \$env:CODE_CHANGED -eq "true"\)[\s\S]*?--ci[\s\S]*?elseif \(\$env:EVENT_NAME -eq "workflow_dispatch"\)[\s\S]*?pnpm calibration:check/,
  );
  assert.match(workflow, /static:\n\s+if: github\.event_name != 'schedule'/);
  assert.match(
    workflow,
    /schedule:[\s\S]*?dependencies = \$true[\s\S]*?dictionary = \$true/,
  );
});
