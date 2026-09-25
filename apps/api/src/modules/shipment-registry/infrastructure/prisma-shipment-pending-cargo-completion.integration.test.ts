import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ShipmentPendingCargoCompletionCommandV1 } from "@logix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { PrismaShipmentPendingCargoCompletion } from "./prisma-shipment-pending-cargo-completion";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_pending_cargo_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let writer: PrismaShipmentPendingCargoCompletion;

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
  writer = new PrismaShipmentPendingCargoCompletion(prisma as never);
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

describe("PrismaShipmentPendingCargoCompletion", () => {
  it("adds audited cargo and per-container allocations without rebuilding Shipment relationships", async () => {
    const fixture = await createFixture();
    const productSku = await prisma.productSku.create({
      data: { tenantId: fixture.tenantId, productNumber: "SKU-001" },
    });
    const command = commandFor(fixture.containerIds);
    const input = {
      tenantId: fixture.tenantId,
      actorId: "operator-1",
      shipmentId: fixture.shipmentId,
      command,
      evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      resolvedProductSkuIds: new Map([["SKU-001", productSku.id]]),
      traceId: "trace-pending-cargo",
    };

    const first = await writer.complete(input);
    const replay = await writer.complete({
      ...input,
      traceId: "ignored-on-replay",
      resolvedProductSkuIds: new Map([
        ["SKU-001", productSku.id],
        ["SKU-NEW", randomUUID()],
      ]),
    });

    expect(first).toEqual({
      duplicate: false,
      relationshipVersion: 1,
      cargoLineCount: 2,
      unmatchedSkuCount: 1,
      traceId: "trace-pending-cargo",
    });
    expect(replay).toEqual({
      duplicate: true,
      relationshipVersion: 1,
      cargoLineCount: 2,
      unmatchedSkuCount: 1,
      traceId: "trace-pending-cargo",
    });
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: fixture.shipmentId },
      include: {
        cargoLines: { orderBy: { lineNo: "asc" } },
        containerLinks: true,
        handoffs: {
          where: { sourceSystem: "logix.operator_cargo_completion" },
        },
      },
    });
    expect(shipment.relationshipVersion).toBe(1);
    expect(shipment.containerLinks).toHaveLength(2);
    expect(shipment.handoffs).toHaveLength(1);
    expect(shipment.cargoLines).toEqual([
      expect.objectContaining({
        productNumberSnapshot: "SKU-001",
        productSkuId: productSku.id,
        sourceHandoffId: shipment.handoffs[0]!.id,
      }),
      expect.objectContaining({
        productNumberSnapshot: "SKU-NEW",
        productSkuId: null,
        sourceHandoffId: shipment.handoffs[0]!.id,
      }),
    ]);
    await expect(
      prisma.containerCargoAllocationSet.count({
        where: {
          tenantId: fixture.tenantId,
          containerRecordId: { in: fixture.containerIds },
          state: "active",
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.containerCargoAllocation.count({
        where: { tenantId: fixture.tenantId },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.containerRecord.count({ where: { tenantId: fixture.tenantId } }),
    ).resolves.toBe(2);
    await expect(
      prisma.outboxMessage.count({
        where: { tenantId: fixture.tenantId, aggregateId: fixture.shipmentId },
      }),
    ).resolves.toBe(0);
  });

  it("rejects an unlinked container and an existing cargo correction", async () => {
    const invalidFixture = await createFixture();
    await expect(
      writer.complete({
        tenantId: invalidFixture.tenantId,
        actorId: "operator-1",
        shipmentId: invalidFixture.shipmentId,
        command: commandFor([randomUUID()]),
        evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        resolvedProductSkuIds: new Map(),
        traceId: "trace-invalid-container",
      }),
    ).rejects.toThrow("SHIPMENT_CONTAINER_REFERENCE_INVALID");

    const fixture = await createFixture();
    await writer.complete({
      tenantId: fixture.tenantId,
      actorId: "operator-1",
      shipmentId: fixture.shipmentId,
      command: commandFor(fixture.containerIds),
      evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      resolvedProductSkuIds: new Map(),
      traceId: "trace-first-cargo",
    });
    await expect(
      writer.complete({
        tenantId: fixture.tenantId,
        actorId: "operator-1",
        shipmentId: fixture.shipmentId,
        command: {
          ...commandFor(fixture.containerIds),
          idempotencyKey: "pending-cargo-correction",
        },
        evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        resolvedProductSkuIds: new Map(),
        traceId: "trace-correction",
      }),
    ).rejects.toThrow("SHIPMENT_CARGO_CORRECTION_REQUIRED");
  });

  it("enforces tenant, relationship version and idempotency boundaries", async () => {
    const tenantFixture = await createFixture();
    await expect(
      writer.complete({
        tenantId: randomUUID(),
        actorId: "operator-1",
        shipmentId: tenantFixture.shipmentId,
        command: commandFor(tenantFixture.containerIds),
        evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        resolvedProductSkuIds: new Map(),
        traceId: "trace-other-tenant",
      }),
    ).rejects.toThrow("SHIPMENT_NOT_FOUND");

    const staleFixture = await createFixture();
    await prisma.shipment.update({
      where: { id: staleFixture.shipmentId },
      data: { relationshipVersion: 2 },
    });
    await expect(
      writer.complete({
        tenantId: staleFixture.tenantId,
        actorId: "operator-1",
        shipmentId: staleFixture.shipmentId,
        command: commandFor(staleFixture.containerIds),
        evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        resolvedProductSkuIds: new Map(),
        traceId: "trace-stale",
      }),
    ).rejects.toThrow("TARGET_SHIPMENT_VERSION_CONFLICT");

    const idempotencyFixture = await createFixture();
    const command = commandFor(idempotencyFixture.containerIds);
    await writer.complete({
      tenantId: idempotencyFixture.tenantId,
      actorId: "operator-1",
      shipmentId: idempotencyFixture.shipmentId,
      command,
      evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      resolvedProductSkuIds: new Map(),
      traceId: "trace-idempotency",
    });
    await expect(
      writer.complete({
        tenantId: idempotencyFixture.tenantId,
        actorId: "operator-1",
        shipmentId: idempotencyFixture.shipmentId,
        command: {
          ...command,
          lines: [
            { ...command.lines[0], quantity: "99" },
            ...command.lines.slice(1),
          ],
        },
        evidenceRef: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        resolvedProductSkuIds: new Map(),
        traceId: "trace-idempotency-conflict",
      }),
    ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_CONFLICT");
  });
});

function commandFor(
  containerIds: string[],
): ShipmentPendingCargoCompletionCommandV1 {
  return {
    contractVersion: "shipment-pending-cargo-completion.v1",
    expectedRelationshipVersion: 1,
    occurredAt: "2026-09-24T08:00:00.000Z",
    idempotencyKey: "pending-cargo-1",
    lines: [
      {
        containerRecordId: containerIds[0]!,
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece",
      },
      {
        containerRecordId: containerIds[1] ?? containerIds[0]!,
        productNumber: "SKU-NEW",
        quantity: "5",
        quantityUnit: "piece",
      },
    ],
  };
}

async function createFixture(): Promise<{
  tenantId: string;
  shipmentId: string;
  containerIds: string[];
}> {
  const tenantId = randomUUID();
  const shipmentId = randomUUID();
  const sourceHandoffId = randomUUID();
  const containerIds = [randomUUID(), randomUUID()];
  await prisma.shipment.create({
    data: {
      id: shipmentId,
      tenantId,
      sourceSystem: "post_departure_source_package",
      sourceVersion: "1",
      transportMode: "ocean",
      currentLifecycleStatus: "departed",
      createdBy: "source-import",
      updatedBy: "source-import",
    },
  });
  await prisma.shipmentHandoffRecord.create({
    data: {
      id: sourceHandoffId,
      tenantId,
      sourceProfile: "legacy_departed_file_v1",
      ingestionChannel: "file_import",
      sourceSystem: "post_departure_source_package",
      externalHandoffId: `source:${shipmentId}`,
      handoffVersion: 1,
      occurredAt: new Date("2026-09-23T16:00:00.000Z"),
      idempotencyKey: `source:${shipmentId}`,
      payloadHash: "a".repeat(64),
      payloadJson: {},
      status: "accepted",
      shipmentId,
      actorId: "source-import",
      traceId: `trace:${shipmentId}`,
    },
  });
  for (const [index, containerId] of containerIds.entries()) {
    await prisma.containerRecord.create({
      data: {
        id: containerId,
        tenantId,
        containerNumber: `MSCU${1000000 + index}`,
        currentStatus: "shipped",
      },
    });
    await prisma.shipmentContainerLink.create({
      data: {
        tenantId,
        shipmentId,
        containerRecordId: containerId,
        version: 1,
        state: "active",
        sourceHandoffId,
        evidenceRefs: [],
        idempotencyKey: `source-link:${containerId}`,
        joinedAt: new Date("2026-09-23T16:00:00.000Z"),
      },
    });
  }
  return { tenantId, shipmentId, containerIds };
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
