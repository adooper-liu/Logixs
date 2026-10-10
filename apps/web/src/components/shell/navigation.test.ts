import { describe, expect, it } from "vitest";
import { workbenchStages } from "../../data/workbenchNetwork";
import router from "../../router";
import { navigationForRole } from "./navigation";

describe("navigationForRole", () => {
  it("keeps formal workbenches behind the single business-workbench directory entry", () => {
    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      expect(items.filter((item) => item.path === "/workspaces")).toHaveLength(
        1,
      );
      expect(
        items.filter(
          (item) =>
            item.path.startsWith("/workspaces/") &&
            item.path !== "/workspaces/work-inbox",
        ),
      ).toHaveLength(0);
    }
  });

  it("keeps formal workbenches behind the directory entry without shortcuts", () => {
    const formalPaths = [
      "/workspaces/cargo-ready",
      "/workspaces/stuffing",
      "/workspaces/dispatch",
      "/workspaces/customs",
      "/workspaces/pickup",
      "/workspaces/delivery",
      "/workspaces/unloading",
    ];

    for (const role of ["operator", "planner", "manager"] as const) {
      const items = navigationForRole(router.getRoutes(), role);
      expect(items.filter((item) => item.path === "/workspaces")).toHaveLength(
        1,
      );
      expect(items.filter((item) => formalPaths.includes(item.path))).toEqual(
        [],
      );
    }
  });

  it("registers catalog-stub routes without adding them to shell navigation", () => {
    expect(
      router.getRoutes().some((route) => route.path === "/workspaces/booking"),
    ).toBe(true);
    expect(
      router
        .getRoutes()
        .some((route) => route.path === "/workspaces/export-customs"),
    ).toBe(true);
    expect(
      router
        .getRoutes()
        .some((route) => route.path === "/workspaces/compliance-operations"),
    ).toBe(true);
  });

  it("registers every catalog workbench path in the runtime router", () => {
    const registeredPaths = new Set(router.getRoutes().map(({ path }) => path));

    for (const stage of workbenchStages) {
      expect(registeredPaths.has(stage.path), stage.code).toBe(true);
    }
  });

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
});
