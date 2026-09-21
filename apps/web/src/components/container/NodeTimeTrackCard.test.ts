import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { LiveNodeView } from "../../data/liveNodeProjection";
import NodeTimeTrackCard from "./NodeTimeTrackCard.vue";

function node(overrides: Partial<LiveNodeView> = {}): LiveNodeView {
  return {
    nodeInstanceId: "n3",
    nodeCode: "shipment_dispatch",
    sequence: 3,
    name: "出运",
    stateLabel: "进行中",
    completedAt: null,
    isCurrent: true,
    isNotApplicable: false,
    blockedCount: 0,
    times: {
      plannedAt: "2026-09-20T16:30:00.000Z",
      estimatedAt: "2026-09-21T16:30:00.000Z",
      actualAt: null,
    },
    ...overrides,
  };
}

describe("NodeTimeTrackCard", () => {
  it("常驻显示三条时间轨，并按用户时区显示跨日日期", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: { node: node(), timeZone: "Asia/Shanghai" },
    });

    const tracks = wrapper.findAll('[data-testid="time-track"]');
    expect(tracks).toHaveLength(3);
    expect(tracks[0]?.text()).toContain("计划");
    expect(tracks[0]?.text()).toContain("2026-09-21");
    expect(tracks[1]?.text()).toContain("预计");
    expect(tracks[1]?.text()).toContain("2026-09-22");
    expect(tracks[2]?.text()).toContain("实际");
    expect(tracks[2]?.text()).toContain("—");
  });

  it("三轨全空时仍渲染三个明确空槽", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: {
        node: node({
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        }),
        timeZone: "UTC",
      },
    });

    const tracks = wrapper.findAll('[data-testid="time-track"]');
    expect(tracks).toHaveLength(3);
    expect(tracks.map((track) => track.get("dd").text())).toEqual([
      "—",
      "—",
      "—",
    ]);
  });

  it("不适用节点的三条时间轨都明确显示不适用", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: {
        node: node({
          stateLabel: "不适用",
          isNotApplicable: true,
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        }),
      },
    });

    expect(
      wrapper
        .findAll('[data-testid="time-track"]')
        .map((track) => track.get("dd").text()),
    ).toEqual(["不适用", "不适用", "不适用"]);
  });

  it("节点存在未关闭阻断时显式呈现数量", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: { node: node({ blockedCount: 2 }) },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain("2 项未关闭的阻断");
  });

  it("无选中节点时给出人话空态", () => {
    const wrapper = mount(NodeTimeTrackCard, { props: { node: null } });

    expect(wrapper.text()).toContain("选择上方任一站点");
    expect(wrapper.findAll('[data-testid="time-track"]')).toHaveLength(0);
  });
});
