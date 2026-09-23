import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ShipmentPageV1 } from "@logix/contracts";
import {
  decodeShipmentCursor,
  encodeShipmentCursor,
  parseShipmentPageSize,
  parseShipmentStatus,
} from "../domain/shipment-page";
import {
  SHIPMENT_READ_REPOSITORY,
  type ShipmentReadRepository,
} from "../domain/shipment-read.repository";

export interface ListShipmentsInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
  status?: string;
}

@Injectable()
export class ListShipmentsService {
  constructor(
    @Inject(SHIPMENT_READ_REPOSITORY)
    private readonly repository: ShipmentReadRepository,
  ) {}

  async execute(input: ListShipmentsInput): Promise<ShipmentPageV1> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }

    let pageSize: number;
    let status: ReturnType<typeof parseShipmentStatus>;
    let after: { updatedAt: Date; id: string } | undefined;
    try {
      pageSize = parseShipmentPageSize(input.pageSize);
      status = parseShipmentStatus(input.status);
      if (input.cursor) {
        const cursor = decodeShipmentCursor(input.cursor);
        if (
          cursor.tenantId !== tenantId ||
          cursor.status !== (status ?? null)
        ) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { updatedAt: cursor.updatedAt, id: cursor.id };
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.repository.list({
      tenantId,
      status,
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
            ? encodeShipmentCursor({
                tenantId,
                status: status ?? null,
                updatedAt: new Date(last.updatedAt),
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date().toISOString(),
      projectionVersion: Math.max(
        0,
        ...items.map(({ lifecycleVersion }) => lifecycleVersion),
      ),
    };
  }
}
