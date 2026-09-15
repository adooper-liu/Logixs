import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { COMPUTE_OVERDUE_DEADLINES } from "../../charges-settlement";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { INLAND_PLAN_REPOSITORY } from "../domain/inland-plan.repository";
import { CAPACITY_LAYER_UNIT, STRATEGY_KEYS } from "../engines/inland-plan";
import { DraftInlandPlanService } from "./draft-inland-plan.service";

const configuredParameters = [
  { key: "customs_buffer", valueText: "12", unit: "hours" },
  { key: "haulage_port_to_warehouse", valueText: "8", unit: "hours" },
  { key: "next_slot_search", valueText: "3", unit: "days" },
  { key: "unload_to_return", valueText: "4", unit: "hours" },
  {
    key: "capacity_layers",
    valueText: '["A"]',
    unit: CAPACITY_LAYER_UNIT,
  },
];

const configuredStrategies = STRATEGY_KEYS.map((key) => ({
  key,
  code: {
    reference_day: "actual_else_eta",
    customs_vs_plan: "draft_before_customs",
    inland_sequence: "warehouse_unload_first",
    occupy_timing: "confirm_before_occupy",
    contention: "human_decide",
    multi_fleet: "primary_first",
    unknown_attribute: "review",
    reschedule_trigger: "on_new_eta",
  }[key]!,
}));

const idleClocks = {
  dischargeEstimated: null,
  dischargeActual: null,
  pickupEstimated: null,
  pickupActual: null,
  shippingCompanyId: null,
  freightForwarderId: null,
};

