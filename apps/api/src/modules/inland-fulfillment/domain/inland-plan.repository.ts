import type {
  ConfigRecord,
  FleetCandidate,
  InlandPlanDraft,
  StrategyRecord,
} from "../engines/inland-plan";

export const INLAND_PLAN_REPOSITORY = Symbol("INLAND_PLAN_REPOSITORY");

export type PlanningSetup = {
  parameters: ConfigRecord[];
  strategies: StrategyRecord[];
  warehouse: { warehouseId: string; dailyLimit: number };
  fleets: Array<{
    fleetId: string;
    dailyTrips: number;
    bufferDeclared: boolean;
  }>;
  allocations: Array<{
    portId: string;
    warehouseId: string;
    fleetId: string;
    assignmentRole: string;
  }>;
};

export type OccupancyTotals = Record<string, number>;

export type PersistedInlandPlan = InlandPlanDraft & {
  id: string;
  tenantId: string;
  containerId: string;
  warehouseId: string;
  portId: string;
  version: number;
  status: string;
  latestPickupAt: Date | null;
  latestReturnAt: Date | null;
  overdueDeadlinesCode: string | null;
};

export interface InlandPlanRepository {
  replaceSetup(tenantId: string, setup: PlanningSetup): Promise<void>;
  loadParameters(tenantId: string): Promise<ConfigRecord[]>;
  loadStrategies(tenantId: string): Promise<StrategyRecord[]>;
  findWarehouseCapacity(
    tenantId: string,
    warehouseId: string,
  ): Promise<number | null>;
  findAllocatedFleets(input: {
    tenantId: string;
    portId: string;
    warehouseId: string;
  }): Promise<FleetCandidate[]>;
  sumOccupancy(input: {
    tenantId: string;
    resourceType: string;
    resourceId: string;
    fromDay: Date;
    toDay: Date;
  }): Promise<OccupancyTotals>;
  nextPlanVersion(tenantId: string, containerId: string): Promise<number>;
  insertPlan(
    plan: Omit<PersistedInlandPlan, "id"> & { id?: string },
  ): Promise<PersistedInlandPlan>;
}
