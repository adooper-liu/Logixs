import { markRaw, type Component, type InjectionKey, type Ref } from "vue";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  summary?: string;
  updatedAt?: string;
}

export interface UiThemeComponents {
  appShell: Component;
  pageHeader: Component;
}

export interface UiThemeAdapter {
  readonly id: string;
  readonly components: Readonly<UiThemeComponents>;
}

export type UiThemeContext = Readonly<Ref<UiThemeAdapter>>;

export const uiThemeKey: InjectionKey<UiThemeContext> = Symbol("ui-theme");

export function defineUiTheme<T extends UiThemeAdapter>(theme: T): T {
  return Object.freeze({
    ...theme,
    components: Object.freeze({
      appShell: markRaw(theme.components.appShell),
      pageHeader: markRaw(theme.components.pageHeader),
    }),
  }) as T;
}
