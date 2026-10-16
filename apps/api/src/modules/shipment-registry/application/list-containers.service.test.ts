import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { encodeContainerCursor } from "../domain/container-page";
import { CONTAINER_REPOSITORY } from "../domain/container.repository";
import { ListContainersService } from "./list-containers.service";

function summary(id: string, updatedAt: string) {
  return {
    id,
    orderNumber: `SO-${id}`,
    containerNumber: `MSKU-${id}`,
    currentStatus: "in_transit" as const,
    updatedAt,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      ListContainersService,
      { provide: CONTAINER_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(ListContainersService);
}

describe("ListContainersService", () => {
  it("缺少租户 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const list = vi.fn();
    const service = await buildService({ list });
    await expect(service.execute({})).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(list).not.toHaveBeenCalled();
  });

  it("pageSize 超过 200 拒绝", async () => {
    const list = vi.fn();
    const service = await buildService({ list });
    await expect(
      service.execute({ tenantId: "dev-tenant", pageSize: "201" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(list).not.toHaveBeenCalled();
  });

  it("cursor 与租户不一致拒绝，不退回第一页", async () => {
    const list = vi.fn();
    const service = await buildService({ list });
    const cursor = encodeContainerCursor({
      tenantId: "other",
      updatedAt: new Date("2026-09-12T10:00:00Z"),
      id: "c1",
      scope: "all",
    });

    await expect(
      service.execute({ tenantId: "dev-tenant", cursor }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(list).not.toHaveBeenCalled();
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = summary("c1", "2026-09-12T12:00:00.000Z");
    const second = summary("c2", "2026-09-12T11:00:00.000Z");
    const third = summary("c3", "2026-09-12T10:00:00.000Z");
    const list = vi.fn().mockResolvedValue([first, second, third]);
    const service = await buildService({ list });

    const page = await service.execute({
      tenantId: "dev-tenant",
      pageSize: "2",
    });

    expect(page.items.map((item) => item.id)).toEqual(["c1", "c2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.pageSize).toBe(2);
    expect(page.pageInfo.nextCursor).toBe(
      encodeContainerCursor({
        tenantId: "dev-tenant",
        updatedAt: new Date(second.updatedAt),
        id: second.id,
      }),
    );
    expect(page.projectionVersion).toBe(0);
    expect(list).toHaveBeenCalledWith({
      tenantId: "dev-tenant",
      after: undefined,
      take: 3,
      scope: "all",
    });
  });

  it("带 cursor 时从 after 继续取", async () => {
    const second = summary("c2", "2026-09-12T11:00:00.000Z");
    const list = vi.fn().mockResolvedValue([second]);
    const service = await buildService({ list });
    const cursor = encodeContainerCursor({
      tenantId: "dev-tenant",
      updatedAt: new Date("2026-09-12T12:00:00.000Z"),
      id: "c1",
      scope: "all",
    });

    const page = await service.execute({ tenantId: "dev-tenant", cursor });

    expect(page.items.map((item) => item.id)).toEqual(["c2"]);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(list).toHaveBeenCalledWith({
      tenantId: "dev-tenant",
      after: {
        updatedAt: new Date("2026-09-12T12:00:00.000Z"),
        id: "c1",
      },
      take: 51,
      scope: "all",
    });
  });

  it("binds the stuffing snapshot scope into the cursor and repository query", async () => {
    const row = summary("c1", "2026-09-12T12:00:00.000Z");
    const list = vi.fn().mockResolvedValue([row]);
    const service = await buildService({ list });

    await service.execute({
      tenantId: "dev-tenant",
      scope: "active_stuffing_snapshot",
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: "dev-tenant",
      after: undefined,
      take: 51,
      scope: "active_stuffing_snapshot",
    });
    const wrongScopeCursor = encodeContainerCursor({
      tenantId: "dev-tenant",
      updatedAt: new Date(row.updatedAt),
      id: row.id,
      scope: "all",
    });
    await expect(
      service.execute({
        tenantId: "dev-tenant",
        scope: "active_stuffing_snapshot",
        cursor: wrongScopeCursor,
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });

  it("无货柜时返回空页", async () => {
    const service = await buildService({
      list: vi.fn().mockResolvedValue([]),
    });

    const page = await service.execute({ tenantId: "dev-tenant" });

    expect(page.items).toEqual([]);
    expect(page.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
      pageSize: 50,
    });
  });
});
