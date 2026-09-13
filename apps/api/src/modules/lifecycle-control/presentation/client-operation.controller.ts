import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { GetClientOperationService } from "../application/get-client-operation.service";
import { GetCompensationService } from "../application/get-compensation.service";
import { ListClientOperationsService } from "../application/list-client-operations.service";
import { ListCompensationsService } from "../application/list-compensations.service";
import { RequestCompensationService } from "../application/request-compensation.service";
import { ResolveCompensationService } from "../application/resolve-compensation.service";
import { SubmitClientOperationService } from "../application/submit-client-operation.service";
import type { ClientOperationRecord } from "../domain/client-operation";
import type { ClientOperationListItem } from "../domain/client-operation.repository";
import type { CompensationRecord } from "../domain/compensation";
import {
  ClientOperationListItemDto,
  ClientOperationPageDto,
  ClientOperationResponseDto,
  CompensationItemDto,
  CompensationPageDto,
  RequestCompensationRequestDto,
  RequestCompensationResponseDto,
  ResolveCompensationRequestDto,
  ResolveCompensationResponseDto,
  SubmitClientOperationRequestDto,
} from "./client-operation.dto";

@ApiTags("client-operations")
@Controller("client-operations")
export class ClientOperationController {
  constructor(
    private readonly submitClientOperation: SubmitClientOperationService,
    private readonly getClientOperation: GetClientOperationService,
    private readonly requestCompensation: RequestCompensationService,
    private readonly resolveCompensation: ResolveCompensationService,
    private readonly listCompensations: ListCompensationsService,
    private readonly listClientOperations: ListClientOperationsService,
    private readonly getCompensation: GetCompensationService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ClientOperationPageDto })
  async list(
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ClientOperationPageDto> {
    const page = await this.listClientOperations.execute({
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map(toListDto),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

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

  @Post(":id/compensations")
  @ApiOkResponse({ type: RequestCompensationResponseDto })
  async compensate(
    @Param("id") id: string,
    @Body() body: RequestCompensationRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<RequestCompensationResponseDto> {
    return this.requestCompensation.execute({
      originalClientOperationId: id,
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
      traceId: body.traceId,
    });
  }

  @Post(":id/compensations/:compensationId/resolve")
  @ApiOkResponse({ type: ResolveCompensationResponseDto })
  async resolve(
    @Param("id") id: string,
    @Param("compensationId") compensationId: string,
    @Body() body: ResolveCompensationRequestDto,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<ResolveCompensationResponseDto> {
    return this.resolveCompensation.execute({
      originalClientOperationId: id,
      compensationId,
      tenantId: request.devIdentity.tenantId,
      state: body.state,
      resultRefs: body.resultRefs,
    });
  }

  @Get(":id/compensations")
  @ApiOkResponse({ type: CompensationPageDto })
  async listCompensationsPage(
    @Param("id") id: string,
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<CompensationPageDto> {
    const page = await this.listCompensations.execute({
      originalClientOperationId: id,
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map(toCompensationDto),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Get(":id/compensations/:compensationId")
  @ApiOkResponse({ type: CompensationItemDto })
  async getCompensationById(
    @Param("id") id: string,
    @Param("compensationId") compensationId: string,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<CompensationItemDto> {
    return toCompensationDto(
      await this.getCompensation.execute({
        tenantId: request.devIdentity.tenantId,
        originalClientOperationId: id,
        compensationId,
      }),
    );
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

function toListDto(
  record: ClientOperationListItem,
): ClientOperationListItemDto {
  return {
    ...toDto(record),
    targetType: record.targetType,
    targetId: record.targetId,
    createdAt: record.createdAt.toISOString(),
  };
}

function toCompensationDto(record: CompensationRecord): CompensationItemDto {
  return {
    compensationId: record.id,
    originalClientOperationId: record.originalClientOperationId,
    compensationActionCode: record.compensationActionCode,
    state: record.state,
    reasonCode: record.reasonCode,
    requestedBy: record.requestedBy,
    resultRefs: record.resultRefs,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    traceId: record.traceId,
  };
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
