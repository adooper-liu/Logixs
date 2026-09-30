import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { OverdueDeadlinesController } from "./overdue-deadlines.controller";

describe("OverdueDeadlinesController", () => {
  it("维护标准与计算截止日都声明费用管理能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OverdueDeadlinesController.prototype.replace,
      ),
    ).toEqual(["charges.manage"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OverdueDeadlinesController.prototype.compute,
      ),
    ).toEqual(["charges.manage"]);
  });
});
