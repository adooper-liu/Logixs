import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import fixtureJson from "../../../../../database/seeds/fixtures/post-departure-source-package-20260923.json";
import { AssertEvidenceAvailableService } from "../../modules/document-records/application/assert-evidence-available.service";
import { RegisterEvidenceService } from "../../modules/document-records/application/register-evidence.service";
import { PrismaEvidenceRepository } from "../../modules/document-records/infrastructure/prisma-evidence.repository";
import { AcceptPostDepartureSourceCandidateService } from "../../modules/integration-import/application/accept-post-departure-source-candidate.service";
import { AcceptPostDepartureSourcePackageService } from "../../modules/integration-import/application/accept-post-departure-source-package.service";
import { PreflightPostDepartureSourcePackageService } from "../../modules/integration-import/application/preflight-post-departure-source-package.service";
import { PrismaImportRepository } from "../../modules/integration-import/infrastructure/prisma-import.repository";
import { ResolveProductSkusService } from "../../modules/master-data/application/resolve-product-skus.service";
import { PrismaProductSkuRepository } from "../../modules/master-data/infrastructure/prisma-product-sku.repository";
import { AcceptShipmentHandoffService } from "../../modules/shipment-lifecycle-orchestration/application/accept-shipment-handoff.service";
import { CompleteShipmentPendingCargoService } from "../../modules/shipment-lifecycle-orchestration/application/complete-shipment-pending-cargo.service";
import { CompleteShipmentPendingDocumentsService } from "../../modules/shipment-lifecycle-orchestration/application/complete-shipment-pending-documents.service";
import { CompleteShipmentPendingFactsService } from "../../modules/shipment-lifecycle-orchestration/application/complete-shipment-pending-facts.service";
import { PreflightShipmentHandoffService } from "../../modules/shipment-lifecycle-orchestration/application/preflight-shipment-handoff.service";
import { CommitShipmentHandoffService } from "../../modules/shipment-registry/application/commit-shipment-handoff.service";
import { GetShipmentService } from "../../modules/shipment-registry/application/get-shipment.service";
import { PrismaShipmentHandoffAcceptanceRepository } from "../../modules/shipment-registry/infrastructure/prisma-shipment-handoff-acceptance.repository";
import { PrismaShipmentHandoffConflictInspector } from "../../modules/shipment-registry/infrastructure/prisma-shipment-handoff-conflict-inspector";
import { PrismaShipmentPendingCargoCompletion } from "../../modules/shipment-registry/infrastructure/prisma-shipment-pending-cargo-completion";
import { PrismaShipmentPendingDocumentCompletion } from "../../modules/shipment-registry/infrastructure/prisma-shipment-pending-document-completion";
import { PrismaShipmentPendingFactCompletion } from "../../modules/shipment-registry/infrastructure/prisma-shipment-pending-fact-completion";
import { PrismaShipmentReadRepository } from "../../modules/shipment-registry/infrastructure/prisma-shipment-read.repository";

type SourceKind = "container" | "customs" | "logistics" | "warehouse";
type SourceFixture = {
  kind: SourceKind;
  sourceFile: string;
  sourceSha256: string;
  sourceSizeBytes: number;
  parserVersion: string;
  rowCount: number;
  columnCount: number;
  rows: Array<{ rowNo: number; values: Record<string, unknown> }>;
};

const fixture = fixtureJson as {
  schemaVersion: string;
  sources: SourceFixture[];
};
const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_real_source_closeout_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;

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

