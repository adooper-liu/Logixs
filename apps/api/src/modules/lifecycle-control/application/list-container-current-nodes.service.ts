import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseContainerIds } from "../domain/lifecycle-current-nodes";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import type {
  ContainerCurrentNodesPage,
  ListContainerCurrentNodesPort,
} from "../list-container-current-nodes.port";

export interface ListContainerCurrentNodesInput {
  tenantId?: string;
  containerIds?: string;
}

@Injectable()
export class ListContainerCurrentNodesService implements ListContainerCurrentNodesPort {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
  ) {}

  async execute(
    input: ListContainerCurrentNodesInput,
  ): Promise<ContainerCurrentNodesPage> {
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

    const items = await this.repository.listCurrentNodes({
      tenantId,
      containerIds,
    });
    return {
      items,
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
