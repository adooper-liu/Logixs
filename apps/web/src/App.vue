<script setup lang="ts">
import AppShell from "./components/AppShell.vue";
import { activeUiTheme } from "./ui-theme/activeTheme";
import UiThemeProvider from "./ui-theme/UiThemeProvider.vue";
</script>

<template>
  <UiThemeProvider :theme="activeUiTheme">
    <AppShell />
  </UiThemeProvider>
</template>
