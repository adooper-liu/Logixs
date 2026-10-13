import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../../../generated/prisma";
import {
  canonicalStringify,
  packageHash,
  sha256Hex,
  type ValidatedFullChainPackage,
} from "@logix/full-chain-sample-contracts";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { FullChainSampleLandingModule } from "../../modules/full-chain-sample-landing";
import { FULL_CHAIN_LANDING_REPOSITORY } from "../../modules/full-chain-sample-landing/domain/full-chain-landing.repository";
import { LANDING_RECEIPT_STORE } from "../../modules/full-chain-sample-landing/domain/landing-receipt-store.port";
import { PrismaFullChainLandingRepository } from "../../modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository";
import { S3LandingReceiptStore } from "../../modules/full-chain-sample-landing/infrastructure/s3-landing-receipt.store";
import { createValidFullChainPackage } from "../../modules/full-chain-sample-landing/test-support/full-chain-package.fixture";
import { withTemporaryDatabase } from "../../tools/full-chain-demo/integration-support";

const minio = new S3Client({
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "logix", secretAccessKey: "logix-dev-secret" },
});
const bucket = "logix-import-sources";

async function ensureBucket() {
  try {
    await minio.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await minio.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}
function rehash(artifacts: ValidatedFullChainPackage) {
  artifacts.manifest.recordCount = artifacts.records.length;
  artifacts.manifest.gapCount = artifacts.gaps.length;
  artifacts.manifest.checkCount = artifacts.checks.length;
  artifacts.manifest.lineageCount = artifacts.lineage.length;
  artifacts.manifest.recordsHash = sha256Hex(
    canonicalStringify(artifacts.records),
  );
  artifacts.manifest.gapsHash = sha256Hex(canonicalStringify(artifacts.gaps));
  artifacts.manifest.checksHash = sha256Hex(
    canonicalStringify(artifacts.checks),
  );
  artifacts.manifest.lineageHash = sha256Hex(
    canonicalStringify(artifacts.lineage),
  );
  artifacts.manifest.packageHash = packageHash(artifacts);
  return artifacts;
}

type JsonResponse = { status: number; body: Record<string, unknown> };
async function json(response: Response): Promise<JsonResponse> {
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function withCloseout(
  run: (input: {
    app: INestApplication;
    baseUrl: string;
    prisma: PrismaClient;
    tenantId: string;
    headers: Record<string, string>;
  }) => Promise<void>,
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
) {
  await withTemporaryDatabase(async ({ prisma }) => {
    const tenantId = `rehearsal-${randomUUID().replaceAll("-", "")}`;
    const originalTenant = process.env.FULL_CHAIN_REHEARSAL_TENANT_ID;
    const originalControl = process.env.FULL_CHAIN_REHEARSAL_CONTROL_TENANT_ID;
    process.env.FULL_CHAIN_REHEARSAL_TENANT_ID = tenantId;
    process.env.FULL_CHAIN_REHEARSAL_CONTROL_TENANT_ID = "control-tenant";
    let builder = Test.createTestingModule({
      imports: [PrismaModule, FullChainSampleLandingModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma);
    if (customize) builder = customize(builder);
    const testing = await builder.compile();
    const app = testing.createNestApplication();
    app.setGlobalPrefix("api");
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      "x-operator-id": "operator-1",
      "x-roles": "import_operator",
    };
    try {
      await run({ app, baseUrl, prisma, tenantId, headers });
    } finally {
      const listed = await minio.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `rehearsal/${tenantId}/`,
        }),
      );
      for (const object of listed.Contents ?? [])
        if (object.Key?.endsWith("/receipt.json"))
          await minio.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }),
          );
      await app.close();
      if (originalTenant === undefined)
        delete process.env.FULL_CHAIN_REHEARSAL_TENANT_ID;
      else process.env.FULL_CHAIN_REHEARSAL_TENANT_ID = originalTenant;
      if (originalControl === undefined)
        delete process.env.FULL_CHAIN_REHEARSAL_CONTROL_TENANT_ID;
      else process.env.FULL_CHAIN_REHEARSAL_CONTROL_TENANT_ID = originalControl;
    }
  });
}

