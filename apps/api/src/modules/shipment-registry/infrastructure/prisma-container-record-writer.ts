import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
    const existing = await this.prisma.containerRecord.findFirst({
      where: {
        id: command.containerRecordId,
        tenantId: command.tenantId,
      },
    });
    if (!existing) {
      throw new NotFoundException("CONTAINER_NOT_FOUND");
    }
    if (
      existing.containerNumber &&
      command.containerNumber &&
      existing.containerNumber !== command.containerNumber
    ) {
      throw new ConflictException("CONTAINER_NUMBER_CONFLICT");
    }

    const updated = await this.prisma.containerRecord.update({
      where: { id: existing.id },
      data: {
        containerNumber: command.containerNumber ?? existing.containerNumber,
        currentStatus: command.currentStatus,
      },
    });
    return { containerRecordId: updated.id, created: false };
  }
}
