import { describe, expect, it, vi } from "vitest";
import {
  buildDeletePlan,
  collectPostgresInventory,
  deriveDeleteRanks,
} from "./postgres-inventory";

describe("postgres ownership inventory", () => {
  it("binds the exact tenant and preserves globals", async () => {
    const query = vi.fn(async (...args: [string, unknown[]?]) =>
      args[0].includes("reference_data_release")
        ? { rows: [{ count: 4 }] }
        : { rows: [{ id: "target-row" }] },
    );
    const result = await collectPostgresInventory({
      client: { query },
      tenantId: "demo-real-sample-20260921",
      catalog: {
        models: {
          Product: {
            table: "product",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 10,
          },
          ReferenceDataRelease: {
            table: "reference_data_release",
            rule: "preserve_global",
          },
        },
      },
    });
    expect(result.candidateCount).toBe(1);
    expect(
      query.mock.calls.some(
        (call) =>
          call[0].includes("reference_data_release") && call[1]?.length === 0,
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(
        (call) =>
          call[0].includes("tenant_id") &&
          call[1]?.[0] === "demo-real-sample-20260921",
      ),
    ).toBe(true);
  });

  it("derives child-first ranks and ignores self references", () => {
    const ranks = deriveDeleteRanks(
      ["parent", "child", "grandchild", "self_ref"],
      [
        { childTable: "child", parentTable: "parent" },
        { childTable: "grandchild", parentTable: "child" },
        { childTable: "self_ref", parentTable: "self_ref" },
      ],
    );

    expect(ranks.grandchild).toBeGreaterThan(ranks.child);
    expect(ranks.child).toBeGreaterThan(ranks.parent);
    expect(ranks.self_ref).toBe(100);
  });

  it("fails closed when physical dependencies are cyclic", () => {
    expect(() =>
      deriveDeleteRanks(
        ["first", "second"],
        [
          { childTable: "first", parentTable: "second" },
          { childTable: "second", parentTable: "first" },
        ],
      ),
    ).toThrow("DELETE_PLAN_DEPENDENCY_INVALID");
  });

  it("requires both NodeEventApplication chains to resolve to the same tenant", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM "node_event_application"'))
        return {
          rows: [
            {
              id: "target-application",
              node_tenant: "demo-real-sample-20260921",
              event_tenant: "demo-real-sample-20260921",
            },
            {
              id: "other-application",
              node_tenant: "other-tenant",
              event_tenant: "other-tenant",
            },
            {
              id: "missing-node-application",
              node_tenant: null,
              event_tenant: "demo-real-sample-20260921",
            },
            {
              id: "missing-event-application",
              node_tenant: "demo-real-sample-20260921",
              event_tenant: null,
            },
            {
              id: "cross-tenant-application",
              node_tenant: "demo-real-sample-20260921",
              event_tenant: "other-tenant",
            },
          ],
        };
      if (sql.includes('FROM "shipment"')) return { rows: [] };
      if (sql.includes('FROM "flow_instance"')) return { rows: [] };
      if (sql.includes('FROM "node_instance"')) return { rows: [] };
      return { rows: [] };
    });

    const result = await collectPostgresInventory({
      client: { query },
      tenantId: "demo-real-sample-20260921",
      catalog: {
        models: {
          Shipment: {
            table: "shipment",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 100,
          },
          FlowInstance: {
            table: "flow_instance",
            rule: "via_parent",
            parentModel: "Shipment",
            foreignKey: "shipmentId",
            parentKey: "id",
            deleteRank: 200,
          },
          NodeInstance: {
            table: "node_instance",
            rule: "via_parent",
            parentModel: "FlowInstance",
            foreignKey: "flowInstanceId",
            parentKey: "id",
            deleteRank: 300,
          },
          CanonicalEvent: {
            table: "canonical_event",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 100,
          },
          NodeEventApplication: {
            table: "node_event_application",
            rule: "via_parent",
            parentModel: "NodeInstance",
            foreignKey: "targetNodeInstanceId",
            parentKey: "id",
            resolver: "node_event_dual_tenant",
            deleteRank: 400,
          },
        },
      },
    });

    const entry = result.entries.find(
      (candidate) => candidate.model === "NodeEventApplication",
    );
    expect(entry).toMatchObject({
      candidateCount: 1,
      primaryKeys: ["target-application"],
      unresolvedCount: 2,
      status: "blocked",
      blockerCodes: ["OWNERSHIP_UNRESOLVED", "OWNERSHIP_AMBIGUOUS"],
    });
  });

  it("uses the full runtime FK graph instead of static catalog ranks", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM pg_constraint"))
        return {
          rows: [
            { child_table: "child", parent_table: "parent" },
            { child_table: "grandchild", parent_table: "child" },
          ],
        };
      if (sql.includes('FROM "grandchild"'))
        return { rows: [{ id: "grandchild-1" }] };
      if (sql.includes('FROM "child"')) return { rows: [{ id: "child-1" }] };
      if (sql.includes('FROM "parent"')) return { rows: [{ id: "parent-1" }] };
      return { rows: [] };
    });

    const result = await collectPostgresInventory({
      client: { query },
      tenantId: "demo-real-sample-20260921",
      catalog: {
        models: {
          Parent: {
            table: "parent",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 100,
          },
          Child: {
            table: "child",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 100,
          },
          Grandchild: {
            table: "grandchild",
            rule: "direct_tenant",
            tenantField: "tenantId",
            deleteRank: 100,
          },
        },
      },
    });

    expect(buildDeletePlan(result.entries).map((entry) => entry.model)).toEqual(
      ["Grandchild", "Child", "Parent"],
    );
  });
});
