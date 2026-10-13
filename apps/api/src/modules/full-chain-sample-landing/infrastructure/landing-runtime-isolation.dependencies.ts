import { Injectable } from "@nestjs/common";
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

@Injectable()
export class LandingRuntimeIsolationDependencies {
  constructor(readonly prisma: PrismaService) {}

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
      inventoryHash(
        await collectPostgresInventory({
          client: queryClient(prisma),
          catalog,
          tenantId: targetTenantId,
        }),
      ),
    captureTenantHash: async (tenantId) =>
      inventoryHash(
        await collectPostgresInventory({
          client: queryClient(prisma),
          catalog,
          tenantId,
        }),
      ),
    captureGlobalReferenceHash: async () => {
      const inventory = await collectPostgresInventory({
        client: queryClient(prisma),
        catalog,
        tenantId: "__global_probe__",
      });
      return inventoryHash(
        inventory.entries.filter((entry) => entry.status === "preserved"),
      );
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
