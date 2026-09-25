import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ShipmentPendingFactCompletionCommandV1 } from "@logix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { ShipmentPendingFactCompletionNotFoundError } from "../shipment-pending-fact-completion.port";
import { PrismaShipmentPendingFactCompletion } from "./prisma-shipment-pending-fact-completion";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_pending_facts_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let writer: PrismaShipmentPendingFactCompletion;

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
  writer = new PrismaShipmentPendingFactCompletion(prisma as never);
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

describe("PrismaShipmentPendingFactCompletion", () => {
  it("fills missing Shipment facts without rebuilding operational relationships", async () => {
    const tenantId = randomUUID();
    const shipmentId = await createShipment(tenantId);
    const command = commandFor("complete-facts-1");

    const first = await writer.complete({
      tenantId,
      actorId: "operator-1",
      shipmentId,
      command,
      traceId: "trace-complete-facts-1",
    });
    const replay = await writer.complete({
      tenantId,
      actorId: "operator-1",
      shipmentId,
      command,
      traceId: "ignored-on-replay",
    });

    expect(first).toEqual({
      duplicate: false,
      relationshipVersion: 1,
      traceId: "trace-complete-facts-1",
    });
    expect(replay).toEqual({
      duplicate: true,
      relationshipVersion: 1,
      traceId: "trace-complete-facts-1",
    });
    await expect(
      prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } }),
    ).resolves.toMatchObject({
      carrierCode: "HMM",
      vesselName: "ONE INTEGRITY",
      voyageNumber: "064E",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      atdAt: new Date("2026-09-23T16:00:00.000Z"),
      relationshipVersion: 1,
      updatedBy: "operator-1",
    });
    await expect(
      prisma.shipmentHandoffRecord.count({
        where: {
          tenantId,
          shipmentId,
          sourceSystem: "logix.operator_completion",
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.containerRecord.count({ where: { tenantId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.shipmentContainerLink.count({ where: { tenantId, shipmentId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.flowInstance.count({ where: { shipmentId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.outboxMessage.count({
        where: { tenantId, aggregateType: "shipment", aggregateId: shipmentId },
      }),
    ).resolves.toBe(0);
  });

  it("rejects idempotency payload reuse and stale relationship versions", async () => {
    const tenantId = randomUUID();
    const shipmentId = await createShipment(tenantId);
    const command = commandFor("complete-facts-conflict");
    await writer.complete({
      tenantId,
      actorId: "operator-1",
      shipmentId,
      command,
      traceId: "trace-conflict",
    });

    await expect(
      writer.complete({
        tenantId,
        actorId: "operator-1",
        shipmentId,
        command: {
          ...command,
          facts: { ...command.facts, vesselName: "OTHER VESSEL" },
        },
        traceId: "trace-reused-key",
      }),
    ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_CONFLICT");
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { relationshipVersion: { increment: 1 } },
    });
    await expect(
      writer.complete({
        tenantId,
        actorId: "operator-1",
        shipmentId,
        command: commandFor("complete-facts-stale"),
        traceId: "trace-stale",
      }),
    ).rejects.toThrow("TARGET_SHIPMENT_VERSION_CONFLICT");
  });

  it("requires an audited correction instead of overwriting an existing fact", async () => {
    const tenantId = randomUUID();
    const shipmentId = await createShipment(tenantId, { carrierCode: "MSK" });

    await expect(
      writer.complete({
        tenantId,
        actorId: "operator-1",
        shipmentId,
        command: commandFor("complete-facts-existing"),
        traceId: "trace-existing",
      }),
    ).rejects.toThrow("SHIPMENT_FACT_CORRECTION_REQUIRED");
    await expect(
      prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } }),
    ).resolves.toMatchObject({ carrierCode: "MSK", relationshipVersion: 1 });
    await expect(
      prisma.shipmentHandoffRecord.count({ where: { tenantId, shipmentId } }),
    ).resolves.toBe(0);
  });

  it("does not expose or mutate a Shipment from another tenant", async () => {
    const ownerTenantId = randomUUID();
    const otherTenantId = randomUUID();
    const shipmentId = await createShipment(ownerTenantId);

    await expect(
      writer.complete({
        tenantId: otherTenantId,
        actorId: "operator-2",
        shipmentId,
        command: commandFor("complete-facts-other-tenant"),
        traceId: "trace-other-tenant",
      }),
    ).rejects.toBeInstanceOf(ShipmentPendingFactCompletionNotFoundError);
    await expect(
      prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } }),
    ).resolves.toMatchObject({ carrierCode: null, relationshipVersion: 1 });
  });
});

function commandFor(
  idempotencyKey: string,
): ShipmentPendingFactCompletionCommandV1 {
  return {
    contractVersion: "shipment-pending-fact-completion.v1",
    expectedRelationshipVersion: 1,
    occurredAt: "2026-09-24T08:00:00.000Z",
    idempotencyKey,
    facts: {
      carrierCode: "HMM",
      vesselName: "ONE INTEGRITY",
      voyageNumber: "064E",
      originPortCode: "CNNGB",
      destinationPortCode: "USLAX",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-23T16:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "44444444-4444-4444-8444-444444444444",
      },
    },
  };
}

async function createShipment(
  tenantId: string,
  facts: { carrierCode?: string } = {},
): Promise<string> {
  const shipment = await prisma.shipment.create({
    data: {
      tenantId,
      sourceSystem: "post_departure_source_package",
      sourceVersion: "1",
      transportMode: "ocean",
      currentLifecycleStatus: "departed",
      createdBy: "source-import",
      updatedBy: "source-import",
      carrierCode: facts.carrierCode,
    },
    select: { id: true },
  });
  return shipment.id;
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
