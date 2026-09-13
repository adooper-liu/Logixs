import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { WORKFLOW_SCHEDULE } from "../domain/workflow-schedule.port";
import { EnsureOutboxPublishScheduleService } from "./ensure-outbox-publish-schedule.service";

async function buildService(ensure: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      EnsureOutboxPublishScheduleService,
      { provide: WORKFLOW_SCHEDULE, useValue: { ensure } },
    ],
  }).compile();
  return module.get(EnsureOutboxPublishScheduleService);
}

describe("EnsureOutboxPublishScheduleService", () => {
  it("按租户保证一条 Schedule", async () => {
    const ensure = vi.fn().mockResolvedValue({ created: true });
    const service = await buildService(ensure);
    const result = await service.execute({
      tenantId: "t1",
      operatorId: "op-1",
      intervalSeconds: 45,
      limit: 20,
      maxRounds: 3,
    });
    expect(result).toEqual({
      scheduleId: "outbox-publish-due:t1",
      workflowType: "outboxPublishDueWorkflow",
      intervalSeconds: 45,
      created: true,
    });
    expect(ensure).toHaveBeenCalledWith({
      scheduleId: "outbox-publish-due:t1",
      workflowType: "outboxPublishDueWorkflow",
      taskQueue: "logix-business",
      intervalSeconds: 45,
      args: [
        {
          tenantId: "t1",
          operatorId: "op-1",
          limit: 20,
          maxRounds: 3,
        },
      ],
    });
  });

  it("非法间隔拒绝且不写 Schedule", async () => {
    const ensure = vi.fn();
    const service = await buildService(ensure);
    await expect(
      service.execute({
        tenantId: "t1",
        operatorId: "op-1",
        intervalSeconds: "4",
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(ensure).not.toHaveBeenCalled();
  });

  it("缺少租户或操作者拒绝", async () => {
    const ensure = vi.fn();
    const service = await buildService(ensure);
    await expect(
      service.execute({ tenantId: "  ", operatorId: "op-1" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    await expect(
      service.execute({ tenantId: "t1", operatorId: "  " }),
    ).rejects.toThrow("AUTHENTICATION_REQUIRED");
    expect(ensure).not.toHaveBeenCalled();
  });
});
