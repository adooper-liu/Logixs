import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  ProductInitiativeDetailV1,
  ProductInitiativeQueuePageV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { DecideProductInitiativeService } from "../application/decide-product-initiative.service";
import { GetProductInitiativeService } from "../application/get-product-initiative.service";
import { ListProductInitiativesService } from "../application/list-product-initiatives.service";
import {
  ProductInitiativeDecisionRequestDto,
  ProductInitiativeDetailResponseDto,
  ProductInitiativeQueuePageResponseDto,
  ProductInitiativeResponseDto,
} from "./product-initiative.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

@ApiTags("product-initiatives")
@Controller("product-initiatives")
export class ProductInitiativesController {
  constructor(
    private readonly listInitiatives: ListProductInitiativesService,
    private readonly getInitiative: GetProductInitiativeService,
    private readonly decideInitiative: DecideProductInitiativeService,
  ) {}

  @Get()
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ProductInitiativeQueuePageResponseDto })
  list(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ProductInitiativeQueuePageV1> {
    return this.listInitiatives.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Get(":handoffId")
  @RequireCapabilities("planning.read")
  @ApiOkResponse({ type: ProductInitiativeDetailResponseDto })
  detail(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
  ): Promise<ProductInitiativeDetailV1> {
    return this.getInitiative.execute({
      tenantId: request.identity.tenantId,
      handoffId,
    });
  }

  @Post(":handoffId/decisions")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductInitiativeResponseDto })
  decide(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
    @Body() body: ProductInitiativeDecisionRequestDto,
  ): Promise<ProductInitiativeV1> {
    return this.decideInitiative.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      handoffId,
      command: body,
    });
  }
}
