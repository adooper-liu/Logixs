import { randomUUID } from "node:crypto";
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
import type {
  LifecycleDateFactReviewPage,
  LifecycleDateFactResult,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ApproveLifecycleDateFactReviewService } from "../application/approve-lifecycle-date-fact-review.service";
import { ListLifecycleDateFactReviewsService } from "../application/list-lifecycle-date-fact-reviews.service";
import {
  ApproveLifecycleDateFactReviewRequestDto,
  LifecycleDateFactReviewPageDto,
  RecordLifecycleDateFactResponseDto,
} from "./lifecycle-date-fact.dto";

interface ReviewIdentity {
  actorId: string;
  tenantId: string;
  capabilities: string[];
}

@ApiTags("lifecycle-date-fact-reviews")
@Controller("lifecycle-date-fact-reviews")
export class LifecycleDateFactReviewsController {
  constructor(
    private readonly listReviews: ListLifecycleDateFactReviewsService,
    private readonly approveReview: ApproveLifecycleDateFactReviewService,
  ) {}

  @Get()
  @RequireCapabilities("evidence.review")
  @ApiOkResponse({ type: LifecycleDateFactReviewPageDto })
  list(
    @Query("pageSize") pageSize: string | undefined,
    @Query("cursor") cursor: string | undefined,
    @Req() request: { identity: ReviewIdentity },
  ): Promise<LifecycleDateFactReviewPage> {
    return this.listReviews.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      pageSize,
      cursor,
    });
  }

  @Post(":factId/approve")
  @RequireCapabilities("evidence.review")
  @ApiOkResponse({ type: RecordLifecycleDateFactResponseDto })
  async approve(
    @Param("factId") factId: string,
    @Body() body: ApproveLifecycleDateFactReviewRequestDto,
    @Headers("x-trace-id") traceId: string | undefined,
    @Req() request: { identity: ReviewIdentity },
  ): Promise<RecordLifecycleDateFactResponseDto> {
    const result: LifecycleDateFactResult = await this.approveReview.execute({
      tenantId: request.identity.tenantId,
      reviewerId: request.identity.actorId,
      actorCapabilities: request.identity.capabilities,
      factId,
      reasonCode: body.reasonCode,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      traceId: normalizeTraceId(traceId),
    });
    return {
      ...result,
      reasonCode: result.reasonCode ?? null,
      canonicalEventId: result.canonicalEventId ?? null,
    };
  }
}

function normalizeTraceId(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 128 ? normalized : randomUUID();
}
