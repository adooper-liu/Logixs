import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";
import type {
  ResolveContainerByNumberInput,
  ResolveContainerByNumberPort,
  ResolveContainerByNumberResult,
} from "../resolve-container-by-number.port";

@Injectable()
export class ResolveContainerByNumberService implements ResolveContainerByNumberPort {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  async execute(
    input: ResolveContainerByNumberInput,
  ): Promise<ResolveContainerByNumberResult> {
    if (!input.tenantId.trim()) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const containerNumber = input.containerNumber.trim();
    if (!containerNumber) return { state: "not_found", containerId: null };

    const candidateIds = await this.repository.findIdsByContainerNumber({
      tenantId: input.tenantId.trim(),
      containerNumber,
      take: 2,
    });
    if (candidateIds.length === 0) {
      return { state: "not_found", containerId: null };
    }
    if (candidateIds.length > 1) {
      return { state: "ambiguous", containerId: null };
    }
    return { state: "resolved", containerId: candidateIds[0] };
  }
}
