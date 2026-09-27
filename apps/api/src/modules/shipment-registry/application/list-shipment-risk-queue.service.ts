import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ShipmentRiskQueuePageV1 } from "@logix/contracts";
import { parseShipmentPageSize } from "../domain/shipment-page";
import {
  decodeShipmentRiskCursor,
  encodeShipmentRiskCursor,
  parseShipmentRiskSort,
} from "../domain/shipment-risk-page";
import {
  SHIPMENT_READ_REPOSITORY,
  type ShipmentReadRepository,
} from "../domain/shipment-read.repository";

export interface ListShipmentRiskQueueInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
  sort?: string;
}

/**
 * Shipment 风险队列取页。
 *
 * 排序与游标**都在服务端**：队列是游标分页，前端只能排当前页 —— 第二页的票可能
 * 比第一页更急，本地排会骗人。因此游标记住了排序键，换排序再翻页会被拒绝，
 * 而不是悄悄按新排序解释旧位置。
 */
@Injectable()
export class ListShipmentRiskQueueService {
  constructor(
    @Inject(SHIPMENT_READ_REPOSITORY)
    private readonly repository: ShipmentReadRepository,
  ) {}

  async execute(
    input: ListShipmentRiskQueueInput,
  ): Promise<ShipmentRiskQueuePageV1> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");

    let pageSize: number;
    let sort: ReturnType<typeof parseShipmentRiskSort>;
    let after: { sortValue: Date | null; id: string } | undefined;
    try {
      pageSize = parseShipmentPageSize(input.pageSize);
      sort = parseShipmentRiskSort(input.sort);
      if (input.cursor) {
        const cursor = decodeShipmentRiskCursor(input.cursor);
        if (cursor.tenantId !== tenantId || cursor.sort !== sort) {
          throw new Error("VALIDATION_FORMAT: cursor 与排序条件不匹配");
        }
        after = { sortValue: cursor.sortValue, id: cursor.id };
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.repository.listRiskQueue({
      tenantId,
      sort,
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);

    return {
      items: items.map(({ shipment, risk, pendingItems }) => ({
        shipment,
        risk,
        pendingItems,
      })),
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeShipmentRiskCursor({
                tenantId,
                sort,
                sortValue: last.sortValue,
                id: last.shipment.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date().toISOString(),
      projectionVersion: Math.max(
        0,
        ...items.map(({ shipment }) => shipment.lifecycleVersion),
      ),
      sort,
    };
  }
}
