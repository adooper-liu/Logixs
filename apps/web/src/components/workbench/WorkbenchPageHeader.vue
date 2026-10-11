<script setup lang="ts">
import { computed } from "vue";
import {
  workbenchPurposeByCode,
  type WorkbenchCode,
} from "../../data/workbenchPurposes.generated";
import PageHeader from "../ui/PageHeader.vue";

const props = withDefaults(
  defineProps<{
    stageCode: WorkbenchCode;
    eyebrow?: string;
    updatedAt?: string;
  }>(),
  { eyebrow: "岗位工作台", updatedAt: undefined },
);

defineSlots<{
  help(): unknown;
  switcher(): unknown;
  moreFunctions(): unknown;
  actions(): unknown;
}>();

const identity = computed(() => workbenchPurposeByCode[props.stageCode]);
</script>

<template>
  <PageHeader
    :eyebrow="eyebrow"
    :title="identity.title"
    :summary="identity.businessPurpose"
    :updated-at="updatedAt"
  >
    <template v-if="$slots.help" #help><slot name="help" /></template>
    <template
      v-if="$slots.switcher || $slots.moreFunctions || $slots.actions"
      #actions
    >
      <template v-if="$slots.switcher || $slots.moreFunctions">
        <slot name="switcher" />
        <slot name="moreFunctions" />
      </template>
      <slot v-else name="actions" />
    </template>
  </PageHeader>
</template>
