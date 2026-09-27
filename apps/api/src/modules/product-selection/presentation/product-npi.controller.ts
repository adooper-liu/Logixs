import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  ProductInitiativeClaimCommandV1,
  ProductInitiativeNpiQueuePageV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ClaimProductInitiativeService } from "../application/claim-product-initiative.service";
import { ListNpiQueueService } from "../application/list-npi-queue.service";
import {
  ProductInitiativeClaimRequestDto,
  ProductInitiativeNpiQueueEntryResponseDto,
  ProductInitiativeNpiQueuePageResponseDto,
} from "./product-npi.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

/**
 * 产品开发与 NPI 工作台的服务端入口。
 *
 * 与选品侧同一套能力码（仓库当前没有产品/NPI 专属角色包）：看待办用 `planning.read`，
 * 领取用 `planning.draft`。
 */
@ApiTags("product-initiative-npi")
@Controller("product-initiative-npi")
export class ProductNpiController {
  constructor(
    private readonly listQueue: ListNpiQueueService,
    private readonly claimInitiative: ClaimProductInitiativeService,
  ) {}

  @Get("queue")
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ProductInitiativeNpiQueuePageResponseDto })
  queue(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ProductInitiativeNpiQueuePageV1> {
    return this.listQueue.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Post(":handoffId/claim")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductInitiativeNpiQueueEntryResponseDto })
  claim(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
    @Body() body: ProductInitiativeClaimRequestDto,
  ): Promise<ProductInitiativeNpiQueuePageV1["items"][number]> {
    return this.claimInitiative.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      handoffId,
      command: body as ProductInitiativeClaimCommandV1,
    });
  }
}
