import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import RoleWorkbenchFrame from "./RoleWorkbenchFrame.vue";

const container = {
  id: "container-1",
  orderNumber: "SO-1",
  containerNumber: "MSCU1234567",
  currentStatus: "not_shipped" as const,
  updatedAt: "2026-09-21T00:00:00.000Z",
};

describe("RoleWorkbenchFrame", () => {
  it("keeps role context, selection and the three work streams in one shell", async () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        title: "备货工作台",
        summary: "备货事实",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        containers: [container],
        selectedContainerId: container.id,
        selectedContainer: container,
        nodes: [],
        containerListLoading: false,
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
      },
      slots: {
        queue: "<div data-testid='queue'>岗位任务池</div>",
        primary: "<div data-testid='primary'>装载事实</div>",
        secondary: "<div data-testid='secondary'>岗位待办</div>",
      },
      global: { stubs: { PageHeader: true } },
    });

    expect(wrapper.text()).toContain("MSCU1234567");
    expect(wrapper.text()).toContain("这柜尚未初始化生命周期流程");
    expect(wrapper.find('[aria-label="货柜节点"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="岗位任务池"]').text()).toContain(
      "岗位任务池",
    );
    expect(wrapper.get('[aria-label="岗位事实"]').text()).toContain("装载事实");
    expect(wrapper.get('[aria-label="岗位待办"]').text()).toContain("岗位待办");

    await wrapper
      .get('[data-testid="workbench-container-select"]')
      .setValue("");
    expect(wrapper.emitted("selectContainer")).toEqual([[""]]);
  });

  it("keeps the role queue usable before a container is selected", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        title: "备货工作台",
        summary: "备货事实",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        containers: [container],
        selectedContainerId: "",
        selectedContainer: null,
        nodes: [],
        containerListLoading: false,
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
      },
      slots: { queue: "<div>可执行任务</div>" },
      global: { stubs: { PageHeader: true } },
    });

    expect(wrapper.get('[aria-label="岗位任务池"]').text()).toContain(
      "可执行任务",
    );
    expect(wrapper.find('[aria-label="岗位事实"]').exists()).toBe(false);
  });

  it("shows auxiliary warnings without hiding the selected container", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        title: "备货工作台",
        summary: "备货事实",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        containers: [container],
        selectedContainerId: container.id,
        selectedContainer: container,
        nodes: [],
        containerListLoading: false,
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [{ code: "compliance", message: "合规评审暂时没能加载" }],
      },
      global: { stubs: { PageHeader: true } },
    });

    expect(wrapper.get('[aria-label="局部数据提示"]').text()).toContain(
      "合规评审暂时没能加载",
    );
    expect(wrapper.text()).toContain("MSCU1234567");
  });
});
