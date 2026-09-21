import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ReplaceWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";

export class ReplaceWarehouseDeliveryInstructionRequestDto implements ReplaceWarehouseDeliveryInstructionCommand {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() warehouseLocationId!: string;
  @ApiPropertyOptional({ nullable: true }) warehouseCode!: string | null;
  @ApiProperty() warehouseName!: string;
  @ApiPropertyOptional({ nullable: true }) unlocode!: string | null;
  @ApiProperty() timezone!: string;
  @ApiPropertyOptional({ nullable: true }) appointmentStartAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) appointmentEndAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) appointmentReference!: string | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class WarehouseDeliveryInstructionDto implements WarehouseDeliveryInstruction {
  @ApiProperty() instructionId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() warehouseLocationId!: string;
  @ApiPropertyOptional({ nullable: true }) warehouseCode!: string | null;
  @ApiProperty() warehouseName!: string;
  @ApiPropertyOptional({ nullable: true }) unlocode!: string | null;
  @ApiProperty() timezone!: string;
  @ApiPropertyOptional({ nullable: true }) appointmentStartAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) appointmentEndAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) appointmentReference!: string | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() duplicate!: boolean;
}
