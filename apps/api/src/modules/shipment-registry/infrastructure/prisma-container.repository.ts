import type { ContainerLifecycleState } from "@logix/contracts";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ContainerSummary } from "../domain/container-summary";
import type { ContainerRepository } from "../domain/container.repository";

@Injectable()
export class PrismaContainerRepository implements ContainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ContainerSummary[]> {
    const rows = await this.prisma.containerRecord.findMany({
      orderBy: { updatedAt: "desc" },
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
}
