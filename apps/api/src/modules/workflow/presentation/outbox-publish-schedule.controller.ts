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
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<EnsureOutboxPublishScheduleResponseDto> {
    return this.ensureOutboxPublishSchedule.execute({
      tenantId: request.devIdentity.tenantId,
      operatorId: request.devIdentity.operatorId,
      intervalSeconds: body.intervalSeconds,
      limit: body.limit,
      maxRounds: body.maxRounds,
    });
  }
}
