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
