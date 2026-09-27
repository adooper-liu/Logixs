import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import type {
  ShipmentHandoffCommandV2,
  ShipmentHandoffPreflightResultV1,
} from "@logix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { PrismaActiveShipmentByContainerMatcher } from "./prisma-active-shipment-by-container.matcher";
import { PrismaShipmentHandoffAcceptanceRepository } from "./prisma-shipment-handoff-acceptance.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_incomplete_handoff_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaShipmentHandoffAcceptanceRepository;

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
  repository = new PrismaShipmentHandoffAcceptanceRepository(prisma as never);
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

describe("PrismaShipmentHandoffAcceptanceRepository incomplete Shipment", () => {
  it("commits one standard Shipment with multiple containers and unbound SKU lines", async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const evidenceRef = randomUUID();
    const command: ShipmentHandoffCommandV2 = {
      contractVersion: "shipment-handoff.v2",
      tenantId,
      sourceProfile: "standard_departed_import_v1",
      source: {
        channel: "file_import",
        system: "post_departure_source_package",
        externalHandoffId: "standard-package:shipment-001",
        handoffVersion: 1,
        occurredAt: "2026-09-25T00:00:00.000Z",
        idempotencyKey: "standard-package:shipment-001:accept",
        mappingVersion: "post_departure_standard_import.v1",
        correlationId: randomUUID(),
        traceId: "trace-standard-handoff",
      },
      shipment: {
        externalShipmentId: "SHP-20260918-001",
        shipmentNumber: "SHP-20260918-001",
        transportMode: "ocean",
        carrierCode: "HMM",
        bookingNumber: "SQSJ26090200041842",
        vesselName: "YM MASCULINITY",
        voyageNumber: "108E",
        originPortCode: "CNNGB",
        destinationPortCode: "CAVAN",
        destinationCountryCode: "CA",
        departureProof: {
          kind: "actual_departure_time",
          occurredAt: "2026-09-17T16:00:00.000Z",
          sourceTimezone: "Asia/Shanghai",
          evidenceRef,
        },
      },
      billsOfLading: [
        {
          referenceId: "booking:SQSJ26090200041842",
          documentType: "booking",
          documentNumber: "SQSJ26090200041842",
          version: 1,
        },
        {
          referenceId: "mbl:NBOZ9FF56400",
          documentType: "mbl",
          documentNumber: "NBOZ9FF56400",
          version: 1,
        },
      ],
      containers: [
        standardContainer(
          "SHP-20260918-001:HMMU4956442",
          "HMMU4956442",
          "26DSC01812",
          "BOM-001",
          "331-015",
          "118",
        ),
        standardContainer(
          "SHP-20260918-001:HMMU4207629",
          "HMMU4207629",
          "26DSC01811",
          "BOM-002",
          "842-327V80",
          "40",
        ),
      ],
      evidenceReferences: [evidenceRef],
    };

    const result = await repository.commit({
      actorId,
      command,
      preflight: preflightFor(command, "9"),
    });

    expect(result).toMatchObject({
      businessDecisionState: "accepted",
      commitState: "committed",
      duplicate: false,
    });
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: result.shipmentId! },
      include: {
        containerLinks: { where: { state: "active" } },
        handoffs: true,
        cargoLines: true,
        transportDocuments: true,
        upstreamReferences: true,
      },
    });
    expect(shipment).toMatchObject({
      shipmentNumber: "SHP-20260918-001",
      sourceRecordId: "SHP-20260918-001",
      currentLifecycleStatus: "departed",
      atdAt: new Date("2026-09-17T16:00:00.000Z"),
    });
    expect(shipment.containerLinks).toHaveLength(2);
    expect(shipment.handoffs[0]).toMatchObject({
      sourceProfile: "standard_departed_import_v1",
    });
    const handoffPayload = shipment.handoffs[0]!
      .payloadJson as unknown as ShipmentHandoffCommandV2;
    expect(handoffPayload).toMatchObject({
      shipment: { bookingNumber: "SQSJ26090200041842" },
      containers: [
        expect.objectContaining({
          externalContainerId: "ERP:SHP-20260918-001:HMMU4956442",
          sealNumber: "SEAL-6442",
          declaredPackageCount: "504",
          declaredGrossWeightKg: "7723",
          declaredVolumeM3: "67.25",
        }),
        expect.objectContaining({
          externalContainerId: "ERP:SHP-20260918-001:HMMU4207629",
          sealNumber: "SEAL-7629",
        }),
      ],
    });
    expect(
      shipment.cargoLines.map((line) => ({
        productNumberSnapshot: line.productNumberSnapshot,
        productSkuId: line.productSkuId,
        quantity: line.quantity.toString(),
        packageCount: line.packageCount?.toString(),
        grossWeight: line.grossWeight?.toString(),
        volume: line.volume?.toString(),
      })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productNumberSnapshot: "331-015",
          productSkuId: null,
          quantity: "118",
          packageCount: "118",
          grossWeight: "1404.2",
          volume: "19.63",
        }),
        expect.objectContaining({
          productNumberSnapshot: "842-327V80",
          productSkuId: null,
          quantity: "40",
        }),
      ]),
    );
    expect(
      shipment.transportDocuments.map(({ documentType }) => documentType),
    ).toEqual(expect.arrayContaining(["booking", "mbl"]));
    expect(
      shipment.upstreamReferences.map((reference) => ({
        sourceRecordId: reference.sourceRecordId,
        sourceLineId: reference.sourceLineId,
        shipmentCargoLineId: reference.shipmentCargoLineId,
      })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceRecordId: "26DSC01812",
          sourceLineId: "BOM-001",
          shipmentCargoLineId: expect.any(String),
        }),
        expect.objectContaining({
          sourceRecordId: "26DSC01811",
          sourceLineId: "BOM-002",
          shipmentCargoLineId: expect.any(String),
        }),
      ]),
    );
    const containerRecords = await prisma.containerRecord.findMany({
      where: { tenantId },
      include: { sourceIdentities: true },
    });
    expect(containerRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          containerNumber: "HMMU4956442",
          sealNumber: "SEAL-6442",
          sourceIdentities: [
            expect.objectContaining({
              sourceRecordId: "ERP:SHP-20260918-001:HMMU4956442",
            }),
          ],
        }),
      ]),
    );
  });

  it("commits a departed Shipment with pending business facts and replays idempotently", async () => {
    const tenantId = randomUUID();
    const actorId = "dev-operator";
    const command: ShipmentHandoffCommandV2 = {
      contractVersion: "shipment-handoff.v2",
      tenantId,
      sourceProfile: "legacy_departed_file_v1",
      source: {
        channel: "file_import",
        system: "post_departure_source_package",
        externalHandoffId: "package-a:container-a",
        handoffVersion: 1,
        occurredAt: "2026-09-24T02:00:00.000Z",
        idempotencyKey: "package-a:container-a:accept",
        mappingVersion: "post_departure_source_package.v1",
        correlationId: randomUUID(),
        traceId: "trace-incomplete-handoff",
      },
      shipment: { transportMode: "ocean" },
      billsOfLading: [],
      containers: [
        {
          referenceId: "candidate-a",
          externalContainerId: "candidate-a",
          billReferences: [],
          upstreamReferences: [],
        },
      ],
      evidenceReferences: [],
    };
    const preflight: ShipmentHandoffPreflightResultV1 = {
      decision: "review_required",
      duplicate: false,
      payloadHash: "a".repeat(64),
      issues: [
        {
          code: "CARGO_DETAIL_INCOMPLETE",
          fieldCodes: ["cargo_allocations"],
          messageKey: "shipment_handoff_cargo_detail_incomplete",
          blocking: false,
          resolutionState: "upstream_action_required",
        },
      ],
      traceId: command.source.traceId,
    };

    const first = await repository.commit({ actorId, command, preflight });
    const replay = await repository.commit({ actorId, command, preflight });

    expect(first).toMatchObject({
      businessDecisionState: "accepted",
      commitState: "committed",
      duplicate: false,
      lifecycleInitializationState: "pending",
      issues: [expect.objectContaining({ code: "CARGO_DETAIL_INCOMPLETE" })],
    });
    expect(replay).toMatchObject({
      businessDecisionState: "accepted",
      duplicate: true,
      shipmentId: first.shipmentId,
    });
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: first.shipmentId! },
      include: {
        containerLinks: true,
        handoffs: { include: { objectResults: true } },
      },
    });
    expect(shipment).toMatchObject({
      sourceRecordId: null,
      carrierCode: null,
      vesselName: null,
      voyageNumber: null,
      originUnlocode: null,
      destinationUnlocode: null,
      currentLifecycleStatus: "departed",
    });
    expect(shipment.containerLinks).toHaveLength(1);
    expect(shipment.handoffs).toHaveLength(1);
    expect(shipment.handoffs[0]?.objectResults[0]?.issueCodes).toEqual([
      "CARGO_DETAIL_INCOMPLETE",
    ]);
    await expect(
      prisma.outboxMessage.count({
        where: { aggregateType: "shipment", aggregateId: shipment.id },
      }),
    ).resolves.toBe(1);
  });

  it("attaches a new source candidate to the selected existing Shipment with optimistic concurrency", async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const firstCommand = commandFor(tenantId, "candidate-a", "handoff-a");
    const first = await repository.commit({
      actorId,
      command: firstCommand,
      preflight: preflightFor(firstCommand, "b"),
    });
    const secondCommand: ShipmentHandoffCommandV2 = {
      ...commandFor(tenantId, "candidate-b", "handoff-b"),
      shipment: {
        transportMode: "ocean",
        targetShipmentId: first.shipmentId!,
        expectedRelationshipVersion: 1,
      },
    };

    const second = await repository.commit({
      actorId,
      command: secondCommand,
      preflight: preflightFor(secondCommand, "c"),
    });

    expect(second.shipmentId).toBe(first.shipmentId);
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: first.shipmentId! },
      include: { containerLinks: { where: { state: "active" } } },
    });
    expect(shipment.relationshipVersion).toBe(2);
    expect(shipment.containerLinks).toHaveLength(2);
    const lifecycleOutbox = await prisma.outboxMessage.findFirstOrThrow({
      where: {
        aggregateType: "shipment",
        aggregateId: first.shipmentId!,
        idempotencyKey: `${secondCommand.source.idempotencyKey}:post-departure`,
      },
    });
    expect(lifecycleOutbox.payloadHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      repository.commit({
        actorId,
        command: {
          ...commandFor(tenantId, "candidate-c", "handoff-c"),
          shipment: {
            transportMode: "ocean",
            targetShipmentId: first.shipmentId!,
            expectedRelationshipVersion: 1,
          },
        },
        preflight: preflightFor(
          commandFor(tenantId, "candidate-c", "handoff-c"),
          "d",
        ),
      }),
    ).rejects.toThrow("TARGET_SHIPMENT_VERSION_CONFLICT");
  });

  it("absorbs a late source for the same container without replacing its active link", async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const firstCommand = commandFor(
      tenantId,
      "same-container",
      "source-container",
    );
    firstCommand.containers[0]!.containerNumber = "MSNU9762671";
    const first = await repository.commit({
      actorId,
      command: firstCommand,
      preflight: preflightFor(firstCommand, "e"),
    });
    const originalLink = await prisma.shipmentContainerLink.findFirstOrThrow({
      where: { tenantId, shipmentId: first.shipmentId!, state: "active" },
    });
    const matcher = new PrismaActiveShipmentByContainerMatcher(prisma as never);
    await expect(
      matcher.matchByContainerNumbers(tenantId, ["msnu9762671"]),
    ).resolves.toEqual([
      {
        containerNumber: "msnu9762671",
        state: "matched",
        shipmentId: first.shipmentId,
        shipmentNumber: null,
        relationshipVersion: 1,
      },
    ]);
    const lateSourceCommand: ShipmentHandoffCommandV2 = {
      ...commandFor(tenantId, "same-container", "source-warehouse"),
      shipment: {
        transportMode: "ocean",
        targetShipmentId: first.shipmentId!,
        expectedRelationshipVersion: 1,
      },
    };

    const absorbed = await repository.commit({
      actorId,
      command: lateSourceCommand,
      preflight: preflightFor(lateSourceCommand, "f"),
    });

    expect(absorbed.shipmentId).toBe(first.shipmentId);
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: first.shipmentId! },
      include: {
        containerLinks: true,
        handoffs: { orderBy: { createdAt: "asc" } },
      },
    });
    expect(shipment.relationshipVersion).toBe(2);
    expect(shipment.handoffs).toHaveLength(2);
    expect(shipment.containerLinks).toHaveLength(1);
    expect(shipment.containerLinks[0]).toMatchObject({
      id: originalLink.id,
      state: "active",
      supersededAt: null,
    });
  });

  it("reports a conflict when one container number has multiple active Shipment links", async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const firstCommand = commandFor(tenantId, "duplicate-a", "duplicate-a");
    firstCommand.containers[0]!.containerNumber = "MSNU9762671";
    const secondCommand = commandFor(tenantId, "duplicate-b", "duplicate-b");
    secondCommand.containers[0]!.containerNumber = "MSNU9762671";
    await repository.commit({
      actorId,
      command: firstCommand,
      preflight: preflightFor(firstCommand, "1"),
    });
    await repository.commit({
      actorId,
      command: secondCommand,
      preflight: preflightFor(secondCommand, "2"),
    });

    const matcher = new PrismaActiveShipmentByContainerMatcher(prisma as never);
    await expect(
      matcher.matchByContainerNumbers(tenantId, ["MSNU9762671"]),
    ).resolves.toEqual([{ containerNumber: "MSNU9762671", state: "conflict" }]);
  });
});