describe("real post-departure source package operational closeout", () => {
  it("keeps one conflict local, restores pending work in a new session and closes a completed Shipment", async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const sources = await seedRetainedSources(tenantId, actorId);
    const importRepository = new PrismaImportRepository(prisma as never);
    const preflightPackage = new PreflightPostDepartureSourcePackageService(
      importRepository,
      { findByIds: async () => [] } as never,
    );
    const preflight = await preflightPackage.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources,
      },
      tenantId,
    );

    expect(fixture.schemaVersion).toBe("1.0.0");
    expect(fixture.sources).toHaveLength(4);
    expect(fixture.sources.every(({ rows }) => rows.length === 20)).toBe(true);
    expect(preflight.candidates).toHaveLength(20);
    expect(preflight.totals).toMatchObject({
      containers: 20,
      bills: 20,
      replenishmentOrders: 20,
      rejected: 0,
    });

    const conflictCandidate = preflight.candidates[0]!;
    await seedCompletedConflictingShipment(
      tenantId,
      actorId,
      conflictCandidate.candidateRef,
    );

    const acceptHandoff = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(
        new PrismaShipmentHandoffConflictInspector(prisma as never),
      ),
      new CommitShipmentHandoffService(
        new PrismaShipmentHandoffAcceptanceRepository(prisma as never),
      ),
      new AssertEvidenceAvailableService(
        new PrismaEvidenceRepository(prisma as never),
      ),
    );
    const acceptCandidate = new AcceptPostDepartureSourceCandidateService(
      preflightPackage,
      importRepository,
      acceptHandoff,
    );
    const acceptPackage = new AcceptPostDepartureSourcePackageService(
      preflightPackage,
      acceptCandidate,
    );
    const command = {
      contractVersion: "post-departure-source-package-accept.v1" as const,
      packageId: preflight.packageId,
      sources,
      idempotencyKey: "real-four-source-package-accept-1",
    };

    const accepted = await acceptPackage.execute(preflight.packageId, command, {
      tenantId,
      actorId,
    });
    const replay = await acceptPackage.execute(preflight.packageId, command, {
      tenantId,
      actorId,
    });

    expect(accepted.totals).toEqual({
      groups: 20,
      accepted: 19,
      duplicate: 0,
      conflict: 1,
      rejected: 0,
      failed: 0,
    });
    expect(accepted.items).toContainEqual(
      expect.objectContaining({
        candidateRefs: [conflictCandidate.candidateRef],
        status: "conflict",
        errorCode: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
        recoveryAction: "review_candidate",
      }),
    );
    expect(replay.totals).toEqual({
      groups: 20,
      accepted: 0,
      duplicate: 19,
      conflict: 1,
      rejected: 0,
      failed: 0,
    });

    const acceptedItem = accepted.items.find(
      (item) => item.status === "accepted" && item.shipmentId,
    )!;
    const shipmentId = acceptedItem.shipmentId!;
    const resumedReadRepository = new PrismaShipmentReadRepository(
      prisma as never,
    );
    const pending = await resumedReadRepository.listPendingCompletion({
      tenantId,
      take: 100,
    });
    expect(pending).toHaveLength(19);
    expect(
      pending.find(({ shipment }) => shipment.id === shipmentId)?.pendingItems,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "origin_port_missing" }),
        expect.objectContaining({ code: "destination_port_missing" }),
        expect.objectContaining({ code: "departure_proof_missing" }),
        expect.objectContaining({ code: "cargo_detail_missing" }),
        expect.objectContaining({ code: "bill_of_lading_missing" }),
      ]),
    );

    await completeOneShipment(tenantId, actorId, shipmentId);

    const nextSessionReadRepository = new PrismaShipmentReadRepository(
      prisma as never,
    );
    const remaining = await nextSessionReadRepository.listPendingCompletion({
      tenantId,
      take: 100,
    });
    expect(remaining).toHaveLength(18);
    expect(remaining.some(({ shipment }) => shipment.id === shipmentId)).toBe(
      false,
    );
  });
});

async function seedRetainedSources(
  tenantId: string,
  actorId: string,
): Promise<Array<{ kind: SourceKind; batchId: string }>> {
  const result: Array<{ kind: SourceKind; batchId: string }> = [];
  for (const source of fixture.sources) {
    const batchId = randomUUID();
    await prisma.importBatch.create({
      data: {
        id: batchId,
        tenantId,
        operatorId: actorId,
        idempotencyKey: `fixture:${source.kind}`,
        fileName: source.sourceFile,
        fileHash: source.sourceSha256,
        sourceFileStatus: "retained",
        sourceObjectKey: `fixture-imports/${batchId}/source`,
        sourceContentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sourceSizeBytes: source.sourceSizeBytes,
        sourceRetainedAt: new Date("2026-09-23T01:30:00.000Z"),
        parserVersion: source.parserVersion,
        status: "parsed",
        rowCount: source.rowCount,
        columnCount: source.columnCount,
        mappingSuggestions: [],
        rows: {
          create: source.rows.map(({ rowNo, values }) => ({
            rowNo,
            snapshot: values as never,
          })),
        },
      },
    });
    result.push({ kind: source.kind, batchId });
  }
  return result;
}

