import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LIST_CONTAINER_TASK_FACTS,
  type ListContainerTaskFactsPort,
} from "../../shipment-registry";
import type { CreateNodeTaskPort } from "../../work-execution";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import { NODE_SEQUENCE } from "../domain/node-status";

const CREATE_NODE_TASK = Symbol.for("logix.CreateNodeTask");

export interface InitializeContainerFlowInput {
  containerId: string;
  tenantId: string;
}

export interface InitializeContainerFlowResult {
  initialized: boolean;
  taskCount: number;
}

@Injectable()
export class InitializeContainerFlowService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
    @Inject(LIST_CONTAINER_TASK_FACTS)
    private readonly listTaskFacts: ListContainerTaskFactsPort,
    @Inject(CREATE_NODE_TASK)
    private readonly createNodeTask: CreateNodeTaskPort,
  ) {}

  async execute(
    input: InitializeContainerFlowInput,
  ): Promise<InitializeContainerFlowResult> {
    const container = await this.repository.findContainerBase(
      input.containerId,
    );
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (container.tenantId !== input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!container.containerNumber?.trim()) {
      return { initialized: false, taskCount: 0 };
    }

    const flow = await this.repository.ensureFlow(input.containerId);
    const facts = await this.listTaskFacts.execute(input);
    const nodes = [...flow.nodes].sort(
      (left, right) =>
        NODE_SEQUENCE[left.nodeCode] - NODE_SEQUENCE[right.nodeCode],
    );
    for (const node of nodes) {
      await this.createNodeTask.execute({
        flowInstanceId: flow.flow.id,
        nodeInstanceId: node.id,
        nodeCode: node.nodeCode,
        containerId: input.containerId,
        tenantId: input.tenantId,
        applicability: node.applicability,
        isCurrent: node.nodeCode === flow.flow.currentNodeCode,
        conditionFacts: facts,
      });
    }
    return { initialized: true, taskCount: nodes.length };
  }
}
