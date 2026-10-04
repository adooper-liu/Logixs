import { Controller, Get, Inject, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { WorkbenchNetworkVolume } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetWorkbenchNetworkVolumeService } from "../application/get-workbench-network-volume.service";

type IdentityRequest = { identity: { tenantId: string } };

@ApiTags("workbench-network")
@Controller("workbench-network")
export class WorkbenchNetworkVolumeController {
  constructor(
    @Inject(GetWorkbenchNetworkVolumeService)
    private readonly volume: GetWorkbenchNetworkVolumeService,
  ) {}

  @Get("volume")
  @RequireCapabilities("planning.read")
  @ApiOkResponse({ description: "workbench-network-volume.v1" })
  get(@Req() request: IdentityRequest): Promise<WorkbenchNetworkVolume> {
    return this.volume.execute({ tenantId: request.identity.tenantId });
  }
}
