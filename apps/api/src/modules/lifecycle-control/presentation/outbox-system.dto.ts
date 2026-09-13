import { ApiProperty } from "@nestjs/swagger";

export class PublishDueSystemOutboxRequestDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 20 })
  maxRounds?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  maxTenants?: number;
}

export class PublishDueSystemTenantResultDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() rounds!: number;
  @ApiProperty() emptied!: boolean;
  @ApiProperty() claimed!: number;
  @ApiProperty() published!: number;
  @ApiProperty() retryWait!: number;
  @ApiProperty() deadLetter!: number;
  @ApiProperty() leftover!: number;
}

export class PublishDueSystemOutboxResponseDto {
  @ApiProperty() tenants!: number;
  @ApiProperty() emptiedTenants!: number;
  @ApiProperty() leftoverTenants!: boolean;
  @ApiProperty() claimed!: number;
  @ApiProperty() published!: number;
  @ApiProperty() retryWait!: number;
  @ApiProperty() deadLetter!: number;
  @ApiProperty() leftover!: number;
  @ApiProperty({ type: [PublishDueSystemTenantResultDto] })
  items!: PublishDueSystemTenantResultDto[];
}
