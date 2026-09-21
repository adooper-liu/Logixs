import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ReplaceContainerDispatchAndReplayService } from "../application/replace-container-dispatch-and-replay.service";
import {
  ContainerDispatchCommandResponseDto,
  ReplaceContainerDispatchSnapshotRequestDto,
} from "./container-dispatch-command.dto";

@ApiTags("containers")
@Controller("containers/:containerId/dispatch-snapshot")
export class ContainerDispatchCommandController {
  constructor(
    private readonly replaceSnapshot: ReplaceContainerDispatchAndReplayService,
  ) {}

  @Post()
  @RequireCapabilities("container.operate")
  @ApiOkResponse({ type: ContainerDispatchCommandResponseDto })
  replace(
    @Param("containerId") containerRecordId: string,
    @Body() body: ReplaceContainerDispatchSnapshotRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ContainerDispatchCommandResponseDto> {
    return this.replaceSnapshot.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      expectedVersion: body.expectedVersion,
      stuffingSnapshotId: body.stuffingSnapshotId,
      stuffingSnapshotVersion: body.stuffingSnapshotVersion,
      bookingNumber: body.bookingNumber,
      carrierCode: body.carrierCode,
      vesselName: body.vesselName,
      voyageNumber: body.voyageNumber,
      masterBillNumber: body.masterBillNumber,
      houseBillNumber: body.houseBillNumber,
      vgmHandoffState: body.vgmHandoffState,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
