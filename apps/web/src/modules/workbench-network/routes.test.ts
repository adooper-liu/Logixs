import { describe, expect, it } from "vitest";
import { workbenchNetworkRoutes } from "./routes";
import { workbenchStages } from "../../data/workbenchNetwork";

describe("workbench route composition", () => {
  it("registers each catalog path once and uses the live ocean component", async () => {
    for (const stage of workbenchStages) {
      const routes = workbenchNetworkRoutes.filter(
        (route) => route.path === stage.path,
      );
      // Dedicated live routes owned by other route modules need not occur here.
      if (stage.code === "ocean_operations") {
        expect(routes).toHaveLength(1);
        const load = routes[0]!.component as () => Promise<{
          default: { __name?: string };
        }>;
        expect((await load()).default.__name).toBe("OceanOperationsWorkbench");
      } else {
        expect(routes.length).toBeLessThanOrEqual(1);
      }
    }
  });
});
