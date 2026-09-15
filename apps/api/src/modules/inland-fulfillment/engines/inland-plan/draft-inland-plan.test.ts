import { describe, expect, it } from "vitest";
import {
  draftInlandPlan,
  enumerateSearchDays,
  utcDay,
  type DraftInlandPlanInput,
} from "./draft-inland-plan";
import {
  CAPACITY_LAYER_UNIT,
  resolvePlanningConfig,
  STRATEGY_KEYS,
  type ResolvedPlanningConfig,
} from "./planning-registry";

function config(
  strategyOverrides: Partial<Record<string, string>> = {},
  parameterOverrides: Partial<
    Record<string, { valueText: string; unit: string }>
  > = {},
): ResolvedPlanningConfig {
  const parameters = [
    {
      key: "customs_buffer",
      valueText: parameterOverrides.customs_buffer?.valueText ?? "12",
      unit: parameterOverrides.customs_buffer?.unit ?? "hours",
    },
    {
      key: "haulage_port_to_warehouse",
      valueText: parameterOverrides.haulage_port_to_warehouse?.valueText ?? "8",
      unit: parameterOverrides.haulage_port_to_warehouse?.unit ?? "hours",
    },
    {
      key: "next_slot_search",
      valueText: parameterOverrides.next_slot_search?.valueText ?? "3",
      unit: parameterOverrides.next_slot_search?.unit ?? "days",
    },
    {
      key: "unload_to_return",
      valueText: parameterOverrides.unload_to_return?.valueText ?? "4",
      unit: parameterOverrides.unload_to_return?.unit ?? "hours",
    },
    {
      key: "capacity_layers",
      valueText: parameterOverrides.capacity_layers?.valueText ?? '["A"]',
      unit: parameterOverrides.capacity_layers?.unit ?? CAPACITY_LAYER_UNIT,
    },
  ];
  const base: Record<string, string> = {
    reference_day: "actual_else_eta",
    customs_vs_plan: "draft_before_customs",
    inland_sequence: "warehouse_unload_first",
    occupy_timing: "confirm_before_occupy",
    contention: "human_decide",
    multi_fleet: "primary_first",
    unknown_attribute: "review",
    reschedule_trigger: "on_new_eta",
    ...strategyOverrides,
  };
  const resolved = resolvePlanningConfig({
    parameters,
    strategies: STRATEGY_KEYS.map((key) => ({ key, code: base[key]! })),
  });
  if (resolved.kind !== "apply") {
    throw new Error(resolved.message);
  }
  return resolved.config;
}

function input(
  overrides: Partial<DraftInlandPlanInput> = {},
): DraftInlandPlanInput {
  const referenceAt =
    overrides.actualArrival ??
    overrides.estimatedArrival ??
    new Date("2026-09-16T08:00:00.000Z");
  const days = enumerateSearchDays(utcDay(referenceAt), {
    value: 3,
    unit: "days",
  });
  const remaining = {
    warehouse: 10,
    "fleet-a": 15,
  };
  return {
    warehouseId: "wh-1",
    portId: "port-1",
    estimatedArrival: new Date("2026-09-16T08:00:00.000Z"),
    actualArrival: null,
    customsCompleted: false,
    cargoAttributesKnown: true,
    warehouseResourceId: "warehouse",
    slots: days.map((day) => ({ day, remaining: { ...remaining } })),
    fleets: [
      {
        fleetId: "fleet-a",
        assignmentRole: "primary",
        dailyTrips: 15,
        bufferDeclared: true,
      },
    ],
    ...overrides,
  };
}

