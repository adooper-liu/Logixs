import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListLifecycleEventsService } from "../application/list-lifecycle-events.service";
import { LifecycleEventPageDto } from "./lifecycle.dto";

@ApiTags("containers")
@Controller("containers/:containerId/lifecycle-events")
export class LifecycleController {
  constructor(
    private readonly listLifecycleEvents: ListLifecycleEventsService,
  ) {}

  @Get()
  @RequireCapabilities("lifecycle.read")
  @ApiOkResponse({ type: LifecycleEventPageDto })
  async list(
    @Param("containerId") containerId: string,
    @Req() request: { identity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<LifecycleEventPageDto> {
    const page = await this.listLifecycleEvents.execute({
      containerId,
      tenantId: request.identity.tenantId,
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
}
