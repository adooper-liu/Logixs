import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StartPostDepartureLifecycleCommandV2 } from "@logix/contracts";
import { hashPostDepartureLifecycleCommand } from "@logix/contracts/post-departure-lifecycle";
import { Prisma, PrismaClient } from "../../../../../../generated/prisma";
import { PrismaPostDepartureLifecycleRepository } from "./prisma-post-departure-lifecycle.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_post_departure_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaPostDepartureLifecycleRepository;

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
  repository = new PrismaPostDepartureLifecycleRepository(prisma as never);
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: withSchema(BASE_DATABASE_URL, "public") },
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

describe("PrismaPostDepartureLifecycleRepository", () => {
  it("one Inbox transaction initializes all container flows and freezes the Shipment event scope", async () => {
    const fixture = await createFixture();

    await expect(
      repository.initialize(initializationInput(fixture)),
    ).resolves.toEqual({
      shipmentId: fixture.shipmentId,
      canonicalEventId: fixture.command.departureEventId,
      relationshipVersion: 1,
      lifecycleVersion: 2,
      containerCount: 2,
      initialized: true,
    });

    const [
      shipment,
      flows,
      event,
      nodeApplications,
      shipmentApplication,
      inbox,
    ] = await Promise.all([
      prisma.shipment.findUniqueOrThrow({
        where: { id: fixture.shipmentId },
      }),
      prisma.flowInstance.findMany({
        where: { shipmentId: fixture.shipmentId },
        include: { nodes: true },
      }),
      prisma.canonicalEvent.findUniqueOrThrow({
        where: { id: fixture.command.departureEventId },
        include: { scopeMembers: true },
      }),
      prisma.nodeEventApplication.findMany({
        where: { eventId: fixture.command.departureEventId },
      }),
      prisma.shipmentEventApplication.findUniqueOrThrow({
        where: { eventId: fixture.command.departureEventId },
      }),
      prisma.inboxMessage.findUniqueOrThrow({
        where: { id: fixture.inboxId },
      }),
    ]);

    expect(shipment.lifecycleVersion).toBe(2);
    expect(flows).toHaveLength(2);
    for (const flow of flows) {
      expect(flow).toMatchObject({
        definitionCode: "post_departure_ocean",
        definitionVersion: 1,
        currentNodeCode: "ocean_transit",
        version: 1,
        shipmentRelationshipVersion: 1,
      });
      expect(flow.nodes).toHaveLength(11);
      expect(flow.nodes.some((node) => node.nodeCode === "cargo_ready")).toBe(
        false,
      );
      expect(
        flow.nodes.find((node) => node.nodeCode === "origin_departure"),
      ).toMatchObject({ state: "completed" });
      expect(
        flow.nodes.find((node) => node.nodeCode === "ocean_transit"),
      ).toMatchObject({ state: "active" });
    }
    expect(event).toMatchObject({
      eventVersion: 2,
      subjectType: "shipment",
      subjectId: fixture.shipmentId,
      scopeVersion: 1,
      containerId: null,
      domainFactType: "shipment_handoff",
    });
    expect(event.scopeMembers).toHaveLength(2);
    expect(nodeApplications).toHaveLength(2);
    expect(nodeApplications.every((row) => row.state === "applied")).toBe(true);
    expect(shipmentApplication).toMatchObject({
      state: "applied",
      projectionVersion: 2,
      previousStatus: "departed",
      resultingStatus: "departed",
    });
    expect(inbox.state).toBe("processed");
    await expect(
      prisma.outboxMessage.findUniqueOrThrow({
        where: { eventId: fixture.command.departureEventId },
      }),
    ).resolves.toMatchObject({
      ownerModule: "lifecycle-control",
      eventType: "departed",
      aggregateType: "shipment",
      aggregateId: fixture.shipmentId,
    });

    const replayInboxId = randomUUID();
    await createProcessingInbox(
      replayInboxId,
      fixture.tenantId,
      fixture.command,
    );
    await expect(
      repository.initialize({
        tenantId: fixture.tenantId,
        command: fixture.command,
        completeInbox: {
          id: replayInboxId,
          owner: "worker-1",
          processedAt: new Date("2026-09-23T10:02:00Z"),
        },
      }),
    ).resolves.toMatchObject({ initialized: false, containerCount: 2 });
    await expect(
      prisma.flowInstance.count({ where: { shipmentId: fixture.shipmentId } }),
    ).resolves.toBe(2);
  });

  it("relationship version mismatch rolls back every lifecycle fact and keeps Inbox retryable", async () => {
    const fixture = await createFixture();
    const conflicting = { ...fixture.command, relationshipVersion: 2 };

    await expect(
      repository.initialize({
        tenantId: fixture.tenantId,
        command: conflicting,
        completeInbox: {
          id: fixture.inboxId,
          owner: "worker-1",
          processedAt: new Date("2026-09-23T10:01:00Z"),
        },
      }),
    ).rejects.toThrow("POST_DEPARTURE_RELATIONSHIP_VERSION_CONFLICT");

    const [flows, event, inbox, shipment] = await Promise.all([
      prisma.flowInstance.count({ where: { shipmentId: fixture.shipmentId } }),
      prisma.canonicalEvent.findUnique({
        where: { id: fixture.command.departureEventId },
      }),
      prisma.inboxMessage.findUniqueOrThrow({
        where: { id: fixture.inboxId },
      }),
      prisma.shipment.findUniqueOrThrow({
        where: { id: fixture.shipmentId },
      }),
    ]);
    expect({ flows, event }).toEqual({ flows: 0, event: null });
    expect(inbox.state).toBe("processing");
    expect(shipment.lifecycleVersion).toBe(1);
  });
});

