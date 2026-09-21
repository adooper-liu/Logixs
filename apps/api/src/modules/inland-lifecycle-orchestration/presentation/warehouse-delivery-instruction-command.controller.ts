import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  ReplaceWarehouseDeliveryInstructionRequestDto,
  WarehouseDeliveryInstructionDto,
} from "../../../contracts/warehouse-delivery-instruction.dto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ReplaceWarehouseDeliveryInstructionAndReplayService } from "../application/replace-warehouse-delivery-instruction-and-replay.service";

@ApiTags("containers")
@Controller("containers/:containerId/delivery-instruction")
export class WarehouseDeliveryInstructionCommandController {
  constructor(
    private readonly replaceInstruction: ReplaceWarehouseDeliveryInstructionAndReplayService,
  ) {}

  @Post()
  @RequireCapabilities("container.operate")
  @ApiOkResponse({ type: WarehouseDeliveryInstructionDto })
  replace(
    @Param("containerId") containerRecordId: string,
    @Body() body: ReplaceWarehouseDeliveryInstructionRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<WarehouseDeliveryInstructionDto> {
    return this.replaceInstruction.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      expectedVersion: body.expectedVersion,
      warehouseLocationId: body.warehouseLocationId,
      warehouseCode: body.warehouseCode,
      warehouseName: body.warehouseName,
      unlocode: body.unlocode,
      timezone: body.timezone,
      appointmentStartAt: body.appointmentStartAt,
      appointmentEndAt: body.appointmentEndAt,
      appointmentReference: body.appointmentReference,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
