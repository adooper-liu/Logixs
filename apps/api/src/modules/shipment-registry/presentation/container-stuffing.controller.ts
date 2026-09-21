import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetContainerStuffingSnapshotService } from "../application/get-container-stuffing-snapshot.service";
import { ContainerStuffingSnapshotDto } from "./container-stuffing.dto";

@ApiTags("containers")
@Controller("containers/:containerId/stuffing-snapshot")
export class ContainerStuffingController {
  constructor(
    private readonly getSnapshot: GetContainerStuffingSnapshotService,
  ) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: ContainerStuffingSnapshotDto })
  getCurrent(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ContainerStuffingSnapshotDto | null> {
    return this.getSnapshot.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
  }
}
