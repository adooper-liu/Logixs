import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, shallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCollaborationPanelModel } from "../../composables/useTaskCollaboration";

const useTaskCollaboration = vi.fn((context: unknown) => {
  void context;
  return collaborationModel();
});

vi.mock("../../composables/useTaskCollaboration", () => ({
  useTaskCollaboration: (...args: unknown[]) => useTaskCollaboration(args[0]),
}));
vi.mock("./TaskCollaborationPanel.vue", () => ({
  default: {
    name: "TaskCollaborationPanel",
    props: ["state"],
    emits: ["submit", "retry", "loadMore"],
    template: `
      <section data-testid="shared-collaboration-panel">
        共享协作
        <button data-testid="panel-submit" @click="$emit('submit')">发送</button>
        <button data-testid="panel-retry-thread" @click="$emit('retry', 'thread')">重试读取</button>
        <button data-testid="panel-retry-send" @click="$emit('retry', 'send')">重试发送</button>
        <button data-testid="panel-load-more" @click="$emit('loadMore')">更早消息</button>
      </section>
    `,
  },
}));

const { default: TaskContextPanel } = await import("./TaskContextPanel.vue");

describe("TaskContextPanel", () => {
  beforeEach(() => useTaskCollaboration.mockClear());

  it("shows only available fixed modes with their human labels", () => {
    const { wrapper } = mountPanel({ modes: ["work", "collaboration"] });

    const controls = wrapper
      .get('[aria-label="任务上下文模式"]')
      .findAll("button");
    expect(controls.map((control) => control.text())).toEqual(["办理", "协作"]);
    expect(wrapper.text()).not.toContain("即将推出");
    expect(wrapper.find('[data-context-mode="archive"]').exists()).toBe(false);
  });

  it("keeps work and archive mounted while rendering collaboration internally once", async () => {
    const { wrapper } = mountPanel(
      { modes: ["work", "archive", "collaboration"] },
      { collaboration: "消费者伪造协作", archive: "档案表单值" },
    );
    const workInput = wrapper.get<HTMLInputElement>(
      '[data-testid="work-input"]',
    );
    await workInput.setValue("办理草稿");

    await selectMode(wrapper, "archive");
    await selectMode(wrapper, "collaboration");
    await selectMode(wrapper, "work");

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="work-input"]').element.value,
    ).toBe("办理草稿");
    expect(wrapper.get('[data-testid="archive-slot"]').text()).toContain(
      "档案表单值",
    );
    expect(
      wrapper.findAll('[data-testid="shared-collaboration-panel"]'),
    ).toHaveLength(1);
    expect(wrapper.text()).not.toContain("消费者伪造协作");
  });

  it("makes every inactive root hidden, inert, aria-hidden, and untabbable", async () => {
    const { wrapper } = mountPanel({
      modes: ["work", "archive", "collaboration"],
    });

    await selectMode(wrapper, "archive");

    const work = wrapper.get('[data-context-mode="work"]');
    const archive = wrapper.get('[data-context-mode="archive"]');
    const collaboration = wrapper.get('[data-context-mode="collaboration"]');
    for (const inactive of [work, collaboration]) {
      expect(inactive.attributes()).toHaveProperty("hidden");
      expect(inactive.attributes()).toHaveProperty("inert");
      expect(inactive.attributes("aria-hidden")).toBe("true");
    }
    expect(archive.attributes()).not.toHaveProperty("hidden");
    expect(archive.attributes()).not.toHaveProperty("inert");
    expect(archive.attributes("aria-hidden")).toBeUndefined();
    expect(work.get("input").attributes("tabindex")).toBe("-1");
  });

  it("restores outer WorkbenchPane scroll and focus independently for each mode", async () => {
    const { wrapper, scrollOwner } = mountPanel({
      modes: ["work", "archive", "collaboration"],
    });
    const workInput = wrapper.get<HTMLInputElement>(
      '[data-testid="work-input"]',
    );
    workInput.element.focus();
    scrollOwner.scrollTop = 123;

    await selectMode(wrapper, "archive");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('[data-mode-control="archive"]').element,
    );
    const archiveButton = wrapper.get<HTMLButtonElement>(
      '[data-testid="archive-button"]',
    );
    archiveButton.element.focus();
    scrollOwner.scrollTop = 231;

    await selectMode(wrapper, "work");
    await flushPromises();
    expect(scrollOwner.scrollTop).toBe(123);
    expect(document.activeElement).toBe(workInput.element);

    await selectMode(wrapper, "archive");
    await flushPromises();
    expect(scrollOwner.scrollTop).toBe(231);
    expect(document.activeElement).toBe(archiveButton.element);
  });

  it("resets to work on context change and cancels the old mode restoration", async () => {
    const { wrapper, scrollOwner } = mountPanel({
      modes: ["work", "archive", "collaboration"],
    });
    await selectMode(wrapper, "archive");
    const archiveButton = wrapper.get<HTMLButtonElement>(
      '[data-testid="archive-button"]',
    );
    archiveButton.element.focus();
    scrollOwner.scrollTop = 251;

    await wrapper.get('[data-mode-control="collaboration"]').trigger("click");
    await wrapper.setProps({ modelValue: "collaboration" });
    await wrapper.setProps({
      contextKey: "container-B|task-B",
      modelValue: "work",
    });
    await nextTick();
    await flushPromises();

    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper.get('[data-context-mode="work"]').attributes(),
    ).not.toHaveProperty("hidden");
    expect(document.activeElement).not.toBe(archiveButton.element);
  });

  it("exposes the fixed facade and forwards collaboration events", async () => {
    const model = collaborationModel();
    const { wrapper } = mountPanel({ collaboration: model });

    expect(Object.keys(wrapper.vm.$options.props ?? {}).sort()).toEqual([
      "collaboration",
      "contextKey",
      "modelValue",
      "modes",
    ]);
    expect(useTaskCollaboration).not.toHaveBeenCalled();
    expect(
      wrapper.getComponent({ name: "TaskCollaborationPanel" }).props("state"),
    ).toBe(model);

    await wrapper.get('[data-testid="panel-submit"]').trigger("click");
    await wrapper.get('[data-testid="panel-retry-thread"]').trigger("click");
    await wrapper.get('[data-testid="panel-retry-send"]').trigger("click");
    await wrapper.get('[data-testid="panel-load-more"]').trigger("click");

    expect(wrapper.emitted("submit")).toEqual([[]]);
    expect(wrapper.emitted("retry")).toEqual([["thread"], ["send"]]);
    expect(wrapper.emitted("loadMore")).toEqual([[]]);
  });

  it("uses modelValue as a controlled mode and requests work on context change", async () => {
    const { wrapper } = mountPanel();

    await wrapper.get('[data-mode-control="archive"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["archive"]]);
    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");

    await wrapper.setProps({ modelValue: "archive" });
    expect(
      wrapper.get('[data-mode-control="archive"]').attributes("aria-pressed"),
    ).toBe("true");
    await wrapper.setProps({ contextKey: "container-B|task-B" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["work"]);
  });

  it("does not create an inner vertical scroll owner", () => {
    const { wrapper } = mountPanel();

    expect(
      wrapper.findAll('[class*="scroll"]').filter((node) => {
        const style = getComputedStyle(node.element);
        return /(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`);
      }),
    ).toHaveLength(0);
  });
});

function mountPanel(
  props: Record<string, unknown> = {},
  content: { archive?: string; collaboration?: string } = {},
) {
  const scrollOwner = document.createElement("div");
  scrollOwner.className = "workbench-pane__scroll--independent";
  document.body.append(scrollOwner);
  const wrapper = mount(TaskContextPanel, {
    attachTo: scrollOwner,
    props: {
      modelValue: "work",
      contextKey: "container-A|task-A",
      collaboration: collaborationModel(),
      modes: ["work", "archive", "collaboration"],
      ...props,
    },
    slots: {
      work: '<input data-testid="work-input" />',
      archive: `<section data-testid="archive-slot"><button data-testid="archive-button">档案动作</button>${content.archive ?? ""}</section>`,
      collaboration: content.collaboration ?? "",
    },
  });
  return { wrapper, scrollOwner };
}

async function selectMode(
  wrapper: ReturnType<typeof mountPanel>["wrapper"],
  mode: "work" | "archive" | "collaboration",
): Promise<void> {
  await wrapper.get(`[data-mode-control="${mode}"]`).trigger("click");
  await wrapper.setProps({ modelValue: mode });
  await flushPromises();
}

function collaborationModel(): TaskCollaborationPanelModel {
  return {
    messages: shallowRef([]),
    loading: shallowRef(false),
  } as unknown as TaskCollaborationPanelModel;
}
