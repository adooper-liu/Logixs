import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ShipmentPendingCompletionPageV1 } from "@logix/contracts";
import {
  decodeShipmentCursor,
  encodeShipmentCursor,
  parseShipmentPageSize,
  SHIPMENT_PENDING_COMPLETION_CURSOR_SCOPE,
} from "../domain/shipment-page";
import {
  SHIPMENT_READ_REPOSITORY,
  type ShipmentReadRepository,
} from "../domain/shipment-read.repository";

export interface ListShipmentPendingCompletionInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

@Injectable()
export class ListShipmentPendingCompletionService {
  constructor(
    @Inject(SHIPMENT_READ_REPOSITORY)
    private readonly repository: ShipmentReadRepository,
  ) {}

  async execute(
    input: ListShipmentPendingCompletionInput,
  ): Promise<ShipmentPendingCompletionPageV1> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");

    let pageSize: number;
    let after: { updatedAt: Date; id: string } | undefined;
    try {
      pageSize = parseShipmentPageSize(input.pageSize);
      if (input.cursor) {
        const cursor = decodeShipmentCursor(
          input.cursor,
          SHIPMENT_PENDING_COMPLETION_CURSOR_SCOPE,
        );
        if (cursor.tenantId !== tenantId || cursor.status !== null) {
          throw new Error("VALIDATION_FORMAT: cursor 与待补队列不匹配");
        }
        after = { updatedAt: cursor.updatedAt, id: cursor.id };
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.repository.listPendingCompletion({
      tenantId,
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1)?.shipment;
    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeShipmentCursor(
                {
                  tenantId,
                  status: null,
                  updatedAt: new Date(last.updatedAt),
                  id: last.id,
                },
                SHIPMENT_PENDING_COMPLETION_CURSOR_SCOPE,
              )
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date().toISOString(),
      projectionVersion: Math.max(
        0,
        ...items.map(({ shipment }) => shipment.lifecycleVersion),
      ),
    };
  }
}
