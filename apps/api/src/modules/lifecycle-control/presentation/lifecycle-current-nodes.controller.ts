import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListContainerCurrentNodesService } from "../application/list-container-current-nodes.service";
import { ContainerCurrentNodesPageDto } from "./lifecycle.dto";

@ApiTags("lifecycle")
@Controller("lifecycle-current-nodes")
export class LifecycleCurrentNodesController {
  constructor(
    private readonly listContainerCurrentNodes: ListContainerCurrentNodesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ContainerCurrentNodesPageDto })
  async list(
    @Req() request: { identity: { tenantId: string } },
    @Query("containerIds") containerIds?: string,
  ): Promise<ContainerCurrentNodesPageDto> {
    const page = await this.listContainerCurrentNodes.execute({
      tenantId: request.identity.tenantId,
      containerIds,
    });
    return {
      items: page.items,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }
}
