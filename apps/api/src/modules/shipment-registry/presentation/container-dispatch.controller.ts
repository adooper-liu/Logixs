import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetContainerDispatchSnapshotService } from "../application/get-container-dispatch-snapshot.service";
import { ContainerDispatchSnapshotDto } from "./container-dispatch.dto";

@ApiTags("containers")
@Controller("containers/:containerId/dispatch-snapshot")
export class ContainerDispatchController {
  constructor(
    private readonly getSnapshot: GetContainerDispatchSnapshotService,
  ) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: ContainerDispatchSnapshotDto })
  getCurrent(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<ContainerDispatchSnapshotDto | null> {
    return this.getSnapshot.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
  }
}
