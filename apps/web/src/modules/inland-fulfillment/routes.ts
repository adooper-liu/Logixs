import type { RouteRecordRaw } from "vue-router";
import { inlandFulfillmentNavigation } from "./navigation";

/** Route contribution registered via apps/web/src/modules/registry.ts */
export const inlandFulfillmentRoutes: RouteRecordRaw[] = [
  {
    path: inlandFulfillmentNavigation.path,
    component: () => import("../../views/MesoPaper.vue"),
    meta: {
      title: inlandFulfillmentNavigation.title,
      section: inlandFulfillmentNavigation.section,
      navLabel: inlandFulfillmentNavigation.navLabel,
      navIcon: inlandFulfillmentNavigation.navIcon,
      navOrder: inlandFulfillmentNavigation.navOrder,
      roles: [...inlandFulfillmentNavigation.roles],
      moduleId: inlandFulfillmentNavigation.moduleId,
      requiredCapabilities: [
        ...inlandFulfillmentNavigation.requiredCapabilities,
      ],
    },
  },
];
