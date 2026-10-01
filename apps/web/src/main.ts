import { createApp } from "vue";
import { ElDialog } from "element-plus";
import "element-plus/es/components/base/style/css";
import "element-plus/es/components/dialog/style/css";
import App from "./App.vue";
import { AUTH_SILENT_CALLBACK_PATH, AuthConfigError } from "./auth/config";
import { getAuthSession } from "./auth/session";
import router from "./router";
import "./styles/base.css";
import "./styles/element.css";
import "./styles/utilities.css";

function bootstrap() {
  // 先解析认证配置：非法配置在挂载前失败关闭，不回退 development。
  const session = getAuthSession();
  if (window.location.pathname === AUTH_SILENT_CALLBACK_PATH) {
    void session.completeSilentRenew();
    return;
  }
  createApp(App).use(ElDialog).use(router).mount("#app");
}

try {
  bootstrap();
} catch (error) {
  if (error instanceof AuthConfigError) {
    const root = document.getElementById("app");
    if (root) root.textContent = "认证配置无效，应用未启动。";
  }
  throw error;
}
