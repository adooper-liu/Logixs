import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchPageHeader from "./WorkbenchPageHeader.vue";

describe("WorkbenchPageHeader", () => {
  const PageHeaderStub = {
    props: ["eyebrow", "title", "summary", "updatedAt"],
    template: `
      <header>
        <small>{{ eyebrow }}</small>
        <h1>{{ title }}</h1>
        <p>{{ summary }}</p>
        <time v-if="updatedAt">{{ updatedAt }}</time>
        <slot name="help" />
        <slot name="actions" />
      </header>
    `,
  };

  it("renders the generated formal title and business purpose for a stage code", () => {
    const wrapper = mount(WorkbenchPageHeader, {
      props: { stageCode: "product_selection" },
      global: { stubs: { PageHeader: PageHeaderStub } },
    });

    expect(wrapper.get("h1").text()).toBe("选品立项");
    expect(wrapper.get("p").text()).toBe(
      "完成商业论证和资源取舍，决定是否形成有责任人的产品立项",
    );
  });

  it("keeps the generated purpose stable when surrounding state changes", async () => {
    const wrapper = mount(WorkbenchPageHeader, {
      props: { stageCode: "product_selection", updatedAt: "10:20" },
      global: { stubs: { PageHeader: PageHeaderStub } },
    });

    await wrapper.setProps({ updatedAt: "11:45", eyebrow: "只读回看" });

    expect(wrapper.get("p").text()).toBe(
      "完成商业论证和资源取舍，决定是否形成有责任人的产品立项",
    );
    expect(wrapper.get("time").text()).toBe("11:45");
  });

  it("forwards help and actions slots without accepting title or summary overrides", () => {
    const wrapper = mount(WorkbenchPageHeader, {
      props: {
        stageCode: "product_selection",
      },
      slots: {
        help: '<button aria-label="帮助">?</button>',
        actions: '<button aria-label="动作">执行</button>',
      },
      global: { stubs: { PageHeader: PageHeaderStub } },
    });

    expect(wrapper.find('[aria-label="帮助"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="动作"]').exists()).toBe(true);
    expect(wrapper.get("h1").text()).toBe("选品立项");
  });
});
