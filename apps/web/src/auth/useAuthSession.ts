import { computed, getCurrentScope, onScopeDispose, shallowRef } from "vue";
import { getAuthSession } from "./session";

/** 会话的最小只读投影；Token 与 SDK 实例都留在 session 内，不进入 Vue 响应式。 */
export function useAuthSession() {
  const session = getAuthSession();
  const snapshot = shallowRef(session.snapshot());
  const stop = session.subscribe((next) => {
    snapshot.value = next;
  });
  if (getCurrentScope()) onScopeDispose(stop);

  return {
    mode: session.mode,
    status: computed(() => snapshot.value.status),
    profile: computed(() => snapshot.value.profile),
    errorCode: computed(() => snapshot.value.errorCode),
    isAuthenticated: computed(() => snapshot.value.status === "authenticated"),
    /** 当前操作者的稳定 subject；未认证时为 null，调用方不得以空串或固定 ID 代替。 */
    actorId: computed(() =>
      snapshot.value.status === "authenticated"
        ? (snapshot.value.profile?.subject ?? null)
        : null,
    ),
    signIn: (returnUrl: string) => session.signIn(returnUrl),
    signOut: () => session.signOut(),
    completeSignIn: () => session.completeSignIn(),
    completeSignOut: () => session.completeSignOut(),
  };
}
