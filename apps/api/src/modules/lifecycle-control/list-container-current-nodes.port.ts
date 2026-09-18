export const LIST_CONTAINER_CURRENT_NODES = Symbol.for(
  "logix.ListContainerCurrentNodes",
);

export interface ContainerCurrentNodeItem {
  containerId: string;
  currentNodeCode: LifecycleNodeCode;
  flowState: FlowInstanceState;
}

export interface ContainerCurrentNodesPage {
  items: ContainerCurrentNodeItem[];
  asOf: Date;
  projectionVersion: number;
}

export interface ListContainerCurrentNodesPort {
  execute(input: {
    tenantId?: string;
    containerIds?: string;
  }): Promise<ContainerCurrentNodesPage>;
}
import type { FlowInstanceState, LifecycleNodeCode } from "@logix/contracts";
