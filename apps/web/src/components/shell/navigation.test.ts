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

  it("shows inland-fulfillment module navigation for planners", () => {
    const planner = navigationForRole(router.getRoutes(), "planner").map(
      (item) => item.path,
    );
    const operator = navigationForRole(router.getRoutes(), "operator").map(
      (item) => item.path,
    );
    expect(planner).toContain("/inland-planning");
    expect(operator).not.toContain("/inland-planning");
  });

  it("shows notification center for planners and managers", () => {
    expect(
      navigationForRole(router.getRoutes(), "planner").map((item) => item.path),
    ).toContain("/notifications");
    expect(
      navigationForRole(router.getRoutes(), "manager").map((item) => item.path),
    ).toContain("/notifications");
    expect(
      navigationForRole(router.getRoutes(), "operator").map(
        (item) => item.path,
      ),
    ).not.toContain("/notifications");
  });

  it("shows compliance review to planners and managers only", () => {
    expect(
      navigationForRole(router.getRoutes(), "planner").map((item) => item.path),
    ).toContain("/compliance");
    expect(
      navigationForRole(router.getRoutes(), "manager").map((item) => item.path),
    ).toContain("/compliance");
    expect(
      navigationForRole(router.getRoutes(), "operator").map(
        (item) => item.path,
      ),
    ).not.toContain("/compliance");
  });

  it("shows date fact review to review-facing roles only", () => {
    expect(
      navigationForRole(router.getRoutes(), "planner").map((item) => item.path),
    ).toContain("/reviews/date-facts");
    expect(
      navigationForRole(router.getRoutes(), "manager").map((item) => item.path),
    ).toContain("/reviews/date-facts");
    expect(
      navigationForRole(router.getRoutes(), "operator").map(
        (item) => item.path,
      ),
    ).not.toContain("/reviews/date-facts");
  });

  it("shows the cargo-ready role workbench to every operating role", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "备货工作台",
            path: "/workspaces/cargo-ready",
            section: "作业",
          }),
        ]),
      );
      expect(
        items.findIndex((item) => item.path === "/workspaces/cargo-ready"),
      ).toBeLessThan(items.findIndex((item) => item.path === "/containers"));
    }
  });

  it("shows the stuffing workbench immediately after cargo-ready", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      const cargoReady = items.findIndex(
        (item) => item.path === "/workspaces/cargo-ready",
      );
      const stuffing = items.findIndex(
        (item) => item.path === "/workspaces/stuffing",
      );
      expect(stuffing).toBe(cargoReady + 1);
      expect(items[stuffing]?.label).toBe("装箱工作台");
    }
  });

  it("shows the dispatch workbench immediately after stuffing", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      const stuffing = items.findIndex(
        (item) => item.path === "/workspaces/stuffing",
      );
      const dispatch = items.findIndex(
        (item) => item.path === "/workspaces/dispatch",
      );
      expect(dispatch).toBe(stuffing + 1);
      expect(items[dispatch]?.label).toBe("出运工作台");
    }
  });

  it("shows the pickup workbench immediately after customs", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      const customs = items.findIndex(
        (item) => item.path === "/workspaces/customs",
      );
      const pickup = items.findIndex(
        (item) => item.path === "/workspaces/pickup",
      );
      expect(pickup).toBe(customs + 1);
      expect(items[pickup]?.label).toBe("提柜工作台");
    }
  });
});
