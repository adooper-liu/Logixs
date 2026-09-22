import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ContainerUnloadingReportDto } from "../../../contracts/container-unloading-report.dto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetContainerUnloadingReportService } from "../application/get-container-unloading-report.service";

@ApiTags("containers")
@Controller("containers/:containerId/unloading-report")
export class ContainerUnloadingReportController {
  constructor(private readonly getReport: GetContainerUnloadingReportService) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: ContainerUnloadingReportDto, nullable: true })
  get(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ContainerUnloadingReportDto | null> {
    return this.getReport.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
  }
}
