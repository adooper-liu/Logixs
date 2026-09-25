import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import type {
  ShipmentPendingDocumentCompletionCommandV1,
  ShipmentPendingSkuBindingCommandV1,
} from "@logix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { PrismaShipmentPendingDocumentCompletion } from "./prisma-shipment-pending-document-completion";
import { PrismaShipmentPendingSkuBinding } from "./prisma-shipment-pending-sku-binding";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_pending_refs_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let skuWriter: PrismaShipmentPendingSkuBinding;
let documentWriter: PrismaShipmentPendingDocumentCompletion;

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
  skuWriter = new PrismaShipmentPendingSkuBinding(prisma as never);
  documentWriter = new PrismaShipmentPendingDocumentCompletion(prisma as never);
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

describe("pending Shipment reference completion", () => {
  it("binds a SKU with an operator Handoff and preserves the cargo source", async () => {
    const fixture = await createFixture({ withCargoLine: true });
    const productSku = await prisma.productSku.create({
      data: { tenantId: fixture.tenantId, productNumber: "SKU-NEW" },
    });
    const command = skuCommand(fixture.cargoLineId!);
    const input = {
      tenantId: fixture.tenantId,
      actorId: "operator-1",
      shipmentId: fixture.shipmentId,
      command,
      productSkuId: productSku.id,
      productNumber: "SKU-NEW",
      skuResolution: "matched_existing" as const,
      traceId: "trace-sku-binding",
    };

    await expect(skuWriter.bind(input)).resolves.toEqual({
      duplicate: false,
      relationshipVersion: 1,
      cargoLineVersion: 2,
      skuResolution: "matched_existing",
      traceId: "trace-sku-binding",
    });
    await expect(
      skuWriter.bind({ ...input, traceId: "ignored-on-replay" }),
    ).resolves.toEqual({
      duplicate: true,
      relationshipVersion: 1,
      cargoLineVersion: 2,
      skuResolution: "matched_existing",
      traceId: "trace-sku-binding",
    });

    const line = await prisma.shipmentCargoLine.findUniqueOrThrow({
      where: { id: fixture.cargoLineId! },
    });
    expect(line).toMatchObject({
      productSkuId: productSku.id,
      version: 2,
      sourceHandoffId: fixture.sourceHandoffId,
    });
    const operatorHandoff = await prisma.shipmentHandoffRecord.findFirstOrThrow(
      {
        where: {
          tenantId: fixture.tenantId,
          sourceSystem: "logix.operator_sku_binding",
        },
        include: { objectResults: true },
      },
    );
    expect(operatorHandoff.objectResults).toEqual([
      expect.objectContaining({
        objectType: "cargo_line",
        entityId: fixture.cargoLineId,
      }),
    ]);
  });

  it("rejects stale SKU binding versions and cross-tenant writes", async () => {
    const fixture = await createFixture({ withCargoLine: true });
    const productSku = await prisma.productSku.create({
      data: { tenantId: fixture.tenantId, productNumber: "SKU-NEW" },
    });
    await expect(
      skuWriter.bind({
        tenantId: fixture.tenantId,
        actorId: "operator-1",
        shipmentId: fixture.shipmentId,
        command: {
          ...skuCommand(fixture.cargoLineId!),
          expectedCargoLineVersion: 2,
        },
        productSkuId: productSku.id,
        productNumber: "SKU-NEW",
        skuResolution: "matched_existing",
        traceId: "trace-stale-sku",
      }),
    ).rejects.toThrow("SHIPMENT_CARGO_LINE_VERSION_CONFLICT");
    await expect(
      skuWriter.bind({
        tenantId: randomUUID(),
        actorId: "operator-1",
        shipmentId: fixture.shipmentId,
        command: skuCommand(fixture.cargoLineId!),
        productSkuId: productSku.id,
        productNumber: "SKU-NEW",
        skuResolution: "matched_existing",
        traceId: "trace-other-tenant",
      }),
    ).rejects.toThrow("SHIPMENT_NOT_FOUND");
  });

  it("adds a transport document and its selected container links under one Handoff", async () => {
    const fixture = await createFixture({ withCargoLine: false });
    const command = documentCommand(fixture.containerIds);
    const input = {
      tenantId: fixture.tenantId,
      actorId: "operator-1",
      shipmentId: fixture.shipmentId,
      command,
      traceId: "trace-document",
    };

    await expect(documentWriter.complete(input)).resolves.toEqual({
      duplicate: false,
      relationshipVersion: 1,
      documentCount: 1,
      traceId: "trace-document",
    });
    await expect(
      documentWriter.complete({ ...input, traceId: "ignored-on-replay" }),
    ).resolves.toEqual({
      duplicate: true,
      relationshipVersion: 1,
      documentCount: 1,
      traceId: "trace-document",
    });

    const document = await prisma.shipmentTransportDocument.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, shipmentId: fixture.shipmentId },
      include: { containerLinks: true, sourceHandoff: true },
    });
    expect(document).toMatchObject({
      documentType: "mbl",
      documentNumber: "NBOZ9FF56400",
      scac: "HMMU",
      version: 1,
    });
    expect(document.containerLinks).toHaveLength(2);
    expect(document.sourceHandoff.sourceSystem).toBe(
      "logix.operator_document_completion",
    );
    expect(
      document.containerLinks.every(
        ({ sourceHandoffId }) => sourceHandoffId === document.sourceHandoffId,
      ),
    ).toBe(true);
  });

  it("rejects unlinked containers and an active duplicate document", async () => {
    const fixture = await createFixture({ withCargoLine: false });
    await expect(
      documentWriter.complete({
        tenantId: fixture.tenantId,
        actorId: "operator-1",
        shipmentId: fixture.shipmentId,
        command: documentCommand([randomUUID()]),
        traceId: "trace-invalid-container",
      }),
    ).rejects.toThrow("SHIPMENT_CONTAINER_REFERENCE_INVALID");

    const command = documentCommand(fixture.containerIds);
    await documentWriter.complete({
      tenantId: fixture.tenantId,
      actorId: "operator-1",
      shipmentId: fixture.shipmentId,
      command,
      traceId: "trace-first-document",
    });
    await expect(
      documentWriter.complete({
        tenantId: fixture.tenantId,
        actorId: "operator-1",
        shipmentId: fixture.shipmentId,
        command: { ...command, idempotencyKey: "pending-document-2" },
        traceId: "trace-duplicate-document",
      }),
    ).rejects.toThrow("SHIPMENT_DOCUMENT_ALREADY_EXISTS");
  });
});

