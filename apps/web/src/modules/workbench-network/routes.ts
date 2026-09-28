import type { RouteRecordRaw } from "vue-router";
import { frameworkWorkbenchStages } from "../../data/workbenchNetwork";

export const workbenchNetworkRoutes: RouteRecordRaw[] = [
  {
    path: "/workspaces",
    component: () => import("../../views/WorkbenchNetworkView.vue"),
    meta: {
      title: "业务工作台",
      section: "作业",
      navLabel: "业务工作台",
      navIcon: "workflow",
      navOrder: 12,
      roles: ["operator", "planner", "manager"],
    },
  },
  {
    path: "/workspaces/market-signals",
    component: () => import("../../views/MarketSignalsWorkbench.vue"),
    meta: {
      title: "市场与经营信号",
      section: "业务工作台",
      roles: ["planner", "manager"],
    },
  },
  {
    path: "/workspaces/product-selection",
    component: () => import("../../views/ProductSelectionWorkbench.vue"),
    meta: {
      title: "选品立项",
      section: "业务工作台",
      roles: ["planner", "manager"],
    },
  },
  {
    // 岗位待办**不进工作台目录**：它不是一条业务链上的工作台，而是四个专业岗位
    // 共用的「交办收件箱」。放在这里只是因为它同属"作业"这一段导航。
    path: "/workspaces/work-inbox",
    component: () => import("../../views/WorkInboxView.vue"),
    meta: {
      title: "岗位待办",
      section: "作业",
      navLabel: "岗位待办",
      navIcon: "list-checks",
      navOrder: 13,
      roles: ["operator", "planner", "manager"],
    },
  },
  {
    path: "/workspaces/sourcing",
    component: () => import("../../views/SourcingWorkbench.vue"),
    meta: {
      title: "寻源与供应商定点",
      section: "业务工作台",
      roles: ["planner", "manager"],
    },
  },
  {
    path: "/workspaces/master-data",
    component: () => import("../../views/MasterDataWorkbench.vue"),
    meta: {
      title: "商品与物料主数据",
      section: "业务工作台",
      roles: ["planner", "manager"],
    },
  },
  {
    path: "/workspaces/product-npi",
    component: () => import("../../views/ProductNpiWorkbench.vue"),
    meta: {
      title: "产品开发与 NPI",
      section: "业务工作台",
      roles: ["planner", "manager"],
    },
  },
  ...frameworkWorkbenchStages.map((stage): RouteRecordRaw => ({
    path: stage.path,
    component: () => import("../../views/PlannedWorkbenchView.vue"),
    props: { stageCode: stage.code },
    meta: {
      title: stage.title,
      section: "业务工作台",
      roles: ["operator", "planner", "manager"],
    },
  })),
];
