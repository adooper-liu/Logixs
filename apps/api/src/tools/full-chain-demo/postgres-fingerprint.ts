import { createHash } from "node:crypto";

type QueryClient = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const identifier = /^[a-z][a-z0-9_]*$/u;

export async function collectDatabaseContentFingerprint(
  client: QueryClient,
  tables: string[],
): Promise<string> {
  const normalizedTables = [...new Set([...tables, "_prisma_migrations"])].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  );
  if (
    normalizedTables.some(
      (table) => table !== "_prisma_migrations" && !identifier.test(table),
    )
  )
    throw new Error("OWNERSHIP_IDENTIFIER_INVALID");
  const snapshots = [];
  for (const table of normalizedTables) {
    const result = await client.query(
      `SELECT row_to_json(source_row)::text AS row_json FROM "${table}" source_row ORDER BY row_to_json(source_row)::text`,
    );
    snapshots.push({
      table,
      rows: result.rows.map((row) => String(row.row_json ?? "")),
    });
  }
  return hash(snapshots);
}

export async function collectPostgresFingerprints(client: QueryClient) {
  const schema = await client.query(
    `SELECT table_schema, table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position`,
  );
  const migrations = await client.query(
    `SELECT migration_name, checksum, finished_at
       FROM "_prisma_migrations"
      ORDER BY started_at, migration_name`,
  );
  return {
    schemaFingerprint: hash(schema.rows),
    migrationFingerprint: hash(migrations.rows),
  };
}
