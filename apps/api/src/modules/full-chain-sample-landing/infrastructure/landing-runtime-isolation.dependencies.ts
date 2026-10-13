import { Inject, Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalStringify,
  sha256Hex,
} from "@logix/full-chain-sample-contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  createMinioInventoryAdapter,
  createTemporalInventoryAdapter,
} from "../../../tools/full-chain-demo/external-adapters";
import {
  collectPostgresInventory,
  type OwnershipCatalog,
  type PostgresInventoryResult,
  type QueryClient,
} from "../../../tools/full-chain-demo/postgres-inventory";
import type { LandingIsolationProbeDependencies } from "./full-chain-landing-isolation.probe";

function queryClient(prisma: PrismaService) {
  return {
    query: async (sql: string, params: unknown[] = []) => ({
      rows: (await prisma.$queryRawUnsafe(sql, ...params)) as Array<
        Record<string, unknown>
      >,
    }),
  };
}
function inventoryHash(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

export function tenantContentHash(
  tables: Array<{ table: string; rows: Array<Record<string, unknown>> }>,
): string {
  return inventoryHash(
    tables
      .map((entry) => ({
        table: entry.table,
        rows: [...entry.rows].sort((left, right) =>
          Buffer.from(canonicalStringify(left)).compare(
            Buffer.from(canonicalStringify(right)),
          ),
        ),
      }))
      .sort((left, right) =>
        Buffer.from(left.table).compare(Buffer.from(right.table)),
      ),
  );
}

function assertTableIdentifier(table: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(table))
    throw new Error("OWNERSHIP_IDENTIFIER_INVALID");
  return `"${table}"`;
}

export async function loadTenantOwnedContent(
  client: QueryClient,
  inventory: PostgresInventoryResult,
): Promise<Array<{ table: string; rows: Array<Record<string, unknown>> }>> {
  if (inventory.blockers.length)
    throw new Error("FULL_CHAIN_ISOLATION_CAPTURE_BLOCKED");
  const tables = [];
  for (const entry of inventory.entries) {
    if (entry.status !== "candidate" || entry.candidateCount === 0) continue;
    const primaryKeys = entry.primaryKeys ?? [];
    if (primaryKeys.length !== entry.candidateCount)
      throw new Error("FULL_CHAIN_ISOLATION_CAPTURE_BLOCKED");
    const result = await client.query?.(
      `SELECT row_to_json(source_row)::jsonb AS row_json FROM ${assertTableIdentifier(entry.table)} source_row WHERE "id" = ANY($1) ORDER BY row_to_json(source_row)::text`,
      [primaryKeys],
    );
    if (!result) throw new Error("POSTGRES_CLIENT_INVALID");
    tables.push({
      table: entry.table,
      rows: result.rows.map((row) => row.row_json as Record<string, unknown>),
    });
  }
  return tables;
}

async function captureTenantContent(
  prisma: PrismaService,
  catalog: OwnershipCatalog,
  tenantId: string,
): Promise<string> {
  const client = queryClient(prisma);
  const inventory = await collectPostgresInventory({
    client,
    catalog,
    tenantId,
  });
  return tenantContentHash(await loadTenantOwnedContent(client, inventory));
}

@Injectable()
export class LandingRuntimeIsolationDependencies {
  constructor(
    @Inject(PrismaService)
    readonly prisma: PrismaService,
  ) {}

  create(): LandingIsolationProbeDependencies {
    return createLandingIsolationProbeDependencies(this.prisma);
  }
}

export function createLandingIsolationProbeDependencies(
  prisma: PrismaService,
): LandingIsolationProbeDependencies {
  const catalog = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        "../../../../../../scripts/full-chain-demo/ownership-catalog.json",
      ),
      "utf8",
    ),
  ) as OwnershipCatalog;
  const minio = createMinioInventoryAdapter();
  return {
    captureTargetTenantHash: async ({ targetTenantId }) =>
      captureTenantContent(prisma, catalog, targetTenantId),
    captureTenantHash: async (tenantId) =>
      captureTenantContent(prisma, catalog, tenantId),
    captureGlobalReferenceHash: async () => {
      const inventory = await collectPostgresInventory({
        client: queryClient(prisma),
        catalog,
        tenantId: "__global_probe__",
      });
      const migrations = await prisma.$queryRawUnsafe(
        `SELECT row_to_json(source_row)::jsonb AS row_json FROM "_prisma_migrations" source_row ORDER BY row_to_json(source_row)::text`,
      );
      return inventoryHash({
        preserved: inventory.entries.filter(
          (entry) => entry.status === "preserved",
        ),
        migrations,
      });
    },
    captureTargetReceiptDigest: async (targetPrefix) =>
      (await minio.headObject(`${targetPrefix}/receipt.json`))?.checksum ??
      null,
    captureMinioOutsideHash: async (targetPrefix) => {
      const objects = await minio.listObjects();
      const outside = [];
      for (const object of objects) {
        if (object.key === `${targetPrefix}/receipt.json`) continue;
        const detail = await minio.headObject(object.key);
        outside.push({
          keyHash: sha256Hex(object.key),
          size: detail?.size ?? null,
          checksum: detail?.checksum ?? null,
        });
      }
      return inventoryHash(outside);
    },
    captureTemporalHash: async () => {
      const temporal = createTemporalInventoryAdapter();
      try {
        return inventoryHash({
          workflows: await temporal.listWorkflows(),
          schedules: await temporal.listSchedules(),
        });
      } finally {
        temporal.close();
      }
    },
    countLandingOutbox: (targetTenantId) =>
      prisma.outboxMessage.count({
        where: {
          tenantId: targetTenantId,
          ownerModule: "full-chain-sample-landing",
        },
      }),
    countBusinessTasks: (targetTenantId) =>
      prisma.nodeTask.count({ where: { tenantId: targetTenantId } }),
  };
}
