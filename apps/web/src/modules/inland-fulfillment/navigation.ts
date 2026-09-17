import type { NavigationIcon } from "../../components/shell/navigation";
import type { DemoRole } from "../../composables/useDemoRole";

/** Web navigation contribution for inland-fulfillment (Odoo views/menu analogue). */
export const inlandFulfillmentNavigation = {
  moduleId: "inland-fulfillment",
  path: "/inland-planning",
  title: "内陆计划",
  section: "计划与管理",
  navLabel: "内陆计划",
  navIcon: "calendar-range" as NavigationIcon,
  navOrder: 28,
  roles: ["planner", "manager"] as DemoRole[],
  requiredCapabilities: ["planning.read"] as const,
};
