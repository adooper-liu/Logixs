import { describe, expect, it, vi } from "vitest";
import { ListObjectActivitiesService } from "./list-object-activities.service";

function build() {
  const lifecycle = {
    findContainerBase: vi.fn().mockResolvedValue({
      tenantId: "tenant-1",
      orderNumber: "SO-1",
      containerNumber: "MSCU1234567",
      currentStatus: "in_transit",
    }),
    listEvents: vi.fn().mockResolvedValue([
      {
        id: "event-1",
        containerId: "container-1",
        eventCode: "vessel_departed",
        occurredAt: new Date("2026-09-17T03:00:00.000Z"),
        recordedAt: new Date("2026-09-17T03:01:00.000Z"),
        evidenceRefs: [],
      },
    ]),
  };
  const notifications = {
    execute: vi.fn().mockResolvedValue([
      {
        id: "notification-1",
        tenantId: "tenant-1",
        problemCode: "eta_drift",
        severity: "high",
        title: "ETA 发生漂移",
        body: "请复核",
        entityType: "node_task",
        entityId: "task-1",
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: "work-order-1",
        recipientRoleCodes: ["operations_dispatcher"],
        conversationHint: null,
        occurredAt: new Date("2026-09-17T02:00:00.000Z"),
        createdAt: new Date("2026-09-17T02:01:00.000Z"),
      },
    ]),
  };
  const taskActivity = {
    execute: vi.fn().mockResolvedValue({
      activities: [
        {
          id: "task:task-1:created",
          activityCode: "task_created",
          sourceType: "node_task",
          sourceId: "task-1",
          occurredAt: new Date("2026-09-17T01:00:00.000Z"),
          recordedAt: new Date("2026-09-17T01:00:00.000Z"),
          containerId: "container-1",
          taskId: "task-1",
          workOrderId: null,
          actorId: null,
          nodeCode: "customs_clearance",
          taskDefinitionKey: "node-customs-clearance",
          workOrderDefinitionKey: null,
        },
        {
          id: "operation:operation-1",
          activityCode: "work_order_claimed",
          sourceType: "client_operation",
          sourceId: "operation-1",
          occurredAt: new Date("2026-09-17T01:30:00.000Z"),
          recordedAt: new Date("2026-09-17T01:30:01.000Z"),
          containerId: "container-1",
          taskId: "task-1",
          workOrderId: "work-order-1",
          actorId: "operator-1",
          nodeCode: "customs_clearance",
          taskDefinitionKey: "node-customs-clearance",
          workOrderDefinitionKey: "wo-customs-clearance",
        },
      ],
      nextActions: [],
      targets: [
        {
          containerId: "container-1",
          taskId: "task-1",
          workOrderId: "work-order-1",
        },
      ],
    }),
  };
  return {
    lifecycle,
    notifications,
    taskActivity,
    service: new ListObjectActivitiesService(
      lifecycle as never,
      notifications as never,
      taskActivity as never,
    ),
  };
}

describe("ListObjectActivitiesService", () => {
  it("merges authorized sources and only links confirmed task references", async () => {
    const { service } = build();
    const page = await service.execute({
      tenantId: "tenant-1",
      containerId: "container-1",
      actorRoles: ["operations_dispatcher"],
      actorCapabilities: ["task.read", "notification.read"],
      pageSize: "10",
    });

    expect(page.items.map((item) => item.id)).toEqual([
      "lifecycle:event-1",
      "notification:notification-1",
      "operation:operation-1",
      "task:task-1:created",
    ]);
    expect(page.items[1]?.targetPath).toBe(
      "/tasks?containerId=container-1&task=task-1",
    );
  });

  it("does not query notification or task sources without capabilities", async () => {
    const { service, notifications, taskActivity } = build();
    const page = await service.execute({
      tenantId: "tenant-1",
      containerId: "container-1",
      actorRoles: ["finance_controller"],
      actorCapabilities: [],
    });

    expect(notifications.execute).not.toHaveBeenCalled();
    expect(taskActivity.execute).not.toHaveBeenCalled();
    expect(page.items).toHaveLength(1);
  });

  it("hides cross-tenant container existence", async () => {
    const { service, lifecycle } = build();
    lifecycle.findContainerBase.mockResolvedValue({ tenantId: "tenant-2" });
    await expect(
      service.execute({
        tenantId: "tenant-1",
        containerId: "container-1",
        actorRoles: [],
        actorCapabilities: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
