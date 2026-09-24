import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  ResolveReplenishmentOrderLinesPort,
  ResolvedReplenishmentOrderLine,
} from "../resolve-replenishment-order-lines.port";
import {
  REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY,
  type ReplenishmentOrderWorkbenchRepository,
} from "../domain/replenishment-order-workbench.repository";

@Injectable()
export class ResolveReplenishmentOrderLinesService implements ResolveReplenishmentOrderLinesPort {
  constructor(
    @Inject(REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY)
    private readonly repository: ReplenishmentOrderWorkbenchRepository,
  ) {}

  execute(input: {
    tenantId: string;
    identities: Array<{
      replenishmentOrderNumber: string;
      productNumber: string;
    }>;
  }): Promise<ResolvedReplenishmentOrderLine[]> {
    const tenantId = normalize(input.tenantId, 128);
    if (!Array.isArray(input.identities) || input.identities.length > 1000) {
      throw new BadRequestException("REPLENISHMENT_LINE_LOOKUP_INVALID");
    }
    const identities = [
      ...new Map(
        input.identities.map((identity) => {
          const normalized = {
            replenishmentOrderNumber: normalize(
              identity.replenishmentOrderNumber,
              100,
            ),
            productNumber: normalize(identity.productNumber, 200),
          };
          return [
            `${normalized.replenishmentOrderNumber}\u0000${normalized.productNumber}`,
            normalized,
          ];
        }),
      ).values(),
    ];
    if (identities.length === 0) return Promise.resolve([]);
    return this.repository.resolveCurrentLines({ tenantId, identities });
  }
}

function normalize(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    throw new BadRequestException("REPLENISHMENT_LINE_LOOKUP_INVALID");
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequestException("REPLENISHMENT_LINE_LOOKUP_INVALID");
  }
  return normalized;
}
