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
