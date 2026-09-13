import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { DrainDueOutboxService } from "../application/drain-due-outbox.service";
import { ListDeadLettersService } from "../application/list-dead-letters.service";
import { PublishOutboxBatchService } from "../application/publish-outbox-batch.service";
import { ReplayDeadLetterService } from "../application/replay-dead-letter.service";
import {
  DeadLetterPageDto,
  PublishDueOutboxRequestDto,
  PublishDueOutboxResponseDto,
  PublishOutboxBatchRequestDto,
  PublishOutboxBatchResponseDto,
  ReplayDeadLetterRequestDto,
  ReplayDeadLetterResponseDto,
} from "./outbox.dto";

@ApiTags("outbox")
@Controller("outbox")
export class OutboxController {
  constructor(
    private readonly publishOutboxBatch: PublishOutboxBatchService,
    private readonly replayDeadLetter: ReplayDeadLetterService,
    private readonly listDeadLetters: ListDeadLettersService,
    private readonly drainDueOutbox: DrainDueOutboxService,
  ) {}

  @Get("dead-letters")
  @ApiOkResponse({ type: DeadLetterPageDto })
  async listDeadLettersPage(
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<DeadLetterPageDto> {
    const page = await this.listDeadLetters.execute({
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map((item) => ({
        id: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        aggregateType: item.aggregateType,
        aggregateId: item.aggregateId,
        payloadRef: item.payloadRef,
        payloadHash: item.payloadHash,
        attemptCount: item.attemptCount,
        lastErrorCode: item.lastErrorCode,
        failureCategory: item.failureCategory,
        ownerQueue: item.ownerQueue,
        deadLetteredAt: item.deadLetteredAt.toISOString(),
        occurredAt: item.occurredAt.toISOString(),
        causationId: item.causationId,
        traceId: item.traceId,
      })),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Post("publish-batch")
  @ApiOkResponse({ type: PublishOutboxBatchResponseDto })
  async publishBatch(
    @Body() body: PublishOutboxBatchRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<PublishOutboxBatchResponseDto> {
    return this.publishOutboxBatch.execute({
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
      limit: body.limit,
    });
  }

  @Post("publish-due")
  @ApiOkResponse({ type: PublishDueOutboxResponseDto })
  async publishDue(
    @Body() body: PublishDueOutboxRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<PublishDueOutboxResponseDto> {
    return this.drainDueOutbox.execute({
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
      limit: body.limit,
      maxRounds: body.maxRounds,
    });
  }

  @Post("dead-letters/:deadLetterId/replay")
  @ApiOkResponse({ type: ReplayDeadLetterResponseDto })
  async replay(
    @Param("deadLetterId") deadLetterId: string,
    @Body() body: ReplayDeadLetterRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<ReplayDeadLetterResponseDto> {
    return this.replayDeadLetter.execute({
      deadLetterId,
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
      reasonCode: body.reasonCode,
      targetConsumerVersion: body.targetConsumerVersion,
      idempotencyKey: body.idempotencyKey,
      payloadRef: body.payloadRef,
      payloadHash: body.payloadHash,
    });
  }
}
