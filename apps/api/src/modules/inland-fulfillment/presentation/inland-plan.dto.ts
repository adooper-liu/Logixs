import { ApiProperty } from "@nestjs/swagger";

export class PlanningParameterDto {
  @ApiProperty() key!: string;
  @ApiProperty() valueText!: string;
  @ApiProperty() unit!: string;
}

export class PlanningStrategyDto {
  @ApiProperty() key!: string;
  @ApiProperty() code!: string;
}

export class WarehouseCapacityDto {
  @ApiProperty() warehouseId!: string;
  @ApiProperty() dailyLimit!: number;
}

export class FleetCapacityDto {
  @ApiProperty() fleetId!: string;
  @ApiProperty() dailyTrips!: number;
  @ApiProperty() bufferDeclared!: boolean;
}

export class AllocationDto {
  @ApiProperty() portId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() fleetId!: string;
  @ApiProperty() assignmentRole!: string;
}

export class ReplacePlanningSetupRequestDto {
  @ApiProperty({ type: [PlanningParameterDto] })
  parameters!: PlanningParameterDto[];
  @ApiProperty({ type: [PlanningStrategyDto] })
  strategies!: PlanningStrategyDto[];
  @ApiProperty({ type: WarehouseCapacityDto })
  warehouse!: WarehouseCapacityDto;
  @ApiProperty({ type: [FleetCapacityDto] })
  fleets!: FleetCapacityDto[];
  @ApiProperty({ type: [AllocationDto] })
  allocations!: AllocationDto[];
}

export class ReplacePlanningSetupResponseDto {
  @ApiProperty() applied!: boolean;
}

export class DraftInlandPlanRequestDto {
  @ApiProperty() containerId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() portId!: string;
  @ApiProperty({ nullable: true, required: false })
  estimatedArrival?: string | null;
  @ApiProperty({ nullable: true, required: false })
  actualArrival?: string | null;
  @ApiProperty({ nullable: true, required: false })
  dischargeEstimated?: string | null;
  @ApiProperty({ nullable: true, required: false })
  dischargeActual?: string | null;
  @ApiProperty({ nullable: true, required: false })
  pickupEstimated?: string | null;
  @ApiProperty({ nullable: true, required: false })
  pickupActual?: string | null;
  @ApiProperty({ nullable: true, required: false })
  shippingCompanyId?: string | null;
  @ApiProperty({ nullable: true, required: false })
  freightForwarderId?: string | null;
  @ApiProperty() customsCompleted!: boolean;
  @ApiProperty() cargoAttributesKnown!: boolean;
}

export class FeeEstimateDto {
  @ApiProperty() feeType!: string;
  @ApiProperty() state!: string;
}

export class InlandPlanDraftResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() status!: string;
  @ApiProperty() schemeCode!: string;
  @ApiProperty({ nullable: true }) fleetId!: string | null;
  @ApiProperty() needsHumanDecision!: boolean;
  @ApiProperty() occupied!: boolean;
  @ApiProperty({ nullable: true }) pickupAt!: string | null;
  @ApiProperty({ nullable: true }) deliveryAt!: string | null;
  @ApiProperty({ nullable: true }) unloadAt!: string | null;
  @ApiProperty({ nullable: true }) returnAt!: string | null;
  @ApiProperty({ nullable: true }) customsMustCompleteBy!: string | null;
  @ApiProperty({ nullable: true }) latestPickupAt!: string | null;
  @ApiProperty({ nullable: true }) latestReturnAt!: string | null;
  @ApiProperty({ nullable: true }) overdueDeadlinesCode!: string | null;
  @ApiProperty({ type: [FeeEstimateDto] }) feeEstimates!: FeeEstimateDto[];
}
