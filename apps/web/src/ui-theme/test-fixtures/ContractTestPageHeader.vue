<script setup lang="ts">
import type { PageHeaderProps } from "../contracts";

defineProps<PageHeaderProps>();
</script>

<template>
  <header data-testid="test-page-header">
    <small v-if="eyebrow">{{ eyebrow }}</small>
    <h2>{{ title }}</h2>
    <p v-if="summary">{{ summary }}</p>
    <slot name="help" />
    <time v-if="updatedAt">{{ updatedAt }}</time>
    <slot name="actions" />
  </header>
</template>
