import {
  durationToMs,
  type DurationParameter,
  type ResolvedPlanningConfig,
} from "./planning-registry";

export type DraftReject = {
  kind: "reject";
  code:
    | "BUSINESS_PRECONDITION_FAILED"
    | "ACTION_CONFIRMATION_REQUIRED"
    | "REVIEW_REQUIRED"
    | "VALIDATION_REQUIRED";
  message: string;
};

export type FleetCandidate = {
  fleetId: string;
  assignmentRole: string;
  dailyTrips: number;
  bufferDeclared: boolean;
};

export type DraftInlandPlanInput = {
  warehouseId: string;
  portId: string;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  customsCompleted: boolean;
  cargoAttributesKnown: boolean;
  warehouseResourceId: string;
  slots: Array<{ day: Date; remaining: Record<string, number> }>;
  fleets: FleetCandidate[];
};

export type InlandPlanDraft = {
  referenceAt: Date;
  pickupAt: Date | null;
  deliveryAt: Date | null;
  unloadAt: Date | null;
  returnAt: Date | null;
  customsMustCompleteBy: Date | null;
  schemeCode: string;
  fleetId: string | null;
  needsHumanDecision: boolean;
  occupied: boolean;
  feeEstimates: { feeType: string; state: "review_required" }[];
};

export type DraftDecision =
  { kind: "apply"; plan: InlandPlanDraft } | DraftReject;

const FEE_TYPES = ["demurrage", "detention", "storage", "trucking"] as const;
const UTC_DAY_MS = 86_400_000;

export function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function dayKey(date: Date): string {
  return utcDay(date).toISOString().slice(0, 10);
}

export function enumerateSearchDays(
  referenceAt: Date,
  search: DurationParameter,
): Date[] {
  const days = Math.max(1, Math.ceil(durationToMs(search) / UTC_DAY_MS));
  const start = utcDay(referenceAt);
  return Array.from(
    { length: days },
    (_, index) => new Date(start.getTime() + index * UTC_DAY_MS),
  );
}

export function draftInlandPlan(
  input: DraftInlandPlanInput,
  config: ResolvedPlanningConfig,
): DraftDecision {
  if (!input.warehouseId.trim() || !input.portId.trim()) {
    return {
      kind: "reject",
      code: "VALIDATION_REQUIRED",
      message: "缺少目的仓或港口",
    };
  }

  if (!input.cargoAttributesKnown) {
    if (config.strategies.unknown_attribute === "block") {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "货物属性未声明，按未知属性策略阻断",
      };
    }
    return {
      kind: "reject",
      code: "REVIEW_REQUIRED",
      message: "货物属性未声明，按未知属性策略复核",
    };
  }

  const reference = selectReferenceDay(input, config);
  if (reference.kind === "reject") return reference;

  if (
    config.strategies.customs_vs_plan === "wait_for_customs" &&
    !input.customsCompleted
  ) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "清关与排程策略要求清关完成后再排",
    };
  }

  const fleet = selectFleet(input.fleets, config.strategies.multi_fleet);
  if (fleet.kind === "reject") return fleet;

  if (config.strategies.inland_sequence !== "warehouse_unload_first") {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `内陆顺序 ${config.strategies.inland_sequence} 未实现`,
    };
  }

  if (config.strategies.occupy_timing !== "confirm_before_occupy") {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `占用时机 ${config.strategies.occupy_timing} 未实现`,
    };
  }

  const fees = FEE_TYPES.map((feeType) => ({
    feeType,
    state: "review_required" as const,
  }));
  const customsEnabled =
    config.strategies.customs_vs_plan === "draft_before_customs";
  const warehouseId = input.warehouseResourceId;
  const fleetId = fleet.fleet.fleetId;

  for (const slot of input.slots) {
    const warehouseRemaining = slot.remaining[warehouseId] ?? 0;
    const fleetRemaining = slot.remaining[fleetId] ?? 0;
    if (warehouseRemaining >= 1 && fleetRemaining >= 1) {
      const times = buildTimes(reference.at, slot.day, config);
      if (!times) continue;
      return {
        kind: "apply",
        plan: completePlan({
          referenceAt: reference.at,
          times,
          customsEnabled,
          customsBufferMs: durationToMs(config.customsBuffer),
          schemeCode: "direct_warehouse",
          fleetId,
          needsHumanDecision: false,
          fees,
        }),
      };
    }
  }

  let bufferDay: Date | null = null;
  if (fleet.fleet.bufferDeclared) {
    for (const slot of input.slots) {
      if ((slot.remaining[fleetId] ?? 0) >= 1) {
        bufferDay = slot.day;
        break;
      }
    }
  }

  if (bufferDay) {
    const times = buildTimes(reference.at, bufferDay, config);
    if (times) {
      return {
        kind: "apply",
        plan: completePlan({
          referenceAt: reference.at,
          times,
          customsEnabled,
          customsBufferMs: durationToMs(config.customsBuffer),
          schemeCode: "compare_demurrage_vs_buffer",
          fleetId,
          needsHumanDecision: true,
          fees,
        }),
      };
    }
  }

  return {
    kind: "apply",
    plan: {
      referenceAt: reference.at,
      pickupAt: null,
      deliveryAt: null,
      unloadAt: null,
      returnAt: null,
      customsMustCompleteBy: null,
      schemeCode: "wait_warehouse",
      fleetId,
      needsHumanDecision: true,
      occupied: false,
      feeEstimates: fees,
    },
  };
}

