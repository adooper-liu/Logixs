<script setup lang="ts">
import { X } from "@lucide/vue";
import type { AppNavigationItem } from "./navigation";
import type { DemoRole } from "../../composables/useDemoRole";
import InfoTooltip from "../ui/InfoTooltip.vue";

defineProps<{
  collapsed: boolean;
  drawerOpen: boolean;
  currentRole: DemoRole;
  roleLabels: Record<DemoRole, string>;
  navigation: AppNavigationItem[];
}>();

const emit = defineEmits<{
  close: [];
  navigate: [];
  changeRole: [role: DemoRole];
}>();

const changeRole = (event: Event) => {
  emit("changeRole", (event.target as HTMLSelectElement).value as DemoRole);
};
</script>

<template>
  <aside
    data-testid="app-sidebar"
    class="app-sidebar"
    :class="{ 'sidebar--collapsed': collapsed, 'sidebar--open': drawerOpen }"
  >
    <div class="sidebar-brand">
      <div class="brand-symbol" aria-hidden="true">LX</div>
      <div class="brand-copy">
        <b>LogiX</b>
        <span>货柜 PDCA 工作系统</span>
      </div>
      <button
        class="icon-button close-drawer"
        type="button"
        aria-label="关闭主导航"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </div>

    <div class="workspace-switcher">
      <span class="workspace-label">工作区</span>
      <div class="workspace-name">
        <strong>First Mile</strong>
        <InfoTooltip
          label="查看工作区范围"
          text="当前工作区聚焦已出运后的货柜履约、现场作业与管理闭环。"
        />
      </div>
    </div>

    <nav class="navigation" aria-label="主导航">
      <router-link
        v-for="item in navigation"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        active-class="nav-item--active"
        :title="collapsed ? item.label : undefined"
        @click="emit('navigate')"
      >
        <component :is="item.icon" :size="18" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="role-switcher">
      <div class="role-label">
        <span>演示角色</span>
        <InfoTooltip
          label="查看演示角色说明"
          text="角色切换只裁剪演示视图，不代表生产环境的服务端权限。"
        />
      </div>
      <select :value="currentRole" aria-label="演示角色" @change="changeRole">
        <option v-for="(label, role) in roleLabels" :key="role" :value="role">
          {{ label }}
        </option>
      </select>
    </div>

    <div class="sidebar-footer">
      <span class="environment-dot"></span>
      <div>
        <b>演示环境</b>
        <span>数据不会写入生产</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: relative;
  z-index: var(--z-sidebar);
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--line);
  transition:
    width var(--motion-normal),
    min-width var(--motion-normal),
    transform var(--motion-normal);
}

.sidebar-brand {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
}

.brand-symbol {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-size: 12px;
  font-weight: 800;
}

.brand-copy,
.workspace-switcher,
.sidebar-footer > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.workspace-name,
.role-label {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.brand-copy b {
  font-size: 15px;
  line-height: 1.2;
}

.brand-copy span,
.workspace-switcher span,
.sidebar-footer span,
.role-switcher small {
  color: var(--muted);
  font-size: 10px;
}

.close-drawer {
  display: none;
  margin-left: auto;
}

.workspace-switcher {
  gap: 1px;
  margin: 12px 10px 6px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface-2);
}

.workspace-switcher .workspace-label {
  color: var(--brand);
  font-weight: 700;
}

.navigation {
  flex: 1;
  min-height: 0;
  padding: 6px 10px;
  overflow-y: auto;
}

.nav-item {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  margin-bottom: 2px;
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  text-decoration: none;
}

.nav-item svg {
  flex: none;
}

.nav-item:hover {
  background: var(--surface-2);
  color: var(--ink);
}

.nav-item--active {
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-weight: 700;
  box-shadow: inset 3px 0 var(--brand);
}

.role-switcher {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 8px 10px 12px;
}

.role-label > span {
  color: var(--muted);
  font-size: 10px;
}

.role-switcher select {
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.sidebar-footer {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
}

.environment-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--warn);
}

.app-sidebar.sidebar--collapsed {
  width: var(--sidebar-folded-width);
  min-width: var(--sidebar-folded-width);
}

.sidebar--collapsed .brand-copy,
.sidebar--collapsed .workspace-switcher,
.sidebar--collapsed .nav-item span,
.sidebar--collapsed .role-switcher,
.sidebar--collapsed .sidebar-footer > div {
  display: none;
}

.sidebar--collapsed .sidebar-brand,
.sidebar--collapsed .sidebar-footer {
  justify-content: center;
  padding-inline: 0;
}

.sidebar--collapsed .navigation {
  padding-inline: 8px;
}

.sidebar--collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

@media (min-width: 960px) and (max-width: 1279px) {
  .app-sidebar {
    width: var(--sidebar-folded-width);
    min-width: var(--sidebar-folded-width);
  }

  .brand-copy,
  .workspace-switcher,
  .nav-item span,
  .role-switcher,
  .sidebar-footer > div {
    display: none;
  }

  .sidebar-brand,
  .sidebar-footer,
  .nav-item {
    justify-content: center;
  }

  .sidebar-brand,
  .sidebar-footer,
  .nav-item {
    padding-inline: 0;
  }

  .navigation {
    padding-inline: 8px;
  }
}

@media (max-width: 959px) {
  .app-sidebar,
  .app-sidebar.sidebar--collapsed {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(280px, calc(100vw - 44px));
    min-width: 0;
    transform: translateX(-100%);
    box-shadow: var(--shadow-overlay);
  }

  .app-sidebar.sidebar--open {
    transform: translateX(0);
  }

  .sidebar--collapsed .brand-copy,
  .sidebar--collapsed .workspace-switcher,
  .sidebar--collapsed .nav-item span,
  .sidebar--collapsed .role-switcher,
  .sidebar--collapsed .sidebar-footer > div {
    display: flex;
  }

  .sidebar--collapsed .sidebar-brand,
  .sidebar--collapsed .sidebar-footer,
  .sidebar--collapsed .nav-item {
    justify-content: flex-start;
  }

  .sidebar--collapsed .sidebar-brand,
  .sidebar--collapsed .sidebar-footer {
    padding-inline: 14px;
  }

  .sidebar--collapsed .navigation {
    padding-inline: 10px;
  }

  .sidebar--collapsed .nav-item {
    padding-inline: 10px;
  }

  .close-drawer {
    display: grid;
  }

  .nav-item,
  .role-switcher select {
    min-height: var(--touch-target);
  }
}
</style>
