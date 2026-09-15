import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RealOperations from "./RealOperations.vue";

const listClientOperations = vi.fn();
const listCompensations = vi.fn();

vi.mock("../api/clientOperations", () => ({
  listClientOperations: (...args: unknown[]) => listClientOperations(...args),
  listCompensations: (...args: unknown[]) => listCompensations(...args),
}));

const operation = {
  clientOperationId: "op-1",
  actionCode: "work_execution.complete_work_order",
  receptionState: "received",
  businessDecisionState: "accepted",
  commitState: "committed",
  rejectionReasonCode: null,
  resultRefs: [],
  requestHash: "should-not-render",
  traceId: "trace-1",
  targetType: "container",
  targetId: "c1",
  createdAt: "2026-09-13T03:00:00.000Z",
};

async function mountPage() {
  const wrapper = mount(RealOperations, {
    global: {
      stubs: {
        PageHeader: {
          props: ["title", "eyebrow"],
          template: "<header><h2>{{ title }}</h2></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("RealOperations", () => {
  beforeEach(() => {
    listClientOperations.mockReset();
    listCompensations.mockReset();
    listClientOperations.mockResolvedValue({
      items: [operation],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listCompensations.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
  });

  it("列出三阶段且不渲染 requestHash", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get("h2").text()).toBe("看提交");
    expect(wrapper.text()).toContain("完成工单");
    expect(wrapper.text()).toContain("已接收");
    expect(wrapper.text()).toContain("已确认");
    expect(wrapper.text()).toContain("已入账");
    expect(wrapper.text()).not.toContain("should-not-render");
    expect(wrapper.text()).not.toContain("requestHash");
  });

  it("展开后加载补偿空态", async () => {
    const wrapper = await mountPage();
    await wrapper.get("button.expand").trigger("click");
    await flushPromises();
    expect(listCompensations).toHaveBeenCalledWith("op-1", { pageSize: 50 });
    expect(wrapper.text()).toContain("该操作没有补偿记录。");
  });

  it("API 失败显示错误", async () => {
    listClientOperations.mockRejectedValueOnce(new Error("列同步操作失败"));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("列同步操作失败");
  });
});
