import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { WORKFLOW_SCHEDULE } from "../domain/workflow-schedule.port";
import { EnsureOutboxPublishSystemScheduleService } from "./ensure-outbox-publish-system-schedule.service";

async function buildService(ensure: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      EnsureOutboxPublishSystemScheduleService,
      { provide: WORKFLOW_SCHEDULE, useValue: { ensure } },
    ],
  }).compile();
  return module.get(EnsureOutboxPublishSystemScheduleService);
}

describe("EnsureOutboxPublishSystemScheduleService", () => {
  it("服务身份保证一条全库 Schedule，args 不含凭据", async () => {
    const ensure = vi.fn().mockResolvedValue({ created: true });
    const service = await buildService(ensure);
    const result = await service.execute({
      actorType: "service",
      actorId: "service:logix-outbox-publisher",
      intervalSeconds: 45,
      limit: 20,
      maxRounds: 3,
      maxTenants: 10,
    });
    expect(result).toEqual({
      scheduleId: "outbox-publish-due-system",
      workflowType: "outboxPublishDueSystemWorkflow",
      intervalSeconds: 45,
      created: true,
    });
    expect(ensure).toHaveBeenCalledWith({
      scheduleId: "outbox-publish-due-system",
      workflowType: "outboxPublishDueSystemWorkflow",
      taskQueue: "logix-business",
      intervalSeconds: 45,
      args: [{ limit: 20, maxRounds: 3, maxTenants: 10 }],
    });
    const serialized = JSON.stringify(ensure.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("serviceKey");
    expect(serialized).not.toContain("x-service-key");
  });

  it("用户身份或非法间隔拒绝且不写 Schedule", async () => {
    const ensure = vi.fn();
    const service = await buildService(ensure);
    await expect(
      service.execute({
        actorType: "user",
        actorId: "op-1",
      }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    await expect(
      service.execute({
        actorType: "service",
        actorId: "service:logix-outbox-publisher",
        intervalSeconds: "4",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(ensure).not.toHaveBeenCalled();
  });
});
