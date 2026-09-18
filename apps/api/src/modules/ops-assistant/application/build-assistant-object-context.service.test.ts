import { describe, expect, it, vi } from "vitest";
import { BuildAssistantObjectContextService } from "./build-assistant-object-context.service";

const SUMMARY = {
  id: "container-1",
  orderNumber: "SO-1",
  containerNumber: "MSKU1",
  currentStatus: "in_transit" as const,
  updatedAt: "2026-09-18T01:00:00.000Z",
};

describe("BuildAssistantObjectContextService", () => {
  it("reuses server projections for summary, current node and next actions", async () => {
    const service = new BuildAssistantObjectContextService(
      { execute: vi.fn().mockResolvedValue(SUMMARY) } as never,
      {
        execute: vi.fn().mockResolvedValue({
          items: [
            {
              containerId: "container-1",
              currentNodeCode: "customs_clearance",
              flowState: "active",
            },
          ],
        }),
      } as never,
      {
        execute: vi.fn().mockResolvedValue({
          activities: [],
          targets: [],
          nextActions: [
            {
              actionCode: "work_execution.claim_work_order",
              containerId: "container-1",
              taskId: "task-1",
              workOrderId: "work-order-1",
              nodeCode: "customs_clearance",
              taskDefinitionKey: "task-customs",
              workOrderDefinitionKey: "work-customs",
              assignmentState: "pool",
              assigneeId: null,
              dueAt: new Date("2026-09-19T01:00:00.000Z"),
            },
          ],
        }),
      } as never,
    );

    const context = await service.execute({
      tenantId: "tenant-1",
      containerId: "container-1",
      actorCapabilities: [
        "container.read",
        "lifecycle.read",
        "task.read",
        "task.execute",
      ],
    });

    expect(context.summary.currentNodeCode).toBe("customs_clearance");
    expect(context.allowedActions).toEqual([
      expect.objectContaining({
        actionCode: "work_execution.claim_work_order",
        actorCanExecute: true,
        dueAt: "2026-09-19T01:00:00.000Z",
        targetPath: "/tasks?containerId=container-1&task=task-1",
      }),
    ]);
    expect(context.readOnlyPolicy.assistantCanExecute).toBe(false);
  });

  it("does not query or expose task and lifecycle data without read capabilities", async () => {
    const currentNodes = { execute: vi.fn() };
    const taskActivity = { execute: vi.fn() };
    const service = new BuildAssistantObjectContextService(
      { execute: vi.fn().mockResolvedValue(SUMMARY) } as never,
      currentNodes as never,
      taskActivity as never,
    );

    const context = await service.execute({
      tenantId: "tenant-1",
      containerId: "container-1",
      actorCapabilities: ["container.read"],
    });

    expect(currentNodes.execute).not.toHaveBeenCalled();
    expect(taskActivity.execute).not.toHaveBeenCalled();
    expect(context.summary.currentNodeCode).toBeNull();
    expect(context.allowedActions).toEqual([]);
    expect(context.actionSummary).toContain("无任务查看权限");
  });

  it("hides an object when container.read is absent", async () => {
    const containers = { execute: vi.fn() };
    const service = new BuildAssistantObjectContextService(
      containers as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );
    await expect(
      service.execute({
        tenantId: "tenant-1",
        containerId: "container-1",
        actorCapabilities: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(containers.execute).not.toHaveBeenCalled();
  });
});
