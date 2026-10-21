import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const MIGRATION = "20261020200000_add_client_operation_claim_result";
const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const suffix = `${process.pid}_${randomUUID().replaceAll("-", "")}`;
const emptySchema = `it_claim_receipt_empty_${suffix}`;
const upgradeSchema = `it_claim_receipt_upgrade_${suffix}`;
const repositoryRoot = resolve(__dirname, "../../../../..");
const legacy = {
  tenantId: `tenant-${randomUUID()}`,
  actorId: "legacy-actor",
  taskId: randomUUID(),
  workOrderId: randomUUID(),
  operationId: randomUUID(),
};
let empty: PrismaClient;
let upgrade: PrismaClient;

beforeAll(async () => {
  deploy(emptySchema);
  deploy(upgradeSchema);
  empty = client(emptySchema);
  upgrade = client(upgradeSchema);
  await Promise.all([empty.$connect(), upgrade.$connect()]);

  await seedLegacyRows(upgrade);
  await upgrade.$executeRawUnsafe(
    `DROP TABLE "${upgradeSchema}"."client_operation_claim_result"`,
  );
  await upgrade.$executeRawUnsafe(
    `DROP FUNCTION "${upgradeSchema}"."reject_client_operation_claim_result_mutation"()`,
  );
  await upgrade.$executeRawUnsafe(
    `DELETE FROM "${upgradeSchema}"."_prisma_migrations" WHERE "migration_name" = $1`,
    MIGRATION,
  );
  deploy(upgradeSchema);
}, 240_000);

afterAll(async () => {
  await Promise.all([empty?.$disconnect(), upgrade?.$disconnect()]);
  const admin = client("public");
  try {
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${emptySchema}" CASCADE`,
    );
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${upgradeSchema}" CASCADE`,
    );
  } finally {
    await admin.$disconnect();
  }
});

describe("client operation claim result migration", () => {
  it("replays from an empty schema and records the migration once", async () => {
    await expect(migrationRows(empty, emptySchema)).resolves.toHaveLength(1);
    await expect(empty.clientOperationClaimResult.count()).resolves.toBe(0);

    await seedLegacyRows(empty);
    const operationId = randomUUID();
    await createOperation(empty, operationId, true);
    const first = await empty.clientOperationClaimResult.findUniqueOrThrow({
      where: { clientOperationId: operationId },
    });
    const replay = await empty.clientOperationClaimResult.findUniqueOrThrow({
      where: { clientOperationId: operationId },
    });
    expect(replay).toEqual(first);
  });

  it("upgrades existing task, work order, and operation without inventing a receipt", async () => {
    await expect(
      upgrade.nodeTask.findUnique({ where: { id: legacy.taskId } }),
    ).resolves.toMatchObject({ tenantId: legacy.tenantId, state: "pending" });
    await expect(
      upgrade.workOrder.findUnique({ where: { id: legacy.workOrderId } }),
    ).resolves.toMatchObject({ state: "ready" });
    await expect(
      upgrade.clientOperation.findUnique({ where: { id: legacy.operationId } }),
    ).resolves.toMatchObject({ commitState: "committed" });
    await expect(
      upgrade.clientOperationClaimResult.findUnique({
        where: { clientOperationId: legacy.operationId },
      }),
    ).resolves.toBeNull();
    await expect(migrationRows(upgrade, upgradeSchema)).resolves.toHaveLength(
      1,
    );
  });

  it("writes one typed receipt for a new formal claim", async () => {
    const operationId = randomUUID();
    await createOperation(upgrade, operationId, true);

    await expect(
      upgrade.clientOperationClaimResult.findUniqueOrThrow({
        where: { clientOperationId: operationId },
      }),
    ).resolves.toMatchObject({
      workOrderId: legacy.workOrderId,
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: legacy.actorId,
      taskId: legacy.taskId,
      taskState: "in_progress",
      applied: true,
    });
  });

  it("writes and rereads a valid non-applied receipt", async () => {
    const operationId = randomUUID();
    await createOperation(upgrade, operationId, false);

    await upgrade.clientOperationClaimResult.create({
      data: receipt(operationId, {
        workOrderState: "ready",
        assignmentState: "unassigned",
        assigneeId: null,
        taskState: "pending",
        applied: false,
      }),
    });

    await expect(
      upgrade.clientOperationClaimResult.findUniqueOrThrow({
        where: { clientOperationId: operationId },
      }),
    ).resolves.toMatchObject({
      workOrderState: "ready",
      assignmentState: "unassigned",
      assigneeId: null,
      taskState: "pending",
      applied: false,
    });
  });

  it("enforces receipt shape, one-to-one ownership, and append-only history", async () => {
    const operationId = randomUUID();
    await createOperation(upgrade, operationId, false);

    await expect(
      upgrade.clientOperationClaimResult.create({
        data: receipt(operationId, { workOrderState: "ready", applied: true }),
      }),
    ).rejects.toThrow(/client_operation_claim_result_applied_check/);

    const receiptId = randomUUID();
    await createOperation(upgrade, receiptId, true);
    await expect(
      upgrade.clientOperationClaimResult.create({ data: receipt(receiptId) }),
    ).rejects.toThrow();
    await expect(
      upgrade.clientOperationClaimResult.update({
        where: { clientOperationId: receiptId },
        data: { recordedAt: new Date() },
      }),
    ).rejects.toThrow("append-only");
    await expect(
      upgrade.clientOperationClaimResult.delete({
        where: { clientOperationId: receiptId },
      }),
    ).rejects.toThrow("append-only");
  });

  it("rejects a receipt without a parent client operation", async () => {
    await expect(
      upgrade.clientOperationClaimResult.create({
        data: receipt(randomUUID()),
      }),
    ).rejects.toThrow(/client_operation_claim_result_client_operation_id_fkey/);
  });

  it.each([
    ["work order", { workOrderState: "invalid", applied: false }],
    ["assignment", { assignmentState: "invalid", applied: false }],
    ["task", { taskState: "invalid", applied: false }],
  ] as const)("rejects an invalid %s state", async (_label, overrides) => {
    const operationId = randomUUID();
    await createOperation(upgrade, operationId, false);

    await expect(
      upgrade.clientOperationClaimResult.create({
        data: receipt(operationId, overrides),
      }),
    ).rejects.toThrow(/client_operation_claim_result_.*_state_check/);
  });
});

