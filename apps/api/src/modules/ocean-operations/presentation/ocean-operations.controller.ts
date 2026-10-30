import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { OceanOperationsSourceReviewService } from "../application/ocean-operations-source-review.service";
import {
  OceanOperationsQueueDto,
  OceanOperationsSourceReviewRequestDto,
  OceanOperationsSourceReviewResponseDto,
} from "./ocean-operations.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

@ApiTags("ocean-operations")
@Controller("ocean-operations")
export class OceanOperationsController {
  constructor(private readonly service: OceanOperationsSourceReviewService) {}

  @Get("source-reviews")
  @RequireCapabilities("lifecycle.read")
  @ApiOkResponse({ type: OceanOperationsQueueDto })
  async queue(
    @Req() request: IdentityRequest,
    @Query("containerNumber") containerNumber?: string,
  ): Promise<OceanOperationsQueueDto> {
    return {
      items: await this.service.listQueue({
        tenantId: request.identity.tenantId,
        containerNumber,
      }),
    };
  }

  @Get("source-reviews/:containerId")
  @RequireCapabilities("lifecycle.read")
  async projection(
    @Req() request: IdentityRequest,
    @Param("containerId") containerId: string,
  ) {
    return this.service.getProjection(request.identity.tenantId, containerId);
  }

  @Post("source-reviews/:containerId")
  @RequireCapabilities("lifecycle.operate")
  @ApiOkResponse({ type: OceanOperationsSourceReviewResponseDto })
  async save(
    @Req() request: IdentityRequest,
    @Param("containerId") containerId: string,
    @Body() body: OceanOperationsSourceReviewRequestDto,
    @Headers("x-trace-id") traceId?: string,
  ): Promise<OceanOperationsSourceReviewResponseDto> {
    return this.service.save({
      ...body,
      containerId,
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      traceId: traceId?.trim() || randomUUID(),
    });
  }
}
