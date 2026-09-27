import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ProductOpportunityPageV1 } from "@logix/contracts";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { decodeKeysetCursor, encodeKeysetCursor } from "./keyset-cursor";

@Injectable()
export class ListProductOpportunitiesService {
  constructor(
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly repository: ProductOpportunityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ProductOpportunityPageV1> {
    if (!input.tenantId)
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    const pageSize = parsePageSize(input.pageSize);
    const cursor = input.cursor
      ? decodeKeysetCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      after: cursor ? { createdAt: cursor.at, id: cursor.id } : undefined,
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    return {
      contractVersion: "product-opportunity-page.v1",
      items,
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeKeysetCursor(
              input.tenantId,
              new Date(last.handoff.createdAt),
              last.handoff.handoffId,
            )
          : null,
    };
  }
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 100) invalid("pageSize");
  return parsed;
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
