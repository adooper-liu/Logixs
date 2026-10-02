<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { DEFAULT_RETURN_URL } from "./returnUrl";
import { useAuthSession } from "./useAuthSession";

const props = defineProps<{ kind: "signin" | "signout" }>();

const router = useRouter();
const auth = useAuthSession();
const phase = shallowRef<"processing" | "signed_out" | "failed">("processing");

const message = computed(() => {
  if (phase.value === "signed_out") return "已退出登录。";
  if (phase.value === "failed") {
    return props.kind === "signin"
      ? "登录未完成，请重新登录。"
      : "退出登录未完成，本页会话已清除。";
  }
  return props.kind === "signin" ? "正在完成登录…" : "正在退出登录…";
});

onMounted(async () => {
  try {
    if (props.kind === "signin") {
      await router.replace(await auth.completeSignIn());
      return;
    }
    await auth.completeSignOut();
    phase.value = "signed_out";
  } catch {
    phase.value = "failed";
  }
});

function signInAgain() {
  void auth.signIn(DEFAULT_RETURN_URL);
}
</script>

<template>
  <section class="auth-callback" aria-live="polite">
    <p>{{ message }}</p>
    <button
      v-if="phase !== 'processing'"
      type="button"
      class="btn btn--primary"
      @click="signInAgain"
    >
      重新登录
    </button>
  </section>
</template>

<style scoped>
.auth-callback {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-6);
}
</style>
