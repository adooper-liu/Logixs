import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { WorkExecutionController } from "./work-execution.controller";

describe("WorkExecutionController", () => {
  it("节点任务列表与详情要求任务读取能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        WorkExecutionController.prototype.list,
      ),
    ).toEqual(["task.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        WorkExecutionController.prototype.get,
      ),
    ).toEqual(["task.read"]);
  });

  it("不再暴露外部创建节点任务的 HTTP 入口", () => {
    const prototype = WorkExecutionController.prototype as unknown as Record<
      string,
      unknown
    >;
    const routes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== "constructor")
      .map((name) => prototype[name])
      .filter((handler) => typeof handler === "function")
      .filter((handler) => Reflect.hasMetadata(PATH_METADATA, handler))
      .map((handler) => ({
        method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
        path: Reflect.getMetadata(PATH_METADATA, handler) as string,
      }));

    expect(prototype.create).toBeUndefined();
    expect(routes).not.toContainEqual({
      method: RequestMethod.POST,
      path: "node-tasks",
    });
    expect(routes).toContainEqual({
      method: RequestMethod.GET,
      path: "node-tasks",
    });
  });
});
