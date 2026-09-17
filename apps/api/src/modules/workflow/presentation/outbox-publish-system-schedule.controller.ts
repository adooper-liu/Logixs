import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ServiceEndpoint } from "../../../security/route-access.decorator";
import { EnsureOutboxPublishSystemScheduleService } from "../application/ensure-outbox-publish-system-schedule.service";
import {
  EnsureOutboxPublishSystemScheduleRequestDto,
  EnsureOutboxPublishSystemScheduleResponseDto,
} from "./outbox-publish-system-schedule.dto";

@ApiTags("workflows")
@ServiceEndpoint()
@Controller("workflows/outbox-system")
export class OutboxPublishSystemScheduleController {
  constructor(
    private readonly ensureOutboxPublishSystemSchedule: EnsureOutboxPublishSystemScheduleService,
  ) {}

  @Post("schedule")
  @ApiOkResponse({ type: EnsureOutboxPublishSystemScheduleResponseDto })
  async ensure(
    @Body() body: EnsureOutboxPublishSystemScheduleRequestDto,
    @Req()
    request: { serviceIdentity: { actorType: string; actorId: string } },
  ): Promise<EnsureOutboxPublishSystemScheduleResponseDto> {
    return this.ensureOutboxPublishSystemSchedule.execute({
      actorType: request.serviceIdentity.actorType,
      actorId: request.serviceIdentity.actorId,
      intervalSeconds: body.intervalSeconds,
      limit: body.limit,
      maxRounds: body.maxRounds,
      maxTenants: body.maxTenants,
    });
  }
}