async function seedLegacyRows(prisma: PrismaClient): Promise<void> {
  await prisma.nodeTask.create({
    data: {
      id: legacy.taskId,
      tenantId: legacy.tenantId,
      flowInstanceId: randomUUID(),
      nodeInstanceId: randomUUID(),
      nodeCode: "customs_clearance",
      containerId: randomUUID(),
      taskDefinitionKey: "migration-upgrade",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
      version: 1,
    },
  });
  await prisma.workOrder.create({
    data: {
      id: legacy.workOrderId,
      nodeTaskId: legacy.taskId,
      workOrderDefinitionKey: "migration-upgrade",
      state: "ready",
      applicability: "required",
      assignmentState: "unassigned",
      version: 1,
    },
  });
  await createOperation(prisma, legacy.operationId, false);
}

async function createOperation(
  prisma: PrismaClient,
  operationId: string,
  withReceipt: boolean,
): Promise<void> {
  const now = new Date();
  await prisma.clientOperation.create({
    data: {
      id: operationId,
      tenantId: legacy.tenantId,
      actorType: "user",
      actorId: legacy.actorId,
      actionCode: "work_execution.claim_work_order",
      actionVersion: 1,
      targetType: "work_order",
      targetId: legacy.workOrderId,
      targetOwnerModule: "work-execution",
      correlationId: randomUUID(),
      traceId: randomUUID(),
      idempotencyKey: `migration:${operationId}`,
      requestHash: "a".repeat(64),
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      resultRefs: [],
      attemptCount: 1,
      lastAttemptAt: now,
      receivedAt: now,
      decidedAt: now,
      committedAt: now,
      ...(withReceipt ? { claimResult: { create: receiptData() } } : {}),
    },
  });
}

function receipt(
  clientOperationId: string,
  overrides: Partial<{
    workOrderState: string;
    assignmentState: string;
    assigneeId: string | null;
    taskState: string;
    applied: boolean;
  }> = {},
) {
  return {
    clientOperationId,
    ...receiptData(overrides),
  };
}

function receiptData(
  overrides: Partial<{
    workOrderState: string;
    assignmentState: string;
    assigneeId: string | null;
    taskState: string;
    applied: boolean;
  }> = {},
) {
  return {
    workOrderId: legacy.workOrderId,
    workOrderState: overrides.workOrderState ?? "in_progress",
    assignmentState: overrides.assignmentState ?? "assigned",
    assigneeId:
      overrides.assigneeId === undefined
        ? legacy.actorId
        : overrides.assigneeId,
    taskId: legacy.taskId,
    taskState: overrides.taskState ?? "in_progress",
    applied: overrides.applied ?? true,
  };
}

async function migrationRows(prisma: PrismaClient, schema: string) {
  return prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT "migration_name" FROM "${schema}"."_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL`,
    MIGRATION,
  );
}

function deploy(schema: string): void {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      DATABASE_URL: withSchema(BASE_DATABASE_URL, schema),
    },
    stdio: "pipe",
  });
}

function client(schema: string): PrismaClient {
  return new PrismaClient({
    adapter: createPostgresAdapter(
      withSchema(BASE_DATABASE_URL, schema),
      schema,
    ),
  });
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
