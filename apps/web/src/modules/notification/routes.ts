import type { RouteRecordRaw } from "vue-router";
import { notificationNavigation } from "./navigation";

export const notificationRoutes: RouteRecordRaw[] = [
  {
    path: notificationNavigation.path,
    component: () => import("../../views/NotificationCenter.vue"),
    meta: {
      title: notificationNavigation.title,
      section: notificationNavigation.section,
      navLabel: notificationNavigation.navLabel,
      navIcon: notificationNavigation.navIcon,
      navOrder: notificationNavigation.navOrder,
      roles: [...notificationNavigation.roles],
      moduleId: notificationNavigation.moduleId,
      requiredCapabilities: [...notificationNavigation.requiredCapabilities],
    },
  },
];
