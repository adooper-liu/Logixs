import { inject } from "vue";
import { uiThemeKey } from "./contracts";

export function useUiTheme() {
  const theme = inject(uiThemeKey);

  if (!theme) {
    throw new Error("UI theme provider is missing");
  }

  return theme;
}
