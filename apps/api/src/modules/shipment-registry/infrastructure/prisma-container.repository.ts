import type { ContainerLifecycleState } from "@logix/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ContainerSummary } from "../domain/container-summary";
import type {
  ContainerListQuery,
  ContainerRepository,
} from "../domain/container.repository";

@Injectable()
export class PrismaContainerRepository implements ContainerRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ContainerListQuery): Promise<ContainerSummary[]> {
    const rows = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.after
          ? {
              OR: [
                { updatedAt: { lt: query.after.updatedAt } },
                {
                  AND: [
                    { updatedAt: query.after.updatedAt },
                    { id: { lt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      containerNumber: row.containerNumber,
      // DB enum 与契约枚举值一致（G7 parity 门禁校验），显式映射而非偶然同名。
      currentStatus: row.currentStatus as ContainerLifecycleState,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async findTenantId(containerId: string): Promise<string | null> {
    const row = await this.prisma.containerRecord.findUnique({
      where: { id: containerId },
      select: { tenantId: true },
    });
    return row?.tenantId ?? null;
  }
}
