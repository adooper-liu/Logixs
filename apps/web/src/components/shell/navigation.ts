import type { Component } from "vue";
import {
  CalendarCheck,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardCheck,
  Container,
  FileUp,
  Landmark,
  ListChecks,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  Ship,
  TriangleAlert,
  Truck,
  Warehouse,
} from "@lucide/vue";
import type { RouteRecordNormalized } from "vue-router";
import type { DemoRole } from "../../composables/useDemoRole";

export type NavigationIcon =
  | "calendar-check"
  | "calendar-range"
  | "chart-no-axes-combined"
  | "clipboard-check"
  | "container"
  | "file-up"
  | "list-checks"
  | "landmark"
  | "package-check"
  | "package-open"
  | "shield-check"
  | "ship"
  | "triangle-alert"
  | "truck"
  | "warehouse";

export interface AppNavigationItem {
  label: string;
  path: string;
  section: string;
  order: number;
  icon: Component;
}

const icons: Record<NavigationIcon, Component> = {
  "calendar-check": CalendarCheck,
  "calendar-range": CalendarRange,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "clipboard-check": ClipboardCheck,
  container: Container,
  "file-up": FileUp,
  "list-checks": ListChecks,
  landmark: Landmark,
  "package-check": PackageCheck,
  "package-open": PackageOpen,
  "shield-check": ShieldCheck,
  ship: Ship,
  "triangle-alert": TriangleAlert,
  truck: Truck,
  warehouse: Warehouse,
};

export function navigationForRole(
  routes: RouteRecordNormalized[],
  role: DemoRole,
): AppNavigationItem[] {
  return routes
    .filter(
      (route) =>
        route.meta.navLabel &&
        route.meta.navIcon &&
        route.meta.roles?.includes(role),
    )
    .map((route) => ({
      label: route.meta.navLabel!,
      path: route.path,
      section: route.meta.section ?? "工作区",
      order: route.meta.navOrder ?? 999,
      icon: icons[route.meta.navIcon!],
    }))
    .sort((left, right) => left.order - right.order);
}
