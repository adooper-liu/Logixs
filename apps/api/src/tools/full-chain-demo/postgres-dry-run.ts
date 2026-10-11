import { createHash } from "node:crypto";
import { buildDeletePlan } from "./postgres-inventory";

export function assertManifestFresh(
  expected: { manifestHash: string },
  current: { manifestHash: string },
) {
  if (expected.manifestHash !== current.manifestHash)
    throw new Error("MANIFEST_STALE:MANIFEST_HASH_CHANGED");
}

type DryRunEntry = {
  model?: string;
  status: string;
  candidateCount: number;
  table?: string;
  deleteRank?: number | null;
  primaryKeyHash?: string;
  primaryKeys?: unknown[];
};
export type DryRunManifest = {
  manifestHash: string;
  postgres: { entries: DryRunEntry[] };
  blockers?: { count: number };
  deletable: false;
};
type DryClient = {
  begin: () => Promise<void>;
  setSerializable: () => Promise<void>;
  deleteByEntry: (
    entry: DryRunEntry,
  ) => Promise<{ count: number; ids?: unknown[] }>;
  rollback: () => Promise<void>;
};
type TransactionClient = {
  $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
};
type InteractivePrisma = {
  $transaction: (
    run: (transaction: TransactionClient) => Promise<void>,
    options?: { isolationLevel?: "Serializable"; timeout?: number },
  ) => Promise<void>;
};

class RollbackOnlySignal extends Error {
  constructor() {
    super("DEMO_DRY_RUN_ROLLBACK_ONLY");
  }
}

function candidateEntries(manifest: DryRunManifest): DryRunEntry[] {
  if (manifest.deletable !== false)
    throw new Error("PURGE_MANIFEST_NOT_DRY_RUN");
  if ((manifest.blockers?.count ?? 0) > 0)
    throw new Error("OWNERSHIP_BLOCKERS_PRESENT");
  const candidates = manifest.postgres.entries.filter(
    (entry) => entry.status === "candidate",
  );
  if (
    candidates.every(
      (entry) =>
        entry.model &&
        entry.table &&
        entry.deleteRank !== null &&
        entry.deleteRank !== undefined,
    )
  )
    return buildDeletePlan(candidates as never) as DryRunEntry[];
  return candidates;
}

function primaryKeyHash(ids: unknown[]): string {
  return createHash("sha256")
    .update(ids.map(String).sort().join("\n"))
    .digest("hex");
}

export async function rehearseDeletePlan(input: {
  client: DryClient;
  manifest: DryRunManifest;
}) {
  const candidates = candidateEntries(input.manifest);
  let started = false;
  const planned = candidates.reduce(
    (sum, entry) => sum + entry.candidateCount,
    0,
  );
  let actual = 0;
  try {
    await input.client.begin();
    started = true;
    await input.client.setSerializable();
    for (const entry of candidates)
      actual += (await input.client.deleteByEntry(entry)).count;
    if (actual !== planned) throw new Error("DRY_RUN_COUNT_MISMATCH");
    return {
      result: "dry_run_complete" as const,
      planned,
      actual,
      manifestHash: input.manifest.manifestHash,
    };
  } finally {
    if (started) await input.client.rollback();
  }
}

export async function runRollbackOnlySerializable<T>(input: {
  prisma: InteractivePrisma;
  work: (transaction: TransactionClient) => Promise<T>;
}): Promise<T> {
  let completed = false;
  let result: T | undefined;
  try {
    await input.prisma.$transaction(
      async (transaction) => {
        result = await input.work(transaction);
        completed = true;
        throw new RollbackOnlySignal();
      },
      { isolationLevel: "Serializable", timeout: 120_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackOnlySignal)) throw error;
  }
  if (!completed) throw new Error("DRY_RUN_ROLLBACK_MISSING");
  return result as T;
}

export async function rehearseDeletePlanOnTransaction(input: {
  transaction: TransactionClient;
  manifest: DryRunManifest;
}) {
  const candidates = candidateEntries(input.manifest);
  const planned = candidates.reduce(
    (sum, entry) => sum + entry.candidateCount,
    0,
  );
  const [identity] = (await input.transaction.$queryRawUnsafe(
    "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id",
  )) as Array<{ backend_pid: number; transaction_id: string }>;
  if (!identity) throw new Error("DRY_RUN_TRANSACTION_IDENTITY_MISSING");
  let actual = 0;
  for (const entry of candidates) {
    if (
      !entry.table ||
      !/^[a-z][a-z0-9_]*$/u.test(entry.table) ||
      !Array.isArray(entry.primaryKeys)
    )
      throw new Error("PURGE_ENTRY_INVALID");
    const deleted = await input.transaction.$queryRawUnsafe(
      `DELETE FROM "${entry.table}" WHERE "id" = ANY($1) RETURNING "id"`,
      entry.primaryKeys,
    );
    actual += deleted.length;
    if (
      entry.primaryKeyHash &&
      primaryKeyHash(deleted.map((row) => (row as { id?: unknown }).id)) !==
        entry.primaryKeyHash
    )
      throw new Error("DRY_RUN_HASH_MISMATCH");
    const [current] = (await input.transaction.$queryRawUnsafe(
      "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id",
    )) as Array<{ backend_pid: number; transaction_id: string }>;
    if (
      current?.backend_pid !== identity.backend_pid ||
      current?.transaction_id !== identity.transaction_id
    )
      throw new Error("DRY_RUN_TRANSACTION_SESSION_CHANGED");
  }
  if (actual !== planned) throw new Error("DRY_RUN_COUNT_MISMATCH");
  return {
    result: "dry_run_complete" as const,
    planned,
    actual,
    manifestHash: input.manifest.manifestHash,
    backendPid: identity.backend_pid,
    transactionId: identity.transaction_id,
  };
}

export async function rehearseDeletePlanInTransaction(input: {
  prisma: InteractivePrisma;
  manifest: DryRunManifest;
}) {
  candidateEntries(input.manifest);
  return runRollbackOnlySerializable({
    prisma: input.prisma,
    work: (transaction) =>
      rehearseDeletePlanOnTransaction({
        transaction,
        manifest: input.manifest,
      }),
  });
}
