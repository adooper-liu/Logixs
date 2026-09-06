import { afterEach } from "vitest";
import { config, enableAutoUnmount } from "@vue/test-utils";

config.global.stubs = {
  transition: false,
};

enableAutoUnmount(afterEach);

afterEach(() => {
  document.body.innerHTML = "";
});
