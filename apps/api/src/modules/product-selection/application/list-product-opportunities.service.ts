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
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      after,
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
          ? encodeCursor(
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

function encodeCursor(tenantId: string, createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ tenantId, createdAt: createdAt.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(
  value: string,
  tenantId: string,
): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      invalid("cursor");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) invalid("cursor");
    return { createdAt, id: parsed.id };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid("cursor");
  }
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
