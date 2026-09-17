import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ApplyContainerRecordCommand,
  ApplyContainerRecordResult,
  ContainerRecordWriter,
} from "../domain/apply-container-record";

@Injectable()
export class PrismaContainerRecordWriter implements ContainerRecordWriter {
  // 显式 @Inject：vitest/esbuild 不 emit 参数类型 metadata，靠类型无法解析。
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async apply(
    command: ApplyContainerRecordCommand,
  ): Promise<ApplyContainerRecordResult> {
    // orderNumber 尚未建 UNIQUE（DATA_MODEL 不变量 1：清洗通过后才建），用 findFirst 匹配。
    const matches = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: command.tenantId,
        orderNumber: command.orderNumber,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 2,
    });
    if (matches.length > 1) {
      throw new ConflictException("LEGACY_ORDER_CONTAINER_CONFLICT");
    }
    const existing = matches[0];

    if (existing) {
      const updated = await this.prisma.containerRecord.update({
        where: { id: existing.id },
        data: {
          containerNumber: command.containerNumber ?? existing.containerNumber,
          currentStatus: command.currentStatus,
        },
      });
      return { containerRecordId: updated.id, created: false };
    }

    const created = await this.prisma.containerRecord.create({
      data: {
        tenantId: command.tenantId,
        orderNumber: command.orderNumber,
        containerNumber: command.containerNumber,
        currentStatus: command.currentStatus,
      },
    });
    return { containerRecordId: created.id, created: true };
  }
}
