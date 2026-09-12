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
});
