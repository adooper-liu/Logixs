import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { OverdueAccrualController } from "./overdue-accrual.controller";

describe("OverdueAccrualController", () => {
  it("重算应计声明费用管理能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OverdueAccrualController.prototype.compute,
      ),
    ).toEqual(["charges.manage"]);
  });
});
