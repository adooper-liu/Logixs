/// <reference types="vite/client" />

import type { DemoRole } from "./composables/useDemoRole";
import type { NavigationIcon } from "./components/shell/navigation";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    section?: string;
    navLabel?: string;
    navIcon?: NavigationIcon;
    navOrder?: number;
    roles?: DemoRole[];
  }
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export default component;
}
