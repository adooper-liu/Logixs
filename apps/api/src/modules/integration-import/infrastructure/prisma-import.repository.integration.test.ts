import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import {
  PostDepartureCorrectionIdempotencyConflictError,
  PostDepartureCorrectionVersionConflictError,
  type NewPostDepartureSourceCandidateCorrection,
  type NewPostDepartureSourcePackageReview,
} from "../domain/import.repository";
import { PrismaImportRepository } from "./prisma-import.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_import_review_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaImportRepository;

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
  repository = new PrismaImportRepository(prisma as never);
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

describe("PrismaImportRepository post-departure review integration", () => {
  it("stores one tenant-scoped review with four source relations and replays idempotently", async () => {
    const tenantId = "tenant-review";
    const sources = await Promise.all(
      ["container", "customs", "logistics", "warehouse"].map(
        async (kind, index) => {
          const batchId = randomUUID();
          await prisma.importBatch.create({
            data: {
              id: batchId,
              tenantId,
              operatorId: "operator-1",
              idempotencyKey: `review-${kind}`,
              fileName: `${kind}.xlsx`,
              fileHash: String(index + 1).repeat(64),
              sourceFileStatus: "retained",
              sourceObjectKey: `imports/${batchId}/source`,
              sourceContentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              sourceSizeBytes: 100,
              sourceRetainedAt: new Date("2026-09-23T00:00:00Z"),
              parserVersion: "tabular-v2",
              status: "parsed",
              rowCount: 20,
              columnCount: 20,
            },
          });
          return { kind, batchId };
        },
      ),
    );
    const input: NewPostDepartureSourcePackageReview = {
      id: randomUUID(),
      tenantId,
      packageHash: "a".repeat(64),
      contractVersion: "post-departure-source-package-review.v1",
      decision: "review_required",
      candidateCount: 20,
      reviewRequiredCount: 20,
      snapshot: {
        packageId: "a".repeat(64),
        sources: sources.map((source) => ({
          ...source,
          fileName: `${source.kind}.xlsx`,
          rowCount: 20,
          columnCount: 20,
        })) as NewPostDepartureSourcePackageReview["snapshot"]["sources"],
        candidates: [],
        totals: {
          containers: 20,
          bills: 20,
          replenishmentOrders: 20,
          ready: 0,
          reviewRequired: 20,
          rejected: 0,
        },
      },
      snapshotHash: "b".repeat(64),
      operatorId: "operator-1",
      traceId: "trace-review-1",
      sources: sources as NewPostDepartureSourcePackageReview["sources"],
    };

    const first = await repository.savePostDepartureSourcePackageReview(input);
    const replay = await repository.savePostDepartureSourcePackageReview({
      ...input,
      id: randomUUID(),
      traceId: "trace-review-2",
    });

    expect(first.created).toBe(true);
    expect(replay).toMatchObject({
      created: false,
      review: { id: first.review.id, traceId: "trace-review-1" },
    });
    await expect(
      prisma.postDepartureSourcePackageReview.count({ where: { tenantId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.postDepartureSourcePackageSource.count({ where: { tenantId } }),
    ).resolves.toBe(4);
    await expect(prisma.shipment.count()).resolves.toBe(0);
  });

  it("appends candidate corrections with idempotency and optimistic version guards", async () => {
    const tenantId = "tenant-correction";
    const reviewId = randomUUID();
    await prisma.postDepartureSourcePackageReview.create({
      data: {
        id: reviewId,
        tenantId,
        packageHash: "c".repeat(64),
        contractVersion: "post-departure-source-package-review.v1",
        decision: "review_required",
        candidateCount: 1,
        reviewRequiredCount: 1,
        snapshot: {
          packageId: "c".repeat(64),
          sources: [],
          candidates: [],
          totals: {
            containers: 1,
            bills: 1,
            replenishmentOrders: 1,
            ready: 0,
            reviewRequired: 1,
            rejected: 0,
          },
        },
        snapshotHash: "d".repeat(64),
        operatorId: "operator-1",
        traceId: "trace-correction",
      },
    });
    const input: NewPostDepartureSourceCandidateCorrection = {
      id: randomUUID(),
      tenantId,
      reviewId,
      candidateRef: "MSNU9762671",
      expectedVersion: 0,
      shipmentGroupingKind: "authorized_new_shipment",
      shipmentNumber: "SHIP-2026-0001",
      targetShipmentId: null,
      targetRelationshipVersion: null,
      originPortId: randomUUID(),
      originUnlocode: "CNFZG",
      destinationPortId: randomUUID(),
      destinationUnlocode: "USSAV",
      departureLocal: "2026-09-23T00:00",
      departureOccurredAt: new Date("2026-09-22T16:00:00Z"),
      departureSourceTimezone: "Asia/Shanghai",
      departureEvidenceId: randomUUID(),
      operatorId: "operator-1",
      reasonCode: "source_fact_confirmed",
      idempotencyKey: "correction-1",
      payloadHash: "e".repeat(64),
    };

    const first =
      await repository.savePostDepartureSourceCandidateCorrection(input);
    const replay = await repository.savePostDepartureSourceCandidateCorrection({
      ...input,
      id: randomUUID(),
    });
    await expect(
      repository.savePostDepartureSourceCandidateCorrection({
        ...input,
        id: randomUUID(),
        payloadHash: "f".repeat(64),
      }),
    ).rejects.toBeInstanceOf(PostDepartureCorrectionIdempotencyConflictError);
    await expect(
      repository.savePostDepartureSourceCandidateCorrection({
        ...input,
        id: randomUUID(),
        idempotencyKey: "correction-stale",
        payloadHash: "1".repeat(64),
      }),
    ).rejects.toBeInstanceOf(PostDepartureCorrectionVersionConflictError);
    const second = await repository.savePostDepartureSourceCandidateCorrection({
      ...input,
      id: randomUUID(),
      expectedVersion: 1,
      idempotencyKey: "correction-2",
      payloadHash: "2".repeat(64),
      reasonCode: "source_fact_reconfirmed",
      cargoLines: [
        {
          id: randomUUID(),
          lineNumber: 1,
          sourceLineId: "MSNU9762671:26DSA01884:SKU-001:1",
          replenishmentOrderNumber: "26DSA01884",
          productSkuId: randomUUID(),
          productNumber: "SKU-001",
          quantity: "10.5",
          quantityUnit: "piece",
          replenishmentOrderLineId: null,
        },
        {
          id: randomUUID(),
          lineNumber: 2,
          sourceLineId: "MSNU9762671:26DSA01884:SKU-002:2",
          replenishmentOrderNumber: "26DSA01884",
          productSkuId: randomUUID(),
          productNumber: "SKU-002",
          quantity: "4",
          quantityUnit: "carton",
          replenishmentOrderLineId: null,
        },
      ],
    });

    expect(first).toMatchObject({
      created: true,
      correction: { version: 1, supersedesCorrectionId: null },
    });
    expect(replay).toMatchObject({
      created: false,
      correction: { id: first.correction.id, version: 1 },
    });
    expect(second).toMatchObject({
      created: true,
      correction: {
        version: 2,
        supersedesCorrectionId: first.correction.id,
        cargoLines: [
          expect.objectContaining({
            productNumber: "SKU-001",
            quantity: "10.5",
          }),
          expect.objectContaining({ productNumber: "SKU-002", quantity: "4" }),
        ],
      },
    });
    await expect(
      prisma.postDepartureSourceCandidateCorrection.count({
        where: { tenantId, reviewId },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.postDepartureSourceCandidateCargoLine.count({
        where: { tenantId, correctionId: second.correction.id },
      }),
    ).resolves.toBe(2);
    await expect(prisma.shipment.count()).resolves.toBe(0);
  });
});

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
