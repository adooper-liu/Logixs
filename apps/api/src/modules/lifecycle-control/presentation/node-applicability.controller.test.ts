import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { NodeApplicabilityController } from "./node-applicability.controller";

describe("NodeApplicabilityController", () => {
  it("设置节点适用性要求生命周期操作能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        NodeApplicabilityController.prototype.apply,
      ),
    ).toEqual(["lifecycle.operate"]);
  });
});
