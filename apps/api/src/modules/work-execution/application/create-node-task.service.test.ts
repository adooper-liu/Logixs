import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";
const ASSERT_CONTAINER_TENANT = Symbol.for("logix.AssertContainerTenant");
import { CreateNodeTaskService } from "./create-node-task.service";

function existingBundle() {
  return {
    task: {
      id: "t1",
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "customs_clearance" as const,
      taskDefinitionKey: "node-customs_clearance",
      state: "pending" as const,
      createdAt: new Date("2026-09-12T10:00:00Z"),
    },
    workOrders: [
      {
        id: "w1",
        nodeTaskId: "t1",
        workOrderDefinitionKey: "wo-customs_clearance",
        state: "ready" as const,
        assignmentState: "unassigned" as const,
        completedAt: null,
      },
    ],
    outcome: null,
  };
}

describe("CreateNodeTaskService", () => {
  it("未知节点码拒绝", async () => {
    const repository = {
      findTaskByNodeInstanceId: vi.fn(),
      createTaskWithRequiredWorkOrder: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        CreateNodeTaskService,
        { provide: WORK_EXECUTION_REPOSITORY, useValue: repository },
        {
          provide: ASSERT_CONTAINER_TENANT,
          useValue: { execute: vi.fn() },
        },
      ],
    }).compile();

    await expect(
      module.get(CreateNodeTaskService).execute({
        flowInstanceId: "f1",
        nodeInstanceId: "n1",
        nodeCode: "not_a_node",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(repository.createTaskWithRequiredWorkOrder).not.toHaveBeenCalled();
  });

  it("同 nodeInstanceId 重复创建返回已有任务", async () => {
    const existing = existingBundle();
    const repository = {
      findTaskByNodeInstanceId: vi.fn().mockResolvedValue(existing),
      createTaskWithRequiredWorkOrder: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        CreateNodeTaskService,
        { provide: WORK_EXECUTION_REPOSITORY, useValue: repository },
        {
          provide: ASSERT_CONTAINER_TENANT,
          useValue: { execute: vi.fn() },
        },
      ],
    }).compile();

    const result = await module.get(CreateNodeTaskService).execute({
      flowInstanceId: "f1",
      nodeInstanceId: "n1",
      nodeCode: "customs_clearance",
    });

    expect(result.task.id).toBe("t1");
    expect(repository.createTaskWithRequiredWorkOrder).not.toHaveBeenCalled();
  });
});
