<script setup lang="ts">
import {
  Bell,
  ChevronRight,
  Command,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserRound,
  Wifi,
} from "@lucide/vue";
import type { AppTheme } from "../../composables/useAppShell";

defineProps<{
  collapsed: boolean;
  title: string;
  section: string;
  contextLabel?: string;
  roleLabel: string;
  theme: AppTheme;
}>();

const emit = defineEmits<{
  openNavigation: [];
  toggleSidebar: [];
  toggleCommand: [];
  toggleTheme: [];
}>();
</script>

<template>
  <header class="app-topbar">
    <div class="topbar-leading">
      <button
        class="icon-button mobile-menu"
        type="button"
        aria-label="打开主导航"
        @click="emit('openNavigation')"
      >
        <Menu :size="19" />
      </button>
      <button
        class="icon-button desktop-fold"
        type="button"
        :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
        @click="emit('toggleSidebar')"
      >
        <PanelLeftOpen v-if="collapsed" :size="18" />
        <PanelLeftClose v-else :size="18" />
      </button>
      <div class="breadcrumb" aria-label="当前位置">
        <span>{{ section }}</span>
        <ChevronRight :size="13" aria-hidden="true" />
        <b>{{ title }}</b>
        <template v-if="contextLabel">
          <ChevronRight :size="13" aria-hidden="true" />
          <strong class="mono">{{ contextLabel }}</strong>
        </template>
      </div>
    </div>

    <div class="topbar-actions">
      <button
        class="command-trigger"
        type="button"
        aria-label="打开快速导航"
        @click="emit('toggleCommand')"
      >
        <Command :size="16" />
        <span>快速导航</span>
        <kbd>Ctrl K</kbd>
      </button>
      <span class="system-health" title="服务连接正常">
        <Wifi :size="15" aria-hidden="true" />
        <span>在线</span>
      </span>
      <router-link
        class="icon-button"
        to="/meso?dimension=exceptions"
        aria-label="查看异常与通知"
      >
        <Bell :size="18" />
        <i aria-hidden="true"></i>
      </router-link>
      <button
        class="icon-button"
        type="button"
        :aria-label="theme === 'light' ? '切换深色主题' : '切换浅色主题'"
        @click="emit('toggleTheme')"
      >
        <Moon v-if="theme === 'light'" :size="18" />
        <Sun v-else :size="18" />
      </button>
      <div class="user-context" :title="`当前演示角色：${roleLabel}`">
        <UserRound :size="17" aria-hidden="true" />
        <span>{{ roleLabel }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  height: var(--topbar-height);
  min-height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border-bottom: 1px solid var(--line);
}

.topbar-leading,
.topbar-actions,
.breadcrumb,
.command-trigger,
.system-health,
.user-context {
  min-width: 0;
  display: flex;
  align-items: center;
}

.topbar-leading,
.topbar-actions {
  gap: 8px;
}

.breadcrumb {
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.breadcrumb b {
  color: var(--ink-soft);
}

.breadcrumb strong {
  max-width: 190px;
  overflow: hidden;
  color: var(--brand-strong);
  text-overflow: ellipsis;
}

.mobile-menu {
  display: none;
}

.command-trigger {
  height: 32px;
  gap: 7px;
  padding: 0 7px 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  color: var(--ink-soft);
  cursor: pointer;
}

.command-trigger kbd {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font: 10px var(--font-mono);
}

.system-health,
.user-context {
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
}

.system-health svg {
  color: var(--ok);
}

.user-context {
  min-height: 32px;
  padding: 0 8px;
  border-left: 1px solid var(--line);
}

.topbar-actions .icon-button {
  position: relative;
}

.topbar-actions .icon-button i {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--risk);
  box-shadow: 0 0 0 2px var(--surface);
}

@media (max-width: 959px) {
  .app-topbar {
    padding-inline: 12px;
  }

  .mobile-menu {
    display: grid;
  }

  .desktop-fold,
  .breadcrumb > span,
  .breadcrumb > svg:first-of-type,
  .command-trigger span,
  .command-trigger kbd,
  .system-health span,
  .user-context span {
    display: none;
  }

  .command-trigger {
    width: var(--control-height);
    padding: 0;
    justify-content: center;
  }
}

@media (max-width: 767px) {
  .app-topbar {
    padding-inline: 8px;
  }

  .breadcrumb strong,
  .breadcrumb > svg:last-of-type {
    display: none;
  }

  .topbar-actions {
    gap: 3px;
  }

  .user-context {
    display: none;
  }
}
</style>