function skuCommand(cargoLineId: string): ShipmentPendingSkuBindingCommandV1 {
  return {
    contractVersion: "shipment-pending-sku-binding.v1",
    expectedRelationshipVersion: 1,
    expectedCargoLineVersion: 1,
    occurredAt: "2026-09-25T08:00:00.000Z",
    idempotencyKey: "pending-sku-1",
    cargoLineId,
  };
}

function documentCommand(
  containerIds: string[],
): ShipmentPendingDocumentCompletionCommandV1 {
  return {
    contractVersion: "shipment-pending-document-completion.v1",
    expectedRelationshipVersion: 1,
    occurredAt: "2026-09-25T08:00:00.000Z",
    idempotencyKey: "pending-document-1",
    documents: [
      {
        documentType: "mbl",
        documentNumber: "NBOZ9FF56400",
        scac: "HMMU",
        containerRecordIds: [containerIds[0]!, ...containerIds.slice(1)],
      },
    ],
  };
}

async function createFixture(input: { withCargoLine: boolean }): Promise<{
  tenantId: string;
  shipmentId: string;
  sourceHandoffId: string;
  containerIds: string[];
  cargoLineId: string | null;
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
        containerNumber: `MSCU${2000000 + index}`,
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
  const cargoLineId = input.withCargoLine ? randomUUID() : null;
  if (cargoLineId) {
    await prisma.shipmentCargoLine.create({
      data: {
        id: cargoLineId,
        tenantId,
        shipmentId,
        lineNo: 1,
        productNumberSnapshot: "SKU-NEW",
        quantity: "10",
        quantityUnit: "piece",
        sourceHandoffId,
        sourceLineId: "source-line-1",
        version: 1,
        state: "active",
      },
    });
  }
  return { tenantId, shipmentId, sourceHandoffId, containerIds, cargoLineId };
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
