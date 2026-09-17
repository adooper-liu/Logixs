import { Body, Controller, Post, Put, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { DraftInlandPlanService } from "../application/draft-inland-plan.service";
import { ReplacePlanningSetupService } from "../application/replace-planning-setup.service";
import {
  DraftInlandPlanRequestDto,
  InlandPlanDraftResponseDto,
  ReplacePlanningSetupRequestDto,
  ReplacePlanningSetupResponseDto,
} from "./inland-plan.dto";

@ApiTags("inland-fulfillment")
@Controller()
export class InlandPlanController {
  constructor(
    private readonly replaceSetup: ReplacePlanningSetupService,
    private readonly draftPlan: DraftInlandPlanService,
  ) {}

  @Put("inland-planning/setup")
  @ApiOkResponse({ type: ReplacePlanningSetupResponseDto })
  async setup(
    @Body() body: ReplacePlanningSetupRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ReplacePlanningSetupResponseDto> {
    return this.replaceSetup.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      setup: {
        parameters: body.parameters,
        strategies: body.strategies,
        warehouse: body.warehouse,
        fleets: body.fleets,
        allocations: body.allocations,
      },
    });
  }

  @Post("inland-plans/draft")
  @ApiOkResponse({ type: InlandPlanDraftResponseDto })
  async draft(
    @Body() body: DraftInlandPlanRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<InlandPlanDraftResponseDto> {
    const plan = await this.draftPlan.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      containerId: body.containerId,
      warehouseId: body.warehouseId,
      portId: body.portId,
      estimatedArrival: body.estimatedArrival ?? null,
      actualArrival: body.actualArrival ?? null,
      dischargeEstimated: body.dischargeEstimated ?? null,
      dischargeActual: body.dischargeActual ?? null,
      pickupEstimated: body.pickupEstimated ?? null,
      pickupActual: body.pickupActual ?? null,
      shippingCompanyId: body.shippingCompanyId ?? null,
      freightForwarderId: body.freightForwarderId ?? null,
      customsCompleted: body.customsCompleted,
      cargoAttributesKnown: body.cargoAttributesKnown,
    });
    return {
      id: plan.id,
      containerId: plan.containerId,
      version: plan.version,
      status: plan.status,
      schemeCode: plan.schemeCode,
      fleetId: plan.fleetId,
      needsHumanDecision: plan.needsHumanDecision,
      occupied: plan.occupied,
      pickupAt: plan.pickupAt ? plan.pickupAt.toISOString() : null,
      deliveryAt: plan.deliveryAt ? plan.deliveryAt.toISOString() : null,
      unloadAt: plan.unloadAt ? plan.unloadAt.toISOString() : null,
      returnAt: plan.returnAt ? plan.returnAt.toISOString() : null,
      customsMustCompleteBy: plan.customsMustCompleteBy
        ? plan.customsMustCompleteBy.toISOString()
        : null,
      latestPickupAt: plan.latestPickupAt
        ? plan.latestPickupAt.toISOString()
        : null,
      latestReturnAt: plan.latestReturnAt
        ? plan.latestReturnAt.toISOString()
        : null,
      overdueDeadlinesCode: plan.overdueDeadlinesCode,
      feeEstimates: plan.feeEstimates,
    };
  }
}
