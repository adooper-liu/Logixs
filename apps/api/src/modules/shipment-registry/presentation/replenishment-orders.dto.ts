import { ApiProperty } from "@nestjs/swagger";

export class ReplenishmentOrderAllocationDto {
  @ApiProperty() containerId!: string;
  @ApiProperty({ nullable: true, type: String }) containerNumber!:
    string | null;
  @ApiProperty() allocatedQuantity!: string;
  @ApiProperty() quantityUnit!: string;
}

export class ReplenishmentLineGapDto {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class ReplenishmentProductProfileDto {
  @ApiProperty() profileId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() verificationState!: string;
  @ApiProperty() sourceSystem!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: Object }) battery!: {
    presenceState: string;
    packingMode: string | null;
  };
  @ApiProperty({ type: Object }) refrigerant!: { presenceState: string };
  @ApiProperty({ type: Object }) dangerousGoods!: {
    classificationState: string;
  };
  @ApiProperty({ type: [Object] }) inspectionRequirements!: Array<{
    requirementType: string;
    requirementState: string;
    jurisdictionCountryCode: string | null;
  }>;
}

export class ReplenishmentOrderLineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) productSkuId!: string | null;
  @ApiProperty() productNumber!: string;
  @ApiProperty() shippedQuantity!: string;
  @ApiProperty() quantityUnit!: string;
  @ApiProperty() allocatedQuantity!: string;
  @ApiProperty() unallocatedQuantity!: string;
  @ApiProperty({ type: [ReplenishmentOrderAllocationDto] })
  allocations!: ReplenishmentOrderAllocationDto[];
  @ApiProperty({ nullable: true, type: ReplenishmentProductProfileDto })
  profile!: ReplenishmentProductProfileDto | null;
  @ApiProperty({ type: [ReplenishmentLineGapDto] })
  gaps!: ReplenishmentLineGapDto[];
}

export class ReplenishmentOrderWorkReasonDto {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty() detail!: string;
  @ApiProperty({ enum: ["mine", "waiting_other"] })
  responsibility!: "mine" | "waiting_other";
}

export class ReplenishmentOrderNextActionDto {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class ReplenishmentOrderContainerDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) containerNumber!:
    string | null;
}

export class ReplenishmentOrderWorkbenchItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: ReplenishmentOrderWorkReasonDto })
  workReason!: ReplenishmentOrderWorkReasonDto;
  @ApiProperty({ nullable: true, type: ReplenishmentOrderNextActionDto })
  nextAction!: ReplenishmentOrderNextActionDto | null;
  @ApiProperty({ type: [ReplenishmentOrderContainerDto] })
  relatedContainers!: ReplenishmentOrderContainerDto[];
  @ApiProperty({ type: [ReplenishmentOrderLineDto] })
  lines!: ReplenishmentOrderLineDto[];
}

export class ReplenishmentOrderPageInfoDto {
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class ReplenishmentOrderPageDto {
  @ApiProperty({ type: [ReplenishmentOrderWorkbenchItemDto] })
  items!: ReplenishmentOrderWorkbenchItemDto[];
  @ApiProperty({ type: ReplenishmentOrderPageInfoDto })
  pageInfo!: ReplenishmentOrderPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}
