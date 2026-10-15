import { createHash } from "node:crypto";
import { buildDeletePlan } from "./postgres-inventory";

type PurgeEntry = {
  model?: string;
  status: string;
  candidateCount: number;
  table?: string;
  deleteRank?: number | null;
  primaryKeyHash?: string;
  primaryKeys?: unknown[];
};

export type PurgeManifest = {
  manifestHash: string;
  postgres: { entries: PurgeEntry[] };
  blockers?: {
    count: number;
    entries?: Array<{ code?: string }>;
  };
  deletable: false;
};

type TransactionClient = {
  $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
};

const ALLOWED_EXTERNAL_BLOCKERS = new Set(["MINIO_ORPHAN_OBJECT"]);

function primaryKeyHash(ids: unknown[]): string {
  return createHash("sha256")
    .update(ids.map(String).sort().join("\n"))
    .digest("hex");
}

function candidateEntries(manifest: PurgeManifest): PurgeEntry[] {
  if (manifest.deletable !== false) throw new Error("PURGE_MANIFEST_INVALID");
  const blockers = manifest.blockers?.entries ?? [];
  if (
    blockers.length !== (manifest.blockers?.count ?? 0) ||
    blockers.some(({ code }) => !code || !ALLOWED_EXTERNAL_BLOCKERS.has(code))
  )
    throw new Error("OWNERSHIP_BLOCKERS_PRESENT");
  const candidates = manifest.postgres.entries.filter(
    (entry) => entry.status === "candidate",
  );
  if (
    candidates.some(
      (entry) =>
        !entry.model ||
        !entry.table ||
        entry.deleteRank === null ||
        entry.deleteRank === undefined ||
        !Array.isArray(entry.primaryKeys),
    )
  )
    throw new Error("PURGE_ENTRY_INVALID");
  return buildDeletePlan(candidates as never) as PurgeEntry[];
}

type TenantForeignKey = {
  constraint_name: string;
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
};

async function assertNoCrossTenantReferences(input: {
  transaction: TransactionClient;
  targetTenantId: string;
  candidates: PurgeEntry[];
}): Promise<void> {
  const candidateByTable = new Map(
    input.candidates.map((entry) => [entry.table as string, entry]),
  );
  const foreignKeys = (await input.transaction.$queryRawUnsafe(
    `SELECT
       constraint_row.conname AS constraint_name,
       child_table.relname AS child_table,
       child_column.attname AS child_column,
       parent_table.relname AS parent_table,
       parent_column.attname AS parent_column
     FROM pg_constraint constraint_row
     JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
     JOIN pg_class parent_table ON parent_table.oid = constraint_row.confrelid
     JOIN pg_namespace namespace_row ON namespace_row.oid = child_table.relnamespace
     JOIN LATERAL unnest(constraint_row.conkey, constraint_row.confkey)
       WITH ORDINALITY AS key_pair(child_key, parent_key, ordinality) ON TRUE
     JOIN pg_attribute child_column
       ON child_column.attrelid = child_table.oid
      AND child_column.attnum = key_pair.child_key
     JOIN pg_attribute parent_column
       ON parent_column.attrelid = parent_table.oid
      AND parent_column.attnum = key_pair.parent_key
     WHERE constraint_row.contype = 'f'
       AND namespace_row.nspname = current_schema()
       AND EXISTS (
         SELECT 1 FROM pg_attribute column_row
          WHERE column_row.attrelid = child_table.oid
            AND column_row.attname = 'tenant_id'
            AND NOT column_row.attisdropped
       )
       AND EXISTS (
         SELECT 1 FROM pg_attribute column_row
          WHERE column_row.attrelid = parent_table.oid
            AND column_row.attname = 'tenant_id'
            AND NOT column_row.attisdropped
       )`,
  )) as TenantForeignKey[];
  for (const foreignKey of foreignKeys) {
    const parent = candidateByTable.get(foreignKey.parent_table);
    if (!parent?.primaryKeys?.length) continue;
    if (
      ![
        foreignKey.child_table,
        foreignKey.child_column,
        foreignKey.parent_table,
        foreignKey.parent_column,
      ].every((value) => /^[a-z][a-z0-9_]*$/u.test(value))
    )
      throw new Error("PURGE_ENTRY_INVALID");
    const [mismatch] = (await input.transaction.$queryRawUnsafe(
      `SELECT EXISTS (
         SELECT 1
           FROM "${foreignKey.child_table}" child_row
           JOIN "${foreignKey.parent_table}" parent_row
             ON child_row."${foreignKey.child_column}" = parent_row."${foreignKey.parent_column}"
          WHERE parent_row."id" = ANY($1)
            AND parent_row."tenant_id" = $2
            AND child_row."tenant_id" <> parent_row."tenant_id"
       ) AS present`,
      parent.primaryKeys,
      input.targetTenantId,
    )) as Array<{ present: boolean }>;
    if (mismatch?.present) throw new Error("PURGE_CROSS_TENANT_REFERENCE");
  }
}

export async function purgeDeletePlanOnTransaction(input: {
  transaction: TransactionClient;
  targetTenantId: string;
  manifest: PurgeManifest;
}) {
  const candidates = candidateEntries(input.manifest);
  await assertNoCrossTenantReferences({
    transaction: input.transaction,
    targetTenantId: input.targetTenantId,
    candidates,
  });
  const planned = candidates.reduce(
    (sum, entry) => sum + entry.candidateCount,
    0,
  );
  const [identity] = (await input.transaction.$queryRawUnsafe(
    "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id",
  )) as Array<{ backend_pid: number; transaction_id: string }>;
  if (!identity) throw new Error("PURGE_TRANSACTION_IDENTITY_MISSING");

  let deletedCount = 0;
  for (const entry of candidates) {
    if (!entry.table || !/^[a-z][a-z0-9_]*$/u.test(entry.table))
      throw new Error("PURGE_ENTRY_INVALID");
    const deleted = await input.transaction.$queryRawUnsafe(
      `DELETE FROM "${entry.table}" WHERE "id" = ANY($1) RETURNING "id"`,
      entry.primaryKeys,
    );
    deletedCount += deleted.length;
    if (
      deleted.length !== entry.candidateCount ||
      (entry.primaryKeyHash &&
        primaryKeyHash(deleted.map((row) => (row as { id?: unknown }).id)) !==
          entry.primaryKeyHash)
    )
      throw new Error("PURGE_HASH_MISMATCH");
    const [current] = (await input.transaction.$queryRawUnsafe(
      "SELECT pg_backend_pid()::int AS backend_pid, txid_current()::text AS transaction_id",
    )) as Array<{ backend_pid: number; transaction_id: string }>;
    if (
      current?.backend_pid !== identity.backend_pid ||
      current?.transaction_id !== identity.transaction_id
    )
      throw new Error("PURGE_TRANSACTION_SESSION_CHANGED");
  }
  if (deletedCount !== planned) throw new Error("PURGE_COUNT_MISMATCH");

  return {
    result: "purge_complete" as const,
    deleted: deletedCount,
    manifestHash: input.manifest.manifestHash,
    backendPid: identity.backend_pid,
    transactionId: identity.transaction_id,
  };
}
