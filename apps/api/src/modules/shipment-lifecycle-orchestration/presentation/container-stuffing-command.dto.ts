import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ContainerStuffingCommandVgmDto {
  @ApiProperty() weight!: string;
  @ApiProperty({ enum: ["method_1", "method_2"] })
  method!: "method_1" | "method_2";
  @ApiProperty({ description: "带时区的 ISO 8601 VGM 核验时间" })
  verifiedAt!: string;
}

export class ReplaceContainerStuffingSnapshotRequestDto {
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() allocationSetId!: string;
  @ApiProperty() allocationSetVersion!: number;
  @ApiProperty() containerNumber!: string;
  @ApiProperty() sealNumber!: string;
  @ApiProperty() packageCount!: number;
  @ApiProperty() grossWeight!: string;
  @ApiPropertyOptional({ nullable: true }) netWeight!: string | null;
  @ApiProperty() volume!: string;
  @ApiPropertyOptional({ type: ContainerStuffingCommandVgmDto, nullable: true })
  vgm!: ContainerStuffingCommandVgmDto | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
}

export class ContainerStuffingCommandVgmResponseDto extends ContainerStuffingCommandVgmDto {
  @ApiProperty({ enum: ["KGM"] }) weightUnit!: "KGM";
}

export class ContainerStuffingCommandResponseDto {
  @ApiProperty() snapshotId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() allocationSetId!: string;
  @ApiProperty() allocationSetVersion!: number;
  @ApiProperty() containerNumber!: string;
  @ApiProperty() sealNumber!: string;
  @ApiProperty() packageCount!: number;
  @ApiProperty() grossWeight!: string;
  @ApiProperty({ enum: ["KGM"] }) grossWeightUnit!: "KGM";
  @ApiPropertyOptional({ nullable: true }) netWeight!: string | null;
  @ApiProperty() volume!: string;
  @ApiProperty({ enum: ["MTQ"] }) volumeUnit!: "MTQ";
  @ApiPropertyOptional({
    type: ContainerStuffingCommandVgmResponseDto,
    nullable: true,
  })
  vgm!: ContainerStuffingCommandVgmResponseDto | null;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() actorId!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() duplicate!: boolean;
}
