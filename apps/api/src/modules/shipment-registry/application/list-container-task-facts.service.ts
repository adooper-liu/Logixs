import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerTaskFact,
  ListContainerTaskFactsPort,
} from "../list-container-task-facts.port";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";

@Injectable()
export class ListContainerTaskFactsService implements ListContainerTaskFactsPort {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  execute(input: {
    containerId: string;
    tenantId: string;
  }): Promise<ContainerTaskFact[]> {
    return this.repository.listCurrentTaskFacts({
      id: input.containerId,
      tenantId: input.tenantId,
    });
  }
}