async function createFixture() {
  const tenantId = randomUUID();
  const shipmentId = randomUUID();
  const handoffId = randomUUID();
  const actorId = randomUUID();
  const containerIds = [randomUUID(), randomUUID()].sort();
  const command: StartPostDepartureLifecycleCommandV2 = {
    shipmentId,
    containerIds:
      containerIds as StartPostDepartureLifecycleCommandV2["containerIds"],
    flowDefinitionCode: "post_departure_ocean",
    definitionVersion: 1,
    departureEventId: randomUUID(),
    relationshipVersion: 1,
    idempotencyKey: `${randomUUID()}:post-departure`,
    traceId: `trace-${randomUUID()}`,
  };
  const departureAt = "2026-09-22T10:00:00.000Z";
  const correlationId = randomUUID();
  const handoffPayload = {
    tenantId,
    sourceProfile: "api_v1",
    source: {
      channel: "api",
      system: "carrier-api",
      externalHandoffId: `handoff-${handoffId}`,
      handoffVersion: 1,
      occurredAt: departureAt,
      idempotencyKey: `handoff-${handoffId}`,
      correlationId,
      traceId: command.traceId,
    },
    shipment: {
      externalShipmentId: `shipment-${shipmentId}`,
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originPortCode: "CNNGB",
      destinationPortCode: "USLAX",
      destinationCountryCode: "US",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: departureAt,
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: randomUUID(),
      },
    },
    billsOfLading: [],
    containers: [],
    evidenceReferences: [],
  };

  await prisma.shipment.create({
    data: {
      id: shipmentId,
      tenantId,
      sourceSystem: "carrier-api",
      sourceRecordId: `shipment-${shipmentId}`,
      sourceVersion: "1",
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      atdAt: new Date(departureAt),
      currentLifecycleStatus: "departed",
      lifecycleVersion: 1,
      relationshipVersion: 1,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  await prisma.shipmentHandoffRecord.create({
    data: {
      id: handoffId,
      tenantId,
      sourceProfile: "api_v1",
      ingestionChannel: "api",
      sourceSystem: "carrier-api",
      externalHandoffId: `handoff-${handoffId}`,
      handoffVersion: 1,
      occurredAt: new Date(departureAt),
      idempotencyKey: `handoff-${handoffId}`,
      payloadHash: "a".repeat(64),
      payloadJson: handoffPayload,
      lifecycleRequestJson: command as unknown as Prisma.InputJsonValue,
      status: "accepted",
      shipmentId,
      actorId,
      traceId: command.traceId,
    },
  });
  for (const [index, containerId] of containerIds.entries()) {
    await prisma.containerRecord.create({
      data: {
        id: containerId,
        tenantId,
        containerNumber: `HMMU${String(index + 1).padStart(7, "0")}`,
        currentStatus: "shipped",
      },
    });
    await prisma.shipmentContainerLink.create({
      data: {
        id: randomUUID(),
        tenantId,
        shipmentId,
        containerRecordId: containerId,
        version: 1,
        state: "active",
        sourceHandoffId: handoffId,
        evidenceRefs: [],
        idempotencyKey: `link-${shipmentId}-${containerId}`,
        joinedAt: new Date(departureAt),
      },
    });
  }
  const inboxId = randomUUID();
  await createProcessingInbox(inboxId, tenantId, command);
  return { tenantId, shipmentId, command, inboxId };
}

async function createProcessingInbox(
  inboxId: string,
  tenantId: string,
  command: StartPostDepartureLifecycleCommandV2,
) {
  await prisma.inboxMessage.create({
    data: {
      id: inboxId,
      tenantId,
      consumerName: "lifecycle-control-inbox",
      messageId: randomUUID(),
      payloadHash: hashPostDepartureLifecycleCommand(command),
      payloadJson: command as unknown as Prisma.InputJsonValue,
      state: "processing",
      attemptCount: 1,
      leaseOwner: "worker-1",
      leaseLockedAt: new Date("2026-09-23T10:00:00Z"),
      leaseExpiresAt: new Date("2026-09-23T10:05:00Z"),
      traceId: command.traceId,
      receivedAt: new Date("2026-09-23T10:00:00Z"),
    },
  });
}

function initializationInput(
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  return {
    tenantId: fixture.tenantId,
    command: fixture.command,
    completeInbox: {
      id: fixture.inboxId,
      owner: "worker-1",
      processedAt: new Date("2026-09-23T10:01:00Z"),
    },
  };
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
