import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDeletePlan,
  collectPostgresInventory,
  type OwnershipCatalog,
} from "./postgres-inventory";
import { REPOSITORY_ROOT, withTemporaryDatabase } from "./integration-support";

describe("postgres isolated inventory", () => {
  it("reads direct and indirect target rows from a migrated temporary database", async () => {
    await withTemporaryDatabase(async ({ databaseName, prisma }) => {
      const targetTenant = "demo-real-sample-20260921";
      const otherTenant = "other-tenant";
      const targetBatch = randomUUID();
      const otherBatch = randomUUID();
      await prisma.importBatch.createMany({
        data: [
          {
            id: targetBatch,
            tenantId: targetTenant,
            operatorId: "test",
            idempotencyKey: `target-${randomUUID()}`,
            fileName: "target.xlsx",
            fileHash: "a".repeat(64),
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
            fileHash: "b".repeat(64),
            status: "parsed",
            rowCount: 1,
            columnCount: 1,
            mappingSuggestions: [],
          },
        ],
      });
      await prisma.importRow.createMany({
        data: [
          { batchId: targetBatch, rowNo: 1, snapshot: {} },
          { batchId: otherBatch, rowNo: 1, snapshot: {} },
        ],
      });
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const result = await collectPostgresInventory({
        client: { query },
        tenantId: targetTenant,
        catalog: {
          models: {
            ImportBatch: {
              table: "import_batch",
              rule: "direct_tenant",
              tenantField: "tenantId",
              deleteRank: 100,
            },
            ImportRow: {
              table: "import_row",
              rule: "via_parent",
              parentModel: "ImportBatch",
              foreignKey: "batchId",
              parentKey: "id",
              deleteRank: 200,
            },
            ReferenceDataRelease: {
              table: "reference_data_release",
              rule: "preserve_global",
            },
          },
        },
      });
      expect(
        result.entries.find((entry) => entry.model === "ImportBatch")
          ?.candidateCount,
      ).toBe(1);
      expect(
        result.entries.find((entry) => entry.model === "ImportRow")
          ?.candidateCount,
      ).toBe(1);
      expect(result.blockers).toEqual([]);
      expect(databaseName).toMatch(/^logix_rehearsal_/u);
    });
  }, 180_000);

  it("orders every catalog table child-first using the migrated database FK graph", async () => {
    await withTemporaryDatabase(async ({ databaseName, prisma }) => {
      const catalog = JSON.parse(
        readFileSync(
          join(
            REPOSITORY_ROOT,
            "scripts/full-chain-demo/ownership-catalog.json",
          ),
          "utf8",
        ),
      ) as OwnershipCatalog;
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const result = await collectPostgresInventory({
        client: { query },
        tenantId: "demo-real-sample-20260921",
        catalog,
      });
      const plan = buildDeletePlan(
        result.entries.map((entry) => ({
          ...entry,
          status: entry.status === "preserved" ? "preserved" : "candidate",
        })),
      );
      const planIndex = new Map(
        plan.map((entry, index) => [entry.table, index]),
      );
      const entryByTable = new Map(
        result.entries.map((entry) => [entry.table, entry]),
      );
      const expectedPlanTables = Object.values(catalog.models)
        .filter((rule) => rule.rule !== "preserve_global")
        .map((rule) => rule.table)
        .sort();
      expect([...planIndex.keys()].sort()).toEqual(expectedPlanTables);
      const edges = (await prisma.$queryRawUnsafe(
        `SELECT DISTINCT child.relname AS child_table,
                           parent.relname AS parent_table
             FROM pg_constraint constraint_row
             JOIN pg_class child ON child.oid = constraint_row.conrelid
             JOIN pg_class parent ON parent.oid = constraint_row.confrelid
             JOIN pg_namespace namespace_row ON namespace_row.oid = child.relnamespace
            WHERE constraint_row.contype = 'f'
              AND namespace_row.nspname = 'public'
              AND child.relname <> parent.relname
            ORDER BY child.relname, parent.relname`,
      )) as Array<{ child_table: string; parent_table: string }>;

      for (const edge of edges) {
        const childIndex = planIndex.get(edge.child_table);
        const parentIndex = planIndex.get(edge.parent_table);
        if (childIndex === undefined || parentIndex === undefined) continue;
        expect(
          childIndex,
          `${edge.child_table} must precede ${edge.parent_table}`,
        ).toBeLessThan(parentIndex);
        expect(
          entryByTable.get(edge.child_table)?.deleteRank,
          `${edge.child_table} rank must exceed ${edge.parent_table}`,
        ).toBeGreaterThan(
          entryByTable.get(edge.parent_table)?.deleteRank as number,
        );
      }
      expect(databaseName).toMatch(/^logix_rehearsal_/u);
    });
  }, 180_000);

  it("resolves NodeEventApplication only when event and node chains agree", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const targetTenant = "demo-real-sample-20260921";
      const otherTenant = "other-tenant";
      const targetShipment = randomUUID();
      const otherShipment = randomUUID();
      await prisma.shipment.createMany({
        data: [
          {
            id: targetShipment,
            tenantId: targetTenant,
            sourceSystem: "integration",
            sourceRecordId: randomUUID(),
            sourceVersion: "1",
            transportMode: "ocean",
            currentLifecycleStatus: "departed",
            createdBy: "test",
            updatedBy: "test",
          },
          {
            id: otherShipment,
            tenantId: otherTenant,
            sourceSystem: "integration",
            sourceRecordId: randomUUID(),
            sourceVersion: "1",
            transportMode: "ocean",
            currentLifecycleStatus: "departed",
            createdBy: "test",
            updatedBy: "test",
          },
        ],
      });
      await prisma.flowInstance.createMany({
        data: [
          {
            id: "target-flow",
            containerId: `target-${randomUUID()}`,
            state: "active",
            currentNodeCode: "ocean_transit",
            definitionCode: "post_departure_ocean",
            definitionVersion: 1,
            shipmentId: targetShipment,
            shipmentRelationshipVersion: 1,
          },
          {
            id: "other-flow",
            containerId: `other-${randomUUID()}`,
            state: "active",
            currentNodeCode: "ocean_transit",
            definitionCode: "post_departure_ocean",
            definitionVersion: 1,
            shipmentId: otherShipment,
            shipmentRelationshipVersion: 1,
          },
        ],
      });
      await prisma.nodeInstance.createMany({
        data: [
          {
            id: "target-node",
            flowInstanceId: "target-flow",
            nodeCode: "ocean_transit",
            state: "active",
          },
          {
            id: "other-node",
            flowInstanceId: "other-flow",
            nodeCode: "ocean_transit",
            state: "active",
          },
        ],
      });
      await prisma.canonicalEvent.createMany({
        data: [
          {
            id: "target-event",
            tenantId: targetTenant,
            eventCode: "TEST",
            occurredAt: new Date("2026-10-11T00:00:00Z"),
            evidenceRefs: [],
            idempotencyKey: `target-${randomUUID()}`,
          },
          {
            id: "other-event",
            tenantId: otherTenant,
            eventCode: "TEST",
            occurredAt: new Date("2026-10-11T00:00:01Z"),
            evidenceRefs: [],
            idempotencyKey: `other-${randomUUID()}`,
          },
          {
            id: "unscoped-event",
            tenantId: null,
            eventCode: "TEST",
            occurredAt: new Date("2026-10-11T00:00:02Z"),
            evidenceRefs: [],
            idempotencyKey: `unscoped-${randomUUID()}`,
          },
        ],
      });
      await prisma.nodeEventApplication.createMany({
        data: [
          {
            id: "target-application",
            eventId: "target-event",
            targetNodeInstanceId: "target-node",
            state: "applied",
            evaluatedAt: new Date("2026-10-11T00:01:00Z"),
            guardResults: [],
            appliedAt: new Date("2026-10-11T00:01:00Z"),
          },
          {
            id: "other-application",
            eventId: "other-event",
            targetNodeInstanceId: "other-node",
            state: "applied",
            evaluatedAt: new Date("2026-10-11T00:01:01Z"),
            guardResults: [],
            appliedAt: new Date("2026-10-11T00:01:01Z"),
          },
          {
            id: "unresolved-application",
            eventId: "unscoped-event",
            targetNodeInstanceId: "target-node",
            state: "applied",
            evaluatedAt: new Date("2026-10-11T00:01:02Z"),
            guardResults: [],
            appliedAt: new Date("2026-10-11T00:01:02Z"),
          },
          {
            id: "ambiguous-application",
            eventId: "other-event",
            targetNodeInstanceId: "target-node",
            state: "applied",
            evaluatedAt: new Date("2026-10-11T00:01:03Z"),
            guardResults: [],
            appliedAt: new Date("2026-10-11T00:01:03Z"),
          },
        ],
      });
      const query = async (sql: string, params?: unknown[]) => ({
        rows: (await prisma.$queryRawUnsafe(sql, ...(params ?? []))) as Array<
          Record<string, unknown>
        >,
      });
      const result = await collectPostgresInventory({
        client: { query },
        tenantId: targetTenant,
        catalog: JSON.parse(
          readFileSync(
            join(
              REPOSITORY_ROOT,
              "scripts/full-chain-demo/ownership-catalog.json",
            ),
            "utf8",
          ),
        ),
      });
      const entry = result.entries.find(
        (candidate) => candidate.model === "NodeEventApplication",
      );

      expect(entry).toMatchObject({
        candidateCount: 1,
        primaryKeys: ["target-application"],
        unresolvedCount: 1,
        status: "blocked",
        blockerCodes: ["OWNERSHIP_UNRESOLVED", "OWNERSHIP_AMBIGUOUS"],
      });
    });
  }, 180_000);
});
