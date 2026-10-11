import type { RouteRecordRaw } from "vue-router";

export const referenceRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: "/__reference/universal-workbench",
        component: () =>
          import("../../reference/universal-workbench/UniversalWorkbenchReferenceView.vue"),
        meta: { title: "通用工作台结构参考" },
      },
      {
        path: "/__reference/universal-workbench/linked-feature",
        component: () =>
          import("../../reference/universal-workbench/UniversalWorkbenchLinkedFeatureReferenceView.vue"),
        meta: { title: "关联子功能结构参考" },
      },
    ]
  : [];
