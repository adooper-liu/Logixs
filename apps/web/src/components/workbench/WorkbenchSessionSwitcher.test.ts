import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { WorkSessionV1 } from "@logix/contracts";
import WorkbenchSessionSwitcher from "./WorkbenchSessionSwitcher.vue";

const sessions = [
  session("selection", "current", "选品 · 合成机会 REF-001"),
  session("stuffing", "resumable", "装箱 · 合成货柜 REF-002"),
];

describe("WorkbenchSessionSwitcher", () => {
  it("opens without switching and renders exactly one current session", async () => {
    const select = vi.fn();
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: { sessions, onSelect: select },
    });

    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");

    expect(select).not.toHaveBeenCalled();
    expect(wrapper.findAll('[aria-current="true"]')).toHaveLength(1);
    expect(wrapper.text()).toContain("待续办");
  });

  it("shows truthful dirty choices before retrying a switch", async () => {
    const resolveChoice = vi.fn(async () => ({
      kind: "switched" as const,
      session: { ...sessions[1]!, status: "current" as const },
    }));
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: {
        sessions,
        onSelect: vi.fn(async () => ({
          kind: "needs-choice" as const,
          choices: ["save", "discard", "stay"] as const,
        })),
        onResolveChoice: resolveChoice,
      },
    });

    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");
    await wrapper.get('[data-session-id="stuffing"]').trigger("click");
    expect(wrapper.text()).toContain("保存领域草稿并切换");
    expect(wrapper.text()).toContain("放弃本地改动并切换");
    expect(wrapper.text()).toContain("留在当前页");
    await wrapper.get('[data-dirty-choice="save"]').trigger("click");
    expect(resolveChoice).toHaveBeenCalledWith(sessions[1], "save");
  });

  it("traps keyboard focus inside the modal and returns focus on Escape", async () => {
    const wrapper = mount(WorkbenchSessionSwitcher, {
      attachTo: document.body,
      props: { sessions, onSelect: vi.fn() },
    });
    const trigger = wrapper.get('[aria-label="切换工作现场"]');
    await trigger.trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    const controls = dialog.findAll("button");
    controls.at(-1)!.element.focus();
    await dialog.trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(controls[0]!.element);
    await dialog.trigger("keydown", { key: "Escape" });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it("keeps the current marker when switching fails", async () => {
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: {
        sessions,
        onSelect: vi.fn(async () => ({
          kind: "failed" as const,
          message: "草稿保存失败，仍停留在当前工作现场",
        })),
      },
    });
    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");
    await wrapper.get('[data-session-id="stuffing"]').trigger("click");

    expect(wrapper.text()).toContain("草稿保存失败，仍停留在当前工作现场");
    expect(wrapper.get('[aria-current="true"]').text()).toContain("选品");
  });

  it("renders all six states as text and keeps closed sessions in a collapsed inspection area", async () => {
    const allStates = [
      session("current", "current", "当前现场"),
      session("resumable", "resumable", "待续办现场"),
      session("draft", "draft_saved", "草稿现场"),
      session("browser", "browser_held", "标签现场"),
      session("conflict", "conflict", "冲突现场"),
      session("closed", "closed", "关闭现场"),
    ];
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: { sessions: allStates, onSelect: vi.fn(), onClose: vi.fn() },
    });

    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");

    for (const label of [
      "当前",
      "待续办",
      "领域草稿已保存",
      "仅此标签保留",
      "冲突",
      "已关闭",
    ]) {
      expect(wrapper.text()).toContain(label);
    }
    expect(wrapper.get("details").attributes("open")).toBeUndefined();
    expect(wrapper.get("details").text()).toContain("已关闭工作现场");
    expect(wrapper.get("details").text()).toContain("工作现场已关闭");
    expect(wrapper.get("details").text()).toContain(
      "关闭现场不等于业务完成、延期或责任转移",
    );
    expect(wrapper.get("details").text()).toContain(
      "重新进入该对象会建立新的受控现场，并重新授权和重读",
    );
    expect(
      wrapper.find('[data-session-id="closed"][aria-current]').exists(),
    ).toBe(false);
  });

  it("closes only a non-current live session and keeps the menu open on failure", async () => {
    const close = vi
      .fn()
      .mockResolvedValueOnce({ kind: "closed" as const })
      .mockResolvedValueOnce({
        kind: "failed" as const,
        message: "关闭失败，请重新加载后再试",
      });
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: { sessions, onSelect: vi.fn(), onClose: close },
    });
    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");

    expect(wrapper.find('[data-close-session="selection"]').exists()).toBe(
      false,
    );
    await wrapper.get('[data-close-session="stuffing"]').trigger("click");
    expect(close).toHaveBeenCalledWith(sessions[1]);

    await wrapper.get('[data-close-session="stuffing"]').trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "关闭失败，请重新加载后再试",
    );
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.get('[aria-current="true"]').text()).toContain("选品");
  });

  it("hides close for browser-held input while keeping other non-current live states closable", async () => {
    const close = vi.fn();
    const protectedSessions = [
      session("current", "current", "当前现场"),
      session("resumable", "resumable", "待续办现场"),
      session("draft", "draft_saved", "草稿现场"),
      session("browser", "browser_held", "标签现场"),
      session("conflict", "conflict", "冲突现场"),
      session("closed", "closed", "关闭现场"),
    ];
    const wrapper = mount(WorkbenchSessionSwitcher, {
      props: {
        sessions: protectedSessions,
        onSelect: vi.fn(),
        onClose: close,
      },
    });

    await wrapper.get('[aria-label="切换工作现场"]').trigger("click");

    expect(wrapper.find('[data-close-session="current"]').exists()).toBe(false);
    expect(wrapper.find('[data-close-session="browser"]').exists()).toBe(false);
    expect(wrapper.find('[data-close-session="closed"]').exists()).toBe(false);
    expect(wrapper.find('[data-close-session="resumable"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-close-session="draft"]').exists()).toBe(true);
    expect(wrapper.find('[data-close-session="conflict"]').exists()).toBe(true);
  });
});

function session(
  id: string,
  status: WorkSessionV1["status"],
  displaySummary: string,
): WorkSessionV1 {
  return {
    contractVersion: "work-session.v1",
    sessionId: id,
    version: 1,
    status,
    workbenchCode: "product_selection",
    contextKey: id,
    routeContext: {
      kind: "product_selection.v1",
      handoffId: "33333333-3333-4333-8333-333333333333",
    },
    subjectRef: {
      kind: "product_initiative_handoff",
      id: "33333333-3333-4333-8333-333333333333",
    },
    displaySummary,
    lastOpenedAt: "2026-10-14T08:00:00.000Z",
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}
