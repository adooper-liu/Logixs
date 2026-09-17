import type { ContainerTaskFact } from "./domain/container-task-fact";

export const LIST_CONTAINER_TASK_FACTS = Symbol.for(
  "logix.ListContainerTaskFacts",
);

export type { ContainerTaskFact } from "./domain/container-task-fact";

export interface ListContainerTaskFactsPort {
  execute(input: {
    containerId: string;
    tenantId: string;
  }): Promise<ContainerTaskFact[]>;
}
