import { ApiProperty } from "@nestjs/swagger";

export class SubmitClientOperationRequestDto {
  @ApiProperty() actionCode!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() eventCode!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ type: [String] }) evidenceRefs!: string[];
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ required: false }) payloadHash?: string;
  @ApiProperty({ required: false }) traceId?: string;
}

export class ClientOperationResponseDto {
  @ApiProperty() clientOperationId!: string;
  @ApiProperty() actionCode!: string;
  @ApiProperty() receptionState!: string;
  @ApiProperty() businessDecisionState!: string;
  @ApiProperty() commitState!: string;
  @ApiProperty({ nullable: true, type: String })
  rejectionReasonCode!: string | null;
  @ApiProperty({ type: [Object] })
  resultRefs!: Array<{ entityType: string; entityId: string }>;
  @ApiProperty() requestHash!: string;
  @ApiProperty() traceId!: string;
}

export class ClientOperationListItemDto extends ClientOperationResponseDto {
  @ApiProperty() targetType!: string;
  @ApiProperty() targetId!: string;
  @ApiProperty() createdAt!: string;
}

export class ClientOperationPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class ClientOperationPageDto {
  @ApiProperty({ type: [ClientOperationListItemDto] })
  items!: ClientOperationListItemDto[];
  @ApiProperty({ type: ClientOperationPageInfoDto })
  pageInfo!: ClientOperationPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class RequestCompensationRequestDto {
  @ApiProperty() reasonCode!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ required: false }) traceId?: string;
}

export class RequestCompensationResponseDto {
  @ApiProperty() compensationId!: string;
  @ApiProperty() originalClientOperationId!: string;
  @ApiProperty() compensationActionCode!: string;
  @ApiProperty() state!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() reasonCode!: string;
}

export class ResolveCompensationRequestDto {
  @ApiProperty() state!: string;
  @ApiProperty({ required: false, type: [Object] })
  resultRefs?: Array<{ entityType: string; entityId: string }>;
}

export class ResolveCompensationResponseDto {
  @ApiProperty() compensationId!: string;
  @ApiProperty() originalClientOperationId!: string;
  @ApiProperty() compensationActionCode!: string;
  @ApiProperty() state!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() reasonCode!: string;
}

export class CompensationItemDto {
  @ApiProperty() compensationId!: string;
  @ApiProperty() originalClientOperationId!: string;
  @ApiProperty() compensationActionCode!: string;
  @ApiProperty() state!: string;
  @ApiProperty() reasonCode!: string;
  @ApiProperty() requestedBy!: string;
  @ApiProperty({ type: [Object] })
  resultRefs!: Array<{ entityType: string; entityId: string }>;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() traceId!: string;
}

export class CompensationPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class CompensationPageDto {
  @ApiProperty({ type: [CompensationItemDto] }) items!: CompensationItemDto[];
  @ApiProperty({ type: CompensationPageInfoDto })
  pageInfo!: CompensationPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}
