import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ReplaceContainerStuffingAndReplayService } from "../application/replace-container-stuffing-and-replay.service";
import {
  ContainerStuffingCommandResponseDto,
  ReplaceContainerStuffingSnapshotRequestDto,
} from "./container-stuffing-command.dto";

@ApiTags("containers")
@Controller("containers/:containerId/stuffing-snapshot")
export class ContainerStuffingCommandController {
  constructor(
    private readonly replaceSnapshot: ReplaceContainerStuffingAndReplayService,
  ) {}

  @Post()
  @RequireCapabilities("container.operate")
  @ApiOkResponse({ type: ContainerStuffingCommandResponseDto })
  replace(
    @Param("containerId") containerRecordId: string,
    @Body() body: ReplaceContainerStuffingSnapshotRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ContainerStuffingCommandResponseDto> {
    return this.replaceSnapshot.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      expectedVersion: body.expectedVersion,
      allocationSetId: body.allocationSetId,
      allocationSetVersion: body.allocationSetVersion,
      containerNumber: body.containerNumber,
      sealNumber: body.sealNumber,
      packageCount: body.packageCount,
      grossWeight: body.grossWeight,
      grossWeightUnit: "KGM",
      netWeight: body.netWeight,
      volume: body.volume,
      volumeUnit: "MTQ",
      vgm: body.vgm ? { ...body.vgm, weightUnit: "KGM" as const } : null,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
