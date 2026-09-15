import { ApiProperty } from "@nestjs/swagger";

export class OverdueChargeRateTierDto {
  @ApiProperty() fromDay!: number;
  @ApiProperty({ required: false, nullable: true }) toDay?: number | null;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
}

export class OverdueChargeStandardDto {
  @ApiProperty({ required: false }) id?: string;
  @ApiProperty() portId!: string;
  @ApiProperty() shippingCompanyId!: string;
  @ApiProperty() freightForwarderId!: string;
  @ApiProperty() chargeType!: string;
  @ApiProperty() freeDays!: number;
  @ApiProperty() freeDaysBasis!: string;
  @ApiProperty() calculationBasis!: string;
  @ApiProperty() includeStartDay!: boolean;
  @ApiProperty() effectiveFrom!: string;
  @ApiProperty({ required: false, nullable: true }) effectiveTo?: string | null;
  @ApiProperty({ required: false, nullable: true })
  transportMode?: string | null;
  @ApiProperty({ required: false, nullable: true }) terminalId?: string | null;
  @ApiProperty({ required: false, type: [OverdueChargeRateTierDto] })
  tiers?: OverdueChargeRateTierDto[];
}

export class ReplaceOverdueStandardsRequestDto {
  @ApiProperty({ type: [OverdueChargeStandardDto] })
  standards!: OverdueChargeStandardDto[];
}

export class ReplaceOverdueStandardsResponseDto {
  @ApiProperty() applied!: boolean;
  @ApiProperty() count!: number;
}

export class ComputeOverdueDeadlinesRequestDto {
  @ApiProperty() portId!: string;
  @ApiProperty() shippingCompanyId!: string;
  @ApiProperty() freightForwarderId!: string;
  @ApiProperty() referenceAt!: string;
  @ApiProperty({ required: false, nullable: true }) arrivalAt?: string | null;
  @ApiProperty({ required: false, nullable: true })
  dischargeAt?: string | null;
  @ApiProperty({ required: false, nullable: true }) pickupAt?: string | null;
  @ApiProperty({ required: false, nullable: true })
  transportMode?: string | null;
  @ApiProperty({ required: false, nullable: true }) terminalId?: string | null;
}

export class OverdueDeadlinesResponseDto {
  @ApiProperty({ nullable: true }) latestPickupAt!: string | null;
  @ApiProperty({ nullable: true }) latestReturnAt!: string | null;
  @ApiProperty({ type: [String] }) matchedStandardIds!: string[];
  @ApiProperty() returnClampedToPickup!: boolean;
}
