import { Test } from "@nestjs/testing";
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
      create: vi
        .fn()
        .mockResolvedValue({ id: "c2", containerNumber: "MSKU-NEW" }),
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
  orderNumber: "SO-1",
  containerNumber: "MSKU-NEW",
  currentStatus: "shipped" as const,
};

describe("PrismaContainerRecordWriter", () => {
  it("命中 → 更新，created=false", async () => {
    const prisma = buildPrisma({ id: "c1", containerNumber: "MSKU-OLD" });
    const { writer } = await buildService(prisma);

    const result = await writer.apply(command);

    expect(result.created).toBe(false);
    expect(result.containerRecordId).toBe("c1");
    expect(prisma.containerRecord.update).toHaveBeenCalled();
    expect(prisma.containerRecord.create).not.toHaveBeenCalled();
  });

  it("未命中 → 新建，created=true", async () => {
    const prisma = buildPrisma(null);
    const { writer } = await buildService(prisma);

    const result = await writer.apply(command);

    expect(result.created).toBe(true);
    expect(result.containerRecordId).toBe("c2");
    expect(prisma.containerRecord.create).toHaveBeenCalled();
  });
});
