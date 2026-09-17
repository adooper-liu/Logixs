import type { NavigationIcon } from "../../components/shell/navigation";
import type { DemoRole } from "../../composables/useDemoRole";

export const notificationNavigation = {
  moduleId: "notification",
  path: "/notifications",
  title: "问题通知",
  section: "管理",
  navLabel: "问题通知",
  navIcon: "triangle-alert" as NavigationIcon,
  navOrder: 38,
  roles: ["planner", "manager"] as DemoRole[],
  requiredCapabilities: ["notification.read"] as const,
};
