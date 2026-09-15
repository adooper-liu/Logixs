export const PARAMETER_KEYS = [
  "customs_buffer",
  "haulage_port_to_warehouse",
  "next_slot_search",
  "unload_to_return",
  "capacity_layers",
] as const;

export const STRATEGY_KEYS = [
  "reference_day",
  "customs_vs_plan",
  "inland_sequence",
  "occupy_timing",
  "contention",
  "multi_fleet",
  "unknown_attribute",
  "reschedule_trigger",
] as const;

export type ParameterKey = (typeof PARAMETER_KEYS)[number];
export type StrategyKey = (typeof STRATEGY_KEYS)[number];

export const REGISTERED_STRATEGY_CODES: Record<StrategyKey, readonly string[]> =
  {
    reference_day: ["actual_else_eta"],
    customs_vs_plan: ["draft_before_customs", "wait_for_customs"],
    inland_sequence: ["warehouse_unload_first"],
    occupy_timing: ["confirm_before_occupy"],
    contention: ["human_decide", "rule_rank_then_human"],
    multi_fleet: ["primary_first", "present_all"],
    unknown_attribute: ["block", "review"],
    reschedule_trigger: ["on_new_eta"],
  };

export const REGISTERED_DURATION_UNITS = ["minutes", "hours", "days"] as const;
export type DurationUnit = (typeof REGISTERED_DURATION_UNITS)[number];

export const CAPACITY_LAYER_UNIT = "layer_codes";
export const REGISTERED_CAPACITY_LAYERS = ["A"] as const;

export type ConfigRecord = { key: string; valueText: string; unit: string };
export type StrategyRecord = { key: string; code: string };

export type DurationParameter = { value: number; unit: DurationUnit };

export type ResolvedPlanningConfig = {
  customsBuffer: DurationParameter;
  haulagePortToWarehouse: DurationParameter;
  nextSlotSearch: DurationParameter;
  unloadToReturn: DurationParameter;
  capacityLayers: string[];
  strategies: Record<StrategyKey, string>;
};

export type RegistryReject = {
  kind: "reject";
  code: "BUSINESS_PRECONDITION_FAILED";
  message: string;
};

const DURATION_MS: Record<DurationUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function durationToMs(parameter: DurationParameter): number {
  return parameter.value * DURATION_MS[parameter.unit];
}

export function isDurationUnit(unit: string): unit is DurationUnit {
  return (REGISTERED_DURATION_UNITS as readonly string[]).includes(unit);
}

export function resolvePlanningConfig(input: {
  parameters: ConfigRecord[];
  strategies: StrategyRecord[];
}): { kind: "apply"; config: ResolvedPlanningConfig } | RegistryReject {
  const parameterByKey = new Map(
    input.parameters.map((item) => [item.key, item]),
  );
  const strategyByKey = new Map(
    input.strategies.map((item) => [item.key, item.code]),
  );

  for (const key of PARAMETER_KEYS) {
    if (!parameterByKey.has(key)) {
      return missing(`缺少计划参数 ${key}`);
    }
  }
  for (const key of STRATEGY_KEYS) {
    if (!strategyByKey.has(key)) {
      return missing(`缺少计划策略 ${key}`);
    }
  }

  const strategies = {} as Record<StrategyKey, string>;
  for (const key of STRATEGY_KEYS) {
    const code = strategyByKey.get(key);
    if (!code) return missing(`缺少计划策略 ${key}`);
    if (!REGISTERED_STRATEGY_CODES[key].includes(code)) {
      return missing(`策略 ${key} 的码 ${code} 未注册`);
    }
    strategies[key] = code;
  }

  const customsBuffer = parseDuration(parameterByKey.get("customs_buffer")!);
  if (customsBuffer.kind === "reject") return customsBuffer;
  const haulage = parseDuration(
    parameterByKey.get("haulage_port_to_warehouse")!,
  );
  if (haulage.kind === "reject") return haulage;
  const nextSlot = parseDuration(parameterByKey.get("next_slot_search")!);
  if (nextSlot.kind === "reject") return nextSlot;
  const unloadToReturn = parseDuration(parameterByKey.get("unload_to_return")!);
  if (unloadToReturn.kind === "reject") return unloadToReturn;
  const layers = parseCapacityLayers(parameterByKey.get("capacity_layers")!);
  if (layers.kind === "reject") return layers;

  if (nextSlot.parameter.value <= 0) {
    return missing("参数 next_slot_search 必须大于 0");
  }
  if (customsBuffer.parameter.value < 0 || haulage.parameter.value < 0) {
    return missing("时长参数不能为负");
  }
  if (unloadToReturn.parameter.value < 0) {
    return missing("参数 unload_to_return 不能为负");
  }

  return {
    kind: "apply",
    config: {
      customsBuffer: customsBuffer.parameter,
      haulagePortToWarehouse: haulage.parameter,
      nextSlotSearch: nextSlot.parameter,
      unloadToReturn: unloadToReturn.parameter,
      capacityLayers: layers.layers,
      strategies,
    },
  };
}

function parseDuration(
  record: ConfigRecord,
): { kind: "apply"; parameter: DurationParameter } | RegistryReject {
  if (!isDurationUnit(record.unit)) {
    return missing(`参数 ${record.key} 的单位 ${record.unit} 未注册`);
  }
  const value = Number(record.valueText);
  if (!Number.isFinite(value)) {
    return missing(`参数 ${record.key} 不是数字`);
  }
  return { kind: "apply", parameter: { value, unit: record.unit } };
}

function parseCapacityLayers(
  record: ConfigRecord,
): { kind: "apply"; layers: string[] } | RegistryReject {
  if (record.unit !== CAPACITY_LAYER_UNIT) {
    return missing(`参数 capacity_layers 单位必须是 ${CAPACITY_LAYER_UNIT}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(record.valueText) as unknown;
  } catch {
    return missing("参数 capacity_layers 不是合法 JSON");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    return missing("参数 capacity_layers 必须是字符串数组");
  }
  const layers = parsed as string[];
  if (layers.length === 0) {
    return missing("参数 capacity_layers 不能为空");
  }
  for (const layer of layers) {
    if (!(REGISTERED_CAPACITY_LAYERS as readonly string[]).includes(layer)) {
      return missing(`能力层 ${layer} 未注册`);
    }
  }
  return { kind: "apply", layers };
}

function missing(message: string): RegistryReject {
  return {
    kind: "reject",
    code: "BUSINESS_PRECONDITION_FAILED",
    message,
  };
}
