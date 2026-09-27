import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  ProductOpportunityPageV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { IntakeProductOpportunityService } from "../application/intake-product-opportunity.service";
import { ListProductOpportunitiesService } from "../application/list-product-opportunities.service";
import {
  ProductOpportunityIntakeRequestDto,
  ProductOpportunityPageResponseDto,
  ProductOpportunityResponseDto,
} from "./product-opportunity.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

@ApiTags("product-opportunities")
@Controller("product-opportunities")
export class ProductOpportunitiesController {
  constructor(
    private readonly listOpportunities: ListProductOpportunitiesService,
    private readonly intakeOpportunity: IntakeProductOpportunityService,
  ) {}

  @Get()
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ProductOpportunityPageResponseDto })
  list(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ProductOpportunityPageV1> {
    return this.listOpportunities.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Post(":handoffId/intake")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductOpportunityResponseDto })
  intake(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
    @Body() body: ProductOpportunityIntakeRequestDto,
  ): Promise<ProductOpportunityV1> {
    return this.intakeOpportunity.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      handoffId,
      command: body,
    });
  }
}
