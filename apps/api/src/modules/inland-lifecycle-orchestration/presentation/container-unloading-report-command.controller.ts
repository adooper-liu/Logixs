import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  AppendContainerUnloadingReportRequestDto,
  ContainerUnloadingReportDto,
} from "../../../contracts/container-unloading-report.dto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { AppendContainerUnloadingReportAndReplayService } from "../application/append-container-unloading-report-and-replay.service";

@ApiTags("containers")
@Controller("containers/:containerId/unloading-report")
export class ContainerUnloadingReportCommandController {
  constructor(
    private readonly appendReport: AppendContainerUnloadingReportAndReplayService,
  ) {}

  @Post()
  @RequireCapabilities("container.operate")
  @ApiOkResponse({ type: ContainerUnloadingReportDto })
  append(
    @Param("containerId") containerRecordId: string,
    @Body() body: AppendContainerUnloadingReportRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ContainerUnloadingReportDto> {
    return this.appendReport.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      expectedVersion: body.expectedVersion,
      warehouseLocationId: body.warehouseLocationId,
      operationState: body.operationState,
      startedAt: body.startedAt,
      completedAt: body.completedAt,
      expectedQuantity: body.expectedQuantity,
      unloadedQuantity: body.unloadedQuantity,
      remainingQuantity: body.remainingQuantity,
      damagedQuantity: body.damagedQuantity,
      shortageQuantity: body.shortageQuantity,
      quantityUnit: body.quantityUnit,
      sealCheck: body.sealCheck,
      exceptionResolved: body.exceptionResolved,
      exceptionNotes: body.exceptionNotes,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
