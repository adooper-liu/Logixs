<script setup lang="ts">
import { computed } from "vue";
import { useUiTheme } from "../ui-theme/useUiTheme";

const theme = useUiTheme();
const implementation = computed(() => theme.value.components.appShell);
</script>

<template>
  <component :is="implementation" />
</template>
