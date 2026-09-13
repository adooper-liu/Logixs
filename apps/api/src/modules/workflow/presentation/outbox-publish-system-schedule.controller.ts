import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { EnsureOutboxPublishSystemScheduleService } from "../application/ensure-outbox-publish-system-schedule.service";
import {
  EnsureOutboxPublishSystemScheduleRequestDto,
  EnsureOutboxPublishSystemScheduleResponseDto,
} from "./outbox-publish-system-schedule.dto";

@ApiTags("workflows")
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
    request: { devServiceIdentity: { actorType: string; actorId: string } },
  ): Promise<EnsureOutboxPublishSystemScheduleResponseDto> {
    return this.ensureOutboxPublishSystemSchedule.execute({
      actorType: request.devServiceIdentity.actorType,
      actorId: request.devServiceIdentity.actorId,
      intervalSeconds: body.intervalSeconds,
      limit: body.limit,
      maxRounds: body.maxRounds,
      maxTenants: body.maxTenants,
    });
  }
}
