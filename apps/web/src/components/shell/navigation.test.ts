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
    expect(operator).not.toContain("/real-operations");
    expect(operator).not.toContain("/real-tasks");
    expect(operator).not.toContain("/real-containers");
    expect(operator).toContain("/tasks");
    expect(operator).toContain("/containers");
    expect(planner).toContain("/dead-letters");
    expect(planner).toContain("/real-operations");
    expect(
      navigationForRole(router.getRoutes(), "planner").map(
        (item) => item.label,
      ),
    ).toEqual(expect.arrayContaining(["看提交"]));
    expect(
      navigationForRole(router.getRoutes(), "operator").map(
        (item) => item.label,
      ),
    ).toEqual(expect.arrayContaining(["我的任务", "干活"]));
  });

  it("shows one import entry to every demo role after the work list", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      const importItems = items.filter((item) =>
        item.path.startsWith("/import"),
      );

      expect(importItems).toHaveLength(1);
      expect(importItems[0]).toMatchObject({
        label: "导入货柜",
        path: "/import",
        section: "作业",
      });
      expect(
        items.findIndex((item) => item.path === "/import"),
      ).toBeGreaterThan(items.findIndex((item) => item.path === "/containers"));
    }
  });
});