function commandFor(
  tenantId: string,
  candidateRef: string,
  externalHandoffId: string,
): ShipmentHandoffCommandV2 {
  return {
    contractVersion: "shipment-handoff.v2",
    tenantId,
    sourceProfile: "legacy_departed_file_v1",
    source: {
      channel: "file_import",
      system: "post_departure_source_package",
      externalHandoffId,
      handoffVersion: 1,
      occurredAt: "2026-09-24T02:00:00.000Z",
      idempotencyKey: `${externalHandoffId}:accept`,
      mappingVersion: "post_departure_source_package.v1",
      correlationId: randomUUID(),
      traceId: `trace-${externalHandoffId}`,
    },
    shipment: { transportMode: "ocean" },
    billsOfLading: [],
    containers: [
      {
        referenceId: candidateRef,
        externalContainerId: candidateRef,
        billReferences: [],
        upstreamReferences: [],
      },
    ],
    evidenceReferences: [],
  };
}

function standardContainer(
  referenceId: string,
  containerNumber: string,
  replenishmentOrderNumber: string,
  sourceLineId: string,
  productNumber: string,
  quantity: string,
): ShipmentHandoffCommandV2["containers"][number] {
  return {
    referenceId,
    externalContainerId: `ERP:${referenceId}`,
    containerNumber,
    containerTypeCode: "40HQ",
    sealNumber: `SEAL-${containerNumber.slice(-4)}`,
    declaredPackageCount: "504",
    declaredGrossWeightKg: "7723",
    declaredVolumeM3: "67.25",
    billReferences: ["booking:SQSJ26090200041842", "mbl:NBOZ9FF56400"],
    upstreamReferences: [
      {
        referenceType: "stocking_order",
        sourceSystem: "post_departure_source_package",
        sourceRecordId: replenishmentOrderNumber,
      },
      {
        referenceType: "stocking_order",
        sourceSystem: "post_departure_source_package",
        sourceRecordId: replenishmentOrderNumber,
        sourceLineId,
      },
    ],
    cargoAllocations: [
      {
        sourceLineId,
        productNumber,
        quantity,
        quantityUnit: "piece",
        packageCount: quantity,
        packageUnit: "carton",
        grossWeight: productNumber === "331-015" ? "1404.2" : "800",
        weightUnit: "kg",
        volume: productNumber === "331-015" ? "19.63" : "8.5",
        volumeUnit: "m3",
      },
    ],
  };
}

function preflightFor(
  command: ShipmentHandoffCommandV2,
  hashCharacter: string,
): ShipmentHandoffPreflightResultV1 {
  return {
    decision: "ready",
    duplicate: false,
    payloadHash: hashCharacter.repeat(64),
    issues: [],
    traceId: command.source.traceId,
  };
}

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}
