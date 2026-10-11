import { createHash } from "node:crypto";

export type OwnershipRule = {
  table: string;
  rule: "preserve_global" | "direct_tenant" | "via_parent" | "via_logical_ref";
  tenantField?: string;
  parentModel?: string;
  foreignKey?: string;
  parentKey?: string;
  resolver?: string;
  deleteRank?: number;
};
export type OwnershipCatalog = { models: Record<string, OwnershipRule> };
export type PostgresManifestEntry = {
  model: string;
  table: string;
  ownershipRule: string;
  deleteRank: number | null;
  candidateCount: number;
  primaryKeyHash: string;
  unresolvedCount: number;
  status: "preserved" | "candidate" | "blocked";
  blockerCodes: string[];
  primaryKeys?: unknown[];
};
export type PostgresInventoryResult = {
  entries: PostgresManifestEntry[];
  blockers: string[];
  candidateCount: number;
};
export type QueryClient = {
  query?: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
  $queryRaw?: (...args: unknown[]) => Promise<unknown[]>;
};

export type ForeignKeyEdge = { childTable: string; parentTable: string };

export function deriveDeleteRanks(
  tables: string[],
  edges: ForeignKeyEdge[],
): Record<string, number> {
  const ranks = Object.fromEntries(tables.map((table) => [table, 100]));
  const crossTableEdges = edges.filter(
    ({ childTable, parentTable }) => childTable !== parentTable,
  );
  for (let iteration = 0; iteration < tables.length; iteration += 1) {
    let changed = false;
    for (const { childTable, parentTable } of crossTableEdges) {
      if (!(childTable in ranks) || !(parentTable in ranks)) continue;
      if (ranks[childTable]! <= ranks[parentTable]!) {
        ranks[childTable] = ranks[parentTable]! + 100;
        changed = true;
      }
    }
    if (!changed) return ranks;
  }
  throw new Error("DELETE_PLAN_DEPENDENCY_INVALID");
}

const ident = /^[a-z][a-z0-9_]*$/u;

function assertIdentifier(value: string) {
  if (!ident.test(value)) throw new Error("OWNERSHIP_IDENTIFIER_INVALID");
  return `"${value}"`;
}
async function rows(
  client: QueryClient,
  sql: string,
  params: unknown[],
): Promise<Array<Record<string, unknown>>> {
  if (client.query) return (await client.query(sql, params)).rows;
  if (client.$queryRaw)
    return (await client.$queryRaw(sql, ...params)) as Array<
      Record<string, unknown>
    >;
  throw new Error("POSTGRES_CLIENT_INVALID");
}
async function collectForeignKeyEdges(
  client: QueryClient,
): Promise<ForeignKeyEdge[]> {
  const result = await rows(
    client,
    `SELECT child.relname AS child_table, parent.relname AS parent_table
       FROM pg_constraint constraint_row
       JOIN pg_class child ON child.oid = constraint_row.conrelid
       JOIN pg_class parent ON parent.oid = constraint_row.confrelid
       JOIN pg_namespace namespace_row ON namespace_row.oid = child.relnamespace
      WHERE constraint_row.contype = 'f'
        AND namespace_row.nspname = 'public'
      ORDER BY child.relname, parent.relname`,
    [],
  );
  return result
    .map((row) => ({
      childTable: String(row.child_table ?? ""),
      parentTable: String(row.parent_table ?? ""),
    }))
    .filter(({ childTable, parentTable }) => childTable && parentTable);
}
function hashIds(ids: unknown[]) {
  return createHash("sha256")
    .update(ids.map(String).sort().join("\n"))
    .digest("hex");
}
function hashProjection(rows: Array<Record<string, unknown>>) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
function columnName(value: string): string {
  return value.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}
