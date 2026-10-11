import assert from "node:assert/strict";
import test from "node:test";
import { findArchitectureBoundaryViolations } from "./check-architecture-boundaries.mjs";

test("allows exact full-chain demo maintenance infrastructure imports", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/tools/full-chain-demo/runtime.ts",
        source: [
          'import { PrismaClient } from "../../../../../generated/prisma";',
          'import { createPostgresAdapter } from "../../prisma/postgres-adapter";',
          'import { Client } from "@temporalio/client";',
        ].join("\n"),
      },
    ]),
    [],
  );
});

test("keeps Prisma and Temporal forbidden in unrelated tools", () => {
  assert.deepEqual(
    findArchitectureBoundaryViolations([
      {
        path: "apps/api/src/tools/unrelated/runtime.ts",
        source: [
          'import { PrismaClient } from "../../../../../generated/prisma";',
          'import { Client } from "@temporalio/client";',
        ].join("\n"),
      },
    ]),
    [
      "apps/api/src/tools/unrelated/runtime.ts: Prisma is limited to infrastructure, prisma, and health '../../../../../generated/prisma'",
      "apps/api/src/tools/unrelated/runtime.ts: only the workflow module and workers may import Temporal '@temporalio/client'",
    ],
  );
});
