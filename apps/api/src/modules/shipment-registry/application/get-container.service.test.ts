import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CONTAINER_REPOSITORY } from "../domain/container.repository";
import { GetContainerService } from "./get-container.service";

const SUMMARY = {
  id: "c1",
  orderNumber: "SO-1",
  containerNumber: "MSKU1",
  currentStatus: "in_transit" as const,
  updatedAt: "2026-09-13T03:00:00.000Z",
};

async function buildService(findById: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      GetContainerService,
      {
        provide: CONTAINER_REPOSITORY,
        useValue: {
          list: vi.fn(),
          findById,
          findTenantId: vi.fn(),
        },
      },
    ],
  }).compile();
  return module.get(GetContainerService);
}

describe("GetContainerService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const findById = vi.fn();
    const service = await buildService(findById);
    await expect(service.execute({ id: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it("同租户可读", async () => {
    const service = await buildService(vi.fn().mockResolvedValue(SUMMARY));
    const record = await service.execute({ tenantId: "t1", id: "c1" });
    expect(record).toEqual(SUMMARY);
  });

  it("不存在或跨租户 → RESOURCE_NOT_FOUND", async () => {
    const service = await buildService(vi.fn().mockResolvedValue(null));
    await expect(
      service.execute({ tenantId: "t1", id: "missing" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("空 id → RESOURCE_NOT_FOUND", async () => {
    const findById = vi.fn();
    const service = await buildService(findById);
    await expect(service.execute({ tenantId: "t1", id: "  " })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
