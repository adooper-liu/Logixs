import { ApiProperty } from "@nestjs/swagger";

export class PublishOutboxBatchRequestDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
}

export class PublishDueOutboxRequestDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200 })
  limit?: number;
  @ApiProperty({ required: false, minimum: 1, maximum: 20 })
  maxRounds?: number;
}

export class PublishDueOutboxResponseDto {
  @ApiProperty() rounds!: number;
  @ApiProperty() emptied!: boolean;
  @ApiProperty() claimed!: number;
  @ApiProperty() published!: number;
  @ApiProperty() retryWait!: number;
  @ApiProperty() deadLetter!: number;
  @ApiProperty() leftover!: number;
}

export class PublishOutboxBatchItemDto {
  @ApiProperty() eventId!: string;
  @ApiProperty() state!: string;
  @ApiProperty({ nullable: true }) brokerReference!: string | null;
  @ApiProperty({ nullable: true }) lastErrorCode!: string | null;
}

export class PublishOutboxBatchResponseDto {
  @ApiProperty() claimed!: number;
  @ApiProperty() published!: number;
  @ApiProperty() retryWait!: number;
  @ApiProperty() deadLetter!: number;
  @ApiProperty() leftover!: number;
  @ApiProperty({ type: [PublishOutboxBatchItemDto] })
  items!: PublishOutboxBatchItemDto[];
}

export class ReplayDeadLetterRequestDto {
  @ApiProperty() reasonCode!: string;
  @ApiProperty() targetConsumerVersion!: string;
  @ApiProperty() idempotencyKey!: string;
  @ApiProperty({ required: false }) payloadRef?: string;
  @ApiProperty({ required: false }) payloadHash?: string;
}

export class DeadLetterItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventId!: string;
  @ApiProperty() eventType!: string;
  @ApiProperty() aggregateType!: string;
  @ApiProperty() aggregateId!: string;
  @ApiProperty() payloadRef!: string;
  @ApiProperty() payloadHash!: string;
  @ApiProperty() attemptCount!: number;
  @ApiProperty({ nullable: true }) lastErrorCode!: string | null;
  @ApiProperty({ nullable: true }) failureCategory!: string | null;
  @ApiProperty({ nullable: true }) ownerQueue!: string | null;
  @ApiProperty() deadLetteredAt!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ nullable: true }) causationId!: string | null;
  @ApiProperty() traceId!: string;
}

export class DeadLetterPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class DeadLetterPageDto {
  @ApiProperty({ type: [DeadLetterItemDto] }) items!: DeadLetterItemDto[];
  @ApiProperty({ type: DeadLetterPageInfoDto })
  pageInfo!: DeadLetterPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ReplayDeadLetterResponseDto {
  @ApiProperty() deadLetterId!: string;
  @ApiProperty() replayedOutboxId!: string;
  @ApiProperty() replayedEventId!: string;
  @ApiProperty() applied!: boolean;
  @ApiProperty() corrected!: boolean;
  @ApiProperty() targetConsumerVersion!: string;
}
