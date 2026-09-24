import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { PrismaShipmentReadRepository } from "./prisma-shipment-read.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_shipment_read_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaShipmentReadRepository;

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
  repository = new PrismaShipmentReadRepository(prisma as never);
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

describe("PrismaShipmentReadRepository integration", () => {
  it("reads one tenant-scoped Shipment with its current container, cargo, document and lifecycle projection", async () => {
    const fixture = await createFixture();

    await expect(
      repository.list({ tenantId: fixture.tenantId, take: 51 }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: fixture.shipmentId,
        activeContainerCount: 1,
        activeCargoLineCount: 1,
        lifecycleInitializationState: "ready",
      }),
    ]);

    await expect(
      repository.findById({
        tenantId: fixture.tenantId,
        id: fixture.shipmentId,
      }),
    ).resolves.toMatchObject({
      shipment: { id: fixture.shipmentId },
      containers: [
        {
          containerRecordId: fixture.containerId,
          currentNodeCode: "ocean_transit",
          allocations: [
            {
              shipmentCargoLineId: fixture.cargoLineId,
              allocatedQuantity: "15",
            },
          ],
        },
      ],
      cargoLines: [{ id: fixture.cargoLineId, productNumber: "SKU-REAL-001" }],
      transportDocuments: [
        {
          id: fixture.documentId,
          documentType: "mbl",
          containerRecordIds: [fixture.containerId],
        },
      ],
      upstreamReferences: [
        {
          referenceType: "stocking_order",
          sourceRecordId: "26DSC01811",
        },
      ],
      lifecycleInitialization: {
        state: "ready",
        activeContainerCount: 1,
        initializedContainerCount: 1,
      },
    });

    await expect(
      repository.findById({
        tenantId: randomUUID(),
        id: fixture.shipmentId,
      }),
    ).resolves.toBeNull();
  });
});

async function createFixture() {
  const tenantId = randomUUID();
  const shipmentId = randomUUID();
  const handoffId = randomUUID();
  const containerId = randomUUID();
  const linkId = randomUUID();
  const cargoLineId = randomUUID();
  const allocationSetId = randomUUID();
  const documentId = randomUUID();
  const actorId = randomUUID();
  const occurredAt = new Date("2026-09-22T10:00:00.000Z");

  await prisma.shipment.create({
    data: {
      id: shipmentId,
      tenantId,
      shipmentNumber: "SHIP-REAL-001",
      sourceSystem: "integration-test",
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
      atdAt: occurredAt,
      etaAt: new Date("2026-10-10T10:00:00.000Z"),
      currentLifecycleStatus: "departed",
      lifecycleVersion: 2,
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
      sourceSystem: "integration-test",
      externalHandoffId: `handoff-${handoffId}`,
      handoffVersion: 1,
      occurredAt,
      idempotencyKey: `handoff-${handoffId}`,
      payloadHash: "a".repeat(64),
      payloadJson: {},
      status: "accepted",
      shipmentId,
      actorId,
      traceId: `trace-${handoffId}`,
    },
  });
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId,
      containerNumber: "HMMU4207629",
      containerTypeCode: "40HC",
      sealNumber: "SEAL-001",
      currentStatus: "shipped",
    },
  });
  await prisma.shipmentContainerLink.create({
    data: {
      id: linkId,
      tenantId,
      shipmentId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      evidenceRefs: [randomUUID()],
      idempotencyKey: `link-${linkId}`,
      joinedAt: occurredAt,
    },
  });
  await prisma.shipmentCargoLine.create({
    data: {
      id: cargoLineId,
      tenantId,
      shipmentId,
      lineNo: 1,
      productNumberSnapshot: "SKU-REAL-001",
      quantity: "15",
      quantityUnit: "carton",
      packageCount: "15",
      packageUnit: "carton",
      grossWeight: "120.5",
      weightUnit: "kg",
      volume: "3.25",
      volumeUnit: "m3",
      sourceHandoffId: handoffId,
      sourceLineId: "source-line-1",
      version: 1,
      state: "active",
    },
  });
  await prisma.containerCargoAllocationSet.create({
    data: {
      id: allocationSetId,
      tenantId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      ingestionChannel: "api",
      sourceSystem: "integration-test",
      evidenceRefs: [randomUUID()],
      idempotencyKey: `allocation-${allocationSetId}`,
      payloadHash: "b".repeat(64),
    },
  });
  await prisma.containerCargoAllocation.create({
    data: {
      tenantId,
      allocationSetId,
      shipmentCargoLineId: cargoLineId,
      allocatedQuantity: "15",
      quantityUnit: "carton",
      packageCount: "15",
      packageUnit: "carton",
      grossWeight: "120.5",
      weightUnit: "kg",
      volume: "3.25",
      volumeUnit: "m3",
    },
  });
  await prisma.shipmentTransportDocument.create({
    data: {
      id: documentId,
      tenantId,
      shipmentId,
      documentType: "mbl",
      documentNumber: "NBOZ9FF56400",
      scac: "HDMU",
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      effectiveFrom: occurredAt,
    },
  });
  await prisma.shipmentContainerDocumentLink.create({
    data: {
      tenantId,
      shipmentId,
      containerRecordId: containerId,
      shipmentContainerLinkId: linkId,
      transportDocumentId: documentId,
      sourceHandoffId: handoffId,
    },
  });
  await prisma.shipmentUpstreamReference.create({
    data: {
      tenantId,
      shipmentId,
      containerRecordId: containerId,
      shipmentCargoLineId: cargoLineId,
      referenceType: "stocking_order",
      sourceSystem: "packing-platform",
      sourceRecordId: "26DSC01811",
      sourceVersion: "1",
      sourceLineId: "source-line-1",
      sourceHandoffId: handoffId,
      version: 1,
      state: "active",
    },
  });
  await prisma.flowInstance.create({
    data: {
      id: randomUUID(),
      containerId,
      state: "active",
      currentNodeCode: "ocean_transit",
      version: 1,
      definitionCode: "post_departure_ocean",
      definitionVersion: 1,
      shipmentId,
      shipmentRelationshipVersion: 1,
    },
  });

  return { tenantId, shipmentId, containerId, cargoLineId, documentId };
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
