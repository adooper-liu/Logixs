import type { Component } from "vue";
import {
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardCheck,
  Container,
  Wrench,
} from "@lucide/vue";
import type { RouteRecordNormalized } from "vue-router";
import type { DemoRole } from "../../composables/useDemoRole";

export type NavigationIcon =
  | "calendar-range"
  | "chart-no-axes-combined"
  | "clipboard-check"
  | "container"
  | "wrench";

export interface AppNavigationItem {
  label: string;
  path: string;
  section: string;
  order: number;
  icon: Component;
}

const icons: Record<NavigationIcon, Component> = {
  "calendar-range": CalendarRange,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "clipboard-check": ClipboardCheck,
  container: Container,
  wrench: Wrench,
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
