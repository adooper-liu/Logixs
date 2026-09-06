<script setup lang="ts">
import { onBeforeUnmount, provide, shallowRef, watch } from "vue";
import type { UiThemeAdapter } from "./contracts";
import { uiThemeKey } from "./contracts";

const props = defineProps<{
  theme: UiThemeAdapter;
}>();

const theme = shallowRef(props.theme);
provide(uiThemeKey, theme);

const root =
  typeof document === "undefined" ? undefined : document.documentElement;
const previousThemeId = root?.dataset.uiTheme;

watch(
  () => props.theme,
  (nextTheme) => {
    theme.value = nextTheme;
    if (root) root.dataset.uiTheme = nextTheme.id;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (!root) return;
  if (previousThemeId) root.dataset.uiTheme = previousThemeId;
  else delete root.dataset.uiTheme;
});
</script>

<template>
  <slot />
</template>
