import { mount } from "@vue/test-utils";
import { h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import AppShell from "../components/AppShell.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { defineUiTheme } from "./contracts";
import ContractTestPageHeader from "./test-fixtures/ContractTestPageHeader.vue";
import ContractTestShell from "./test-fixtures/ContractTestShell.vue";
import UiThemeProvider from "./UiThemeProvider.vue";

const testTheme = defineUiTheme({
  id: "contract-test",
  components: {
    appShell: ContractTestShell,
    pageHeader: ContractTestPageHeader,
  },
});

describe("UI theme contract", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-ui-theme");
  });

  it("replaces the application shell through the stable facade", () => {
    const wrapper = mount(UiThemeProvider, {
      props: { theme: testTheme },
      slots: { default: () => h(AppShell) },
    });

    expect(wrapper.get('[data-testid="test-shell"]').text()).toBe("替代壳");
    expect(document.documentElement.dataset.uiTheme).toBe("contract-test");

    wrapper.unmount();
    expect(document.documentElement.dataset.uiTheme).toBeUndefined();
  });

  it("keeps page-header props and slots stable across themes", () => {
    const wrapper = mount(UiThemeProvider, {
      props: { theme: testTheme },
      slots: {
        default: () =>
          h(
            PageHeader,
            { title: "清关计划", updatedAt: "14:20" },
            {
              help: () => h("button", { "aria-label": "查看清关计划口径" }),
              actions: () =>
                h("button", { "aria-label": "发布计划" }, "发布计划"),
            },
          ),
      },
    });
    const header = wrapper.get('[data-testid="test-page-header"]');

    expect(header.text()).toContain("清关计划");
    expect(header.text()).toContain("14:20");
    expect(header.get('[aria-label="查看清关计划口径"]')).toBeTruthy();
    expect(header.get('[aria-label="发布计划"]').text()).toBe("发布计划");
  });
});