describe("draftInlandPlan", () => {
  it("缺 ETA 和实际则失败", () => {
    const decision = draftInlandPlan(
      input({ estimatedArrival: null, actualArrival: null }),
      config(),
    );
    expect(decision).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("仓有位且车队有趟则直送仓，倒推清关必完日，不占名额", () => {
    const decision = draftInlandPlan(input(), config());
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.schemeCode).toBe("direct_warehouse");
    expect(decision.plan.occupied).toBe(false);
    expect(decision.plan.pickupAt?.toISOString()).toBe(
      "2026-09-16T08:00:00.000Z",
    );
    expect(decision.plan.deliveryAt?.toISOString()).toBe(
      "2026-09-16T16:00:00.000Z",
    );
    expect(decision.plan.customsMustCompleteBy?.toISOString()).toBe(
      "2026-09-15T20:00:00.000Z",
    );
    expect(
      decision.plan.feeEstimates.every(
        (item) => item.state === "review_required",
      ),
    ).toBe(true);
  });

  it("有到港实际则用实际作参考日", () => {
    const decision = draftInlandPlan(
      input({ actualArrival: new Date("2026-09-17T02:00:00.000Z") }),
      config(),
    );
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.referenceAt.toISOString()).toBe(
      "2026-09-17T02:00:00.000Z",
    );
    expect(decision.plan.pickupAt?.toISOString()).toBe(
      "2026-09-17T02:00:00.000Z",
    );
  });

  it("首日仓满、次日有位则仍直送仓", () => {
    const days = enumerateSearchDays(
      utcDay(new Date("2026-09-16T08:00:00.000Z")),
      {
        value: 3,
        unit: "days",
      },
    );
    const decision = draftInlandPlan(
      input({
        slots: days.map((day, index) => ({
          day,
          remaining: {
            warehouse: index === 0 ? 0 : 10,
            "fleet-a": 15,
          },
        })),
      }),
      config(),
    );
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.schemeCode).toBe("direct_warehouse");
    expect(decision.plan.deliveryAt?.toISOString()).toBe(
      "2026-09-17T00:00:00.000Z",
    );
  });

  it("仓满且车队有余力并声明缓冲则只给比价建议", () => {
    const days = enumerateSearchDays(
      utcDay(new Date("2026-09-16T08:00:00.000Z")),
      {
        value: 3,
        unit: "days",
      },
    );
    const decision = draftInlandPlan(
      input({
        slots: days.map((day) => ({
          day,
          remaining: { warehouse: 0, "fleet-a": 15 },
        })),
      }),
      config(),
    );
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.schemeCode).toBe("compare_demurrage_vs_buffer");
    expect(decision.plan.needsHumanDecision).toBe(true);
    expect(decision.plan.occupied).toBe(false);
  });

  it("车队无余力则不算路 B", () => {
    const days = enumerateSearchDays(
      utcDay(new Date("2026-09-16T08:00:00.000Z")),
      {
        value: 3,
        unit: "days",
      },
    );
    const decision = draftInlandPlan(
      input({
        slots: days.map((day) => ({
          day,
          remaining: { warehouse: 0, "fleet-a": 0 },
        })),
        fleets: [
          {
            fleetId: "fleet-a",
            assignmentRole: "primary",
            dailyTrips: 0,
            bufferDeclared: true,
          },
        ],
      }),
      config(),
    );
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.schemeCode).toBe("wait_warehouse");
    expect(decision.plan.pickupAt).toBeNull();
    expect(decision.plan.fleetId).toBe("fleet-a");
  });

  it("仓满但未声明缓冲则不算路 B", () => {
    const days = enumerateSearchDays(
      utcDay(new Date("2026-09-16T08:00:00.000Z")),
      {
        value: 3,
        unit: "days",
      },
    );
    const decision = draftInlandPlan(
      input({
        slots: days.map((day) => ({
          day,
          remaining: { warehouse: 0, "fleet-a": 15 },
        })),
        fleets: [
          {
            fleetId: "fleet-a",
            assignmentRole: "primary",
            dailyTrips: 15,
            bufferDeclared: false,
          },
        ],
      }),
      config(),
    );
    expect(decision.kind).toBe("apply");
    if (decision.kind !== "apply") return;
    expect(decision.plan.schemeCode).toBe("wait_warehouse");
  });

  it("wait_for_customs 且未完成则拒绝排程", () => {
    const decision = draftInlandPlan(
      input({ customsCompleted: false }),
      config({ customs_vs_plan: "wait_for_customs" }),
    );
    expect(decision).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("present_all 多车队要人选", () => {
    const decision = draftInlandPlan(
      input({
        fleets: [
          {
            fleetId: "fleet-a",
            assignmentRole: "primary",
            dailyTrips: 5,
            bufferDeclared: false,
          },
          {
            fleetId: "fleet-b",
            assignmentRole: "backup",
            dailyTrips: 5,
            bufferDeclared: true,
          },
        ],
      }),
      config({ multi_fleet: "present_all" }),
    );
    expect(decision).toMatchObject({
      kind: "reject",
      code: "ACTION_CONFIRMATION_REQUIRED",
    });
  });

  it("未知属性按策略复核", () => {
    const decision = draftInlandPlan(
      input({ cargoAttributesKnown: false }),
      config(),
    );
    expect(decision).toMatchObject({
      kind: "reject",
      code: "REVIEW_REQUIRED",
    });
  });
});
