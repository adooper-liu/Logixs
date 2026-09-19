import { describe, expect, it, vi } from "vitest";
import type { ContainerRepository } from "../domain/container.repository";
import { ResolveContainerByNumberService } from "./resolve-container-by-number.service";

function buildService(candidateIds: string[]) {
  const repository = {
    findIdsByContainerNumber: vi.fn().mockResolvedValue(candidateIds),
  } as unknown as ContainerRepository;
  return {
    repository,
    service: new ResolveContainerByNumberService(repository),
  };
}

describe("ResolveContainerByNumberService", () => {
  it("租户内唯一命中时返回稳定货柜 ID", async () => {
    const { service, repository } = buildService(["container-1"]);

    await expect(
      service.execute({
        tenantId: " tenant-1 ",
        containerNumber: " test0000001 ",
      }),
    ).resolves.toEqual({ state: "resolved", containerId: "container-1" });
    expect(repository.findIdsByContainerNumber).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerNumber: "test0000001",
      take: 2,
    });
  });

  it("没有匹配货柜时返回待复核的 not_found", async () => {
    const { service } = buildService([]);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        containerNumber: "TEST0000001",
      }),
    ).resolves.toEqual({ state: "not_found", containerId: null });
  });

  it("同租户箱号命中多条历史记录时拒绝猜测", async () => {
    const { service } = buildService(["container-1", "container-2"]);

    await expect(
      service.execute({
        tenantId: "tenant-1",
        containerNumber: "TEST0000001",
      }),
    ).resolves.toEqual({ state: "ambiguous", containerId: null });
  });

  it("缺少租户时不查询跨租户对象", async () => {
    const { service, repository } = buildService([]);

    await expect(
      service.execute({ tenantId: " ", containerNumber: "TEST0000001" }),
    ).rejects.toMatchObject({ message: "AUTHORIZATION_SCOPE_DENIED" });
    expect(repository.findIdsByContainerNumber).not.toHaveBeenCalled();
  });
});
