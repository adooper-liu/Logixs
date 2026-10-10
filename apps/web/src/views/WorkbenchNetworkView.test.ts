import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpRequestError } from "../api/httpClient";
import { getWorkbenchNetworkVolume } from "../api/workbenchNetworkVolume";
import type { WorkbenchNetworkVolume } from "@logix/contracts";
import WorkbenchNetworkView from "./WorkbenchNetworkView.vue";

vi.mock("../api/workbenchNetworkVolume", () => ({
  getWorkbenchNetworkVolume: vi.fn(),
}));

const stubs = {
  PageHeader: {
    props: ["title", "summary"],
    template: "<header><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
  },
  RouterLink: {
    props: ["to"],
    template: "<a :href='to'><slot /></a>",
  },
};

describe("WorkbenchNetworkView", () => {
  beforeEach(() => {
    vi.mocked(getWorkbenchNetworkVolume).mockReset();
    vi.mocked(getWorkbenchNetworkVolume).mockReturnValue(
      new Promise(() => undefined),
    );
  });

  it("shows the complete business chain and distinguishes live workbenches", () => {
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });

    expect(wrapper.get("h1").text()).toBe("业务工作台");
    expect(wrapper.get("header p").text()).toBe(
      "从市场机会到还箱收口，按事实产生顺序进入正确岗位",
    );
    expect(
      wrapper.findAll('[data-testid="main-workbench-stage"]'),
    ).toHaveLength(20);
    expect(
      wrapper.findAll('[data-testid="support-workbench-stage"]'),
    ).toHaveLength(3);
    expect(wrapper.findAll('[data-implementation="live"]')).toHaveLength(12);
    expect(wrapper.findAll('[data-implementation="prototype"]')).toHaveLength(
      0,
    );
    expect(wrapper.text()).toContain("市场与经营信号");
    expect(wrapper.text()).toContain("还箱");
    expect(wrapper.text()).toContain("订舱");
    expect(wrapper.text()).toContain("出口报关");
    expect(wrapper.text()).toContain("合规运营");
    expect(wrapper.text()).toContain("进口清关");
    expect(wrapper.text()).toContain("费用结算");
    expect(wrapper.text()).toContain("异常中心");
    expect(wrapper.findAll(".stage-connector")).toHaveLength(0);
    expect(wrapper.findAll(".stage-link .stage-handoff")).toHaveLength(0);
    expect(wrapper.findAll(".stage-status")).toHaveLength(20);
    expect(wrapper.text()).toContain("支撑模块");
    expect(wrapper.text()).toContain("已接真实能力");
    expect(wrapper.get(".network-legend details").text()).toContain(
      "不代表业务闭环已经验收",
    );
    expect(wrapper.findAll(".network-legend > p")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("可工作");
    expect(wrapper.get('a[href="/workspaces/dispatch"]')).toBeTruthy();
  });

  it("shows server counts and links the counted desk", async () => {
    vi.mocked(getWorkbenchNetworkVolume).mockResolvedValue(volumeFixture());
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const band = wrapper.get('[aria-label="全局业务量"]');
    expect(band.findAll("dd").map((cell) => cell.text())).toEqual([
      "9",
      "未接通",
      "未定义",
    ]);
    const market = wrapper
      .findAll('[data-testid="main-workbench-stage"]')
      .find((stage) => stage.text().includes("市场与经营信号"));
    expect(market?.text()).toContain("在办 5");
    expect(
      wrapper
        .findAll('[data-testid="stage-volume"]')
        .map((volume) => volume.text()),
    ).toEqual(["在办 5 · 本周 4", "在办 3", "在办 1"]);
    expect(
      wrapper
        .findAll('[data-testid="main-workbench-stage"]')
        .find((stage) => stage.text().includes("订舱"))
        ?.findAll('[data-testid="stage-volume"]'),
    ).toHaveLength(0);
    expect(market?.get("a").attributes("href")).toBe(
      "/workspaces/market-signals",
    );
    expect(wrapper.text()).not.toContain("当前阶段");
    expect(band.get("a").attributes("href")).toBe("/workspaces/exceptions");
  });

  it("keeps the full state explanation in progressive disclosure", () => {
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });

    const details = wrapper.get(".network-legend details");
    expect(details.get("summary").text()).toBe("状态说明");
    expect(details.text()).toContain("已有技术操作映射 11 / 23 个工作台");
  });

  it("does not render an empty volume row while loading", () => {
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });

    expect(wrapper.findAll('[data-testid="stage-volume"]')).toHaveLength(0);
  });

  it("filters zero and non-count stage metrics independently", async () => {
    const fixture = volumeFixture();
    vi.mocked(getWorkbenchNetworkVolume).mockResolvedValue({
      ...fixture,
      workbenches: [
        {
          ...fixture.workbenches[0],
          open: { state: "count", count: 0 },
          weeklyFlow: { state: "count", count: 2 },
          blocked: { state: "forbidden" },
        },
        {
          ...fixture.workbenches[1],
          open: { state: "count", count: 0 },
        },
        fixture.workbenches[2],
      ],
    });
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const stageVolumeText = wrapper
      .findAll('[data-testid="stage-volume"]')
      .map((volume) => volume.text());
    expect(stageVolumeText).toEqual(["本周 2", "在办 1"]);
    expect(stageVolumeText.join(" ")).not.toContain("无权查看");
    expect(stageVolumeText.join(" ")).not.toContain("未定义");
    expect(stageVolumeText.join(" ")).not.toContain("未接通");
  });

  it("highlights only the phase the server names", async () => {
    vi.mocked(getWorkbenchNetworkVolume).mockResolvedValue({
      ...volumeFixture(),
      currentPhase: "supply",
    });
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const current = wrapper.findAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.text()).toContain("供应与采购");
    expect(current[0]?.text()).toContain("当前阶段");
  });

  it("does not fabricate zero for an invalid count metric", async () => {
    const invalid = {
      ...volumeFixture(),
      global: {
        ...volumeFixture().global,
        open: { state: "count" },
      },
    } as unknown as WorkbenchNetworkVolume;
    vi.mocked(getWorkbenchNetworkVolume).mockResolvedValue(invalid);
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const band = wrapper.get('[aria-label="全局业务量"]');
    expect(band.find("dd").text()).toBe("—");
    expect(band.find("dd").text()).not.toBe("0");
  });

  it("shows no permission without inventing counts", async () => {
    vi.mocked(getWorkbenchNetworkVolume).mockRejectedValue(
      new HttpRequestError({
        kind: "forbidden",
        status: 403,
        message: "无权查看",
      }),
    );
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const band = wrapper.get('[aria-label="全局业务量"]');
    expect(band.text()).toContain("无权查看");
    expect(band.text()).not.toMatch(/\d/);
  });

  it("clears numbers when the projection cannot be read", async () => {
    vi.mocked(getWorkbenchNetworkVolume).mockRejectedValue(new Error("down"));
    const wrapper = mount(WorkbenchNetworkView, {
      global: { stubs },
    });
    await flushPromises();

    const band = wrapper.get('[aria-label="全局业务量"]');
    expect(band.text()).toContain("业务量暂时读不出来");
    expect(band.findAll("dd").map((cell) => cell.text())).toEqual([
      "—",
      "—",
      "—",
    ]);
  });
});

