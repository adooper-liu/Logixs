import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  COMPUTE_OVERDUE_DEADLINES,
  type ComputeOverdueDeadlinesPort,
} from "../../charges-settlement";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import {
  draftInlandPlan,
  enumerateSearchDays,
  resolvePlanningConfig,
  utcDay,
} from "../engines/inland-plan";
import {
  evaluateDailySlots,
  WAREHOUSE_RESOURCE_ID,
} from "../engines/occupancy-slot";
import {
  INLAND_PLAN_REPOSITORY,
  type InlandPlanRepository,
  type PersistedInlandPlan,
} from "../domain/inland-plan.repository";

export type DraftInlandPlanCommand = {
  tenantId: string;
  actorId: string;
  containerId: string;
  warehouseId: string;
  portId: string;
  estimatedArrival: string | null;
  actualArrival: string | null;
  dischargeEstimated: string | null;
  dischargeActual: string | null;
  pickupEstimated: string | null;
  pickupActual: string | null;
  shippingCompanyId: string | null;
  freightForwarderId: string | null;
  customsCompleted: boolean;
  cargoAttributesKnown: boolean;
};

const HTTP_BY_CODE: Record<string, HttpStatus> = {
  VALIDATION_REQUIRED: HttpStatus.BAD_REQUEST,
  VALIDATION_FORMAT: HttpStatus.BAD_REQUEST,
  REVIEW_REQUIRED: HttpStatus.CONFLICT,
  ACTION_CONFIRMATION_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  BUSINESS_PRECONDITION_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
  AUTHORIZATION_SCOPE_DENIED: HttpStatus.FORBIDDEN,
};

@Injectable()
export class DraftInlandPlanService {
  constructor(
    @Inject(INLAND_PLAN_REPOSITORY)
    private readonly repository: InlandPlanRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(COMPUTE_OVERDUE_DEADLINES)
    private readonly overdueDeadlines: ComputeOverdueDeadlinesPort,
  ) {}

