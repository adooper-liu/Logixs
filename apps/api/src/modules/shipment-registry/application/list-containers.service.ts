import { Inject, Injectable } from "@nestjs/common";
import type { ContainerSummary } from "../domain/container-summary";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";

@Injectable()
export class ListContainersService {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  list(): Promise<ContainerSummary[]> {
    return this.repository.list();
  }
}
