import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListLifecycleNodesService } from "../application/list-lifecycle-nodes.service";
import { LifecycleNodesPageDto } from "./lifecycle.dto";

@ApiTags("containers")
@Controller("containers/:containerId/lifecycle-nodes")
export class LifecycleNodesController {
  constructor(private readonly listLifecycleNodes: ListLifecycleNodesService) {}

  @Get()
  @ApiOkResponse({ type: LifecycleNodesPageDto })
  async list(
    @Param("containerId") containerId: string,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<LifecycleNodesPageDto> {
    const page = await this.listLifecycleNodes.execute({
      containerId,
      tenantId: request.devIdentity.tenantId,
    });
    return {
      flow: page.flow,
      nodes: page.nodes.map((node) => ({
        nodeInstanceId: node.nodeInstanceId,
        nodeCode: node.nodeCode,
        sequence: node.sequence,
        state: node.state,
        applicability: node.applicability,
        completedAt: node.completedAt?.toISOString() ?? null,
        isCurrent: node.isCurrent,
      })),
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }
}
