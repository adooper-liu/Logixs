import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { CanonicalEventCode } from "@logix/contracts";
import { ApplyLifecycleEventService } from "../application/apply-lifecycle-event.service";
import {
  ApplyLifecycleEventRequestDto,
  ApplyLifecycleEventResponseDto,
} from "./lifecycle.dto";

@ApiTags("containers")
@Controller("containers/:containerId/lifecycle-events")
export class LifecycleController {
  constructor(
    private readonly applyLifecycleEvent: ApplyLifecycleEventService,
  ) {}

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
