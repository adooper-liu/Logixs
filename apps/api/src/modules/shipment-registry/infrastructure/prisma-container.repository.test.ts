import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaContainerRepository } from "./prisma-container.repository";

function buildPrisma() {
  return {
    shipmentTimeFact: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "fact-known",
          factCode: "container_unloading_completed",
          eventCode: "unloaded",
          timeKind: "actual",
          captureSource: "controlled_import",
          evidenceRef: "11111111-1111-4111-8111-111111111111",
        },
        {
          id: "fact-unknown",
          factCode: "future_unknown_fact",
          eventCode: "future_unknown_event",
          timeKind: "actual",
          captureSource: "controlled_import",
          evidenceRef: "22222222-2222-4222-8222-222222222222",
        },
        {
          id: "fact-no-default",
          factCode: "hold_recorded",
          eventCode: "hold",
          timeKind: "estimated",
          captureSource: "provider_payload",
          evidenceRef: null,
        },
      ]),
    },
  };
}

async function buildRepository(prisma: ReturnType<typeof buildPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      PrismaContainerRepository,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaContainerRepository);
}

describe("PrismaContainerRepository.listCurrentTaskFacts", () => {
  it("按规范事件目录解析节点，未知或无默认节点的事件保持 null", async () => {
    const prisma = buildPrisma();
    const repository = await buildRepository(prisma);

    await expect(
      repository.listCurrentTaskFacts({
        id: "container-1",
        tenantId: "tenant-1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "fact-known",
        eventCode: "unloaded",
        nodeCode: "container_unloading",
      }),
      expect.objectContaining({
        id: "fact-unknown",
        eventCode: "future_unknown_event",
        nodeCode: null,
      }),
      expect.objectContaining({
        id: "fact-no-default",
        eventCode: "hold",
        nodeCode: null,
      }),
    ]);
    expect(prisma.shipmentTimeFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ eventCode: true }),
      }),
    );
  });
});
