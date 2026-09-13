import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseContainerIds } from "../domain/lifecycle-current-nodes";
import {
  projectLifecycleNodes,
  type LifecycleNodesView,
} from "../domain/lifecycle-nodes";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";

export interface ListContainerLifecycleNodesInput {
  tenantId?: string;
  containerIds?: string;
}

export interface ContainerLifecycleNodesItem extends LifecycleNodesView {
  containerId: string;
}

export interface ContainerLifecycleNodesPage {
  items: ContainerLifecycleNodesItem[];
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListContainerLifecycleNodesService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
  ) {}

  async execute(
    input: ListContainerLifecycleNodesInput,
  ): Promise<ContainerLifecycleNodesPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }

    let containerIds: string[];
    try {
      containerIds = parseContainerIds(input.containerIds);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const flows = await this.repository.listFlowsWithNodes({
      tenantId,
      containerIds,
    });
    return {
      items: flows.map((flow) => ({
        containerId: flow.flow.containerId,
        ...projectLifecycleNodes(flow),
      })),
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
