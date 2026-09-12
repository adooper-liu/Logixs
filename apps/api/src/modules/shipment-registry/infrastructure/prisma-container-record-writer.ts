import { Inject, Injectable } from "@nestjs/common";
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
    const existing = await this.prisma.containerRecord.findFirst({
      where: { orderNumber: command.orderNumber },
    });

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
