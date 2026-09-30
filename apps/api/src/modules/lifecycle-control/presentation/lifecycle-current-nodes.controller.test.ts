import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { LifecycleCurrentNodesController } from "./lifecycle-current-nodes.controller";

describe("LifecycleCurrentNodesController", () => {
  it("读取当前节点要求生命周期读取能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleCurrentNodesController.prototype.list,
      ),
    ).toEqual(["lifecycle.read"]);
  });
});
