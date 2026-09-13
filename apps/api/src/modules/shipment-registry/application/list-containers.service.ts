import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  decodeContainerCursor,
  encodeContainerCursor,
  parsePageSize,
} from "../domain/container-page";
import type { ContainerSummary } from "../domain/container-summary";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";

export interface ListContainersInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface ContainerPage {
  items: ContainerSummary[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListContainersService {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  async execute(input: ListContainersInput): Promise<ContainerPage> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const tenantId = input.tenantId;

    let pageSize: number;
    try {
      pageSize = parsePageSize(input.pageSize);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    let after: { updatedAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeContainerCursor(input.cursor);
        if (cursor.tenantId !== tenantId) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { updatedAt: cursor.updatedAt, id: cursor.id };
      } catch (error) {
        throw new HttpException(
          error instanceof Error ? error.message : "VALIDATION_FORMAT",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.repository.list({
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
            ? encodeContainerCursor({
                tenantId,
                updatedAt: new Date(last.updatedAt),
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
