import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ActiveShipmentContainerMatch,
  MatchActiveShipmentByContainerPort,
} from "../match-active-shipment-by-container.port";

@Injectable()
export class PrismaActiveShipmentByContainerMatcher implements MatchActiveShipmentByContainerPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async matchByContainerNumbers(
    tenantId: string,
    containerNumbers: readonly string[],
    context?: {
      excludeSourceSystem: string;
      excludeExternalHandoffPrefix: string;
    },
  ): Promise<ActiveShipmentContainerMatch[]> {
    const requested = containerNumbers.map(normalizeContainerNumber);
    const uniqueNumbers = [...new Set(requested.filter(Boolean))];
    const links = uniqueNumbers.length
      ? await this.prisma.shipmentContainerLink.findMany({
          where: {
            tenantId,
            state: "active",
            shipment: {
              currentLifecycleStatus: "departed",
              ...(context
                ? {
                    handoffs: {
                      none: {
                        sourceSystem: context.excludeSourceSystem,
                        externalHandoffId: {
                          startsWith: context.excludeExternalHandoffPrefix,
                        },
                      },
                    },
                  }
                : {}),
            },
            containerRecord: {
              containerNumber: { in: uniqueNumbers, mode: "insensitive" },
            },
          },
          orderBy: [{ containerRecordId: "asc" }, { id: "asc" }],
          select: {
            containerRecord: { select: { containerNumber: true } },
            shipment: {
              select: {
                id: true,
                shipmentNumber: true,
                relationshipVersion: true,
              },
            },
          },
        })
      : [];
    const matchesByNumber = new Map<string, typeof links>();
    for (const link of links) {
      const key = normalizeContainerNumber(
        link.containerRecord.containerNumber,
      );
      const matches = matchesByNumber.get(key) ?? [];
      matches.push(link);
      matchesByNumber.set(key, matches);
    }

    return containerNumbers.map((containerNumber, index) => {
      const matches = matchesByNumber.get(requested[index] ?? "") ?? [];
      if (matches.length === 0) return { containerNumber, state: "not_found" };
      if (matches.length > 1) return { containerNumber, state: "conflict" };
      const shipment = matches[0]!.shipment;
      return {
        containerNumber,
        state: "matched",
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        relationshipVersion: shipment.relationshipVersion,
      };
    });
  }
}

function normalizeContainerNumber(value: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}