type ResolvedIds = {
  target: Set<unknown>;
  unresolved: number;
  ambiguous: number;
};
async function resolveOwnership(
  client: QueryClient,
  catalog: OwnershipCatalog,
  modelName: string,
  ids: unknown[],
  tenantId: string,
  seen = new Set<string>(),
): Promise<ResolvedIds> {
  if (seen.has(modelName))
    return { target: new Set(), unresolved: ids.length, ambiguous: 0 };
  const rule = catalog.models[modelName];
  if (!rule) return { target: new Set(), unresolved: ids.length, ambiguous: 0 };
  if (rule.rule === "preserve_global")
    return { target: new Set(), unresolved: 0, ambiguous: 0 };
  if (rule.rule === "via_logical_ref")
    return { target: new Set(), unresolved: ids.length, ambiguous: 0 };
  const table = assertIdentifier(rule.table);
  if (rule.rule === "direct_tenant") {
    const result = await rows(
      client,
      `SELECT "id" AS id, "tenant_id" AS tenant FROM ${table} WHERE "id" = ANY($1)`,
      [ids],
    );
    const byId = new Map(result.map((row) => [row.id, row.tenant]));
    return {
      target: new Set(ids.filter((id) => byId.get(id) === tenantId)),
      unresolved: ids.filter((id) => !byId.has(id)).length,
      ambiguous: 0,
    };
  }
  if (!rule.parentModel || !rule.foreignKey)
    return { target: new Set(), unresolved: ids.length, ambiguous: 0 };
  const parentColumn = assertIdentifier(columnName(rule.foreignKey));
  const result = await rows(
    client,
    `SELECT "id" AS id, ${parentColumn} AS parent_id FROM ${table} WHERE "id" = ANY($1)`,
    [ids],
  );
  const childToParent = new Map<unknown, unknown>();
  for (const row of result) childToParent.set(row.id, row.parent_id);
  const parentIds = [...childToParent.values()].filter(
    (id) => id !== null && id !== undefined,
  );
  const resolved = await resolveOwnership(
    client,
    catalog,
    rule.parentModel,
    parentIds,
    tenantId,
    new Set([...seen, modelName]),
  );
  const targetParentIds = resolved.target;
  return {
    target: new Set(
      [...childToParent.entries()]
        .filter(([, parentId]) => targetParentIds.has(parentId))
        .map(([id]) => id),
    ),
    unresolved:
      ids.filter(
        (id) =>
          !childToParent.has(id) ||
          childToParent.get(id) === null ||
          childToParent.get(id) === undefined,
      ).length + resolved.unresolved,
    ambiguous: resolved.ambiguous,
  };
}

