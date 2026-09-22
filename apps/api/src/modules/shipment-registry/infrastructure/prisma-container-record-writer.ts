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
    // 箱号存在时优先复用物理货柜，使另一备货单可以通过装载分配加入同一柜。
    // 箱号迟绑定时才回退旧单号；两种键都可能存在历史歧义，因此最多取两条并明确失败。
    const lookup = command.containerNumber
      ? { tenantId: command.tenantId, containerNumber: command.containerNumber }
      : { tenantId: command.tenantId, orderNumber: command.orderNumber };
    const matches = await this.prisma.containerRecord.findMany({
      where: lookup,
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
