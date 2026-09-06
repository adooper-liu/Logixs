import { createApp, type App } from "vue";

export function withSetup<T>(composable: () => T): [T, App] {
  let result: T | undefined;
  const app = createApp({
    setup() {
      result = composable();
      return () => undefined;
    },
  });

  app.mount(document.createElement("div"));
  return [result as T, app];
}
