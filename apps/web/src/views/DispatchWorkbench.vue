<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PreDepartureDispatchWorkbench from "../components/dispatch/PreDepartureDispatchWorkbench.vue";
import PostDepartureHandoffWorkbench from "../components/shipment-handoff/PostDepartureHandoffWorkbench.vue";

const route = useRoute();
const router = useRouter();
const showLoadingHistory = computed(() => route.query.view === "loading");

function openHandoffIntake(): void {
  void router.replace({ path: "/workspaces/dispatch" });
}

function openLoadingHistory(): void {
  void router.replace({
    path: "/workspaces/dispatch",
    query: { view: "loading" },
  });
}
</script>

<template>
  <PreDepartureDispatchWorkbench
    v-if="showLoadingHistory"
    @show-handoff-intake="openHandoffIntake"
  />
  <PostDepartureHandoffWorkbench
    v-else
    @show-loading-history="openLoadingHistory"
  />
</template>
