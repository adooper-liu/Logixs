import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectPostgresInventory } from "./postgres-inventory";
import { purgeDeletePlanOnTransaction } from "./postgres-purge";
import { withTemporaryDatabase } from "./integration-support";

const root = path.resolve(__dirname, "../../../../..");

describe("committed target-tenant purge integration", () => {
  it("rejects a cross-tenant cascade edge before the first delete", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const target = "demo-real-sample-20260921";
      const other = "other-tenant";
      const standard = await prisma.overdueChargeStandard.create({
        data: {
          tenantId: target,
          portId: "port",
          shippingCompanyId: "carrier",
          freightForwarderId: "forwarder",
          chargeType: "demurrage",
          freeDays: 1,
          freeDaysBasis: "calendar_day",
          calculationBasis: "calendar_day",
          includeStartDay: false,
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const otherTier = await prisma.overdueChargeRateTier.create({
        data: {
          tenantId: other,
          standardId: standard.id,
          fromDay: 1,
          amount: "10.00",
          currency: "USD",
        },
      });
      const catalog = JSON.parse(
        await readFile(
          path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
          "utf8",
        ),
      );
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const inventory = await collectPostgresInventory({
        client: { query },
        catalog,
        tenantId: target,
      });

      await expect(
        prisma.$transaction(
          (transaction) =>
            purgeDeletePlanOnTransaction({
              transaction,
              targetTenantId: target,
              manifest: {
                manifestHash: "cross-tenant",
                deletable: false,
                blockers: { count: 0, entries: [] },
                postgres: { entries: inventory.entries },
              },
            }),
          { isolationLevel: "Serializable", timeout: 120_000 },
        ),
      ).rejects.toThrow("PURGE_CROSS_TENANT_REFERENCE");
      expect(
        await prisma.overdueChargeStandard.count({
          where: { id: standard.id },
        }),
      ).toBe(1);
      expect(
        await prisma.overdueChargeRateTier.count({
          where: { id: otherTier.id, tenantId: other },
        }),
      ).toBe(1);
    });
  }, 120_000);

  it("removes only exact target rows and preserves other-tenant and global rows", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const target = "demo-real-sample-20260921";
      const other = "other-tenant";
      const globalCurrencyCount = await prisma.currencyCodeReference.count();
      await prisma.importBatch.createMany({
        data: [
          {
            id: "target-batch",
            tenantId: target,
            operatorId: "test",
            idempotencyKey: "target",
            fileName: "target.xlsx",
            fileHash: "a".repeat(64),
            parserVersion: "test",
            status: "parsed",
            rowCount: 0,
            columnCount: 0,
          },
          {
            id: "other-batch",
            tenantId: other,
            operatorId: "test",
            idempotencyKey: "other",
            fileName: "other.xlsx",
            fileHash: "b".repeat(64),
            parserVersion: "test",
            status: "parsed",
            rowCount: 0,
            columnCount: 0,
          },
        ],
      });
      const catalog = JSON.parse(
        await readFile(
          path.join(root, "scripts/full-chain-demo/ownership-catalog.json"),
          "utf8",
        ),
      );
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const inventory = await collectPostgresInventory({
        client: { query },
        catalog,
        tenantId: target,
      });

      const result = await prisma.$transaction(
        (transaction) =>
          purgeDeletePlanOnTransaction({
            transaction,
            targetTenantId: target,
            manifest: {
              manifestHash: "integration",
              deletable: false,
              blockers: { count: 0, entries: [] },
              postgres: { entries: inventory.entries },
            },
          }),
        { isolationLevel: "Serializable", timeout: 120_000 },
      );

      expect(result.deleted).toBe(1);
      expect(
        await prisma.importBatch.count({ where: { tenantId: target } }),
      ).toBe(0);
      expect(
        await prisma.importBatch.count({ where: { tenantId: other } }),
      ).toBe(1);
      expect(await prisma.currencyCodeReference.count()).toBe(
        globalCurrencyCount,
      );
    });
  }, 120_000);
});
