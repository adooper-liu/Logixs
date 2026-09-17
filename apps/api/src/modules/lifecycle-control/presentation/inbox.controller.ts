import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ServiceEndpoint } from "../../../security/route-access.decorator";
import { ClaimInboxBatchService } from "../application/claim-inbox-batch.service";
import { ProcessInboxBatchService } from "../application/process-inbox-batch.service";
import { ReceiveInboxMessageService } from "../application/receive-inbox-message.service";
import {
  ClaimInboxBatchRequestDto,
  ClaimInboxBatchResponseDto,
  ProcessInboxBatchRequestDto,
  ProcessInboxBatchResponseDto,
  ReceiveInboxMessageRequestDto,
  ReceiveInboxMessageResponseDto,
} from "./inbox.dto";

@ApiTags("inbox")
@ServiceEndpoint()
@Controller("inbox")
export class InboxController {
  constructor(
    private readonly receiveInboxMessage: ReceiveInboxMessageService,
    private readonly claimInboxBatch: ClaimInboxBatchService,
    private readonly processInboxBatch: ProcessInboxBatchService,
  ) {}

  @Post("messages")
  @ApiOkResponse({ type: ReceiveInboxMessageResponseDto })
  async receive(
    @Body() body: ReceiveInboxMessageRequestDto,
    @Req()
    request: { serviceIdentity: { actorType: string; actorId: string } },
  ): Promise<ReceiveInboxMessageResponseDto> {
    return this.receiveInboxMessage.execute({
      actorType: request.serviceIdentity.actorType,
      actorId: request.serviceIdentity.actorId,
      tenantId: body.tenantId,
      consumerName: body.consumerName,
      messageId: body.messageId,
      payloadHash: body.payloadHash,
      payload: body.payload,
      traceId: body.traceId,
    });
  }

  @Post("claim-batch")
  @ApiOkResponse({ type: ClaimInboxBatchResponseDto })
  async claimBatch(
    @Body() body: ClaimInboxBatchRequestDto,
    @Req()
    request: { serviceIdentity: { actorType: string; actorId: string } },
  ): Promise<ClaimInboxBatchResponseDto> {
    return this.claimInboxBatch.execute({
      actorType: request.serviceIdentity.actorType,
      actorId: request.serviceIdentity.actorId,
      tenantId: body.tenantId,
      consumerName: body.consumerName,
      limit: body.limit,
    });
  }

  @Post("process-batch")
  @ApiOkResponse({ type: ProcessInboxBatchResponseDto })
  async processBatch(
    @Body() body: ProcessInboxBatchRequestDto,
    @Req()
    request: { serviceIdentity: { actorType: string; actorId: string } },
  ): Promise<ProcessInboxBatchResponseDto> {
    return this.processInboxBatch.execute({
      actorType: request.serviceIdentity.actorType,
      actorId: request.serviceIdentity.actorId,
      tenantId: body.tenantId,
      consumerName: body.consumerName,
      limit: body.limit,
    });
  }
}
