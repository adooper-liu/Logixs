import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ReferencePortRepository } from "../domain/reference-port.repository";
import type {
  ReferencePortRecord,
  ReferencePortSearchResult,
} from "../reference-port-directory.port";

const ACTIVE_RELEASE = {
  datasetCode: "UNLOCODE",
  status: "active",
} as const;

@Injectable()
export class PrismaReferencePortRepository implements ReferencePortRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async searchActive(input: {
    normalizedQuery: string;
    pageSize: number;
    cursor?: string;
  }): Promise<ReferencePortSearchResult> {
    const queryUpper = input.normalizedQuery.toUpperCase();
    const rows = await this.prisma.portCodeReference.findMany({
      where: {
        release: ACTIVE_RELEASE,
        ...(input.cursor ? { unlocode: { gt: input.cursor } } : {}),
        OR: [
          { unlocode: { startsWith: queryUpper } },
          {
            entries: {
              some: {
                OR: [
                  {
                    nameNormalized: {
                      contains: input.normalizedQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    nameWithoutDiacriticsNormalized: {
                      contains: input.normalizedQuery,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          },
          {
            aliases: {
              some: {
                normalizedAlias: { contains: input.normalizedQuery },
                mappingState: { in: ["candidate", "confirmed"] },
              },
            },
          },
        ],
      },
      orderBy: { unlocode: "asc" },
      take: input.pageSize + 1,
      select: {
        id: true,
        unlocode: true,
        areaCode: true,
        entries: {
          orderBy: { sourceRowNumber: "desc" },
          take: 1,
          select: { name: true },
        },
      },
    });
    const hasNextPage = rows.length > input.pageSize;
    const page = rows.slice(0, input.pageSize).map(toRecord);
    return {
      items: page,
      nextCursor: hasNextPage ? (page.at(-1)?.unlocode ?? null) : null,
    };
  }

  async findActiveByUnlocodes(
    unlocodes: string[],
  ): Promise<ReferencePortRecord[]> {
    const rows = await this.prisma.portCodeReference.findMany({
      where: {
        release: ACTIVE_RELEASE,
        unlocode: { in: unlocodes },
      },
      orderBy: { unlocode: "asc" },
      select: {
        id: true,
        unlocode: true,
        areaCode: true,
        entries: {
          orderBy: { sourceRowNumber: "desc" },
          take: 1,
          select: { name: true },
        },
      },
    });
    return rows.map(toRecord);
  }

  async findByIds(portIds: string[]): Promise<ReferencePortRecord[]> {
    const rows = await this.prisma.portCodeReference.findMany({
      where: { id: { in: portIds } },
      orderBy: { unlocode: "asc" },
      select: {
        id: true,
        unlocode: true,
        areaCode: true,
        entries: {
          orderBy: { sourceRowNumber: "desc" },
          take: 1,
          select: { name: true },
        },
      },
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: string;
  unlocode: string;
  areaCode: string;
  entries: Array<{ name: string }>;
}): ReferencePortRecord {
  return {
    portId: row.id,
    unlocode: row.unlocode,
    officialName: row.entries[0]?.name ?? row.unlocode,
    areaCode: row.areaCode,
  };
}
