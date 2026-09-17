import type { RouteRecordRaw } from "vue-router";
import { inlandFulfillmentRoutes } from "./inland-fulfillment/routes";
import { notificationRoutes } from "./notification/routes";

/**
 * Aggregates incremental module route/nav contributions.
 * Core shell routes stay in router/index.ts; business modules append here.
 */
export const moduleRouteContributions: RouteRecordRaw[] = [
  ...inlandFulfillmentRoutes,
  ...notificationRoutes,
];
