<script setup lang="ts">
import { computed } from "vue";
import type { PageHeaderProps } from "../../ui-theme/contracts";
import { useUiTheme } from "../../ui-theme/useUiTheme";

defineProps<PageHeaderProps>();

const theme = useUiTheme();
const implementation = computed(() => theme.value.components.pageHeader);
</script>

<template>
  <component :is="implementation" v-bind="$props">
    <template v-if="$slots.help" #help>
      <slot name="help" />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </component>
</template>
