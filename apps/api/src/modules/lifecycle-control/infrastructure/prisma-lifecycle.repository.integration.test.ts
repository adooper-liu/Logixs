import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { WORK_FACT_RECONCILIATION_EVENT_TYPE } from "../domain/work-fact-reconciliation-outbox";
import { PrismaLifecycleRepository } from "./prisma-lifecycle.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_lifecycle_outbox_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaLifecycleRepository;

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl },
      { schema: schemaName },
    ),
  });
  await prisma.$connect();
  repository = new PrismaLifecycleRepository(prisma as never);
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: withSchema(BASE_DATABASE_URL, "public"),
      },
      { schema: "public" },
    ),
  });
  try {
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await admin.$disconnect();
  }
});

describe("PrismaLifecycleRepository reconciliation Outbox transaction", () => {
  it("one canonical event creates one independent Outbox per applied target node", async () => {
    const fixture = await createFixture();

    await repository.applyEventToNode({
      tenantId: fixture.tenantId,
      flowInstanceId: fixture.flowInstanceId,
      expectedFlowVersion: 0,
      eventId: fixture.eventId,
      targetNodeInstanceId: fixture.firstNodeId,
      targetNodeCode: "ocean_transit",
      nextNodeCode: "destination_arrival",
      occurredAt: fixture.occurredAt,
      evaluatedAt: fixture.occurredAt,
      guardResults: [],
      routeSegmentGuard: null,
      traceId: "trace-first-node",
    });
    await repository.applyEventToNode({
      tenantId: fixture.tenantId,
      flowInstanceId: fixture.flowInstanceId,
      expectedFlowVersion: 1,
      eventId: fixture.eventId,
      targetNodeInstanceId: fixture.secondNodeId,
      targetNodeCode: "destination_arrival",
      nextNodeCode: null,
      occurredAt: fixture.occurredAt,
      evaluatedAt: fixture.occurredAt,
      guardResults: [],
      routeSegmentGuard: null,
      traceId: "trace-second-node",
    });

    const [applications, messages] = await Promise.all([
      prisma.nodeEventApplication.findMany({
        where: { eventId: fixture.eventId, state: "applied" },
      }),
      prisma.outboxMessage.findMany({
        where: {
          eventType: WORK_FACT_RECONCILIATION_EVENT_TYPE,
          causationId: fixture.eventId,
        },
      }),
    ]);
    expect(applications).toHaveLength(2);
    expect(messages).toHaveLength(2);
    expect(
      new Set(messages.map((message) => message.idempotencyKey)).size,
    ).toBe(2);
    expect(messages.map((message) => message.aggregateId).sort()).toEqual(
      applications.map((application) => application.id).sort(),
    );
    const firstMessage = messages.find(
      (message) => message.aggregateId === applications[0]?.id,
    );
    const migrationHash = await prisma.$queryRawUnsafe<
      Array<{ payload_hash: string }>
    >(
      `WITH payload AS (
         SELECT jsonb_build_object(
           'canonicalEventId', $1::text,
           'containerId', $2::text,
           'flowInstanceId', $3::text,
           'nodeEventApplicationId', $4::text,
           'nodeInstanceId', $5::text,
           'tenantId', $6::text
         )::text AS value
       )
       SELECT encode(sha256(convert_to(value, 'UTF8')), 'hex') AS payload_hash
       FROM payload`,
      fixture.eventId,
      fixture.containerId,
      fixture.flowInstanceId,
      applications[0]?.id,
      applications[0]?.targetNodeInstanceId,
      fixture.tenantId,
    );
    expect(firstMessage?.payloadHash).toBe(migrationHash[0]?.payload_hash);
  });

  it("Outbox insert failure rolls back node, flow and application together", async () => {
    const fixture = await createFixture();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${schemaName}"."fail_reconciliation_outbox_insert"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."event_type" = '${WORK_FACT_RECONCILIATION_EVENT_TYPE}' THEN
          RAISE EXCEPTION 'forced reconciliation outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER "fail_reconciliation_outbox_insert"
      BEFORE INSERT ON "${schemaName}"."outbox_message"
      FOR EACH ROW EXECUTE FUNCTION "${schemaName}"."fail_reconciliation_outbox_insert"();
    `);
    try {
      await expect(
        repository.applyEventToNode({
          tenantId: fixture.tenantId,
          flowInstanceId: fixture.flowInstanceId,
          expectedFlowVersion: 0,
          eventId: fixture.eventId,
          targetNodeInstanceId: fixture.firstNodeId,
          targetNodeCode: "ocean_transit",
          nextNodeCode: "destination_arrival",
          occurredAt: fixture.occurredAt,
          evaluatedAt: fixture.occurredAt,
          guardResults: [],
          routeSegmentGuard: null,
          traceId: "trace-rollback",
        }),
      ).rejects.toBeTruthy();
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER "fail_reconciliation_outbox_insert" ON "${schemaName}"."outbox_message";
        DROP FUNCTION "${schemaName}"."fail_reconciliation_outbox_insert"();
      `);
    }

    const [flow, node, applications, messages] = await Promise.all([
      prisma.flowInstance.findUniqueOrThrow({
        where: { id: fixture.flowInstanceId },
      }),
      prisma.nodeInstance.findUniqueOrThrow({
        where: { id: fixture.firstNodeId },
      }),
      prisma.nodeEventApplication.count({
        where: { eventId: fixture.eventId },
      }),
      prisma.outboxMessage.count({
        where: {
          eventType: WORK_FACT_RECONCILIATION_EVENT_TYPE,
          causationId: fixture.eventId,
        },
      }),
    ]);
    expect(flow).toMatchObject({
      version: 0,
      state: "active",
      currentNodeCode: "ocean_transit",
    });
    expect(node).toMatchObject({ state: "active", completedAt: null });
    expect({ applications, messages }).toEqual({
      applications: 0,
      messages: 0,
    });
  });
});

async function createFixture() {
  const tenantId = `tenant-${randomUUID()}`;
  const containerId = randomUUID();
  const flowInstanceId = randomUUID();
  const firstNodeId = randomUUID();
  const secondNodeId = randomUUID();
  const eventId = randomUUID();
  const occurredAt = new Date("2026-09-21T08:00:00.000Z");
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId,
      orderNumber: `ORDER-${randomUUID()}`,
      currentStatus: "in_transit",
    },
  });
  await prisma.flowInstance.create({
    data: {
      id: flowInstanceId,
      containerId,
      state: "active",
      currentNodeCode: "ocean_transit",
    },
  });
  await prisma.nodeInstance.createMany({
    data: [
      {
        id: firstNodeId,
        flowInstanceId,
        nodeCode: "ocean_transit",
        state: "active",
      },
      {
        id: secondNodeId,
        flowInstanceId,
        nodeCode: "destination_arrival",
        state: "pending",
      },
    ],
  });
  await prisma.canonicalEvent.create({
    data: {
      id: eventId,
      containerId,
      eventCode: "arrived",
      occurredAt,
      evidenceRefs: ["evidence-1"],
      idempotencyKey: `event-${randomUUID()}`,
    },
  });
  return {
    tenantId,
    containerId,
    flowInstanceId,
    firstNodeId,
    secondNodeId,
    eventId,
    occurredAt,
  };
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
