import { ApiProperty } from "@nestjs/swagger";

export class ReceiveInboxMessageRequestDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() consumerName!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() payloadHash!: string;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiProperty() traceId!: string;
}

export class ReceiveInboxMessageResponseDto {
  @ApiProperty() inboxRecordId!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() state!: string;
  @ApiProperty() applied!: boolean;
}

export class ClaimInboxBatchRequestDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() consumerName!: string;
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
}

export class ClaimInboxBatchItemDto {
  @ApiProperty() inboxRecordId!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() state!: string;
  @ApiProperty() attemptCount!: number;
  @ApiProperty() leaseOwner!: string;
  @ApiProperty() leaseLockedAt!: string;
  @ApiProperty() leaseExpiresAt!: string;
}

export class ClaimInboxBatchResponseDto {
  @ApiProperty() claimed!: number;
  @ApiProperty() leftover!: boolean;
  @ApiProperty({ type: [ClaimInboxBatchItemDto] })
  items!: ClaimInboxBatchItemDto[];
}

export class ProcessInboxBatchRequestDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() consumerName!: string;
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
}

export class ProcessInboxBatchItemDto {
  @ApiProperty() inboxRecordId!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ nullable: true, type: String })
  processedAt!: string | null;
  @ApiProperty({ nullable: true, type: String })
  lastErrorCode!: string | null;
}

export class ProcessInboxBatchResponseDto {
  @ApiProperty() claimed!: number;
  @ApiProperty() processed!: number;
  @ApiProperty() leftover!: number;
  @ApiProperty() retryWait!: number;
  @ApiProperty() deadLetter!: number;
  @ApiProperty({ type: [ProcessInboxBatchItemDto] })
  items!: ProcessInboxBatchItemDto[];
}
