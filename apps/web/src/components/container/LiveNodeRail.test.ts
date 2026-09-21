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

describe("LiveNodeRail", () => {
  it("每站显示状态与摘要日期，无数据明确留空", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n1",
            stateLabel: "已完成",
            completedAt: "2026-09-19T00:00:00.000Z",
          }),
          node({
            nodeInstanceId: "n2",
            nodeCode: "container_stuffing",
            sequence: 2,
            name: "装箱",
          }),
        ],
      },
    });

    const cells = wrapper.findAll('[data-testid="rail-node"]');
    expect(cells).toHaveLength(2);
    expect(cells[0]?.text()).toContain("已完成");
    expect(cells[0]?.text()).toContain("09-19");
    expect(cells[1]?.text()).toContain("未开始");
    expect(cells[1]?.text()).toContain("—");
  });

  it("实际优先于预计，并按用户时区显示跨日日期", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "Asia/Shanghai",
        nodes: [
          node({
            times: {
              plannedAt: "2026-09-20T00:00:00.000Z",
              estimatedAt: "2026-09-21T00:00:00.000Z",
              actualAt: "2026-09-21T16:30:00.000Z",
            },
          }),
        ],
      },
    });

    expect(wrapper.get('[data-testid="rail-node"]').text()).toContain("09-22");
    expect(wrapper.get('[data-testid="rail-node"]').text()).toContain("实际");
  });

  it("没有实际时，预计优先于计划", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        timeZone: "UTC",
        nodes: [
          node({
            times: {
              plannedAt: "2026-09-20T00:00:00.000Z",
              estimatedAt: "2026-09-21T00:00:00.000Z",
              actualAt: null,
            },
          }),
        ],
      },
    });

    const cell = wrapper.get('[data-testid="rail-node"]');
    expect(cell.text()).toContain("预计");
    expect(cell.text()).toContain("09-21");
    expect(cell.text()).not.toContain("09-20");
  });

  it("不适用与阻断不会被显示成普通空值", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n6",
            name: "中转港",
            stateLabel: "不适用",
            isNotApplicable: true,
          }),
          node({
            nodeInstanceId: "n7",
            name: "清关",
            stateLabel: "进行中",
            isCurrent: true,
            blockedCount: 2,
          }),
        ],
      },
    });

    expect(wrapper.text()).toContain("不适用");
    expect(wrapper.text()).toContain("2 个未关闭阻断");
    expect(wrapper.get('[aria-current="step"]').text()).toContain("清关");
    expect(wrapper.get('[aria-current="step"]').element.tagName).toBe("BUTTON");
  });

  it("点击站点抛出节点实例选择事件", async () => {
    const wrapper = mount(LiveNodeRail, {
      props: { nodes: [node({ nodeInstanceId: "n7" })] },
    });

    await wrapper.get('[data-testid="rail-node"]').trigger("click");

    expect(wrapper.emitted("select")).toEqual([["n7"]]);
  });
});
