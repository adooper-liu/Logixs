import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { WarehouseDeliveryInstructionDto } from "../../../contracts/warehouse-delivery-instruction.dto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetWarehouseDeliveryInstructionService } from "../application/get-warehouse-delivery-instruction.service";

@ApiTags("containers")
@Controller("containers/:containerId/delivery-instruction")
export class WarehouseDeliveryInstructionController {
  constructor(
    private readonly getInstruction: GetWarehouseDeliveryInstructionService,
  ) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: WarehouseDeliveryInstructionDto, nullable: true })
  get(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<WarehouseDeliveryInstructionDto | null> {
    return this.getInstruction.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
  }
}
