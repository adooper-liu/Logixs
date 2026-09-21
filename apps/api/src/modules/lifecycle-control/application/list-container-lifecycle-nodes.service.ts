import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseContainerIds } from "../domain/lifecycle-current-nodes";
import {
  projectLifecycleNodes,
  type LifecycleNodesView,
} from "../domain/lifecycle-nodes";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
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
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
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

    const [flows, facts] = await Promise.all([
      this.repository.listFlowsWithNodes({ tenantId, containerIds }),
      this.dateFacts.listCurrentForNodeProjection({ tenantId, containerIds }),
    ]);
    const factsByContainer = new Map<string, typeof facts>();
    for (const fact of facts) {
      const containerFacts = factsByContainer.get(fact.containerId) ?? [];
      containerFacts.push(fact);
      factsByContainer.set(fact.containerId, containerFacts);
    }
    return {
      items: flows.map((flow) => ({
        containerId: flow.flow.containerId,
        ...projectLifecycleNodes(flow, {
          facts: factsByContainer.get(flow.flow.containerId) ?? [],
        }),
      })),
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
