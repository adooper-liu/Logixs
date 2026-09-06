<script setup lang="ts">
import type { PageHeaderProps } from "../contracts";

defineProps<PageHeaderProps>();
</script>

<template>
  <header data-testid="test-page-header">
    <h2>{{ title }}</h2>
    <slot name="help" />
    <time v-if="updatedAt">{{ updatedAt }}</time>
    <slot name="actions" />
  </header>
</template>
