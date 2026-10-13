import { describe, expect, it, vi } from "vitest";
import {
  loadTenantOwnedContent,
  tenantContentHash,
} from "./landing-runtime-isolation.dependencies";

describe("tenantContentHash", () => {
  it("detects same-id content mutation and ignores row order", () => {
    const first = [
      { table: "replenishment_order", rows: [{ id: "1", value: "A" }] },
      { table: "full_chain_landing_run", rows: [{ id: "2", state: "staged" }] },
    ];
    const reordered = [...first].reverse();
    const mutated = [
      { table: "replenishment_order", rows: [{ id: "1", value: "B" }] },
      { table: "full_chain_landing_run", rows: [{ id: "2", state: "staged" }] },
    ];
    expect(tenantContentHash(first)).toBe(tenantContentHash(reordered));
    expect(tenantContentHash(first)).not.toBe(tenantContentHash(mutated));
  });

  it("loads direct and parent-owned candidate rows for content hashing", async () => {
    const inventory = {
      entries: [
        {
          model: "ContainerRecord",
          table: "container_record",
          ownershipRule: "direct_tenant",
          deleteRank: 100,
          candidateCount: 1,
          primaryKeyHash: "a",
          unresolvedCount: 0,
          status: "candidate" as const,
          blockerCodes: [],
          primaryKeys: ["container-1"],
        },
        {
          model: "OceanRoutePlan",
          table: "ocean_route_plan",
          ownershipRule: "via_parent",
          deleteRank: 200,
          candidateCount: 1,
          primaryKeyHash: "b",
          unresolvedCount: 0,
          status: "candidate" as const,
          blockerCodes: [],
          primaryKeys: ["route-1"],
        },
      ],
      blockers: [],
      candidateCount: 2,
    };
    const query = vi.fn(async (sql: string, params: unknown[] = []) => ({
      rows: [
        {
          row_json: {
            id: (params[0] as string[])[0],
            table: sql.includes('"ocean_route_plan"') ? "route" : "container",
          },
        },
      ],
    }));

    await expect(loadTenantOwnedContent({ query }, inventory)).resolves.toEqual(
      [
        {
          table: "container_record",
          rows: [{ id: "container-1", table: "container" }],
        },
        {
          table: "ocean_route_plan",
          rows: [{ id: "route-1", table: "route" }],
        },
      ],
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
});
