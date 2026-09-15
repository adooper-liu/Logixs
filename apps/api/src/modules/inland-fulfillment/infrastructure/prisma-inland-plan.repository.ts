import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  InlandPlanRepository,
  OccupancyTotals,
  PersistedInlandPlan,
  PlanningSetup,
} from "../domain/inland-plan.repository";
import {
  dayKey,
  type ConfigRecord,
  type FleetCandidate,
  type StrategyRecord,
} from "../engines/inland-plan";

@Injectable()
export class PrismaInlandPlanRepository implements InlandPlanRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceSetup(tenantId: string, setup: PlanningSetup): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.inlandPlanningParameter.deleteMany({ where: { tenantId } }),
      this.prisma.inlandPlanningStrategy.deleteMany({ where: { tenantId } }),
      this.prisma.warehouseUnloadCapacity.deleteMany({ where: { tenantId } }),
      this.prisma.fleetHaulageCapacity.deleteMany({ where: { tenantId } }),
      this.prisma.portFleetWarehouseAllocation.deleteMany({
        where: { tenantId },
      }),
      this.prisma.inlandPlanningParameter.createMany({
        data: setup.parameters.map((item) => ({
          tenantId,
          key: item.key,
          valueText: item.valueText,
          unit: item.unit,
        })),
      }),
      this.prisma.inlandPlanningStrategy.createMany({
        data: setup.strategies.map((item) => ({
          tenantId,
          key: item.key,
          code: item.code,
        })),
      }),
      this.prisma.warehouseUnloadCapacity.create({
        data: {
          tenantId,
          warehouseId: setup.warehouse.warehouseId,
          dailyLimit: setup.warehouse.dailyLimit,
        },
      }),
      this.prisma.fleetHaulageCapacity.createMany({
        data: setup.fleets.map((item) => ({
          tenantId,
          fleetId: item.fleetId,
          dailyTrips: item.dailyTrips,
          bufferDeclared: item.bufferDeclared,
        })),
      }),
      this.prisma.portFleetWarehouseAllocation.createMany({
        data: setup.allocations.map((item) => ({
          tenantId,
          portId: item.portId,
          warehouseId: item.warehouseId,
          fleetId: item.fleetId,
          assignmentRole: item.assignmentRole,
        })),
      }),
    ]);
  }

  async loadParameters(tenantId: string): Promise<ConfigRecord[]> {
    const rows = await this.prisma.inlandPlanningParameter.findMany({
      where: { tenantId },
    });
    return rows.map((row) => ({
      key: row.key,
      valueText: row.valueText,
      unit: row.unit,
    }));
  }

  async loadStrategies(tenantId: string): Promise<StrategyRecord[]> {
    const rows = await this.prisma.inlandPlanningStrategy.findMany({
      where: { tenantId },
    });
    return rows.map((row) => ({ key: row.key, code: row.code }));
  }

  async findWarehouseCapacity(
    tenantId: string,
    warehouseId: string,
  ): Promise<number | null> {
    const row = await this.prisma.warehouseUnloadCapacity.findUnique({
      where: {
        tenantId_warehouseId: { tenantId, warehouseId },
      },
    });
    return row ? row.dailyLimit : null;
  }

  async findAllocatedFleets(input: {
    tenantId: string;
    portId: string;
    warehouseId: string;
  }): Promise<FleetCandidate[]> {
    const allocations = await this.prisma.portFleetWarehouseAllocation.findMany(
      {
        where: {
          tenantId: input.tenantId,
          portId: input.portId,
          warehouseId: input.warehouseId,
        },
      },
    );
    const fleets = await this.prisma.fleetHaulageCapacity.findMany({
      where: {
        tenantId: input.tenantId,
        fleetId: { in: allocations.map((item) => item.fleetId) },
      },
    });
    const byId = new Map(fleets.map((item) => [item.fleetId, item]));
    return allocations.flatMap((allocation) => {
      const fleet = byId.get(allocation.fleetId);
      if (!fleet) return [];
      return [
        {
          fleetId: fleet.fleetId,
          assignmentRole: allocation.assignmentRole,
          dailyTrips: fleet.dailyTrips,
          bufferDeclared: fleet.bufferDeclared,
        },
      ];
    });
  }

  async sumOccupancy(input: {
    tenantId: string;
    resourceType: string;
    resourceId: string;
    fromDay: Date;
    toDay: Date;
  }): Promise<OccupancyTotals> {
    const rows = await this.prisma.inlandResourceOccupancy.findMany({
      where: {
        tenantId: input.tenantId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        occupancyDate: { gte: input.fromDay, lte: input.toDay },
        state: { in: ["held", "confirmed"] },
      },
    });
    const totals: OccupancyTotals = {};
    for (const row of rows) {
      const key = dayKey(row.occupancyDate);
      totals[key] = (totals[key] ?? 0) + row.quantity;
    }
    return totals;
  }

  async nextPlanVersion(
    tenantId: string,
    containerId: string,
  ): Promise<number> {
    const latest = await this.prisma.inlandPlan.findFirst({
      where: { tenantId, containerId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  async insertPlan(
    plan: Omit<PersistedInlandPlan, "id"> & { id?: string },
  ): Promise<PersistedInlandPlan> {
    const created = await this.prisma.inlandPlan.create({
      data: {
        id: plan.id ?? randomUUID(),
        tenantId: plan.tenantId,
        containerId: plan.containerId,
        version: plan.version,
        status: plan.status,
        warehouseId: plan.warehouseId,
        portId: plan.portId,
        fleetId: plan.fleetId,
        pickupAt: plan.pickupAt,
        deliveryAt: plan.deliveryAt,
        unloadAt: plan.unloadAt,
        returnAt: plan.returnAt,
        customsMustCompleteBy: plan.customsMustCompleteBy,
        latestPickupAt: plan.latestPickupAt,
        latestReturnAt: plan.latestReturnAt,
        overdueDeadlinesCode: plan.overdueDeadlinesCode,
        schemeCode: plan.schemeCode,
        needsHumanDecision: plan.needsHumanDecision,
        occupied: plan.occupied,
      },
    });
    return {
      ...plan,
      id: created.id,
      pickupAt: created.pickupAt,
      deliveryAt: created.deliveryAt,
      unloadAt: created.unloadAt,
      returnAt: created.returnAt,
      customsMustCompleteBy: created.customsMustCompleteBy,
      latestPickupAt: created.latestPickupAt,
      latestReturnAt: created.latestReturnAt,
      overdueDeadlinesCode: created.overdueDeadlinesCode,
    };
  }
}
