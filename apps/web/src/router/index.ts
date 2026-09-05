import { createRouter, createWebHistory } from 'vue-router'

// 壳与视图分离：路由只负责"哪个视图"，视觉壳统一在 AppShell
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import('../views/DashboardGlobal.vue'), meta: { title: '全局 · 态势' } },
    { path: '/meso', component: () => import('../views/MesoPaper.vue'), meta: { title: '中观 · 清关运营' } },
    { path: '/container/:orderNumber', component: () => import('../views/MicroWorkbench.vue'), meta: { title: '微观 · 一柜一档' } }
  ]
})

export default router
