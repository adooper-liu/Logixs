import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { TaskActionCandidateController } from "./task-action-candidate.controller";

describe("TaskActionCandidateController", () => {
  it("exposes one task-bound route family with the required capabilities", () => {
    const prototype = TaskActionCandidateController.prototype;
    expect(route(prototype.generate)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates",
      capabilities: ["task.read"],
    });
    expect(route(prototype.get)).toEqual({
      method: RequestMethod.GET,
      path: ":taskId/ai/action-candidates/:candidateId",
      capabilities: ["task.read"],
    });
    expect(route(prototype.reject)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates/:candidateId/rejections",
      capabilities: ["task.read"],
    });
    expect(route(prototype.confirm)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates/:candidateId/confirmations",
      capabilities: ["task.read", "task.execute"],
    });
  });

  it("takes tenant, actor and capabilities only from authenticated identity", async () => {
    const services = {
      generate: { execute: vi.fn().mockResolvedValue({ candidateId: "c" }) },
      get: { execute: vi.fn().mockResolvedValue({ candidateId: "c" }) },
      reject: { execute: vi.fn().mockResolvedValue({ decision: "rejected" }) },
      confirm: {
        execute: vi.fn().mockResolvedValue({
          contractVersion: "task-action-candidate-confirm-result.v1",
        }),
      },
    };
    const controller = new TaskActionCandidateController(
      services.generate as never,
      services.get as never,
      services.reject as never,
      services.confirm as never,
    );
    const identity = {
      identity: {
        tenantId: "tenant-from-token",
        actorId: "actor-from-token",
        capabilities: ["task.read", "task.execute"],
      },
      headers: { "x-trace-id": "client-chosen" },
    };
    const taskId = "10000000-0000-4000-8000-000000000001";
    const candidateId = "20000000-0000-4000-8000-000000000001";

    await controller.confirm(
      taskId,
      candidateId,
      {
        contractVersion: "task-action-candidate-confirm.v1",
        candidateId,
        candidateHash: "a".repeat(64),
        idempotencyKey: "confirm-1",
      },
      identity,
    );

    expect(services.confirm.execute).toHaveBeenCalledWith({
      tenantId: "tenant-from-token",
      actorId: "actor-from-token",
      capabilities: ["task.read", "task.execute"],
      taskId,
      candidateId,
      command: expect.objectContaining({ idempotencyKey: "confirm-1" }),
    });
    expect(services.confirm.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "client-chosen" }),
    );
  });
});

function route(handler: (...args: never[]) => unknown) {
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
    path: Reflect.getMetadata(PATH_METADATA, handler) as string,
    capabilities: Reflect.getMetadata(
      REQUIRED_CAPABILITIES_KEY,
      handler,
    ) as string[],
  };
}