async function postPackage(
  baseUrl: string,
  headers: Record<string, string>,
  artifacts: ValidatedFullChainPackage,
  idempotencyKey: string,
) {
  return json(
    await fetch(`${baseUrl}/full-chain-sample-landings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        artifacts,
        idempotencyKey,
        traceId: `trace-${idempotencyKey}`,
      }),
    }),
  );
}
async function receiptObjectCount(prefix: string) {
  const result = await minio.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );
  return result.Contents?.length ?? 0;
}

beforeAll(ensureBucket);
afterAll(() => minio.destroy());

describe("full-chain rehearsal domain adapter closeout", () => {
  it("applies one real package, replays it, and reads the published chain", async () => {
    await withCloseout(async ({ baseUrl, prisma, tenantId, headers }) => {
      await prisma.replenishmentOrder.createMany({
        data: [
          { tenantId: "demo-real-sample-20260921", orderNumber: "OLD-DEMO" },
          { tenantId: "control-tenant", orderNumber: "CONTROL" },
        ],
      });
      const artifacts = createValidFullChainPackage();
      const applied = await postPackage(
        baseUrl,
        headers,
        artifacts,
        "request-1",
      );
      expect(applied.status).toBe(201);
      expect(applied.body.state).toBe("published");
      const runId = String(applied.body.runId);

      const status = await json(
        await fetch(`${baseUrl}/full-chain-sample-landings/${runId}`, {
          headers,
        }),
      );
      expect(status.status).toBe(200);
      expect(status.body.state).toBe("published");
      expect(status.body.appliedCounts).toEqual({
        shipment_plan: 1,
        booking_commitment: 1,
        cargo_ready_release: 1,
        stuffing_snapshot_line: 1,
        export_customs_case: 1,
        dispatch_fact: 1,
      });

      const chain = await json(
        await fetch(
          `${baseUrl}/full-chain-sample-landings/${runId}/chains/PLAN-1`,
          { headers },
        ),
      );
      expect(chain.status).toBe(200);
      expect(chain.body).toMatchObject({
        planNumber: "PLAN-1",
        booking: {
          bookingNumber: "BOOK-1",
          documents: expect.arrayContaining([
            expect.objectContaining({ type: "mbl", number: "MBL-1" }),
            expect.objectContaining({ type: "hbl", number: "HBL-1" }),
          ]),
        },
        cargoReady: [expect.objectContaining({ cargoReadyNumber: "CR-1" })],
        stuffing: [
          expect.objectContaining({
            containerNumber: "CONT-1",
            houseBill: { type: "hbl", number: "HBL-1" },
          }),
        ],
        exportCustoms: [
          expect.objectContaining({
            invoiceNumber: "INV-1",
            houseBill: { type: "hbl", number: "HBL-1" },
          }),
        ],
        dispatch: [
          expect.objectContaining({
            containerNumber: "CONT-1",
            masterBill: { type: "mbl", number: "MBL-1" },
            houseBills: [{ type: "hbl", number: "HBL-1" }],
          }),
        ],
        gaps: [],
      });

      const replay = await postPackage(
        baseUrl,
        headers,
        artifacts,
        "request-2",
      );
      expect(replay.body).toMatchObject({ runId, state: "replayed" });
      const concurrent = await Promise.all([
        postPackage(baseUrl, headers, artifacts, "request-3"),
        postPackage(baseUrl, headers, artifacts, "request-4"),
      ]);
      expect(new Set(concurrent.map(({ body }) => body.runId))).toEqual(
        new Set([runId]),
      );
      expect(concurrent.every(({ body }) => body.state === "replayed")).toBe(
        true,
      );
      expect(
        await prisma.fullChainLandingRun.count({ where: { tenantId } }),
      ).toBe(1);
      expect(
        await prisma.outboxMessage.count({
          where: { tenantId, ownerModule: "full-chain-sample-landing" },
        }),
      ).toBe(1);
      expect(await prisma.canonicalEvent.count({ where: { tenantId } })).toBe(
        0,
      );
      expect(await prisma.inboxMessage.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.nodeTask.count({ where: { tenantId } })).toBe(0);
      expect(
        await prisma.replenishmentOrder.findMany({
          where: {
            tenantId: { in: ["demo-real-sample-20260921", "control-tenant"] },
          },
          orderBy: { tenantId: "asc" },
        }),
      ).toHaveLength(2);
      const objects = await minio.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `rehearsal/${tenantId}/${runId}/`,
        }),
      );
      expect(objects.Contents?.map((item) => item.Key)).toEqual([
        `rehearsal/${tenantId}/${runId}/receipt.json`,
      ]);
    });
  }, 180_000);

  it("rejects malformed, orphaned, lineage-incomplete, and cross-tenant requests before writes", async () => {
    await withCloseout(async ({ baseUrl, prisma, tenantId, headers }) => {
      const valid = createValidFullChainPackage();
      const cases: Array<{
        name: string;
        artifacts: ValidatedFullChainPackage;
        requestHeaders?: Record<string, string>;
      }> = [];

      const notPublishable = structuredClone(valid);
      notPublishable.manifest.publishable = false;
      notPublishable.gaps.push({
        code: "BLOCKED",
        status: "blocking",
        reason: "blocked",
      });
      cases.push({
        name: "publishable false",
        artifacts: rehash(notPublishable),
      });

      const hashTamper = structuredClone(valid);
      hashTamper.manifest.packageHash = "f".repeat(64);
      cases.push({ name: "hash tamper", artifacts: hashTamper });

      const orphanCargo = structuredClone(valid);
      const stuffing = orphanCargo.records.find(
        (record) => record.recordType === "stuffing_snapshot_line",
      );
      if (stuffing?.recordType === "stuffing_snapshot_line")
        stuffing.payload.cargoReadyNo = "CR-MISSING";
      cases.push({ name: "orphan cargo", artifacts: rehash(orphanCargo) });

      const customsHbl = structuredClone(valid);
      const customs = customsHbl.records.find(
        (record) => record.recordType === "export_customs_case",
      );
      if (customs?.recordType === "export_customs_case")
        customs.payload.houseBillNo = "HBL-MISSING";
      cases.push({ name: "customs HBL", artifacts: rehash(customsHbl) });

      const dispatchMbl = structuredClone(valid);
      const dispatch = dispatchMbl.records.find(
        (record) => record.recordType === "dispatch_fact",
      );
      if (dispatch?.recordType === "dispatch_fact")
        dispatch.payload.masterBillNo = "MBL-MISSING";
      cases.push({ name: "dispatch MBL", artifacts: rehash(dispatchMbl) });

      const missingLineage = structuredClone(valid);
      missingLineage.lineage = missingLineage.lineage.slice(1);
      cases.push({ name: "lineage", artifacts: rehash(missingLineage) });

      cases.push({
        name: "cross tenant",
        artifacts: valid,
        requestHeaders: { ...headers, "x-tenant-id": "another-tenant" },
      });

      for (const [index, item] of cases.entries()) {
        const beforeRuns = await prisma.fullChainLandingRun.count({
          where: { tenantId },
        });
        const beforeObjects = await receiptObjectCount(
          `rehearsal/${tenantId}/`,
        );
        const response = await postPackage(
          baseUrl,
          item.requestHeaders ?? headers,
          item.artifacts,
          `rejected-${index}`,
        );
        expect(response.status, item.name).toBeGreaterThanOrEqual(400);
        expect(response.body).toMatchObject({
          code: expect.stringMatching(/^[A-Z][A-Z0-9_]+$/u),
          traceId: expect.any(String),
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /stack|PLAN-1|HBL-1|MBL-1|rehearsal-/u,
        );
        expect(
          await prisma.fullChainLandingRun.count({ where: { tenantId } }),
          item.name,
        ).toBe(beforeRuns);
        expect(
          await receiptObjectCount(`rehearsal/${tenantId}/`),
          item.name,
        ).toBe(beforeObjects);
      }
    });
  }, 180_000);

  it("rolls back the full stage transaction when a mid-chain adapter fails", async () => {
    await withCloseout(
      async ({ baseUrl, prisma, tenantId, headers }) => {
        const response = await postPackage(
          baseUrl,
          headers,
          createValidFullChainPackage(),
          "rollback-1",
        );
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(
          await prisma.fullChainLandingRun.count({ where: { tenantId } }),
        ).toBe(0);
        expect(
          await prisma.fullChainExportCustomsCase.count({
            where: { tenantId },
          }),
        ).toBe(0);
        expect(
          await prisma.fullChainDispatchFact.count({ where: { tenantId } }),
        ).toBe(0);
        expect(await receiptObjectCount(`rehearsal/${tenantId}/`)).toBe(0);
      },
      (builder) =>
        builder.overrideProvider(FULL_CHAIN_LANDING_REPOSITORY).useFactory({
          inject: [PrismaService],
          factory: (prisma: PrismaService) =>
            new PrismaFullChainLandingRepository(prisma, {
              failAfterRecordType: "export_customs_case",
            }),
        }),
    );
  }, 180_000);

  it("recovers the same run after MinIO stores the receipt but the request times out", async () => {
    let failOnce = true;
    await withCloseout(
      async ({ baseUrl, prisma, tenantId, headers }) => {
        const artifacts = createValidFullChainPackage();
        const first = await postPackage(
          baseUrl,
          headers,
          artifacts,
          "receipt-timeout-1",
        );
        expect(first.status).toBeGreaterThanOrEqual(500);
        const staged = await prisma.fullChainLandingRun.findFirstOrThrow({
          where: { tenantId },
        });
        expect(staged.state).toBe("receipt_pending");
        expect(
          await prisma.outboxMessage.count({
            where: { tenantId, ownerModule: "full-chain-sample-landing" },
          }),
        ).toBe(0);
        expect(await receiptObjectCount(`rehearsal/${tenantId}/`)).toBe(1);

        const retried = await postPackage(
          baseUrl,
          headers,
          artifacts,
          "receipt-timeout-2",
        );
        expect(retried.body).toMatchObject({
          runId: staged.id,
          state: "published",
        });
        expect(
          await prisma.fullChainLandingRun.count({ where: { tenantId } }),
        ).toBe(1);
        expect(
          await prisma.outboxMessage.count({
            where: { tenantId, ownerModule: "full-chain-sample-landing" },
          }),
        ).toBe(1);
        expect(await receiptObjectCount(`rehearsal/${tenantId}/`)).toBe(1);
      },
      (builder) =>
        builder.overrideProvider(LANDING_RECEIPT_STORE).useFactory({
          factory: () => {
            const real = new S3LandingReceiptStore(minio, bucket, {
              rehearsalTenantId:
                process.env.FULL_CHAIN_REHEARSAL_TENANT_ID ?? "",
              oldDemoTenantId: "demo-real-sample-20260921",
              prefixRoot: "rehearsal",
            });
            return {
              ...real,
              readDigest: real.readDigest.bind(real),
              deleteOwnedKey: real.deleteOwnedKey.bind(real),
              putIfAbsent: async (
                input: Parameters<typeof real.putIfAbsent>[0],
              ) => {
                const result = await real.putIfAbsent(input);
                if (failOnce) {
                  failOnce = false;
                  throw new Error("NETWORK_TIMEOUT_AFTER_PUT");
                }
                return result;
              },
            };
          },
        }),
    );
  }, 180_000);
});
