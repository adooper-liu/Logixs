import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListContainerLifecycleNodesService } from "../application/list-container-lifecycle-nodes.service";
import { ContainerLifecycleNodesPageDto } from "./lifecycle.dto";

@ApiTags("lifecycle")
@Controller("lifecycle-nodes")
export class LifecycleNodesBatchController {
  constructor(
    private readonly listContainerLifecycleNodes: ListContainerLifecycleNodesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ContainerLifecycleNodesPageDto })
  async list(
    @Req() request: { identity: { tenantId: string } },
    @Query("containerIds") containerIds?: string,
  ): Promise<ContainerLifecycleNodesPageDto> {
    const page = await this.listContainerLifecycleNodes.execute({
      tenantId: request.identity.tenantId,
      containerIds,
    });
    return {
      items: page.items.map((item) => ({
        containerId: item.containerId,
        flow: item.flow,
        nodes: item.nodes.map((node) => ({
          nodeInstanceId: node.nodeInstanceId,
          nodeCode: node.nodeCode,
          sequence: node.sequence,
          state: node.state,
          applicability: node.applicability,
          completedAt: node.completedAt?.toISOString() ?? null,
          blockedReasonRefs: node.blockedReasonRefs,
          isCurrent: node.isCurrent,
          times: {
            plannedAt: node.times.plannedAt?.toISOString() ?? null,
            estimatedAt: node.times.estimatedAt?.toISOString() ?? null,
            actualAt: node.times.actualAt?.toISOString() ?? null,
          },
        })),
      })),
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }
}
