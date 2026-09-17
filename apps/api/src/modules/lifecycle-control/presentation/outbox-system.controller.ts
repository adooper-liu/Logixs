import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ServiceEndpoint } from "../../../security/route-access.decorator";
import { DrainDueSystemOutboxService } from "../application/drain-due-system-outbox.service";
import {
  PublishDueSystemOutboxRequestDto,
  PublishDueSystemOutboxResponseDto,
} from "./outbox-system.dto";

@ApiTags("outbox")
@ServiceEndpoint()
@Controller("outbox/system")
export class OutboxSystemController {
  constructor(
    private readonly drainDueSystemOutbox: DrainDueSystemOutboxService,
  ) {}

  @Post("publish-due")
  @ApiOkResponse({ type: PublishDueSystemOutboxResponseDto })
  async publishDue(
    @Body() body: PublishDueSystemOutboxRequestDto,
    @Req()
    request: { serviceIdentity: { actorType: string; actorId: string } },
  ): Promise<PublishDueSystemOutboxResponseDto> {
    return this.drainDueSystemOutbox.execute({
      actorType: request.serviceIdentity.actorType,
      actorId: request.serviceIdentity.actorId,
      limit: body.limit,
      maxRounds: body.maxRounds,
      maxTenants: body.maxTenants,
    });
  }
}
