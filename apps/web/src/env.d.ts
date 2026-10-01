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
    moduleId?: string;
    requiredCapabilities?: string[];
    /** 仅 OIDC 协议回调可免登录访问；不得用于业务页面。 */
    authPublic?: boolean;
  }
}

declare global {
  // 认证配置只由 auth/config.ts 读取；其余模块不得散读 import.meta.env。
  interface ImportMetaEnv {
    readonly VITE_AUTH_MODE?: string;
    readonly VITE_OIDC_AUTHORITY?: string;
    readonly VITE_OIDC_CLIENT_ID?: string;
    readonly VITE_OIDC_SCOPE?: string;
    readonly VITE_OIDC_REDIRECT_URI?: string;
    readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
    readonly VITE_OIDC_SILENT_REDIRECT_URI?: string;
    readonly VITE_DEV_TENANT_ID?: string;
    readonly VITE_DEV_OPERATOR_ID?: string;
    readonly VITE_DEV_ROLES?: string;
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
