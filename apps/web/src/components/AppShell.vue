<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DataBoard, Grid, Ship } from '@element-plus/icons-vue'
import type { Component } from 'vue'

// 导航模型：分组（后续加组只改这里，壳不变）
interface NavItem {
  label: string
  path: string
  icon: Component
  exact?: boolean
}
interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '货柜运营',
    items: [
      { label: '全局 · 态势', path: '/dashboard', icon: DataBoard },
      { label: '中观 · 清关运营', path: '/meso', icon: Grid },
      { label: '微观 · 一柜一档', path: '/container/24DSA1954', icon: Ship }
    ]
  }
]

const route = useRoute()
const pageTitle = computed(() => (route.meta.title as string) || '货柜运营')
const isActive = (item: NavItem) =>
  item.exact ? route.path === item.path : route.path.startsWith(item.path)
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <span class="mark">LogiX</span>
        <span class="cn">乐捷行 · 货柜运营</span>
      </div>
      <nav class="groups">
        <div v-for="g in navGroups" :key="g.title" class="group">
          <div class="group-title">{{ g.title }}</div>
          <router-link
            v-for="it in g.items"
            :key="it.path"
            :to="it.path"
            class="nav-item"
            :class="{ on: isActive(it) }"
          >
            <el-icon><component :is="it.icon" /></el-icon>
            <span>{{ it.label }}</span>
          </router-link>
        </div>
      </nav>
      <div class="side-foot">壳与视图分离 · 换壳即统一换肤</div>
    </aside>

    <div class="body">
      <header class="top">
        <h1>{{ pageTitle }}</h1>
        <span class="demo">演示环境</span>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
}
.side {
  width: 220px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.brand {
  padding: 14px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid var(--line);
}
.mark {
  font-weight: 800;
  color: var(--brand);
  letter-spacing: 0.02em;
}
.cn {
  font-size: 12px;
  color: var(--muted);
}
.groups {
  padding: 10px;
  overflow-y: auto;
  flex: 1;
}
.group-title {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 8px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: var(--ink-soft);
  text-decoration: none;
}
.nav-item:hover {
  background: var(--ground);
}
.nav-item.on {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
.side-foot {
  padding: 10px 14px;
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--line);
}
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.top h1 {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
  text-wrap: balance;
}
.demo {
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--line);
  padding: 2px 8px;
  border-radius: 6px;
}
.content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: var(--ground);
}
</style>
