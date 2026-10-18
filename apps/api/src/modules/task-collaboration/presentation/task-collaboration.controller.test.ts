import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { TaskCollaborationController } from "./task-collaboration.controller";

describe("TaskCollaborationController", () => {
  it("binds GET to task.read and POST to task.read plus task.collaborate", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        TaskCollaborationController.prototype.list,
      ),
    ).toEqual(["task.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        TaskCollaborationController.prototype.post,
      ),
    ).toEqual(["task.read", "task.collaborate"]);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        TaskCollaborationController.prototype.list,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        TaskCollaborationController.prototype.post,
      ),
    ).toBe("node-tasks/:taskId/collaboration/messages");
  });

  it("takes tenant/actor/capabilities only from authenticated identity", async () => {
    const list = { execute: vi.fn().mockResolvedValue({}) };
    const post = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new TaskCollaborationController(
      list as never,
      post as never,
    );
    const identity = {
      tenantId: "tenant-a",
      actorId: "actor-a",
      capabilities: ["task.read", "task.collaborate"],
    };

    await controller.post("task-a", command() as never, { identity } as never);
    expect(post.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "actor-a",
      capabilities: ["task.read", "task.collaborate"],
      taskId: "task-a",
      command: command(),
    });
  });
});

function command() {
  return {
    contractVersion: "task-collaboration-post-command.v1",
    subjectRef: { kind: "container", id: "container-a" },
    workRef: { kind: "node_task", id: "task-a" },
    body: "hello",
    parentMessageId: null,
    mentionActorIds: [],
    evidenceRecordIds: [],
    sourceRefs: [],
    idempotencyKey: "key-a",
  };
}
