<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppSidebar from "../../components/shell/AppSidebar.vue";
import AppTopbar from "../../components/shell/AppTopbar.vue";
import CommandPalette from "../../components/shell/CommandPalette.vue";
import { navigationForRole } from "../../components/shell/navigation";
import { useAppShell } from "../../composables/useAppShell";
import { useDemoRole, type DemoRole } from "../../composables/useDemoRole";

const defaultRoute: Record<DemoRole, string> = {
  operator: "/tasks",
  planner: "/containers",
  manager: "/dashboard",
};

const route = useRoute();
const router = useRouter();
const { currentRole, roleLabel, roleLabels, setRole } = useDemoRole();
const {
  isSidebarCollapsed,
  isNavigationOpen,
  isCommandOpen,
  theme,
  toggleSidebar,
  openNavigation,
  closeNavigation,
  toggleCommand,
  closeCommand,
  toggleTheme,
} = useAppShell();
const navItems = computed(() =>
  navigationForRole(router.getRoutes(), currentRole.value),
);
const pageTitle = computed(() => (route.meta.title as string) || "货柜运营");
const pageSection = computed(() => route.meta.section ?? "工作区");
const contextLabel = computed(() => {
  if (typeof route.params.containerRecordId === "string")
    return route.params.containerRecordId;
  if (typeof route.query.task === "string") return route.query.task;
  return undefined;
});

const changeRole = (role: DemoRole) => {
  setRole(role);
  void router.push(defaultRoute[role]);
};

watch(
  () => route.fullPath,
  () => {
    closeNavigation();
    closeCommand();
  },
);
</script>

<template>
  <div
    data-testid="app-shell"
    class="app-shell"
    :class="{ 'shell--collapsed': isSidebarCollapsed }"
  >
    <AppSidebar
      :collapsed="isSidebarCollapsed"
      :drawer-open="isNavigationOpen"
      :current-role="currentRole"
      :role-labels="roleLabels"
      :navigation="navItems"
      @close="closeNavigation"
      @navigate="closeNavigation"
      @change-role="changeRole"
    />
    <button
      v-if="isNavigationOpen"
      class="navigation-backdrop"
      type="button"
      aria-label="关闭主导航"
      @click="closeNavigation"
    ></button>

    <div class="app-body">
      <AppTopbar
        :collapsed="isSidebarCollapsed"
        :title="pageTitle"
        :section="pageSection"
        :context-label="contextLabel"
        :role-label="roleLabel"
        :theme="theme"
        @open-navigation="openNavigation"
        @toggle-sidebar="toggleSidebar"
        @toggle-command="toggleCommand"
        @toggle-theme="toggleTheme"
      />
      <main class="app-content"><router-view /></main>
    </div>
    <CommandPalette
      :open="isCommandOpen"
      :navigation="navItems"
      @close="closeCommand"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
}

.app-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--ground);
  scrollbar-gutter: stable;
}

.navigation-backdrop {
  display: none;
}

@media (max-width: 959px) {
  .navigation-backdrop {
    position: fixed;
    z-index: var(--z-backdrop);
    inset: 0;
    display: block;
    border: 0;
    background: var(--overlay);
  }
}
</style>