export async function collectPostgresInventory(input: {
  client: QueryClient;
  catalog: OwnershipCatalog;
  tenantId: string;
}): Promise<PostgresInventoryResult> {
  if (!input.tenantId) throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  const entries: PostgresManifestEntry[] = [];
  const blockers: string[] = [];
  const catalogTables = Object.values(input.catalog.models).map(
    (rule) => rule.table,
  );
  const catalogEdges = Object.values(input.catalog.models).flatMap((rule) => {
    if (rule.rule !== "via_parent" || !rule.parentModel) return [];
    const parent = input.catalog.models[rule.parentModel];
    return parent
      ? [{ childTable: rule.table, parentTable: parent.table }]
      : [];
  });
  const deleteRanks = deriveDeleteRanks(catalogTables, [
    ...(await collectForeignKeyEdges(input.client)),
    ...catalogEdges,
  ]);
  for (const [model, rule] of Object.entries(input.catalog.models)) {
    const table = assertIdentifier(rule.table);
    if (rule.rule === "preserve_global") {
      const result = await rows(
        input.client,
        `SELECT * FROM ${table} ORDER BY 1`,
        [],
      );
      entries.push({
        model,
        table: rule.table,
        ownershipRule: rule.rule,
        deleteRank: null,
        candidateCount: 0,
        primaryKeyHash: hashProjection(result),
        unresolvedCount: 0,
        status: "preserved",
        blockerCodes: [],
      });
      continue;
    }
    if (rule.rule === "via_parent") {
      if (rule.resolver === "node_event_dual_tenant") {
        const result = await rows(
          input.client,
          `SELECT application."id" AS id,
                  shipment."tenant_id" AS node_tenant,
                  event."tenant_id" AS event_tenant
             FROM ${table} application
             LEFT JOIN "node_instance" node
               ON node."id" = application."target_node_instance_id"
             LEFT JOIN "flow_instance" flow
               ON flow."id" = node."flow_instance_id"
             LEFT JOIN "shipment" shipment
               ON shipment."id" = flow."shipment_id"
             LEFT JOIN "canonical_event" event
               ON event."id" = application."event_id"
            ORDER BY application."id"`,
          [],
        );
        const targetIds: unknown[] = [];
        let unresolved = 0;
        let ambiguous = 0;
        for (const row of result) {
          if (!row.node_tenant || !row.event_tenant) unresolved += 1;
          else if (row.node_tenant !== row.event_tenant) ambiguous += 1;
          else if (row.node_tenant === input.tenantId) targetIds.push(row.id);
        }
        const blockerCodes = [
          ...(unresolved ? ["OWNERSHIP_UNRESOLVED"] : []),
          ...(ambiguous ? ["OWNERSHIP_AMBIGUOUS"] : []),
        ];
        if (blockerCodes.length) blockers.push(...blockerCodes);
        entries.push({
          model,
          table: rule.table,
          ownershipRule: rule.rule,
          deleteRank: deleteRanks[rule.table] ?? null,
          candidateCount: targetIds.length,
          primaryKeyHash: hashIds(targetIds),
          unresolvedCount: unresolved,
          status: blockerCodes.length ? "blocked" : "candidate",
          blockerCodes,
          primaryKeys: targetIds,
        });
        continue;
      }
      const result = await rows(
        input.client,
        `SELECT "id" AS id FROM ${table} ORDER BY "id"`,
        [],
      );
      const ids = result.map((row) => row.id).filter((id) => id !== undefined);
      const resolved = await resolveOwnership(
        input.client,
        input.catalog,
        model,
        ids,
        input.tenantId,
      );
      const blockerCodes = [];
      if (resolved.unresolved) blockerCodes.push("OWNERSHIP_UNRESOLVED");
      if (resolved.ambiguous) blockerCodes.push("OWNERSHIP_AMBIGUOUS");
      if (blockerCodes.length) blockers.push(...blockerCodes);
      entries.push({
        model,
        table: rule.table,
        ownershipRule: rule.rule,
        deleteRank: deleteRanks[rule.table] ?? null,
        candidateCount: resolved.target.size,
        primaryKeyHash: hashIds([...resolved.target]),
        unresolvedCount: resolved.unresolved,
        status: blockerCodes.length ? "blocked" : "candidate",
        blockerCodes,
        primaryKeys: [...resolved.target],
      });
      continue;
    }
    if (rule.rule !== "direct_tenant") {
      entries.push({
        model,
        table: rule.table,
        ownershipRule: rule.rule,
        deleteRank: deleteRanks[rule.table] ?? null,
        candidateCount: 0,
        primaryKeyHash: hashIds([]),
        unresolvedCount: 1,
        status: "blocked",
        blockerCodes: ["OWNERSHIP_RESOLVER_REQUIRED"],
      });
      blockers.push("OWNERSHIP_RESOLVER_REQUIRED");
      continue;
    }
    const tenantField = assertIdentifier(
      rule.tenantField === "tenantId"
        ? "tenant_id"
        : (rule.tenantField ?? "tenant_id"),
    );
    const result = await rows(
      input.client,
      `SELECT "id" FROM ${table} WHERE ${tenantField} = $1 ORDER BY "id"`,
      [input.tenantId],
    );
    const ids = result.map((row) => row.id).filter((id) => id !== undefined);
    entries.push({
      model,
      table: rule.table,
      ownershipRule: rule.rule,
      deleteRank: deleteRanks[rule.table] ?? null,
      candidateCount: ids.length,
      primaryKeyHash: hashIds(ids),
      unresolvedCount: 0,
      status: "candidate",
      blockerCodes: [],
      primaryKeys: ids,
    });
  }
  return {
    entries,
    blockers: [...new Set(blockers)],
    candidateCount: entries.reduce(
      (sum, entry) => sum + entry.candidateCount,
      0,
    ),
  };
}

export function buildDeletePlan(entries: PostgresManifestEntry[]) {
  const candidates = entries.filter((entry) => entry.status === "candidate");
  if (
    candidates.some(
      (entry) => entry.deleteRank === null || entry.deleteRank === undefined,
    )
  )
    throw new Error("DELETE_PLAN_RANK_INVALID");
  return [...candidates].sort(
    (a, b) =>
      (b.deleteRank as number) - (a.deleteRank as number) ||
      Buffer.from(`${a.table}|${a.model}`).compare(
        Buffer.from(`${b.table}|${b.model}`),
      ),
  );
}
