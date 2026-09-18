import { describe, expect, it, vi } from "vitest";
import { ResolveNotificationTargetService } from "./resolve-notification-target.service";

describe("ResolveNotificationTargetService", () => {
  it("returns a server-confirmed task target", async () => {
    const notifications = {
      findVisible: vi.fn().mockResolvedValue({
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: "work-order-1",
      }),
    };
    const taskActivity = {
      resolveTarget: vi.fn().mockResolvedValue({
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: "work-order-1",
      }),
    };
    const lifecycle = {
      findContainerBase: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
    };
    const service = new ResolveNotificationTargetService(
      lifecycle as never,
      notifications as never,
      taskActivity as never,
    );

    await expect(
      service.execute({
        tenantId: "tenant-1",
        notificationId: "notification-1",
        actorRoles: ["operations_dispatcher"],
        actorCapabilities: ["task.read"],
      }),
    ).resolves.toEqual({
      containerId: "container-1",
      taskId: "task-1",
      workOrderId: "work-order-1",
      targetPath: "/tasks?containerId=container-1&task=task-1",
    });
  });

  it("rejects an orphaned task reference without exposing it", async () => {
    const service = new ResolveNotificationTargetService(
      {
        findContainerBase: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      } as never,
      {
        findVisible: vi.fn().mockResolvedValue({
          containerId: "container-1",
          taskId: "task-other",
          workOrderId: null,
        }),
      } as never,
      { resolveTarget: vi.fn().mockResolvedValue(null) } as never,
    );
    await expect(
      service.execute({
        tenantId: "tenant-1",
        notificationId: "notification-1",
        actorRoles: ["operations_dispatcher"],
        actorCapabilities: ["task.read"],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("does not expose a task target without task.read", async () => {
    const taskActivity = { resolveTarget: vi.fn() };
    const service = new ResolveNotificationTargetService(
      {
        findContainerBase: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      } as never,
      {
        findVisible: vi.fn().mockResolvedValue({
          containerId: "container-1",
          taskId: "task-1",
          workOrderId: null,
        }),
      } as never,
      taskActivity as never,
    );

    await expect(
      service.execute({
        tenantId: "tenant-1",
        notificationId: "notification-1",
        actorRoles: ["business_admin"],
        actorCapabilities: ["notification.read", "container.read"],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(taskActivity.resolveTarget).not.toHaveBeenCalled();
  });
});