function command(
  overrides: Partial<Parameters<DraftInlandPlanService["execute"]>[0]> = {},
) {
  return {
    tenantId: "t1",
    actorId: "op-1",
    containerId: "c1",
    warehouseId: "wh-1",
    portId: "port-1",
    estimatedArrival: "2026-09-16T08:00:00.000Z",
    actualArrival: null,
    ...idleClocks,
    customsCompleted: false,
    cargoAttributesKnown: true,
    ...overrides,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
  overdue = {
    execute: vi.fn().mockResolvedValue({
      kind: "apply" as const,
      deadlines: {
        latestPickupAt: new Date("2026-09-18T00:00:00.000Z"),
        latestReturnAt: new Date("2026-09-21T00:00:00.000Z"),
        matchedStandardIds: ["s1"],
        returnClampedToPickup: false,
      },
    }),
  },
) {
  const module = await Test.createTestingModule({
    providers: [
      DraftInlandPlanService,
      { provide: INLAND_PLAN_REPOSITORY, useValue: repository },
      {
        provide: ASSERT_CONTAINER_TENANT,
        useValue: { execute: vi.fn().mockResolvedValue(undefined) },
      },
      { provide: COMPUTE_OVERDUE_DEADLINES, useValue: overdue },
    ],
  }).compile();
  return { service: module.get(DraftInlandPlanService), overdue };
}

describe("DraftInlandPlanService", () => {
  it("缺配置则 BUSINESS_PRECONDITION_FAILED，不写计划", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue([]),
      loadStrategies: vi.fn().mockResolvedValue([]),
      insertPlan: vi.fn(),
    };
    const { service } = await buildService(repository);
    await expect(service.execute(command())).rejects.toThrow(
      "BUSINESS_PRECONDITION_FAILED",
    );
    expect(repository.insertPlan).not.toHaveBeenCalled();
  });

  it("配置齐全则起草直送仓草稿且 occupied=false", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue(configuredParameters),
      loadStrategies: vi.fn().mockResolvedValue(configuredStrategies),
      findWarehouseCapacity: vi.fn().mockResolvedValue(10),
      findAllocatedFleets: vi.fn().mockResolvedValue([
        {
          fleetId: "fleet-a",
          assignmentRole: "primary",
          dailyTrips: 15,
          bufferDeclared: true,
        },
      ]),
      sumOccupancy: vi.fn().mockResolvedValue({}),
      nextPlanVersion: vi.fn().mockResolvedValue(1),
      insertPlan: vi.fn().mockImplementation(async (plan) => ({
        id: "plan-1",
        ...plan,
      })),
    };
    const { service, overdue } = await buildService(repository);
    const result = await service.execute(command());
    expect(result.schemeCode).toBe("direct_warehouse");
    expect(result.occupied).toBe(false);
    expect(result.status).toBe("draft");
    expect(result.latestPickupAt).toBeNull();
    expect(result.latestReturnAt).toBeNull();
    expect(result.overdueDeadlinesCode).toBeNull();
    expect(overdue.execute).not.toHaveBeenCalled();
    expect(repository.insertPlan).toHaveBeenCalled();
  });

  it("仓满且车队有余力则起草比价建议，不直送仓", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue(configuredParameters),
      loadStrategies: vi.fn().mockResolvedValue(configuredStrategies),
      findWarehouseCapacity: vi.fn().mockResolvedValue(10),
      findAllocatedFleets: vi.fn().mockResolvedValue([
        {
          fleetId: "fleet-a",
          assignmentRole: "primary",
          dailyTrips: 15,
          bufferDeclared: true,
        },
      ]),
      sumOccupancy: vi.fn().mockImplementation(async ({ resourceType }) => {
        if (resourceType === "warehouse_unload") {
          return {
            "2026-09-16": 10,
            "2026-09-17": 10,
            "2026-09-18": 10,
          };
        }
        return {};
      }),
      nextPlanVersion: vi.fn().mockResolvedValue(1),
      insertPlan: vi.fn().mockImplementation(async (plan) => ({
        id: "plan-1",
        ...plan,
      })),
    };
    const { service } = await buildService(repository);
    const result = await service.execute(command());
    expect(result.schemeCode).toBe("compare_demurrage_vs_buffer");
    expect(result.needsHumanDecision).toBe(true);
    expect(result.occupied).toBe(false);
  });

  it("有港口船司货代时只读超期截止日，不阻断起草", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue(configuredParameters),
      loadStrategies: vi.fn().mockResolvedValue(configuredStrategies),
      findWarehouseCapacity: vi.fn().mockResolvedValue(10),
      findAllocatedFleets: vi.fn().mockResolvedValue([
        {
          fleetId: "fleet-a",
          assignmentRole: "primary",
          dailyTrips: 15,
          bufferDeclared: true,
        },
      ]),
      sumOccupancy: vi.fn().mockResolvedValue({}),
      nextPlanVersion: vi.fn().mockResolvedValue(1),
      insertPlan: vi.fn().mockImplementation(async (plan) => ({
        id: "plan-1",
        ...plan,
      })),
    };
    const { service, overdue } = await buildService(repository);
    const result = await service.execute(
      command({
        shippingCompanyId: "line-1",
        freightForwarderId: "ff-1",
      }),
    );
    expect(overdue.execute).toHaveBeenCalledTimes(1);
    expect(result.latestPickupAt?.toISOString()).toBe(
      "2026-09-18T00:00:00.000Z",
    );
    expect(result.latestReturnAt?.toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
    expect(result.overdueDeadlinesCode).toBeNull();
  });

  it("超期标准未命中仍起草，日期为空并记下错误码", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue(configuredParameters),
      loadStrategies: vi.fn().mockResolvedValue(configuredStrategies),
      findWarehouseCapacity: vi.fn().mockResolvedValue(10),
      findAllocatedFleets: vi.fn().mockResolvedValue([
        {
          fleetId: "fleet-a",
          assignmentRole: "primary",
          dailyTrips: 15,
          bufferDeclared: true,
        },
      ]),
      sumOccupancy: vi.fn().mockResolvedValue({}),
      nextPlanVersion: vi.fn().mockResolvedValue(1),
      insertPlan: vi.fn().mockImplementation(async (plan) => ({
        id: "plan-1",
        ...plan,
      })),
    };
    const { service } = await buildService(repository, {
      execute: vi.fn().mockResolvedValue({
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "没有匹配的超期费用标准",
      }),
    });
    const result = await service.execute(
      command({
        shippingCompanyId: "line-1",
        freightForwarderId: "ff-1",
      }),
    );
    expect(result.status).toBe("draft");
    expect(result.latestPickupAt).toBeNull();
    expect(result.latestReturnAt).toBeNull();
    expect(result.overdueDeadlinesCode).toBe("BUSINESS_PRECONDITION_FAILED");
  });
});

describe("DraftInlandPlanService HTTP mapping", () => {
  it("包装成 HttpException", async () => {
    const repository = {
      loadParameters: vi.fn().mockResolvedValue([]),
      loadStrategies: vi.fn().mockResolvedValue([]),
    };
    const { service } = await buildService(repository);
    await expect(
      service.execute(command({ estimatedArrival: null })),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
