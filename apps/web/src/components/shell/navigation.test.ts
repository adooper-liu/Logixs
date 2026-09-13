import { describe, expect, it } from "vitest";
import router from "../../router";
import { navigationForRole } from "./navigation";

describe("navigationForRole", () => {
  it("does not put the developer console in the operations shell", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      expect(items.map((item) => item.path)).not.toContain("/dev");
      expect(items.map((item) => item.label)).not.toContain("开发控制台");
    }
  });

  it("keeps the dead-letter queue off the operator home navigation", () => {
    const operator = navigationForRole(router.getRoutes(), "operator").map(
      (item) => item.path,
    );
    const planner = navigationForRole(router.getRoutes(), "planner").map(
      (item) => item.path,
    );
    expect(operator).not.toContain("/dead-letters");
    expect(planner).toContain("/dead-letters");
  });
});
