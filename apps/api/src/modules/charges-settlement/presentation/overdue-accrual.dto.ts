import { ApiProperty } from "@nestjs/swagger";

export class ComputeOverdueAccrualRequestDto {
  @ApiProperty() purpose!: string;
  @ApiProperty() portId!: string;
  @ApiProperty() shippingCompanyId!: string;
  @ApiProperty() freightForwarderId!: string;
  @ApiProperty() referenceAt!: string;
  @ApiProperty() asOf!: string;
  @ApiProperty({ required: false, nullable: true }) arrivalAt?: string | null;
  @ApiProperty({ required: false, nullable: true })
  dischargeAt?: string | null;
  @ApiProperty({ required: false, nullable: true }) pickupAt?: string | null;
  @ApiProperty({ required: false, nullable: true })
  transportMode?: string | null;
  @ApiProperty({ required: false, nullable: true }) terminalId?: string | null;
}

export class OverdueAccrualDayDto {
  @ApiProperty() date!: string;
  @ApiProperty() dayNumber!: number;
  @ApiProperty() rate!: string;
  @ApiProperty() amount!: string;
}

export class OverdueAccrualLineDto {
  @ApiProperty() standardId!: string;
  @ApiProperty() chargeType!: string;
  @ApiProperty() lastFreeDay!: string;
  @ApiProperty({ nullable: true }) firstChargeDay!: string | null;
  @ApiProperty({ nullable: true }) lastChargeDay!: string | null;
  @ApiProperty() chargeDays!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() amount!: string;
  @ApiProperty({ type: [OverdueAccrualDayDto] }) daily!: OverdueAccrualDayDto[];
}

export class OverdueAccrualTotalDto {
  @ApiProperty() currency!: string;
  @ApiProperty() amount!: string;
}

export class OverdueAccrualResponseDto {
  @ApiProperty() purpose!: string;
  @ApiProperty({ type: [OverdueAccrualLineDto] })
  lines!: OverdueAccrualLineDto[];
  @ApiProperty({ type: [OverdueAccrualTotalDto] })
  totals!: OverdueAccrualTotalDto[];
}
