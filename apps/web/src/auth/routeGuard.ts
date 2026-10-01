import type { RouteLocationNormalized } from "vue-router";
import type { AuthSession } from "./session";

/**
 * 全局认证边界：只回答“当前标签页是否已登录”。角色、能力、对象范围和业务动作一律由服务端
 * 在每次请求时重新授权，这里不读取 `meta.roles` 或 `meta.requiredCapabilities`。
 */
export function createAuthGuard(resolveSession: () => AuthSession) {
  return async (to: RouteLocationNormalized) => {
    if (to.meta.authPublic) return true;
    const session = resolveSession();
    await session.initialize();
    if (session.isAuthenticated()) return true;
    await session.signIn(to.fullPath);
    return false;
  };
}
