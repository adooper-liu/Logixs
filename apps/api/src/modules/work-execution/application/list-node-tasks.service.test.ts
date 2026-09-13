import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { encodeTaskCursor } from "../domain/task-page";
import type { NodeTaskWithWorkOrders } from "../domain/work-execution.repository";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";
import { ListNodeTasksService } from "./list-node-tasks.service";
const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

function taskBundle(id: string, createdAt: string): NodeTaskWithWorkOrders {
  return {
    task: {
      id,
      flowInstanceId: "f1",
      nodeInstanceId: `n-${id}`,
      nodeCode: "container_stuffing",
      containerId: "c1",
      taskDefinitionKey: "node-container_stuffing",
      state: "pending",
      createdAt: new Date(createdAt),
    },
    workOrders: [],
    outcome: null,
  };
}

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      ListNodeTasksService,
      { provide: WORK_EXECUTION_REPOSITORY, useValue: repository },
      {
        provide: ASSERT_CONTAINER_TENANT,
        useValue: { execute: vi.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();
  return module.get(ListNodeTasksService);
}

describe("ListNodeTasksService", () => {
  it("缺租户拒绝", async () => {
    const service = await buildService({
      listTasksByContainer: vi.fn(),
      listTasksByTenant: vi.fn(),
    });
    await expect(service.execute({ containerId: "c1" })).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
  });

  it("无 containerId 按租户列，不写货柜", async () => {
    const first = taskBundle("t1", "2026-09-12T10:00:00Z");
    const second = taskBundle("t2", "2026-09-12T11:00:00Z");
    const repository = {
      listTasksByContainer: vi.fn(),
      listTasksByTenant: vi.fn().mockResolvedValue([first, second]),
    };
    const service = await buildService(repository);
    const page = await service.execute({ tenantId: "t1", pageSize: "1" });
    expect(page.items.map((item) => item.task.id)).toEqual(["t1"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.nextCursor).toBe(
      encodeTaskCursor({
        tenantId: "t1",
        createdAt: first.task.createdAt,
        id: first.task.id,
      }),
    );
    expect(repository.listTasksByContainer).not.toHaveBeenCalled();
    expect(repository.listTasksByTenant).toHaveBeenCalledWith({
      tenantId: "t1",
      after: undefined,
      take: 2,
    });
  });

  it("租户 cursor 与租户不一致拒绝", async () => {
    const repository = {
      listTasksByContainer: vi.fn(),
      listTasksByTenant: vi.fn(),
    };
    const service = await buildService(repository);
    const cursor = encodeTaskCursor({
      tenantId: "other",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      id: "t1",
    });
    await expect(service.execute({ tenantId: "t1", cursor })).rejects.toThrow(
      "VALIDATION_FORMAT",
    );
    expect(repository.listTasksByTenant).not.toHaveBeenCalled();
  });

  it("pageSize 超过 200 拒绝", async () => {
    const service = await buildService({
      listTasksByContainer: vi.fn(),
    });
    await expect(
      service.execute({ containerId: "c1", tenantId: "t1", pageSize: "201" }),
    ).rejects.toThrow("VALIDATION_FORMAT");
  });

  it("cursor 与 containerId 不一致拒绝，不退回第一页", async () => {
    const repository = { listTasksByContainer: vi.fn() };
    const service = await buildService(repository);
    const cursor = encodeTaskCursor({
      containerId: "other",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      id: "t1",
    });

    await expect(
      service.execute({ containerId: "c1", tenantId: "t1", cursor }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(repository.listTasksByContainer).not.toHaveBeenCalled();
  });

  it("按页返回并给出下一页 cursor", async () => {
    const first = taskBundle("t1", "2026-09-12T10:00:00Z");
    const second = taskBundle("t2", "2026-09-12T11:00:00Z");
    const third = taskBundle("t3", "2026-09-12T12:00:00Z");
    const repository = {
      listTasksByContainer: vi.fn().mockResolvedValue([first, second, third]),
    };
    const service = await buildService(repository);

    const page = await service.execute({
      containerId: "c1",
      tenantId: "t1",
      pageSize: "2",
    });

    expect(page.items.map((item) => item.task.id)).toEqual(["t1", "t2"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.pageSize).toBe(2);
    expect(page.pageInfo.nextCursor).toBe(
      encodeTaskCursor({
        containerId: "c1",
        createdAt: second.task.createdAt,
        id: second.task.id,
      }),
    );
    expect(page.projectionVersion).toBe(0);
    expect(repository.listTasksByContainer).toHaveBeenCalledWith({
      containerId: "c1",
      after: undefined,
      take: 3,
    });
  });

  it("带 cursor 时从 after 继续取", async () => {
    const second = taskBundle("t2", "2026-09-12T11:00:00Z");
    const repository = {
      listTasksByContainer: vi.fn().mockResolvedValue([second]),
    };
    const service = await buildService(repository);
    const cursor = encodeTaskCursor({
      containerId: "c1",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      id: "t1",
    });

    const page = await service.execute({
      containerId: "c1",
      tenantId: "t1",
      cursor,
    });

    expect(page.items.map((item) => item.task.id)).toEqual(["t2"]);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(repository.listTasksByContainer).toHaveBeenCalledWith({
      containerId: "c1",
      after: {
        createdAt: new Date("2026-09-12T10:00:00Z"),
        id: "t1",
      },
      take: 51,
    });
  });

  it("无任务时返回空页", async () => {
    const service = await buildService({
      listTasksByContainer: vi.fn().mockResolvedValue([]),
    });

    const page = await service.execute({ containerId: "c1", tenantId: "t1" });

    expect(page.items).toEqual([]);
    expect(page.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
      pageSize: 50,
    });
  });
});
