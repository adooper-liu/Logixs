import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { EnsureOutboxPublishScheduleService } from "../application/ensure-outbox-publish-schedule.service";
import {
  EnsureOutboxPublishScheduleRequestDto,
  EnsureOutboxPublishScheduleResponseDto,
} from "./outbox-publish-schedule.dto";

@ApiTags("workflows")
@Controller("workflows/outbox-publish-due")
export class OutboxPublishScheduleController {
  constructor(
    private readonly ensureOutboxPublishSchedule: EnsureOutboxPublishScheduleService,
  ) {}

  @Post("schedule")
  @ApiOkResponse({ type: EnsureOutboxPublishScheduleResponseDto })
  async ensure(
    @Body() body: EnsureOutboxPublishScheduleRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<EnsureOutboxPublishScheduleResponseDto> {
    return this.ensureOutboxPublishSchedule.execute({
      tenantId: request.identity.tenantId,
      operatorId: request.identity.actorId,
      intervalSeconds: body.intervalSeconds,
      limit: body.limit,
      maxRounds: body.maxRounds,
    });
  }
}
