import { Test } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaContainerRecordWriter } from "./prisma-container-record-writer";

function buildPrisma(
  existing: { id: string; containerNumber: string | null } | null,
) {
  return {
    containerRecord: {
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue({
        id: existing?.id ?? "c1",
        containerNumber: "MSKU-NEW",
      }),
    },
  };
}

async function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      PrismaContainerRecordWriter,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return { writer: module.get(PrismaContainerRecordWriter), prisma };
}

const command = {
  tenantId: "t1",
  containerRecordId: "c1",
  containerNumber: "MSKU-NEW",
  currentStatus: "shipped" as const,
};

describe("PrismaContainerRecordWriter", () => {
  it("按稳定货柜 ID 命中并更新", async () => {
    const prisma = buildPrisma({ id: "c1", containerNumber: "MSKU-NEW" });
    const { writer } = await buildService(prisma);

    const result = await writer.apply(command);

    expect(result.created).toBe(false);
    expect(result.containerRecordId).toBe("c1");
    expect(prisma.containerRecord.update).toHaveBeenCalled();
    expect(prisma.containerRecord.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", tenantId: "t1" },
    });
  });

  it("稳定货柜 ID 未命中时拒绝创建新实例", async () => {
    const prisma = buildPrisma(null);
    const { writer } = await buildService(prisma);

    await expect(writer.apply(command)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.containerRecord.update).not.toHaveBeenCalled();
  });

  it("稳定货柜已有不同箱号时拒绝静默覆盖", async () => {
    const prisma = buildPrisma({ id: "c1", containerNumber: "MSKU-OLD" });
    const { writer } = await buildService(prisma);

    await expect(writer.apply(command)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.containerRecord.update).not.toHaveBeenCalled();
  });
});
