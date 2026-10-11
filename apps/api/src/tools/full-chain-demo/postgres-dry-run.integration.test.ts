import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectDatabaseContentFingerprint,
  collectPostgresFingerprints,
} from "./postgres-fingerprint";
import {
  rehearseDeletePlanInTransaction,
  rehearseDeletePlanOnTransaction,
  runRollbackOnlySerializable,
} from "./postgres-dry-run";
import {
  collectPostgresInventory,
  type OwnershipCatalog,
} from "./postgres-inventory";
import { REPOSITORY_ROOT, withTemporaryDatabase } from "./integration-support";

describe("postgres rollback integration", () => {
  it("deletes child-first on one backend transaction and leaves every source table unchanged", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = "demo-real-sample-20260921";
      const otherTenant = "other-tenant";
      const targetBatch = randomUUID();
      const otherBatch = randomUUID();
      await prisma.importBatch.createMany({
        data: [
          {
            id: targetBatch,
            tenantId,
            operatorId: "test",
            idempotencyKey: `dry-${randomUUID()}`,
            fileName: "dry.xlsx",
            fileHash: "c".repeat(64),
            status: "parsed",
            rowCount: 1,
            columnCount: 1,
            mappingSuggestions: [],
          },
          {
            id: otherBatch,
            tenantId: otherTenant,
            operatorId: "test",
            idempotencyKey: `other-${randomUUID()}`,
            fileName: "other.xlsx",
            fileHash: "d".repeat(64),
            status: "parsed",
            rowCount: 1,
            columnCount: 1,
            mappingSuggestions: [],
          },
        ],
      });
      await prisma.importRow.create({
        data: { batchId: targetBatch, rowNo: 1, snapshot: {} },
      });
      await prisma.importRow.create({
        data: { batchId: otherBatch, rowNo: 1, snapshot: {} },
      });
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const before = await collectDatabaseContentFingerprint({ query }, [
        "import_batch",
        "import_row",
      ]);
      const catalog = JSON.parse(
        readFileSync(
          join(
            REPOSITORY_ROOT,
            "scripts/full-chain-demo/ownership-catalog.json",
          ),
          "utf8",
        ),
      ) as OwnershipCatalog;
      const result = await runRollbackOnlySerializable({
        prisma: prisma as never,
        work: async (transaction) => {
          const [beforeIdentity] = (await transaction.$queryRawUnsafe(
            "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id, current_setting('transaction_isolation') AS isolation",
          )) as Array<{
            backend_pid: number;
            transaction_id: string;
            isolation: string;
          }>;
          const transactionQuery = async (sql: string, params?: unknown[]) => ({
            rows: (await transaction.$queryRawUnsafe(
              sql,
              ...(params ?? []),
            )) as Array<Record<string, unknown>>,
          });
          const inventory = await collectPostgresInventory({
            client: { query: transactionQuery },
            catalog,
            tenantId,
          });
          await collectPostgresFingerprints({ query: transactionQuery });
          const entries = inventory.entries.filter((entry) =>
            ["ImportBatch", "ImportRow"].includes(entry.model),
          );
          const rehearsal = await rehearseDeletePlanOnTransaction({
            transaction,
            manifest: {
              manifestHash: "a".repeat(64),
              deletable: false,
              blockers: { count: inventory.blockers.length },
              postgres: { entries },
            },
          });
          const [afterIdentity] = (await transaction.$queryRawUnsafe(
            "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id",
          )) as Array<{ backend_pid: number; transaction_id: string }>;
          expect(afterIdentity).toMatchObject({
            backend_pid: beforeIdentity?.backend_pid,
            transaction_id: beforeIdentity?.transaction_id,
          });
          expect(beforeIdentity?.isolation).toBe("serializable");
          return rehearsal;
        },
      });
      const after = await collectDatabaseContentFingerprint({ query }, [
        "import_batch",
        "import_row",
      ]);
      expect(result.actual).toBe(2);
      expect(result.backendPid).toBeGreaterThan(0);
      expect(result.transactionId).not.toBe("");
      expect(after).toBe(before);
      expect(
        await prisma.importBatch.count({ where: { tenantId: otherTenant } }),
      ).toBe(1);
      expect(
        await prisma.importRow.count({ where: { batchId: otherBatch } }),
      ).toBe(1);
    });
  }, 180_000);

  it("rolls back when returned primary-key hash differs at the same count", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = "demo-real-sample-20260921";
      const id = randomUUID();
      await prisma.importBatch.create({
        data: {
          id,
          tenantId,
          operatorId: "test",
          idempotencyKey: `mismatch-${randomUUID()}`,
          fileName: "mismatch.xlsx",
          fileHash: "e".repeat(64),
          status: "parsed",
          rowCount: 0,
          columnCount: 0,
          mappingSuggestions: [],
        },
      });
      await expect(
        rehearseDeletePlanInTransaction({
          prisma: prisma as never,
          manifest: {
            manifestHash: "a".repeat(64),
            deletable: false,
            blockers: { count: 0 },
            postgres: {
              entries: [
                {
                  model: "ImportBatch",
                  status: "candidate",
                  candidateCount: 1,
                  table: "import_batch",
                  deleteRank: 100,
                  primaryKeys: [id],
                  primaryKeyHash: "f".repeat(64),
                },
              ],
            },
          },
        }),
      ).rejects.toThrow("DRY_RUN_HASH_MISMATCH");
      expect(await prisma.importBatch.count({ where: { id } })).toBe(1);
    });
  }, 180_000);

  it("rejects unresolved ownership before starting a transaction", async () => {
    const transaction = async () => {
      throw new Error("TRANSACTION_MUST_NOT_START");
    };
    await expect(
      rehearseDeletePlanInTransaction({
        prisma: { $transaction: transaction },
        manifest: {
          manifestHash: "a".repeat(64),
          deletable: false,
          blockers: { count: 1 },
          postgres: { entries: [] },
        },
      }),
    ).rejects.toThrow("OWNERSHIP_BLOCKERS_PRESENT");
  });
});