function completePlan(input: {
  referenceAt: Date;
  times: {
    pickupAt: Date;
    deliveryAt: Date;
    unloadAt: Date;
    returnAt: Date;
  };
  customsEnabled: boolean;
  customsBufferMs: number;
  schemeCode: string;
  fleetId: string;
  needsHumanDecision: boolean;
  fees: InlandPlanDraft["feeEstimates"];
}): InlandPlanDraft {
  return {
    referenceAt: input.referenceAt,
    pickupAt: input.times.pickupAt,
    deliveryAt: input.times.deliveryAt,
    unloadAt: input.times.unloadAt,
    returnAt: input.times.returnAt,
    customsMustCompleteBy: input.customsEnabled
      ? new Date(input.times.pickupAt.getTime() - input.customsBufferMs)
      : null,
    schemeCode: input.schemeCode,
    fleetId: input.fleetId,
    needsHumanDecision: input.needsHumanDecision,
    occupied: false,
    feeEstimates: input.fees,
  };
}

function selectReferenceDay(
  input: DraftInlandPlanInput,
  config: ResolvedPlanningConfig,
): { kind: "apply"; at: Date } | DraftReject {
  if (config.strategies.reference_day !== "actual_else_eta") {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: `参考日策略 ${config.strategies.reference_day} 未实现`,
    };
  }
  if (input.actualArrival) return { kind: "apply", at: input.actualArrival };
  if (input.estimatedArrival) {
    return { kind: "apply", at: input.estimatedArrival };
  }
  return {
    kind: "reject",
    code: "BUSINESS_PRECONDITION_FAILED",
    message: "参考日策略选不出 ETA 或到港实际",
  };
}

function selectFleet(
  fleets: FleetCandidate[],
  strategy: string,
): { kind: "apply"; fleet: FleetCandidate } | DraftReject {
  if (fleets.length === 0) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "港口-车队-仓库没有已分配车队",
    };
  }
  if (strategy === "primary_first") {
    const primary = fleets.filter((item) => item.assignmentRole === "primary");
    if (primary.length !== 1) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "主派策略需要恰好一支主派车队",
      };
    }
    return { kind: "apply", fleet: primary[0]! };
  }
  if (strategy === "present_all") {
    if (fleets.length > 1) {
      return {
        kind: "reject",
        code: "ACTION_CONFIRMATION_REQUIRED",
        message: "多车队策略要求人选择后再起草",
      };
    }
    return { kind: "apply", fleet: fleets[0]! };
  }
  return {
    kind: "reject",
    code: "BUSINESS_PRECONDITION_FAILED",
    message: `多车队策略 ${strategy} 未实现`,
  };
}

function buildTimes(
  referenceAt: Date,
  deliveryDay: Date,
  config: ResolvedPlanningConfig,
): {
  pickupAt: Date;
  deliveryAt: Date;
  unloadAt: Date;
  returnAt: Date;
} | null {
  const haulageMs = durationToMs(config.haulagePortToWarehouse);
  const returnMs = durationToMs(config.unloadToReturn);
  const dayStart = utcDay(deliveryDay);
  const earliestDelivery = new Date(referenceAt.getTime() + haulageMs);
  if (utcDay(earliestDelivery).getTime() > dayStart.getTime()) return null;

  const deliveryAt =
    utcDay(earliestDelivery).getTime() === dayStart.getTime()
      ? earliestDelivery
      : dayStart;
  const pickupAt = new Date(deliveryAt.getTime() - haulageMs);
  if (pickupAt.getTime() < referenceAt.getTime()) return null;

  const unloadAt = deliveryAt;
  const returnAt = new Date(unloadAt.getTime() + returnMs);
  return { pickupAt, deliveryAt, unloadAt, returnAt };
}
