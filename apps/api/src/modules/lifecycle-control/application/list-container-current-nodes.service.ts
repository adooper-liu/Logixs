import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseContainerIds } from "../domain/lifecycle-current-nodes";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";

export interface ListContainerCurrentNodesInput {
  tenantId?: string;
  containerIds?: string;
}

export interface ContainerCurrentNodeItem {
  containerId: string;
  currentNodeCode: string;
  flowState: string;
}

export interface ContainerCurrentNodesPage {
  items: ContainerCurrentNodeItem[];
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListContainerCurrentNodesService {
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
