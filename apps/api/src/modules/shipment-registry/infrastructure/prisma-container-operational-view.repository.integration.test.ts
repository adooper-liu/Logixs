import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import { PrismaContainerOperationalViewRepository } from "./prisma-container-operational-view.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_container_view_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaContainerOperationalViewRepository;

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
  repository = new PrismaContainerOperationalViewRepository(prisma as never);
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

describe("PrismaContainerOperationalViewRepository integration", () => {
  it("reads a consistent tenant-scoped lifecycle and evidence projection", async () => {
    const tenantId = randomUUID();
    const containerId = randomUUID();
    const shipmentId = randomUUID();
    const handoffId = randomUUID();
    const linkId = randomUUID();
    const flowId = randomUUID();
    const nodeId = randomUUID();
    const evidenceId = randomUUID();
    const factId = randomUUID();
    const exceptionId = randomUUID();
    const occurredAt = new Date("2026-09-22T08:00:00.000Z");

    await prisma.containerRecord.create({
      data: {
        id: containerId,
        tenantId,
        containerNumber: "HMMU4207629",
        currentStatus: "shipped",
      },
    });
    await prisma.shipment.create({
      data: {
        id: shipmentId,
        tenantId,
        shipmentNumber: "SHIP-OPERATIONAL-VIEW-001",
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
        currentLifecycleStatus: "departed",
        lifecycleVersion: 1,
        relationshipVersion: 1,
        createdBy: randomUUID(),
        updatedBy: randomUUID(),
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
        payloadHash: "c".repeat(64),
        payloadJson: {},
        status: "accepted",
        shipmentId,
        actorId: randomUUID(),
        traceId: `trace-${handoffId}`,
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
        evidenceRefs: [],
        idempotencyKey: `link-${linkId}`,
        joinedAt: occurredAt,
      },
    });
    await prisma.flowInstance.create({
      data: {
        id: flowId,
        containerId,
        state: "active",
        currentNodeCode: "origin_departure",
        version: 2,
        definitionCode: "post_departure_ocean",
        definitionVersion: 1,
        shipmentId,
        shipmentRelationshipVersion: 1,
      },
    });
    await prisma.nodeInstance.create({
      data: {
        id: nodeId,
        flowInstanceId: flowId,
        nodeCode: "origin_departure",
        state: "active",
        applicability: "required",
      },
    });
    await prisma.evidenceRecord.create({
      data: {
        id: evidenceId,
        tenantId,
        idempotencyKey: `evidence-${evidenceId}`,
        evidenceType: "bill_of_lading",
        subjectType: "container",
        subjectId: containerId,
        authorityLevel: "authoritative",
        contentRef: `fixture://${evidenceId}`,
        contentHash: "a".repeat(64),
        source: { sourceSystem: "integration-test" },
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        receivedAt: occurredAt,
        recordedAt: occurredAt,
      },
    });
    await prisma.lifecycleDateFact.create({
      data: {
        id: factId,
        tenantId,
        containerId,
        nodeCode: "origin_departure",
        eventCode: "departed",
        timeKind: "actual",
        occurredAt,
        rawValue: occurredAt.toISOString(),
        sourceUtcOffset: "+00:00",
        ingestionChannel: "api",
        captureSource: "external_evidence",
        sourceSystem: "integration-test",
        authoritySystem: "carrier",
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        evidenceRefs: [evidenceId],
        idempotencyKey: `fact-${factId}`,
        payloadHash: "b".repeat(64),
        applicationState: "pending_application",
        projectionVersion: 1,
        traceId: `trace-${factId}`,
        receivedAt: occurredAt,
      },
    });
    await prisma.operationalExceptionCase.create({
      data: {
        id: exceptionId,
        tenantId,
        containerRecordId: containerId,
        shipmentId,
        exceptionCode: "customs_document_missing",
        severity: "high",
        status: "open",
        sourceDomain: "customs-compliance",
        sourceRecordId: `customs-exception-${containerId}`,
        sourceVersion: "1",
        summary: "Required customs document is missing",
        occurredAt,
        evidenceRefs: [evidenceId],
        version: 1,
        idempotencyKey: `exception-${exceptionId}`,
      },
    });

    await expect(
      repository.findByContainer({ tenantId, containerId }),
    ).resolves.toMatchObject({
      tenantId,
      containerId,
      containerNumber: "HMMU4207629",
      shipment: {
        shipmentId,
        linkId,
        currentLifecycleStatus: "departed",
        relationshipVersion: 1,
      },
      flow: { flowInstanceId: flowId, version: 2 },
      currentNode: {
        nodeInstanceId: nodeId,
        nodeCode: "origin_departure",
        actualAt: occurredAt.toISOString(),
      },
      professionalFacts: [{ domainFactId: factId, evidenceRefs: [evidenceId] }],
      evidenceSummary: {
        total: 1,
        effective: 1,
        evidenceRefs: [evidenceId],
      },
      activeExceptions: [
        {
          exceptionId,
          target: {
            tenantId,
            entityType: "container",
            entityId: containerId,
            ownerModule: "shipment-registry",
          },
          exceptionCode: "customs_document_missing",
          severity: "high",
          occurredAt: occurredAt.toISOString(),
        },
      ],
      sourceVersions: expect.arrayContaining([
        { source: "exception-management", version: 1 },
      ]),
    });
    await expect(
      repository.findByContainer({ tenantId: randomUUID(), containerId }),
    ).resolves.toBeNull();

    await prisma.operationalExceptionCase.create({
      data: {
        id: randomUUID(),
        tenantId,
        containerRecordId: containerId,
        shipmentId,
        exceptionCode: "carrier_delay",
        severity: "medium",
        status: "resolved",
        sourceDomain: "ocean-port-visibility",
        sourceRecordId: `resolved-exception-${containerId}`,
        sourceVersion: "1",
        occurredAt,
        resolvedAt: new Date("2026-09-22T10:00:00.000Z"),
        evidenceRefs: [],
        idempotencyKey: `resolved-exception-${containerId}`,
      },
    });
    const afterResolution = await repository.findByContainer({
      tenantId,
      containerId,
    });
    expect(
      afterResolution?.activeExceptions.map(
        (exception) => exception.exceptionId,
      ),
    ).toEqual([exceptionId]);

    await expect(
      prisma.operationalExceptionCase.create({
        data: {
          id: randomUUID(),
          tenantId,
          containerRecordId: containerId,
          exceptionCode: "invalid_resolution",
          severity: "low",
          status: "resolved",
          sourceDomain: "integration-test",
          sourceRecordId: `invalid-resolution-${containerId}`,
          sourceVersion: "1",
          occurredAt,
          evidenceRefs: [],
          idempotencyKey: `invalid-resolution-${containerId}`,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.operationalExceptionCase.create({
        data: {
          id: randomUUID(),
          tenantId: randomUUID(),
          containerRecordId: containerId,
          exceptionCode: "cross_tenant_container",
          severity: "high",
          status: "open",
          sourceDomain: "integration-test",
          sourceRecordId: `cross-tenant-container-${containerId}`,
          sourceVersion: "1",
          occurredAt,
          evidenceRefs: [],
          idempotencyKey: `cross-tenant-container-${containerId}`,
        },
      }),
    ).rejects.toThrow();

    const otherTenantId = randomUUID();
    const otherContainerId = randomUUID();
    await prisma.containerRecord.create({
      data: {
        id: otherContainerId,
        tenantId: otherTenantId,
        containerNumber: "HMMU4207630",
        currentStatus: "shipped",
      },
    });
    await expect(
      prisma.operationalExceptionCase.create({
        data: {
          id: randomUUID(),
          tenantId: otherTenantId,
          containerRecordId: otherContainerId,
          shipmentId,
          exceptionCode: "cross_tenant_shipment",
          severity: "high",
          status: "open",
          sourceDomain: "integration-test",
          sourceRecordId: `cross-tenant-shipment-${shipmentId}`,
          sourceVersion: "1",
          occurredAt,
          evidenceRefs: [],
          idempotencyKey: `cross-tenant-shipment-${shipmentId}`,
        },
      }),
    ).rejects.toThrow();
  });
});

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