async function seedCompletedConflictingShipment(
  tenantId: string,
  actorId: string,
  candidateRef: string,
): Promise<void> {
  const shipmentId = randomUUID();
  const handoffId = randomUUID();
  const containerId = randomUUID();
  const productSkuId = randomUUID();
  await prisma.productSku.create({
    data: {
      id: productSkuId,
      tenantId,
      productNumber: "CONFLICT-SKU",
    },
  });
  await prisma.shipment.create({
    data: {
      id: shipmentId,
      tenantId,
      sourceSystem: "fixture.conflict",
      sourceVersion: "1",
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "CONFLICT VESSEL",
      voyageNumber: "001E",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      atdAt: new Date("2026-09-22T16:00:00.000Z"),
      currentLifecycleStatus: "departed",
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
      sourceSystem: "fixture.conflict",
      externalHandoffId: `conflict:${candidateRef}`,
      handoffVersion: 1,
      occurredAt: new Date("2026-09-22T16:00:00.000Z"),
      idempotencyKey: `conflict:${candidateRef}`,
      payloadHash: "a".repeat(64),
      payloadJson: {},
      status: "accepted",
      shipmentId,
      actorId,
      traceId: `trace-conflict:${candidateRef}`,
    },
  });
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId,
      containerNumber: candidateRef,
      currentStatus: "shipped",
    },
  });
  await prisma.containerSourceIdentity.create({
    data: {
      tenantId,
      sourceSystem: "post_departure_source_package",
      sourceRecordId: candidateRef,
      containerRecordId: containerId,
    },
  });
  await prisma.shipmentContainerLink.create({
    data: {
      tenantId,
      shipmentId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      evidenceRefs: [],
      idempotencyKey: `conflict-link:${candidateRef}`,
      joinedAt: new Date("2026-09-22T16:00:00.000Z"),
    },
  });
  await prisma.shipmentCargoLine.create({
    data: {
      tenantId,
      shipmentId,
      lineNo: 1,
      productSkuId,
      productNumberSnapshot: "CONFLICT-SKU",
      quantity: "1",
      quantityUnit: "piece",
      sourceHandoffId: handoffId,
      sourceLineId: "conflict-line-1",
      version: 1,
      state: "active",
    },
  });
  await prisma.shipmentTransportDocument.create({
    data: {
      tenantId,
      shipmentId,
      documentType: "mbl",
      documentNumber: `CONFLICT-${candidateRef}`,
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      effectiveFrom: new Date("2026-09-22T16:00:00.000Z"),
    },
  });
}

async function completeOneShipment(
  tenantId: string,
  actorId: string,
  shipmentId: string,
): Promise<void> {
  const evidenceRepository = new PrismaEvidenceRepository(prisma as never);
  const departureEvidence = await new RegisterEvidenceService(
    evidenceRepository,
  ).execute({
    tenantId,
    idempotencyKey: `departure:${shipmentId}`,
    evidenceType: "system_record",
    subjectType: "domain_fact",
    subjectId: shipmentId,
    authorityLevel: "operational",
    contentRef: `fixture://shipment/${shipmentId}/departure`,
    contentHash: "d".repeat(64),
    sourceType: "system",
    originatorSystem: "fixture",
    authoritySystem: "shipping_operations",
    ingestionChannel: "system_internal",
    captureSource: "internal_operation",
  });
  const readRepository = new PrismaShipmentReadRepository(prisma as never);
  const getShipment = new GetShipmentService(readRepository);
  const detail = await getShipment.execute({ tenantId, id: shipmentId });
  await new CompleteShipmentPendingFactsService(
    getShipment,
    new PrismaShipmentPendingFactCompletion(prisma as never),
  ).execute(
    shipmentId,
    {
      contractVersion: "shipment-pending-fact-completion.v1",
      expectedRelationshipVersion: detail.shipment.relationshipVersion,
      occurredAt: "2026-09-25T08:00:00.000Z",
      idempotencyKey: `complete-facts:${shipmentId}`,
      facts: {
        originPortCode: "CNNGB",
        destinationPortCode: "USLAX",
        departureProof: {
          kind: "actual_departure_time",
          occurredAt: "2026-09-22T16:00:00.000Z",
          sourceTimezone: "Asia/Shanghai",
          evidenceRef: departureEvidence.id,
        },
      },
    },
    { tenantId, actorId },
  );

  const productNumber = `REAL-${shipmentId.slice(0, 8)}`;
  await prisma.productSku.create({ data: { tenantId, productNumber } });
  await new CompleteShipmentPendingCargoService(
    new RegisterEvidenceService(evidenceRepository),
    new ResolveProductSkusService(
      new PrismaProductSkuRepository(prisma as never),
    ),
    getShipment,
    new PrismaShipmentPendingCargoCompletion(prisma as never),
  ).execute(
    shipmentId,
    {
      contractVersion: "shipment-pending-cargo-completion.v1",
      expectedRelationshipVersion: detail.shipment.relationshipVersion,
      occurredAt: "2026-09-25T08:01:00.000Z",
      idempotencyKey: `complete-cargo:${shipmentId}`,
      lines: [
        {
          containerRecordId: detail.containers[0]!.containerRecordId,
          productNumber,
          quantity: "1",
          quantityUnit: "piece",
        },
      ],
    },
    { tenantId, actorId },
  );
  await new CompleteShipmentPendingDocumentsService(
    getShipment,
    new PrismaShipmentPendingDocumentCompletion(prisma as never),
  ).execute(
    shipmentId,
    {
      contractVersion: "shipment-pending-document-completion.v1",
      expectedRelationshipVersion: detail.shipment.relationshipVersion,
      occurredAt: "2026-09-25T08:02:00.000Z",
      idempotencyKey: `complete-document:${shipmentId}`,
      documents: [
        {
          documentType: "mbl",
          documentNumber: `MBL-${shipmentId.slice(0, 8)}`,
          containerRecordIds: [detail.containers[0]!.containerRecordId],
        },
      ],
    },
    { tenantId, actorId },
  );
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
