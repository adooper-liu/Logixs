import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ObjectActivityQueryDto {
  @ApiPropertyOptional() pageSize?: string;
  @ApiPropertyOptional() cursor?: string;
}

export class ObjectActivityItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() activityCode!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() sourceId!: string;
  @ApiPropertyOptional({ nullable: true }) occurredAt!: string | null;
  @ApiProperty() recordedAt!: string;
  @ApiProperty() containerId!: string;
  @ApiPropertyOptional({ nullable: true }) taskId!: string | null;
  @ApiPropertyOptional({ nullable: true }) workOrderId!: string | null;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) nodeCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) title!: string | null;
  @ApiPropertyOptional({ nullable: true }) detail!: string | null;
  @ApiPropertyOptional({ nullable: true }) severity!: string | null;
  @ApiPropertyOptional({ nullable: true }) targetPath!: string | null;
}

export class ObjectNextActionDto {
  @ApiProperty() actionCode!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiProperty() taskDefinitionKey!: string;
  @ApiProperty() workOrderDefinitionKey!: string;
  @ApiProperty() assignmentState!: string;
  @ApiPropertyOptional({ nullable: true }) assigneeId!: string | null;
  @ApiPropertyOptional({ nullable: true }) dueAt!: string | null;
  @ApiProperty() targetPath!: string;
}

export class ObjectActivityPageInfoDto {
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class ObjectActivityPageDto {
  @ApiProperty({ type: [ObjectActivityItemDto] })
  items!: ObjectActivityItemDto[];
  @ApiProperty({ type: [ObjectNextActionDto] })
  nextActions!: ObjectNextActionDto[];
  @ApiProperty({ type: ObjectActivityPageInfoDto })
  pageInfo!: ObjectActivityPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class NotificationTargetDto {
  @ApiProperty() containerId!: string;
  @ApiPropertyOptional({ nullable: true }) taskId!: string | null;
  @ApiPropertyOptional({ nullable: true }) workOrderId!: string | null;
  @ApiProperty() targetPath!: string;
}
