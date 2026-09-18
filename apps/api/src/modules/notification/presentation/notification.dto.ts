import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() problemCode!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiPropertyOptional({ nullable: true }) containerId!: string | null;
  @ApiPropertyOptional({ nullable: true }) taskId!: string | null;
  @ApiPropertyOptional({ nullable: true }) workOrderId!: string | null;
  @ApiProperty() hasObjectTarget!: boolean;
  @ApiProperty({ type: [String] }) recipientRoleCodes!: string[];
  @ApiPropertyOptional({ nullable: true }) conversationHint!: string | null;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() createdAt!: string;
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationItemDto] })
  items!: NotificationItemDto[];
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional() limit?: number;
}
