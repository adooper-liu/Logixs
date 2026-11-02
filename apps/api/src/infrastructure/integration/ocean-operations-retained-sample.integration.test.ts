import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  OCEAN_DEMO,
  restoreOceanReviewSample,
} from "../../modules/ocean-operations/infrastructure/restore-ocean-review-sample";
import { PrismaOceanOperationsSourceReviewRepository } from "../../modules/ocean-operations/infrastructure/prisma-ocean-operations-source-review.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_ocean_arrival_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: createPostgresAdapter(
      withSchema(BASE_DATABASE_URL, "public"),
      "public",
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

describe("ocean arrival-preparation retained sample", () => {
  it("restores idempotently, saves a server-derived judgment, and rereads it", async () => {
    const first = await restoreOceanReviewSample(prisma);
    const second = await restoreOceanReviewSample(prisma);
    expect(first.created).toHaveLength(9);
    expect(second.created).toEqual([]);
    expect(second.reused).toHaveLength(9);
    expect(second.containerId).toBe(first.containerId);
    expect(second.etaFactId).toBe(first.etaFactId);

    const repository = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );
    const queue = await repository.listQueue({ tenantId: OCEAN_DEMO.tenantId });
    expect(queue).toEqual([
      expect.objectContaining({
        containerId: first.containerId,
        containerNumber: OCEAN_DEMO.containerNumber,
        observationCount: 1,
        conflictCount: 0,
      }),
    ]);

    const before = await repository.getProjection(
      OCEAN_DEMO.tenantId,
      first.containerId,
    );
    expect(before.shipment).toEqual(
      expect.objectContaining({
        carrier: "MSC",
        vessel: "MSC MAKALU III",
        voyage: "HD638A",
        actualDepartureAt: null,
        actualDepartureSource: null,
      }),
    );
    expect(before.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `lifecycle:${first.etaFactId}`,
          semanticKey: "arrived",
          timeKind: "estimated",
          rawValue: "2026-11-01",
        }),
      ]),
    );

    await repository.save({
      tenantId: OCEAN_DEMO.tenantId,
      actorId: "integration-operator",
      containerId: first.containerId,
      sourceObservationId: `lifecycle:${first.etaFactId}`,
      reviewDecision: "review_required",
      reason: "清关最晚行动时间待补",
      expectedVersion: 0,
      idempotencyKey: "integration-arrival-preparation-v1",
      traceId: "integration-ocean-arrival-preparation",
      arrivalPreparationResult: "pending_evidence",
      nextStep: "等待清关接收入口接通",
      expectedArrivalPreparationVersion: 0,
    });
    const after = await repository.getProjection(
      OCEAN_DEMO.tenantId,
      first.containerId,
    );
    expect(after.review).toEqual(
      expect.objectContaining({
        version: 1,
        reason: "清关最晚行动时间待补",
        sourceObservationId: `lifecycle:${first.etaFactId}`,
      }),
    );
    expect(after.arrivalPreparation).toEqual(
      expect.objectContaining({
        result: "pending_evidence",
        sourceVersion: "post-departure-20260923-v1",
        purpose: "customs_arrival_preparation",
        currentResponsibility: "海运运营",
        nextStep: "等待清关接收入口接通",
        version: 1,
      }),
    );

    const etaFact = await prisma.lifecycleDateFact.findUniqueOrThrow({
      where: { id: first.etaFactId },
    });
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id: first.shipmentId },
    });
    expect(etaFact.applicationState).toBe("not_applicable");
    expect(etaFact.canonicalEventId).toBeNull();
    expect(shipment.atdAt).toBeNull();
    expect(shipment.ataAt).toBeNull();
  });
});

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
