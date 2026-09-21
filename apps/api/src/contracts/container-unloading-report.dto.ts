import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AppendContainerUnloadingReportCommand,
  ContainerUnloadingReport,
  ContainerUnloadingOperationState,
  ContainerUnloadingSealCheck,
} from "@logix/contracts";

export class AppendContainerUnloadingReportRequestDto implements AppendContainerUnloadingReportCommand {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() warehouseLocationId!: string;
  @ApiProperty({ enum: ["started", "partial", "completed"] })
  operationState!: ContainerUnloadingOperationState;
  @ApiProperty() startedAt!: string;
  @ApiPropertyOptional({ nullable: true }) completedAt!: string | null;
  @ApiProperty() expectedQuantity!: string;
  @ApiProperty() unloadedQuantity!: string;
  @ApiProperty() remainingQuantity!: string;
  @ApiProperty() damagedQuantity!: string;
  @ApiProperty() shortageQuantity!: string;
  @ApiProperty({ enum: ["piece", "carton", "set", "pallet"] })
  quantityUnit!: "piece" | "carton" | "set" | "pallet";
  @ApiProperty({ enum: ["matched", "mismatch"] })
  sealCheck!: ContainerUnloadingSealCheck;
  @ApiProperty() exceptionResolved!: boolean;
  @ApiPropertyOptional({ nullable: true }) exceptionNotes!: string | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: [string, ...string[]];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ContainerUnloadingReportDto implements ContainerUnloadingReport {
  @ApiProperty() reportId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() warehouseLocationId!: string;
  @ApiProperty({ enum: ["started", "partial", "completed"] })
  operationState!: ContainerUnloadingOperationState;
  @ApiProperty() startedAt!: string;
  @ApiPropertyOptional({ nullable: true }) completedAt!: string | null;
  @ApiProperty() expectedQuantity!: string;
  @ApiProperty() unloadedQuantity!: string;
  @ApiProperty() remainingQuantity!: string;
  @ApiProperty() damagedQuantity!: string;
  @ApiProperty() shortageQuantity!: string;
  @ApiProperty({ enum: ["piece", "carton", "set", "pallet"] })
  quantityUnit!: "piece" | "carton" | "set" | "pallet";
  @ApiProperty({ enum: ["matched", "mismatch"] })
  sealCheck!: ContainerUnloadingSealCheck;
  @ApiProperty() exceptionResolved!: boolean;
  @ApiPropertyOptional({ nullable: true }) exceptionNotes!: string | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: [string, ...string[]];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() duplicate!: boolean;
}
