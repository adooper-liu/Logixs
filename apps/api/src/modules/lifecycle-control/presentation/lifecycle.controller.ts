import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { CanonicalEventCode } from "@logix/contracts";
import { ApplyLifecycleEventService } from "../application/apply-lifecycle-event.service";
import { ListLifecycleEventsService } from "../application/list-lifecycle-events.service";
import {
  ApplyLifecycleEventRequestDto,
  ApplyLifecycleEventResponseDto,
  LifecycleEventPageDto,
} from "./lifecycle.dto";

@ApiTags("containers")
@Controller("containers/:containerId/lifecycle-events")
export class LifecycleController {
  constructor(
    private readonly applyLifecycleEvent: ApplyLifecycleEventService,
    private readonly listLifecycleEvents: ListLifecycleEventsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: LifecycleEventPageDto })
  async list(
    @Param("containerId") containerId: string,
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<LifecycleEventPageDto> {
    const page = await this.listLifecycleEvents.execute({
      containerId,
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items.map((item) => ({
        id: item.id,
        containerId: item.containerId,
        eventCode: item.eventCode,
        occurredAt: item.occurredAt.toISOString(),
        recordedAt: item.recordedAt.toISOString(),
        evidenceRefs: item.evidenceRefs,
      })),
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }

  @Post()
  @ApiOkResponse({ type: ApplyLifecycleEventResponseDto })
  async applyEvent(
    @Param("containerId") containerId: string,
    @Body() body: ApplyLifecycleEventRequestDto,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<ApplyLifecycleEventResponseDto> {
    return this.applyLifecycleEvent.execute({
      containerId,
      tenantId: request.devIdentity.tenantId,
      eventCode: body.eventCode as CanonicalEventCode,
      occurredAt: new Date(body.occurredAt),
      idempotencyKey: body.idempotencyKey,
      evidenceRefs: body.evidenceRefs,
    });
  }
}
