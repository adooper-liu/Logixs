import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
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
      path: "/containers",
      component: () => import("../views/ContainerList.vue"),
      meta: {
        title: "已出运货柜",
        section: "货柜",
        navLabel: "已出运货柜",
        navIcon: "container",
        navOrder: 20,
        roles: ["operator", "planner", "manager"],
      },
    },
    {
      path: "/dashboard",
      component: () => import("../views/DashboardGlobal.vue"),
      meta: {
        title: "运营态势",
        section: "管理",
        navLabel: "运营态势",
        navIcon: "chart-no-axes-combined",
        navOrder: 10,
        roles: ["manager"],
      },
    },
    {
      path: "/meso",
      component: () => import("../views/MesoPaper.vue"),
      meta: {
        title: "First Mile PDCA 运营",
        section: "计划与管理",
        navLabel: "PDCA 运营",
        navIcon: "calendar-range",
        navOrder: 30,
        roles: ["planner", "manager"],
      },
    },
    {
      path: "/container/:containerRecordId",
      component: () => import("../views/MicroWorkbench.vue"),
      meta: { title: "一柜一档", section: "货柜" },
    },
  ],
});

export default router;
