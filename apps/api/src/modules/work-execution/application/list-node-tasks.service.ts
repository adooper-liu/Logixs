import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  decodeTaskCursor,
  encodeTaskCursor,
  parsePageSize,
} from "../domain/task-page";
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskWithWorkOrders,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

interface AssertContainerTenantPort {
  execute(input: { containerId: string; tenantId: string }): Promise<void>;
}

export interface ListNodeTasksInput {
  containerId?: string;
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface NodeTaskPage {
  items: NodeTaskWithWorkOrders[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListNodeTasksService {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: ListNodeTasksInput): Promise<NodeTaskPage> {
    const containerId = input.containerId?.trim() ?? "";
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }

    let pageSize: number;
    try {
      pageSize = parsePageSize(input.pageSize);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    let after: { createdAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        after = this.readCursor(input.cursor, {
          tenantId,
          containerId: containerId || undefined,
        });
      } catch (error) {
        throw new HttpException(
          error instanceof Error ? error.message : "VALIDATION_FORMAT",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = containerId
      ? await this.listByContainer(containerId, tenantId, after, pageSize)
      : await this.repository.listTasksByTenant({
          tenantId,
          after,
          take: pageSize + 1,
        });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const last = items[items.length - 1];

    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeTaskCursor({
                ...(containerId ? { containerId } : { tenantId }),
                createdAt: last.task.createdAt,
                id: last.task.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date(),
      projectionVersion: 0,
    };
  }

  private readCursor(
    raw: string,
    filter: { tenantId: string; containerId?: string },
  ): { createdAt: Date; id: string } {
    const cursor = decodeTaskCursor(raw);
    if (filter.containerId) {
      if (cursor.containerId !== filter.containerId) {
        throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
      }
    } else if (cursor.tenantId !== filter.tenantId) {
      throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
    }
    return { createdAt: cursor.createdAt, id: cursor.id };
  }

  private async listByContainer(
    containerId: string,
    tenantId: string,
    after: { createdAt: Date; id: string } | undefined,
    pageSize: number,
  ) {
    await this.assertContainerTenant.execute({
      containerId,
      tenantId,
    });
    return this.repository.listTasksByContainer({
      containerId,
      after,
      take: pageSize + 1,
    });
  }
}
