import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReplaceContainerDispatchSnapshotRequestDto {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() stuffingSnapshotId!: string;
  @ApiProperty() stuffingSnapshotVersion!: number;
  @ApiProperty() bookingNumber!: string;
  @ApiProperty() carrierCode!: string;
  @ApiProperty() vesselName!: string;
  @ApiProperty() voyageNumber!: string;
  @ApiPropertyOptional({ nullable: true }) masterBillNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) houseBillNumber!: string | null;
  @ApiProperty({ enum: ["accepted"] }) vgmHandoffState!: "accepted";
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ContainerDispatchCommandResponseDto {
  @ApiProperty() snapshotId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() stuffingSnapshotId!: string;
  @ApiProperty() stuffingSnapshotVersion!: number;
  @ApiProperty() bookingNumber!: string;
  @ApiProperty() carrierCode!: string;
  @ApiProperty() vesselName!: string;
  @ApiProperty() voyageNumber!: string;
  @ApiPropertyOptional({ nullable: true }) masterBillNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) houseBillNumber!: string | null;
  @ApiProperty({ enum: ["accepted"] }) vgmHandoffState!: "accepted";
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() duplicate!: boolean;
}
