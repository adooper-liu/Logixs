import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { findArchitectureBoundaryViolations } from "./check-architecture-boundaries.mjs";
import {
  extractMarkdownTargets,
  findAmbiguousContractPhaseReferences,
  findBrokenMarkdownLinks,
  findForbiddenTrackedPaths,
  findMisleadingContractPackageScripts,
  findMissingRequiredPolicyFiles,
  findUiThemeBoundaryViolations,
  validateTaskStatusRecords,
} from "./check-repository.mjs";

const temporaryDirectories = [];
after(() => {
  temporaryDirectories.forEach((directory) =>
    rmSync(directory, { force: true, recursive: true }),
  );
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
