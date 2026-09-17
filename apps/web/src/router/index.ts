import { createRouter, createWebHistory } from "vue-router";
import { uiCopy } from "../data/uiCopyCatalog";
import { moduleRouteContributions } from "../modules/registry";

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash };
    return undefined;
  },
  routes: [
    { path: "/", redirect: "/tasks" },
    {
      path: "/tasks",
      component: () => import("../views/TaskWorkbench.vue"),
      meta: {
        title: "我的任务",
        section: "作业",
        navLabel: "我的任务",
        navIcon: "clipboard-check",
        navOrder: 10,
        roles: ["operator"],
      },
    },
    {
      path: "/real-tasks",
      redirect: (to) => ({ path: "/tasks", query: to.query }),
    },
    {
      path: "/containers",
      component: () => import("../views/ContainerList.vue"),
      meta: {
        title: "干活",
        section: "货柜",
        navLabel: "干活",
        navIcon: "container",
        navOrder: 20,
        roles: ["operator", "planner", "manager"],
      },
    },
    {
      path: "/real-containers",
      redirect: "/containers",
    },
    {
      path: "/dashboard",
      component: () => import("../views/DashboardGlobal.vue"),
      meta: {
        title: "货柜",
        section: "管理",
        navLabel: "货柜",
        navIcon: "chart-no-axes-combined",
        navOrder: 10,
        roles: ["manager"],
      },
    },
    {
      path: "/meso",
      component: () => import("../views/MesoPaper.vue"),
      meta: {
        title: "看档",
        section: "计划与管理",
        navLabel: "看档",
        navIcon: "calendar-range",
        navOrder: 30,
        roles: ["planner", "manager"],
      },
    },
    {
      path: "/real-operations",
      component: () => import("../views/RealOperations.vue"),
      meta: {
        title: "看提交",
        section: "管理",
        navLabel: "看提交",
        navIcon: "list-checks",
        navOrder: 35,
        roles: ["planner", "manager"],
      },
    },
    {
      path: "/dead-letters",
      component: () => import("../views/DeadLetterQueue.vue"),
      meta: {
        title: "看失败",
        section: "管理",
        navLabel: "看失败",
        navIcon: "triangle-alert",
        navOrder: 40,
        roles: ["planner", "manager"],
      },
    },
    {
      path: "/dev",
      component: () => import("../views/DevConsole.vue"),
      meta: {
        title: "开发控制台",
        section: "开发",
        // 只走 URL（README 已登记），不进作业导航，避免污染运营壳和视觉基线。
        roles: ["operator", "planner", "manager"],
      },
    },
    {
      path: "/import",
      component: () => import("../views/ImportUpload.vue"),
      meta: {
        title: uiCopy.chrome.importTitle,
        section: "作业",
        navLabel: uiCopy.chrome.importTitle,
        navIcon: "file-up",
        navOrder: 25,
        roles: ["operator", "planner", "manager"],
      },
    },
    {
      path: "/import/:batchId",
      component: () => import("../views/ImportBatchDetail.vue"),
      meta: { title: "导入批次", section: "导入" },
    },
    {
      path: "/container/:containerRecordId",
      component: () => import("../views/MicroWorkbench.vue"),
      meta: { title: "一柜一档", section: "货柜" },
    },
    ...moduleRouteContributions,
  ],
});

export default router;
