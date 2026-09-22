import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { LiveNodeView } from "../../data/liveNodeProjection";
import LiveNodeRail from "./LiveNodeRail.vue";

function node(overrides: Partial<LiveNodeView> = {}): LiveNodeView {
  return {
    nodeInstanceId: "n1",
    nodeCode: "cargo_ready",
    sequence: 1,
    name: "备货",
    stateLabel: "未开始",
    completedAt: null,
    isCurrent: false,
    isNotApplicable: false,
    blockedCount: 0,
    times: { plannedAt: null, estimatedAt: null, actualAt: null },
    ...overrides,
  };
}

function cellText(wrapper: ReturnType<typeof mount>, index = 0): string {
  return wrapper.findAll('[data-testid="rail-node"]')[index]?.text() ?? "";
}

function cellAria(wrapper: ReturnType<typeof mount>, index = 0): string {
  return (
    wrapper
      .findAll('[data-testid="rail-node"]')
      [index]?.attributes("aria-label") ?? ""
  );
}

describe("LiveNodeRail", () => {
  it("每站渲染序号、名称与摘要日期", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            nodeInstanceId: "n3",
            nodeCode: "shipment_dispatch",
            sequence: 3,
            name: "出运",
            stateLabel: "进行中",
          }),
        ],
      },
    });

    const text = cellText(wrapper);
    expect(text).toContain("03");
    expect(text).toContain("出运");
  });

  it("三轨全空时写 —，不用 0 或假日期冒充", () => {
    const wrapper = mount(LiveNodeRail, {
      props: { timeZone: "UTC", nodes: [node()] },
    });

    expect(cellText(wrapper)).toContain("—");
  });

  it("摘要日期优先级：实际 > 预计 > 计划 > 完成时间", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            times: {
              plannedAt: "2026-09-20T00:00:00.000Z",
              estimatedAt: "2026-09-21T00:00:00.000Z",
              actualAt: "2026-09-22T00:00:00.000Z",
            },
            completedAt: "2026-09-23T00:00:00.000Z",
          }),
        ],
      },
    });

    expect(cellText(wrapper)).toContain("实09-22");
  });

  it("依次退到预计、计划、完成时间", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            nodeInstanceId: "a",
            times: {
              plannedAt: "2026-09-20T00:00:00.000Z",
              estimatedAt: "2026-09-21T00:00:00.000Z",
              actualAt: null,
            },
          }),
          node({
            nodeInstanceId: "b",
            times: {
              plannedAt: "2026-09-20T00:00:00.000Z",
              estimatedAt: null,
              actualAt: null,
            },
          }),
          node({
            nodeInstanceId: "c",
            times: { plannedAt: null, estimatedAt: null, actualAt: null },
            completedAt: "2026-09-23T00:00:00.000Z",
          }),
        ],
      },
    });

    expect(cellText(wrapper, 0)).toContain("预09-21");
    expect(cellText(wrapper, 1)).toContain("计09-20");
    expect(cellText(wrapper, 2)).toContain("完09-23");
  });

  it("按用户时区显示跨日日期", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "Asia/Shanghai",
        nodes: [
          node({
            times: {
              plannedAt: null,
              estimatedAt: null,
              actualAt: "2026-09-21T16:30:00.000Z",
            },
          }),
        ],
      },
    });

    // UTC 09-21 16:30 在上海是 09-22 00:30
    expect(cellText(wrapper)).toContain("实09-22");
  });

  it("不适用与留空是两种呈现", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            nodeInstanceId: "na",
            nodeCode: "transshipment",
            sequence: 6,
            name: "中转港",
            stateLabel: "不适用",
            isNotApplicable: true,
          }),
          node({ nodeInstanceId: "blank", sequence: 7, name: "清关" }),
        ],
      },
    });

    expect(cellText(wrapper, 0)).toContain("不适用");
    expect(cellText(wrapper, 0)).not.toContain("—");
    expect(cellText(wrapper, 1)).toContain("—");
    expect(cellText(wrapper, 1)).not.toContain("不适用");
  });

  it("状态、时间类型与未关闭阻塞写进 aria-label，不在视觉层堆文字", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            sequence: 3,
            name: "出运",
            stateLabel: "进行中",
            isCurrent: true,
            blockedCount: 1,
            times: {
              plannedAt: null,
              estimatedAt: "2026-09-22T00:00:00.000Z",
              actualAt: null,
            },
          }),
        ],
      },
    });

    const aria = cellAria(wrapper);
    expect(aria).toContain("出运");
    expect(aria).toContain("进行中");
    expect(aria).toContain("预计 09-22");
    expect(aria).toContain("有 1 项未关闭阻塞");

    const text = cellText(wrapper);
    expect(text).not.toContain("进行中");
    expect(text).not.toContain("未关闭阻塞");
  });

  it("当前站带 aria-current，并标出与展开卡对应的站点", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        selectedNodeId: "n7",
        nodes: [
          node({ nodeInstanceId: "n3", sequence: 3, name: "出运" }),
          node({
            nodeInstanceId: "n7",
            nodeCode: "customs_clearance",
            sequence: 7,
            name: "清关",
            stateLabel: "进行中",
            isCurrent: true,
          }),
        ],
      },
    });

    expect(wrapper.get('[aria-current="step"]').text()).toContain("清关");
    expect(wrapper.get('[aria-current="step"]').element.tagName).toBe("BUTTON");
    expect(wrapper.findAll(".rail-item")[1]?.classes()).toContain(
      "is-selected",
    );
    expect(wrapper.findAll(".rail-item")[0]?.classes()).not.toContain(
      "is-selected",
    );
  });

  it("四态落到各自的 class，供样式区分", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            nodeInstanceId: "done",
            completedAt: "2026-09-19T00:00:00.000Z",
          }),
          node({ nodeInstanceId: "current", isCurrent: true }),
          node({ nodeInstanceId: "blocked", blockedCount: 2 }),
          node({ nodeInstanceId: "na", isNotApplicable: true }),
        ],
      },
    });

    const items = wrapper.findAll(".rail-item");
    expect(items[0]?.classes()).toContain("is-done");
    expect(items[1]?.classes()).toContain("is-current");
    expect(items[2]?.classes()).toContain("is-blocked");
    expect(items[3]?.classes()).toContain("is-na");
  });

  it("点击站点抛出节点实例选择事件", async () => {
    const wrapper = mount(LiveNodeRail, {
      props: { timeZone: "UTC", nodes: [node({ nodeInstanceId: "n7" })] },
    });

    await wrapper.get('[data-testid="rail-node"]').trigger("click");

    expect(wrapper.emitted("select")).toEqual([["n7"]]);
  });
});
