import { createApp } from "vue";
import { ElDialog } from "element-plus";
import "element-plus/es/components/base/style/css";
import "element-plus/es/components/dialog/style/css";
import App from "./App.vue";
import router from "./router";
import "./styles/base.css";
import "./styles/element.css";
import "./styles/utilities.css";

createApp(App).use(ElDialog).use(router).mount("#app");
