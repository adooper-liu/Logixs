import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import {
  WORK_EXECUTION_REPOSITORY,
  type NodeTaskWithWorkOrders,
} from "../domain/work-execution.repository";
import { GetNodeTaskService } from "./get-node-task.service";

const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");

function bundle(input: {
  tenantId: string;
  containerId: string | null;
}): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "task-1",
      tenantId: input.tenantId,
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "cargo_ready",
      containerId: input.containerId,
      taskDefinitionKey: "cargo_ready.confirm",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      version: 0,
      createdAt: new Date("2026-09-30T00:00:00.000Z"),
    },
    workOrders: [],
    outcome: null,
  };
}

async function buildService(
  found: NodeTaskWithWorkOrders | null,
  assertContainerTenant = vi.fn().mockResolvedValue(undefined),
) {
  const findTaskById = vi.fn().mockResolvedValue(found);
  const findTaskInTenant = vi.fn(
    async (query: { taskId: string; tenantId: string }) =>
      found &&
      found.task.id === query.taskId &&
      found.task.tenantId === query.tenantId
        ? found
        : null,
  );
  const module = await Test.createTestingModule({
    providers: [
      GetNodeTaskService,
      {
        provide: WORK_EXECUTION_REPOSITORY,
        useValue: { findTaskById, findTaskInTenant },
      },
      {
        provide: ASSERT_CONTAINER_TENANT,
        useValue: { execute: assertContainerTenant },
      },
    ],
  }).compile();
  return {
    service: module.get(GetNodeTaskService),
    findTaskById,
    findTaskInTenant,
    assertContainerTenant,
  };
}

describe("GetNodeTaskService", () => {
  it("同租户无柜任务可读", async () => {
    const task = bundle({ tenantId: "t1", containerId: null });
    const { service, assertContainerTenant } = await buildService(task);

    await expect(service.execute("task-1", "t1")).resolves.toBe(task);
    expect(assertContainerTenant).not.toHaveBeenCalled();
  });

  it("跨租户无柜任务表现为不存在，且不加载无范围聚合", async () => {
    const { service, assertContainerTenant, findTaskById, findTaskInTenant } =
      await buildService(bundle({ tenantId: "t1", containerId: null }));

    await expect(service.execute("task-1", "t2")).resolves.toBeNull();
    expect(findTaskInTenant).toHaveBeenCalledWith({
      taskId: "task-1",
      tenantId: "t2",
    });
    expect(findTaskById).not.toHaveBeenCalled();
    expect(assertContainerTenant).not.toHaveBeenCalled();
  });

  it("跨租户带柜任务表现为不存在，且不再探测货柜", async () => {
    const { service, assertContainerTenant } = await buildService(
      bundle({ tenantId: "t1", containerId: "c1" }),
    );

    await expect(service.execute("task-1", "t2")).resolves.toBeNull();
    expect(assertContainerTenant).not.toHaveBeenCalled();
  });

  it("同租户带柜任务保留父货柜租户断言", async () => {
    const task = bundle({ tenantId: "t1", containerId: "c1" });
    const { service, assertContainerTenant } = await buildService(task);

    await expect(service.execute("task-1", "t1")).resolves.toBe(task);
    expect(assertContainerTenant).toHaveBeenCalledWith({
      containerId: "c1",
      tenantId: "t1",
    });
  });

  it("父货柜租户断言失败时拒绝", async () => {
    const { service } = await buildService(
      bundle({ tenantId: "t1", containerId: "c1" }),
      vi.fn().mockRejectedValue(new Error("AUTHORIZATION_SCOPE_DENIED")),
    );

    await expect(service.execute("task-1", "t1")).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
  });

  it("任务不存在返回 null", async () => {
    const { service } = await buildService(null);

    await expect(service.execute("missing", "t1")).resolves.toBeNull();
  });

  it.each(["", "   "])("空租户 %j 拒绝且不查询任务", async (tenantId) => {
    const { service, findTaskById, findTaskInTenant } = await buildService(
      bundle({ tenantId: "t1", containerId: null }),
    );

    await expect(service.execute("task-1", tenantId)).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    expect(findTaskById).not.toHaveBeenCalled();
    expect(findTaskInTenant).not.toHaveBeenCalled();
  });
});
