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
});
