import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OpenAssistantSessionRequestDto {
  @ApiPropertyOptional() notificationId?: string;
  @ApiPropertyOptional() containerId?: string;
}

export class PostAssistantMessageRequestDto {
  @ApiProperty() body!: string;
}

export class AssistantMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["system", "user", "assistant"] }) role!:
    "system" | "user" | "assistant";
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;
}

export class AssistantObjectSummaryDto {
  @ApiProperty() containerId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiPropertyOptional({ nullable: true }) containerNumber!: string | null;
  @ApiProperty() currentStatus!: string;
  @ApiPropertyOptional({ nullable: true }) currentNodeCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) flowState!: string | null;
  @ApiProperty() updatedAt!: string;
}

export class AssistantAllowedActionDto {
  @ApiProperty() actionCode!: string;
  @ApiProperty() explanation!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() nodeCode!: string;
  @ApiPropertyOptional({ nullable: true }) assigneeId!: string | null;
  @ApiPropertyOptional({ nullable: true }) dueAt!: string | null;
  @ApiProperty() actorCanExecute!: boolean;
  @ApiProperty() targetPath!: string;
}

export class AssistantReadOnlyPolicyDto {
  @ApiProperty({ enum: [false] }) assistantCanExecute!: false;
  @ApiProperty() actorCanExecuteActions!: boolean;
  @ApiProperty() explanation!: string;
}

export class AssistantObjectContextDto {
  @ApiProperty({ type: AssistantObjectSummaryDto })
  summary!: AssistantObjectSummaryDto;
  @ApiProperty({ type: [AssistantAllowedActionDto] })
  allowedActions!: AssistantAllowedActionDto[];
  @ApiProperty() actionSummary!: string;
  @ApiProperty({ type: AssistantReadOnlyPolicyDto })
  readOnlyPolicy!: AssistantReadOnlyPolicyDto;
}

export class AssistantSessionResponseDto {
  @ApiProperty() sessionId!: string;
  @ApiPropertyOptional({ nullable: true }) notificationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) containerId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: AssistantObjectContextDto,
  })
  objectContext!: AssistantObjectContextDto | null;
  @ApiProperty({ type: [AssistantMessageDto] })
  messages!: AssistantMessageDto[];
}
