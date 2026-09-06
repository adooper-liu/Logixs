import { defineUiTheme } from "../../ui-theme/contracts";
import LogixAppShell from "./LogixAppShell.vue";
import LogixPageHeader from "./LogixPageHeader.vue";
import "./tokens.css";

export const logixTheme = defineUiTheme({
  id: "logix",
  components: {
    appShell: LogixAppShell,
    pageHeader: LogixPageHeader,
  },
});
