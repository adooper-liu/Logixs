import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  extractMarkdownTargets,
  findAmbiguousContractPhaseReferences,
  findBrokenMarkdownLinks,
  findForbiddenTrackedPaths,
  findMisleadingContractPackageScripts,
  findUiThemeBoundaryViolations,
  validateTaskStatusRecords,
} from "./check-repository.mjs";

const temporaryDirectories = [];
after(() => {
  temporaryDirectories.forEach((directory) =>
    rmSync(directory, { force: true, recursive: true }),
  );
});

test("rejects generated output, evidence scratch files, competing lockfiles, logs, and real env files", () => {
  assert.deepEqual(
    findForbiddenTrackedPaths([
      "apps/web/src/main.ts",
      "apps/web/node_modules/vue/index.js",
      "apps/web/dist/index.html",
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
