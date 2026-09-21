import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
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

export interface ListLifecycleNodesInput {
  containerId: string;
  tenantId?: string;
}

export interface LifecycleNodesPage extends LifecycleNodesView {
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListLifecycleNodesService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
  ) {}

  async execute(input: ListLifecycleNodesInput): Promise<LifecycleNodesPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const containerId = input.containerId.trim();
    if (!containerId) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const container = await this.repository.findContainerBase(containerId);
    if (!container || container.tenantId !== tenantId) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const [flow, facts] = await Promise.all([
      this.repository.findFlowByContainer(containerId),
      this.dateFacts.listCurrentForNodeProjection({
        tenantId,
        containerIds: [containerId],
      }),
    ]);
    const view = projectLifecycleNodes(flow, { facts });
    return {
      ...view,
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
