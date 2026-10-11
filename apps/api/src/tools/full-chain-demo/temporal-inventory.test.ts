import { describe, expect, it, vi } from "vitest";
import { collectTemporalInventory } from "./temporal-inventory";

describe("Temporal ownership inventory", () => {
  it("redacts inputs and blocks global schedules without mutation methods", async () => {
    const client = {
      listWorkflows: vi.fn(async () => [
        {
          namespace: "ns",
          workflowId: "wf",
          tenantId: "demo-real-sample-20260921",
          input: { secret: "hidden" },
        },
      ]),
      listSchedules: vi.fn(async () => [
        { id: "outbox-publish-due-system", state: "active", global: true },
      ]),
    };
    const result = await collectTemporalInventory({
      client,
      targetTenant: "demo-real-sample-20260921",
    });
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "schedule",
          scheduleId: "outbox-publish-due-system",
          state: "active",
          attribution: "global",
          freezeRequired: true,
        }),
      ]),
    );
    expect(result.blockers).toContain("TEMPORAL_GLOBAL_SCHEDULE_BLOCKER");
    expect(JSON.stringify(result)).not.toContain("hidden");
    expect(client).not.toHaveProperty("pause");
  });

  it("separates other and ambiguous workflow ownership", async () => {
    const result = await collectTemporalInventory({
      targetTenant: "demo-real-sample-20260921",
      client: {
        listWorkflows: async () => [
          { namespace: "ns", workflowId: "other", tenantId: "other" },
          { namespace: "ns", workflowId: "ambiguous" },
        ],
        listSchedules: async () => [],
      },
    });
    expect(result.entries.map((entry) => entry.attribution)).toEqual([
      "other",
      "ambiguous",
    ]);
    expect(result.blockers).toContain("TEMPORAL_OWNERSHIP_AMBIGUOUS");
    expect(result.blockers).toContain("TEMPORAL_INPUT_UNAVAILABLE");
  });
});
