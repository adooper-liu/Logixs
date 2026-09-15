import { describe, expect, it } from "vitest";
import {
  CAPACITY_LAYER_UNIT,
  PARAMETER_KEYS,
  resolvePlanningConfig,
  STRATEGY_KEYS,
  type ConfigRecord,
  type StrategyRecord,
} from "./planning-registry";

function parameters(
  overrides: Partial<Record<string, ConfigRecord>> = {},
): ConfigRecord[] {
  const base: Record<string, ConfigRecord> = {
    customs_buffer: {
      key: "customs_buffer",
      valueText: "12",
      unit: "hours",
    },
    haulage_port_to_warehouse: {
      key: "haulage_port_to_warehouse",
      valueText: "8",
      unit: "hours",
    },
    next_slot_search: {
      key: "next_slot_search",
      valueText: "3",
      unit: "days",
    },
    unload_to_return: {
      key: "unload_to_return",
      valueText: "4",
      unit: "hours",
    },
    capacity_layers: {
      key: "capacity_layers",
      valueText: '["A"]',
      unit: CAPACITY_LAYER_UNIT,
    },
  };
  return PARAMETER_KEYS.map((key) => overrides[key] ?? base[key]!);
}

function strategies(
  overrides: Partial<Record<string, string>> = {},
): StrategyRecord[] {
  const base: Record<string, string> = {
    reference_day: "actual_else_eta",
    customs_vs_plan: "draft_before_customs",
    inland_sequence: "warehouse_unload_first",
    occupy_timing: "confirm_before_occupy",
    contention: "human_decide",
    multi_fleet: "primary_first",
    unknown_attribute: "review",
    reschedule_trigger: "on_new_eta",
  };
  return STRATEGY_KEYS.map((key) => ({
    key,
    code: overrides[key] ?? base[key]!,
  }));
}

describe("resolvePlanningConfig", () => {
  it("缺参数则失败，不补默认", () => {
    const resolved = resolvePlanningConfig({
      parameters: parameters().filter((item) => item.key !== "customs_buffer"),
      strategies: strategies(),
    });
    expect(resolved).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("未注册策略码失败", () => {
    const resolved = resolvePlanningConfig({
      parameters: parameters(),
      strategies: strategies({ inland_sequence: "cheapest_first" }),
    });
    expect(resolved.kind).toBe("reject");
    if (resolved.kind === "reject") {
      expect(resolved.message).toContain("未注册");
    }
  });

  it("未注册时长单位失败", () => {
    const resolved = resolvePlanningConfig({
      parameters: parameters({
        customs_buffer: {
          key: "customs_buffer",
          valueText: "1",
          unit: "business_days",
        },
      }),
      strategies: strategies(),
    });
    expect(resolved).toMatchObject({
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
    });
  });

  it("齐全且已注册则通过", () => {
    const resolved = resolvePlanningConfig({
      parameters: parameters(),
      strategies: strategies(),
    });
    expect(resolved.kind).toBe("apply");
  });
});
