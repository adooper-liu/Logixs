import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListInboxDeadLettersService } from "../application/list-inbox-dead-letters.service";
import { ReplayInboxDeadLetterService } from "../application/replay-inbox-dead-letter.service";
import {
  InboxDeadLetterPageDto,
  ReplayInboxDeadLetterRequestDto,
  ReplayInboxDeadLetterResponseDto,
} from "./inbox.dto";

@ApiTags("inbox")
@Controller("inbox")
export class InboxDeadLetterController {
  constructor(
    private readonly listInboxDeadLetters: ListInboxDeadLettersService,
    private readonly replayInboxDeadLetter: ReplayInboxDeadLetterService,
  ) {}

  @Get("dead-letters")
  @ApiOkResponse({ type: InboxDeadLetterPageDto })
  async listDeadLettersPage(
    @Req() request: { identity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<InboxDeadLetterPageDto> {
    const page = await this.listInboxDeadLetters.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map((item) => ({
        id: item.id,
        messageId: item.messageId,
        consumerName: item.consumerName,
        payloadRef: item.payloadRef,
        payloadHash: item.payloadHash,
        attemptCount: item.attemptCount,
        lastErrorCode: item.lastErrorCode,
        failureCategory: item.failureCategory,
        ownerQueue: item.ownerQueue,
        deadLetteredAt: item.deadLetteredAt.toISOString(),
        receivedAt: item.receivedAt.toISOString(),
        causationId: item.causationId,
        traceId: item.traceId,
      })),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Post("dead-letters/:deadLetterId/replay")
  @ApiOkResponse({ type: ReplayInboxDeadLetterResponseDto })
  async replay(
    @Param("deadLetterId") deadLetterId: string,
    @Body() body: ReplayInboxDeadLetterRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ReplayInboxDeadLetterResponseDto> {
    return this.replayInboxDeadLetter.execute({
      deadLetterId,
      tenantId: request.identity.tenantId,
      operatorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      targetConsumerVersion: body.targetConsumerVersion,
      idempotencyKey: body.idempotencyKey,
      payloadRef: body.payloadRef,
      payloadHash: body.payloadHash,
    });
  }
}
