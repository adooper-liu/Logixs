import { onBeforeUnmount, onMounted, readonly, shallowRef } from "vue";

export type AppTheme = "light" | "dark";

const themeStorageKey = "logix-theme";

function initialTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useAppShell() {
  const isSidebarCollapsed = shallowRef(false);
  const isNavigationOpen = shallowRef(false);
  const isCommandOpen = shallowRef(false);
  const theme = shallowRef<AppTheme>(initialTheme());

  const applyTheme = () => {
    document.documentElement.dataset.theme = theme.value;
  };

  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  };

  const openNavigation = () => {
    isNavigationOpen.value = true;
  };

  const closeNavigation = () => {
    isNavigationOpen.value = false;
  };

  const toggleCommand = () => {
    isCommandOpen.value = !isCommandOpen.value;
  };

  const closeCommand = () => {
    isCommandOpen.value = false;
  };

  const toggleTheme = () => {
    theme.value = theme.value === "light" ? "dark" : "light";
    window.localStorage.setItem(themeStorageKey, theme.value);
    applyTheme();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeNavigation();
      closeCommand();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggleCommand();
    }
  };

  onMounted(() => {
    applyTheme();
    window.addEventListener("keydown", handleKeydown);
  });
  onBeforeUnmount(() => window.removeEventListener("keydown", handleKeydown));

  return {
    isSidebarCollapsed: readonly(isSidebarCollapsed),
    isNavigationOpen: readonly(isNavigationOpen),
    isCommandOpen: readonly(isCommandOpen),
    theme: readonly(theme),
    toggleSidebar,
    openNavigation,
    closeNavigation,
    toggleCommand,
    closeCommand,
    toggleTheme,
  };
}
