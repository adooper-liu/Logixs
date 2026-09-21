import { ApiProperty } from "@nestjs/swagger";

export class ContainerCargoScopeItemDto {
  @ApiProperty() replenishmentOrderLineId!: string;
  @ApiProperty() productSkuId!: string;
  @ApiProperty() productNumber!: string;
  @ApiProperty({ description: "定点十进制数量字符串" })
  allocatedQuantity!: string;
  @ApiProperty() quantityUnit!: string;
}

export class ContainerCargoScopeDto {
  @ApiProperty() containerRecordId!: string;
  @ApiProperty({ nullable: true, type: String })
  allocationSetId!: string | null;
  @ApiProperty({ nullable: true, type: Number })
  allocationSetVersion!: number | null;
  @ApiProperty({ type: [ContainerCargoScopeItemDto] })
  items!: ContainerCargoScopeItemDto[];
}
