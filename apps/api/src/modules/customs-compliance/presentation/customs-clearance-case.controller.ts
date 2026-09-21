import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { CustomsClearanceCaseDto } from "../../../contracts/customs-clearance.dto";
import { GetCustomsClearanceCaseService } from "../application/get-customs-clearance-case.service";

@ApiTags("containers")
@Controller("containers/:containerId/customs-clearance-case")
export class CustomsClearanceCaseController {
  constructor(private readonly getCase: GetCustomsClearanceCaseService) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: CustomsClearanceCaseDto })
  getCurrent(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<CustomsClearanceCaseDto | null> {
    return this.getCase.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
  }
}
