import { describe, expect, it, vi } from "vitest";
import {
  rehearseDeletePlan,
  rehearseDeletePlanInTransaction,
  rehearseDeletePlanOnTransaction,
  runRollbackOnlySerializable,
} from "./postgres-dry-run";

const childHash =
  "e3ed78b5cdccac284b5997fca4f52a2f27de9bdb7161f66c89726e7344162dc0";
const parentHash =
  "e6a6f774877c2886df0b4d0442ac80e4f50758a2dd440c135fc7e36a9bee0ee3";

describe("rollback-only purge rehearsal", () => {
  it("runs inventory work and delete rehearsal on the same serializable transaction", async () => {
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) =>
        sql.startsWith("SELECT pg_backend_pid")
          ? [{ backend_pid: 1, transaction_id: "2" }]
          : [{ id: "child-id" }],
      ),
    };
    const work = vi.fn(
      async (client: {
        $queryRawUnsafe: (
          sql: string,
          ...params: unknown[]
        ) => Promise<unknown[]>;
      }) => {
        expect(client).toBe(transaction);
        const result = await rehearseDeletePlanOnTransaction({
          transaction: client,
          manifest: {
            manifestHash: "hash",
            deletable: false,
            blockers: { count: 0 },
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
        });
        return result.actual;
      },
    );
    const prisma = {
      $transaction: vi.fn(
        async (run: (client: typeof transaction) => Promise<void>) =>
          run(transaction),
      ),
    };

    const result = await runRollbackOnlySerializable({ prisma, work });

    expect(result).toBe(1);
    expect(work).toHaveBeenCalledOnce();
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
  });

  it("always rolls back after matching counts", async () => {
    const client = {
      begin: vi.fn(),
      setSerializable: vi.fn(),
      deleteByEntry: vi.fn(async () => ({ count: 1 })),
      rollback: vi.fn(),
    };
    const result = await rehearseDeletePlan({
      client,
      manifest: {
        manifestHash: "hash",
        deletable: false,
        postgres: { entries: [{ status: "candidate", candidateCount: 1 }] },
      },
    });
    expect(result.result).toBe("dry_run_complete");
    expect(client.rollback).toHaveBeenCalledOnce();
  });

  it("rejects blockers before opening a transaction", async () => {
    const transaction = vi.fn();

    await expect(
      rehearseDeletePlanInTransaction({
        prisma: { $transaction: transaction },
        manifest: {
          manifestHash: "hash",
          deletable: false,
          blockers: { count: 1 },
          postgres: { entries: [] },
        },
      }),
    ).rejects.toThrow("OWNERSHIP_BLOCKERS_PRESENT");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("sorts delete entries child-first and validates returned primary-key hashes", async () => {
    const executedTables: string[] = [];
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT pg_backend_pid"))
          return [{ backend_pid: 1, transaction_id: "2" }];
        const table = sql.match(/DELETE FROM "([a-z_]+)"/u)?.[1];
        if (table) executedTables.push(table);
        return table === "child" ? [{ id: "child-id" }] : [{ id: "parent-id" }];
      }),
    };
    const prisma = {
      $transaction: async (
        run: (client: typeof transaction) => Promise<void>,
      ) => run(transaction),
    };

    const result = await rehearseDeletePlanInTransaction({
      prisma,
      manifest: {
        manifestHash: "hash",
        deletable: false,
        blockers: { count: 0 },
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

    expect(result.actual).toBe(2);
    expect(executedTables).toEqual(["child", "parent"]);
  });

  it("fails when returned IDs differ even if delete counts match", async () => {
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) =>
        sql.startsWith("SELECT pg_backend_pid")
          ? [{ backend_pid: 1, transaction_id: "2" }]
          : [{ id: "different-id" }],
      ),
    };

    await expect(
      rehearseDeletePlanInTransaction({
        prisma: {
          $transaction: async (
            run: (client: typeof transaction) => Promise<void>,
          ) => run(transaction),
        },
        manifest: {
          manifestHash: "hash",
          deletable: false,
          blockers: { count: 0 },
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
    ).rejects.toThrow("DRY_RUN_HASH_MISMATCH");
  });
});