  async execute(command: DraftInlandPlanCommand): Promise<PersistedInlandPlan> {
    const tenantId = command.tenantId.trim();
    const actorId = command.actorId.trim();
    if (!tenantId || !actorId) {
      throw fail("AUTHORIZATION_SCOPE_DENIED", "缺少租户或操作者");
    }

    await this.assertContainerTenant.execute({
      containerId: command.containerId,
      tenantId,
    });

    const resolved = resolvePlanningConfig({
      parameters: await this.repository.loadParameters(tenantId),
      strategies: await this.repository.loadStrategies(tenantId),
    });
    if (resolved.kind === "reject") {
      throw fail(resolved.code, resolved.message);
    }

    const warehouseDailyLimit = await this.repository.findWarehouseCapacity(
      tenantId,
      command.warehouseId,
    );
    if (warehouseDailyLimit === null) {
      throw fail("BUSINESS_PRECONDITION_FAILED", "缺少仓库卸柜能力");
    }

    const fleets = await this.repository.findAllocatedFleets({
      tenantId,
      portId: command.portId,
      warehouseId: command.warehouseId,
    });

    const estimatedArrival = parseTime(command.estimatedArrival);
    const actualArrival = parseTime(command.actualArrival);
    const referenceAt = actualArrival ?? estimatedArrival;
    const occupancyFrom = referenceAt ? utcDay(referenceAt) : new Date(0);
    const searchDays = referenceAt
      ? enumerateSearchDays(referenceAt, resolved.config.nextSlotSearch)
      : [];
    const occupancyTo = searchDays.at(-1) ?? occupancyFrom;

    const warehouseOccupiedByDay = await this.repository.sumOccupancy({
      tenantId,
      resourceType: "warehouse_unload",
      resourceId: command.warehouseId,
      fromDay: occupancyFrom,
      toDay: occupancyTo,
    });
    const fleetOccupiedTripsByFleetDay: Record<
      string,
      Record<string, number>
    > = {};
    for (const fleet of fleets) {
      fleetOccupiedTripsByFleetDay[fleet.fleetId] =
        await this.repository.sumOccupancy({
          tenantId,
          resourceType: "fleet_trip",
          resourceId: fleet.fleetId,
          fromDay: occupancyFrom,
          toDay: occupancyTo,
        });
    }

    const occupancy = evaluateDailySlots({
      days: searchDays,
      resources: [
        {
          resourceId: WAREHOUSE_RESOURCE_ID,
          dailyLimit: warehouseDailyLimit,
          occupiedByDay: warehouseOccupiedByDay,
        },
        ...fleets.map((fleet) => ({
          resourceId: fleet.fleetId,
          dailyLimit: fleet.dailyTrips,
          occupiedByDay: fleetOccupiedTripsByFleetDay[fleet.fleetId] ?? {},
        })),
      ],
    });
    if (occupancy.kind === "reject") {
      throw fail(occupancy.code, occupancy.message);
    }

    const decision = draftInlandPlan(
      {
        warehouseId: command.warehouseId,
        portId: command.portId,
        estimatedArrival,
        actualArrival,
        customsCompleted: command.customsCompleted,
        cargoAttributesKnown: command.cargoAttributesKnown,
        warehouseResourceId: WAREHOUSE_RESOURCE_ID,
        slots: occupancy.slots,
        fleets,
      },
      resolved.config,
    );
    if (decision.kind === "reject") {
      throw fail(decision.code, decision.message);
    }

    const version = await this.repository.nextPlanVersion(
      tenantId,
      command.containerId,
    );
    const overdue = await this.readOverdueDeadlines(command, {
      arrivalAt: actualArrival ?? estimatedArrival,
      pickupAt:
        parseTime(command.pickupActual) ??
        parseTime(command.pickupEstimated) ??
        decision.plan.pickupAt,
    });
    return this.repository.insertPlan({
      ...decision.plan,
      tenantId,
      containerId: command.containerId,
      warehouseId: command.warehouseId,
      portId: command.portId,
      version,
      status: "draft",
      latestPickupAt: overdue.latestPickupAt,
      latestReturnAt: overdue.latestReturnAt,
      overdueDeadlinesCode: overdue.code,
    });
  }

  private async readOverdueDeadlines(
    command: DraftInlandPlanCommand,
    clocks: { arrivalAt: Date | null; pickupAt: Date | null },
  ): Promise<{
    latestPickupAt: Date | null;
    latestReturnAt: Date | null;
    code: string | null;
  }> {
    const shippingCompanyId = command.shippingCompanyId?.trim() ?? "";
    const freightForwarderId = command.freightForwarderId?.trim() ?? "";
    if (!shippingCompanyId || !freightForwarderId || !clocks.arrivalAt) {
      return { latestPickupAt: null, latestReturnAt: null, code: null };
    }
    const decision = await this.overdueDeadlines.execute({
      tenantId: command.tenantId.trim(),
      query: {
        portId: command.portId,
        shippingCompanyId,
        freightForwarderId,
        referenceAt: clocks.arrivalAt,
      },
      clocks: {
        arrivalAt: clocks.arrivalAt,
        dischargeAt:
          parseTime(command.dischargeActual) ??
          parseTime(command.dischargeEstimated),
        pickupAt: clocks.pickupAt,
      },
    });
    if (decision.kind === "reject") {
      return {
        latestPickupAt: null,
        latestReturnAt: null,
        code: decision.code,
      };
    }
    return {
      latestPickupAt: decision.deadlines.latestPickupAt,
      latestReturnAt: decision.deadlines.latestReturnAt,
      code: null,
    };
  }
}

function parseTime(value: string | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw fail("VALIDATION_FORMAT", "时刻不是合法 ISO 8601");
  }
  return parsed;
}

function fail(code: string, message: string): HttpException {
  return new HttpException(
    `${code}: ${message}`,
    HTTP_BY_CODE[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
}
