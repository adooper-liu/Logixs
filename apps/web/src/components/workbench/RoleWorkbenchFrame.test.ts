import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import RoleWorkbenchFrame from "./RoleWorkbenchFrame.vue";
import WorkbenchLayout from "./WorkbenchLayout.vue";

const container = {
  id: "container-1",
  orderNumber: "SO-1",
  containerNumber: "MSCU1234567",
  currentStatus: "not_shipped" as const,
  updatedAt: "2026-09-21T00:00:00.000Z",
};
const attachedWrappers: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  attachedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("RoleWorkbenchFrame", () => {
  it("keeps the queue as the only selector and shows the selected context", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "cargo_ready",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        selectedContainer: container,
        nodes: [],
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
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    expect(wrapper.text()).toContain("MSCU1234567");
    expect(wrapper.text()).toContain("这柜尚未初始化生命周期流程");
    expect(wrapper.find('[aria-label="货柜节点"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="岗位任务池"]').text()).toContain(
      "岗位任务池",
    );
    expect(wrapper.get('[aria-label="岗位事实"]').text()).toContain("装载事实");
    expect(wrapper.get('[aria-label="岗位待办"]').text()).toContain("岗位待办");
    expect(
      wrapper.find('[data-testid="workbench-container-select"]').exists(),
    ).toBe(false);
    expect(wrapper.emitted("selectContainer")).toBeUndefined();
  });

  it("keeps the role queue usable before a container is selected", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "cargo_ready",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        selectedContainer: null,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
      },
      slots: { queue: "<div>可执行任务</div>" },
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    expect(wrapper.get('[aria-label="岗位任务池"]').text()).toContain(
      "可执行任务",
    );
    expect(wrapper.get('[aria-label="岗位事实"]').text()).toContain(
      "从左侧任务队列选择一项工作",
    );
  });

  it("keeps existing consumers on the stacked compatibility response mode", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "cargo_ready",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        selectedContainer: container,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
        contextReady: true,
      },
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    const layout = wrapper.getComponent(WorkbenchLayout);
    expect(layout.props("responsiveMode")).toBe("stacked");
    expect(layout.props("rightRailLabel")).toBe("岗位待办");
    expect(layout.props("rightRailSummary")).toBe("查看动作");
    expect(layout.props("mobileContextLabel")).toBe("编辑");
    expect(wrapper.get('[aria-label="岗位待办"] h2').text()).toBe("岗位待办");
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
  });

  it("collapses and expands the queue without unmounting its content", async () => {
    const wrapper = mountInteractiveFrame();
    const layout = wrapper.getComponent(WorkbenchLayout);
    const queueAction = wrapper.get<HTMLElement>(
      '[data-testid="queue-action"]',
    );

    expect(layout.props("responsiveMode")).toBe("stacked");
    expect(layout.props("leftCollapsed")).toBe(false);
    expect(layout.props("rightCollapsed")).toBe(false);
    expect(wrapper.find('[aria-label="折叠岗位任务池"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="折叠岗位待办"]').exists()).toBe(true);

    queueAction.element.focus();
    expect(document.activeElement).toBe(queueAction.element);
    await wrapper.get('[aria-label="折叠岗位任务池"]').trigger("click");

    expect(wrapper.find('[aria-label="展开岗位任务池"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-workbench-pane="queue"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="queue-action"]').exists()).toBe(true);
    const collapsedBody = wrapper.get(
      '[data-workbench-pane="queue"] .collapsible-rail__body',
    );
    expect(collapsedBody.attributes()).toHaveProperty("hidden");
    expect(collapsedBody.attributes()).toHaveProperty("inert");

    await wrapper.get('[aria-label="展开岗位任务池"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="折叠岗位任务池"]').exists()).toBe(true);
    const expandedBody = wrapper.get(
      '[data-workbench-pane="queue"] .collapsible-rail__body',
    );
    expect(expandedBody.attributes()).not.toHaveProperty("hidden");
    expect(expandedBody.attributes()).not.toHaveProperty("inert");
    expect(document.activeElement).toBe(queueAction.element);
  });

  it("collapses both rails while preserving pane order and restores context focus", async () => {
    const wrapper = mountInteractiveFrame();
    const contextAction = wrapper.get<HTMLElement>(
      '[data-testid="context-action"]',
    );

    await wrapper.get('[aria-label="折叠岗位任务池"]').trigger("click");
    contextAction.element.focus();
    expect(document.activeElement).toBe(contextAction.element);
    await wrapper.get('[aria-label="折叠岗位待办"]').trigger("click");

    expect(wrapper.find('[aria-label="展开岗位任务池"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="展开岗位待办"]').exists()).toBe(true);
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
    expect(wrapper.find('[data-testid="detail-fact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="context-action"]').exists()).toBe(true);
    const contextBody = wrapper.get(
      '[data-workbench-pane="context"] .collapsible-rail__body',
    );
    expect(contextBody.attributes()).toHaveProperty("hidden");
    expect(contextBody.attributes()).toHaveProperty("inert");

    await wrapper.get('[aria-label="展开岗位待办"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[aria-label="折叠岗位待办"]').exists()).toBe(true);
    expect(document.activeElement).toBe(contextAction.element);

    await wrapper.get('[aria-label="展开岗位任务池"]').trigger("click");
    expect(wrapper.find('[aria-label="折叠岗位任务池"]').exists()).toBe(true);
  });

  it("keeps both rails collapsed across asynchronous context rerenders", async () => {
    const wrapper = mountInteractiveFrame();
    const queueAction = wrapper.get<HTMLElement>(
      '[data-testid="queue-action"]',
    );
    const assertCollapsedState = () => {
      const layout = wrapper.getComponent(WorkbenchLayout);
      expect(layout.props("leftCollapsed")).toBe(true);
      expect(layout.props("rightCollapsed")).toBe(true);
      expect(wrapper.findAll('[aria-label^="展开"]')).toHaveLength(2);
      expect(
        wrapper
          .findAll("[data-workbench-pane]")
          .map((pane) => pane.attributes("data-workbench-pane")),
      ).toEqual(["queue", "detail", "context"]);
      expect(wrapper.find('[data-testid="queue-action"]').exists()).toBe(true);
    };
    const assertReadySlots = () => {
      expect(wrapper.find('[data-testid="detail-fact"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="context-action"]').exists()).toBe(
        true,
      );
    };

    queueAction.element.focus();
    await wrapper.get('[aria-label="折叠岗位任务池"]').trigger("click");
    await wrapper.get('[aria-label="折叠岗位待办"]').trigger("click");
    assertCollapsedState();

    await wrapper.setProps({ selectionLoading: true });
    assertCollapsedState();
    await wrapper.setProps({ selectionLoading: false });
    assertCollapsedState();
    assertReadySlots();
    await wrapper.setProps({ contextLabel: "当前办理" });
    assertCollapsedState();
    assertReadySlots();
    await wrapper.setProps({
      selectedContainer: {
        ...container,
        id: "container-2",
        containerNumber: "MSCU7654321",
      },
    });
    assertCollapsedState();
    assertReadySlots();

    await wrapper.get('[aria-label="展开岗位任务池"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(queueAction.element);
    expect(
      wrapper
        .get('[data-workbench-pane="queue"] .collapsible-rail__body')
        .attributes(),
    ).not.toHaveProperty("hidden");

    await wrapper.get('[aria-label="展开当前办理"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(
      wrapper
        .get('[data-workbench-pane="context"] .collapsible-rail__body')
        .attributes(),
    ).not.toHaveProperty("hidden");
  });

  it("only changes context labels when a consumer provides them", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "customs",
        workspaceLabel: "进口清关",
        nodeScopeLabel: "进口清关",
        selectedContainer: container,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
        contextReady: true,
        contextLabel: "当前可见档案",
        contextSummary: "核对记录",
        mobileContextLabel: "档案",
      },
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    const layout = wrapper.getComponent(WorkbenchLayout);
    expect(layout.props("responsiveMode")).toBe("stacked");
    expect(layout.props("rightRailLabel")).toBe("当前可见档案");
    expect(layout.props("rightRailSummary")).toBe("核对记录");
    expect(layout.props("mobileContextLabel")).toBe("档案");
    expect(wrapper.get('[aria-label="当前可见档案"] h2').text()).toBe(
      "当前可见档案",
    );
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
  });

  it("forwards the production work-session switcher slot", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "stuffing",
        workspaceLabel: "装箱",
        nodeScopeLabel: "装箱",
        selectedContainer: container,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
      },
      slots: {
        switcher: '<button aria-label="切换工作现场">切换</button>',
      },
      global: {
        stubs: {
          WorkbenchPageHeader: {
            template: '<header><slot name="switcher" /></header>',
          },
        },
      },
    });

    expect(wrapper.find('[aria-label="切换工作现场"]').exists()).toBe(true);
  });

  it("keeps all three information responsibilities before a container is selected", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "cargo_ready",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        selectedContainer: null,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [],
        contextReady: false,
      },
      slots: { queue: "<div>可执行任务</div>" },
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    expect(wrapper.findAll('[data-workbench-pane="queue"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-workbench-pane="detail"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-workbench-pane="context"]')).toHaveLength(1);
    expect(wrapper.text()).toContain("从左侧任务队列选择一项工作");
    expect(wrapper.text()).toContain("选择对象后显示动作");
  });

  it("shows auxiliary warnings without hiding the selected container", () => {
    const wrapper = mount(RoleWorkbenchFrame, {
      props: {
        stageCode: "cargo_ready",
        workspaceLabel: "备货",
        nodeScopeLabel: "备货",
        selectedContainer: container,
        nodes: [],
        selectionLoading: false,
        containerListError: "",
        selectionError: "",
        warnings: [{ code: "compliance", message: "合规评审暂时没能加载" }],
      },
      global: { stubs: { WorkbenchPageHeader: true } },
    });

    expect(wrapper.get('[aria-label="局部数据提示"]').text()).toContain(
      "合规评审暂时没能加载",
    );
    expect(wrapper.text()).toContain("MSCU1234567");
  });
});

function mountInteractiveFrame() {
  const wrapper = mount(RoleWorkbenchFrame, {
    attachTo: document.body,
    props: {
      stageCode: "cargo_ready",
      workspaceLabel: "备货",
      nodeScopeLabel: "备货",
      selectedContainer: container,
      nodes: [],
      selectionLoading: false,
      containerListError: "",
      selectionError: "",
      warnings: [],
    },
    slots: {
      queue:
        '<button type="button" data-testid="queue-action">处理队列</button>',
      primary: '<p data-testid="detail-fact">岗位事实内容</p>',
      secondary:
        '<button type="button" data-testid="context-action">处理待办</button>',
    },
    global: { stubs: { WorkbenchPageHeader: true } },
  });
  attachedWrappers.push(wrapper);
  return wrapper;
}
