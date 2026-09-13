import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { GetClientOperationService } from "../application/get-client-operation.service";
import { SubmitClientOperationService } from "../application/submit-client-operation.service";
import type { ClientOperationRecord } from "../domain/client-operation";
import {
  ClientOperationResponseDto,
  SubmitClientOperationRequestDto,
} from "./client-operation.dto";

@ApiTags("client-operations")
@Controller("client-operations")
export class ClientOperationController {
  constructor(
    private readonly submitClientOperation: SubmitClientOperationService,
    private readonly getClientOperation: GetClientOperationService,
  ) {}

  @Post()
  @ApiOkResponse({ type: ClientOperationResponseDto })
  async submit(
    @Body() body: SubmitClientOperationRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<ClientOperationResponseDto> {
    const record = await this.submitClientOperation.execute({
      tenantId: request.devIdentity.tenantId,
      actorId: request.devIdentity.operatorId,
      actionCode: body.actionCode,
      containerId: body.containerId,
      eventCode: body.eventCode,
      occurredAt: body.occurredAt,
      evidenceRefs: body.evidenceRefs,
      idempotencyKey: body.idempotencyKey,
      payloadHash: body.payloadHash,
      traceId: body.traceId,
    });
    return toDto(record);
  }

  @Get(":id")
  @ApiOkResponse({ type: ClientOperationResponseDto })
  async getById(
    @Param("id") id: string,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<ClientOperationResponseDto> {
    return toDto(
      await this.getClientOperation.execute({
        tenantId: request.devIdentity.tenantId,
        id,
      }),
    );
  }
}

function toDto(record: ClientOperationRecord): ClientOperationResponseDto {
  return {
    clientOperationId: record.id,
    actionCode: record.actionCode,
    receptionState: record.receptionState,
    businessDecisionState: record.businessDecisionState,
    commitState: record.commitState,
    rejectionReasonCode: record.rejectionReasonCode,
    resultRefs: record.resultRefs,
    requestHash: record.requestHash,
    traceId: record.traceId,
  };
}
