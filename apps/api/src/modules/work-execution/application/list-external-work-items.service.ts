import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import {
  decodeTaskCursor,
  encodeTaskCursor,
  parsePageSize,
} from "../domain/task-page";
import {
  EXTERNAL_WORK_ITEM_REPOSITORY,
  type ExternalWorkItemRecord,
  type ExternalWorkItemRepository,
} from "../domain/external-work-item.repository";

export interface ExternalWorkItemPage {
  items: ExternalWorkItemRecord[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListExternalWorkItemsService {
  constructor(
    @Inject(EXTERNAL_WORK_ITEM_REPOSITORY)
    private readonly repository: ExternalWorkItemRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: {
    tenantId?: string;
    containerId?: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ExternalWorkItemPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    const containerId = input.containerId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    let pageSize: number;
    let after: { createdAt: Date; id: string } | undefined;
    try {
      pageSize = parsePageSize(input.pageSize);
      if (input.cursor) {
        const cursor = decodeTaskCursor(input.cursor);
        if (
          (containerId && cursor.containerId !== containerId) ||
          (!containerId && cursor.tenantId !== tenantId)
        ) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { createdAt: cursor.createdAt, id: cursor.id };
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (containerId) {
      await this.assertContainerTenant.execute({ tenantId, containerId });
    }
    const rows = await this.repository.listOpen({
      tenantId,
      ...(containerId ? { containerId } : {}),
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeTaskCursor({
                ...(containerId ? { containerId } : { tenantId }),
                createdAt: last.createdAt,
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date(),
      projectionVersion: 1,
    };
  }
}
