import { describe, expect, it, vi } from "vitest";
import { purgeDeletePlanOnTransaction } from "./postgres-purge";

const childHash =
  "e3ed78b5cdccac284b5997fca4f52a2f27de9bdb7161f66c89726e7344162dc0";
const parentHash =
  "e6a6f774877c2886df0b4d0442ac80e4f50758a2dd440c135fc7e36a9bee0ee3";

describe("committed target-tenant purge", () => {
  it("deletes the exact manifest keys child-first in one transaction", async () => {
    const executedTables: string[] = [];
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.includes("FROM pg_constraint")) return [];
        if (sql.startsWith("SELECT pg_backend_pid"))
          return [{ backend_pid: 11, transaction_id: "22" }];
        const table = sql.match(/DELETE FROM "([a-z_]+)"/u)?.[1];
        if (table) executedTables.push(table);
        return table === "child" ? [{ id: "child-id" }] : [{ id: "parent-id" }];
      }),
    };

    const result = await purgeDeletePlanOnTransaction({
      transaction,
      targetTenantId: "demo-real-sample-20260921",
      manifest: {
        manifestHash: "manifest-hash",
        deletable: false,
        blockers: { count: 1, entries: [{ code: "MINIO_ORPHAN_OBJECT" }] },
        postgres: {
          entries: [
            {
              model: "Parent",
              status: "candidate",
              candidateCount: 1,
              table: "parent",
              deleteRank: 100,
              primaryKeys: ["parent-id"],
              primaryKeyHash: parentHash,
            },
            {
              model: "Child",
              status: "candidate",
              candidateCount: 1,
              table: "child",
              deleteRank: 200,
              primaryKeys: ["child-id"],
              primaryKeyHash: childHash,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      result: "purge_complete",
      deleted: 2,
      manifestHash: "manifest-hash",
      backendPid: 11,
      transactionId: "22",
    });
    expect(executedTables).toEqual(["child", "parent"]);
  });

  it("rejects any blocker except an unowned MinIO orphan before deletion", async () => {
    const transaction = { $queryRawUnsafe: vi.fn() };

    await expect(
      purgeDeletePlanOnTransaction({
        transaction,
        targetTenantId: "demo-real-sample-20260921",
        manifest: {
          manifestHash: "hash",
          deletable: false,
          blockers: {
            count: 1,
            entries: [{ code: "OWNERSHIP_AMBIGUOUS" }],
          },
          postgres: { entries: [] },
        },
      }),
    ).rejects.toThrow("OWNERSHIP_BLOCKERS_PRESENT");
    expect(transaction.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects a returned-key mismatch so the transaction rolls back", async () => {
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.includes("FROM pg_constraint")) return [];
        return sql.startsWith("SELECT pg_backend_pid")
          ? [{ backend_pid: 11, transaction_id: "22" }]
          : [{ id: "unexpected-id" }];
      }),
    };

    await expect(
      purgeDeletePlanOnTransaction({
        transaction,
        targetTenantId: "demo-real-sample-20260921",
        manifest: {
          manifestHash: "hash",
          deletable: false,
          blockers: { count: 0, entries: [] },
          postgres: {
            entries: [
              {
                model: "Child",
                status: "candidate",
                candidateCount: 1,
                table: "child",
                deleteRank: 200,
                primaryKeys: ["child-id"],
                primaryKeyHash: childHash,
              },
            ],
          },
        },
      }),
    ).rejects.toThrow("PURGE_HASH_MISMATCH");
  });
});