function volumeFixture() {
  return {
    contractVersion: "workbench-network-volume.v1" as const,
    weekStart: "2026-09-28T00:00:00.000Z",
    currentPhase: null,
    global: {
      open: { state: "count" as const, count: 9 },
      weeklyFlow: { state: "not_connected" as const },
      blocked: { state: "undefined" as const },
    },
    workbenches: [
      {
        code: "market_signals" as const,
        open: { state: "count" as const, count: 5 },
        weeklyFlow: { state: "count" as const, count: 4 },
        blocked: { state: "undefined" as const },
      },
      {
        code: "product_selection" as const,
        open: { state: "count" as const, count: 3 },
        weeklyFlow: { state: "not_connected" as const },
        blocked: { state: "undefined" as const },
      },
      {
        code: "sourcing" as const,
        open: { state: "count" as const, count: 1 },
        weeklyFlow: { state: "not_connected" as const },
        blocked: { state: "undefined" as const },
      },
    ],
    connections: [
      {
        fromCode: "market_signals",
        toCode: "product_selection",
        pendingAcceptance: { state: "count" as const, count: 2 },
        overdue: { state: "undefined" as const },
      },
      {
        fromCode: "product_selection",
        toCode: "product_npi",
        pendingAcceptance: { state: "not_connected" as const },
        overdue: { state: "undefined" as const },
      },
      {
        fromCode: "sourcing",
        toCode: "demand_replenishment",
        pendingAcceptance: { state: "count" as const, count: 1 },
        overdue: { state: "undefined" as const },
      },
    ],
  };
}
