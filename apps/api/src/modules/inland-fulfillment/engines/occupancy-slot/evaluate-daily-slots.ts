export const WAREHOUSE_RESOURCE_ID = "warehouse";

export type OccupancyResource = {
  resourceId: string;
  dailyLimit: number;
  occupiedByDay: Record<string, number>;
};

export type DailySlot = {
  day: Date;
  remaining: Record<string, number>;
};

export type OccupancyReject = {
  kind: "reject";
  code: "BUSINESS_PRECONDITION_FAILED";
  message: string;
};

export function occupancyDayKey(date: Date): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

export function evaluateDailySlots(input: {
  days: Date[];
  resources: OccupancyResource[];
}): { kind: "apply"; slots: DailySlot[] } | OccupancyReject {
  const seen = new Set<string>();
  for (const resource of input.resources) {
    if (!resource.resourceId.trim()) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "占用资源缺少标识",
      };
    }
    if (seen.has(resource.resourceId)) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: `占用资源 ${resource.resourceId} 重复`,
      };
    }
    seen.add(resource.resourceId);
    if (!Number.isInteger(resource.dailyLimit)) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: `资源 ${resource.resourceId} 日限额必须是整数`,
      };
    }
    if (resource.dailyLimit < 0) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: `资源 ${resource.resourceId} 日限额不能为负`,
      };
    }
  }

  return {
    kind: "apply",
    slots: input.days.map((day) => {
      const remaining: Record<string, number> = {};
      for (const resource of input.resources) {
        remaining[resource.resourceId] =
          resource.dailyLimit -
          (resource.occupiedByDay[occupancyDayKey(day)] ?? 0);
      }
      return { day, remaining };
    }),
  };
}
