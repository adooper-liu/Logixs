import type { ProductOpportunityV1 } from "@logix/contracts";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductSelectionWorkbench from "./ProductSelectionWorkbench.vue";

const listProductOpportunities = vi.fn();
const intakeProductOpportunity = vi.fn();
const registerMarketSignalEvidence = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listProductOpportunities: (...args: unknown[]) =>
    listProductOpportunities(...args),
  intakeProductOpportunity: (...args: unknown[]) =>
    intakeProductOpportunity(...args),
  registerMarketSignalEvidence: (...args: unknown[]) =>
    registerMarketSignalEvidence(...args),
}));

describe("ProductSelectionWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMarketSignalEvidence.mockResolvedValue(undefined);
    listProductOpportunities.mockResolvedValue({
      contractVersion: "product-opportunity-page.v1",
      items: [opportunity()],
      pageSize: 100,
      nextCursor: null,
    });
  });

  it("shows the received facts and keeps ordinary gaps actionable", async () => {
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("加拿大站宠物出行需求上升");
    expect(wrapper.text()).toContain("验证宠物出行机会是否值得立项");
    expect(wrapper.text()).toContain("商品类别");
    expect(wrapper.text()).toContain("来源证据");
    expect(wrapper.text()).toContain(
      "这些内容随后会继续补充，不阻止领取和评估",
    );
    expect(wrapper.get(".action-body button").text()).toBe("领取此机会");
  });

  it("claims the team-queue item and then accepts the same handoff", async () => {
    const claimed = opportunity({
      intakeState: "claimed",
      intakeVersion: 2,
      assignedActorId: "dev-operator",
    });
    const accepted = opportunity({
      intakeState: "accepted",
      intakeVersion: 3,
      assignedActorId: "dev-operator",
    });
    intakeProductOpportunity
      .mockResolvedValueOnce(claimed)
      .mockResolvedValueOnce(accepted);
    const wrapper = await mountPage();

    await wrapper.get(".action-body button").trigger("click");
    await flushPromises();
    expect(intakeProductOpportunity).toHaveBeenNthCalledWith(
      1,
      opportunity().handoff.handoffId,
      expect.objectContaining({
        action: "claim",
        expectedIntakeVersion: 1,
      }),
    );
    expect(wrapper.get('[role="status"]').text()).toContain("已领取");
    expect(wrapper.get(".action-body button").text()).toBe(
      "接受并进入立项判断",
    );

    await wrapper.get(".action-body button").trigger("click");
    await flushPromises();
    expect(intakeProductOpportunity).toHaveBeenNthCalledWith(
      2,
      opportunity().handoff.handoffId,
      expect.objectContaining({
        action: "accept",
        expectedIntakeVersion: 2,
      }),
    );
    expect(wrapper.get('[role="status"]').text()).toContain("已接受经营机会");
    expect(wrapper.text()).toContain("下一步围绕目标用户、收益与风险");
  });

  it("does not expose intake actions for a superseded handoff", async () => {
    listProductOpportunities.mockResolvedValue({
      contractVersion: "product-opportunity-page.v1",
      items: [opportunity({ intakeState: "superseded" })],
      pageSize: 100,
      nextCursor: null,
    });
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("该版本已被新版替代");
    expect(wrapper.find(".action-body button").exists()).toBe(false);
  });

  it("does not show professional requirements before evaluation starts", async () => {
    const wrapper = await mountPage();

    expect(wrapper.find(".evaluation-requirements").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("竞争供给证据");
    expect(wrapper.text()).not.toContain("售后原声");
  });

  it("generates scoped professional requirements with reasons once evaluation starts", async () => {
    listProductOpportunities.mockResolvedValue({
      contractVersion: "product-opportunity-page.v1",
      items: [
        opportunity({
          intakeState: "accepted",
          intakeVersion: 3,
          assignedActorId: "dev-operator",
          handoff: { ...opportunity().handoff, categoryRef: "宠物出行" },
        }),
      ],
      pageSize: 100,
      nextCursor: null,
    });
    const wrapper = await mountPage();

    const panel = wrapper.get(".evaluation-requirements");
    expect(panel.text()).toContain("竞争供给证据");
    expect(panel.text()).toContain("目标价格带");
    expect(panel.text()).toContain("售后原声");
    expect(panel.text()).toContain("为什么适用");
    expect(panel.text()).toContain("宠物出行");

    const addButtons = panel.findAll("button.add-evidence");
    expect(addButtons).toHaveLength(3);

    await addButtons[0]!.trigger("click");
    await wrapper
      .get('textarea[aria-label="竞争供给证据"]')
      .setValue("类目页显示在售同款 320 个，头部商品月销集中。");
    await wrapper.get(".evidence-form").trigger("submit");
    await flushPromises();

    expect(registerMarketSignalEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        signalId: "22222222-2222-4222-8222-222222222222",
        content: "类目页显示在售同款 320 个，头部商品月销集中。",
      }),
    );
    expect(wrapper.get('[role="status"]').text()).toContain("已把新增证据登记");
    expect(wrapper.find(".evidence-form").exists()).toBe(false);
  });

  it("hides scope-only requirements when evaluation starts without a scope", async () => {
    listProductOpportunities.mockResolvedValue({
      contractVersion: "product-opportunity-page.v1",
      items: [
        opportunity({
          intakeState: "accepted",
          intakeVersion: 3,
          assignedActorId: "dev-operator",
        }),
      ],
      pageSize: 100,
      nextCursor: null,
    });
    const wrapper = await mountPage();

    const panel = wrapper.get(".evaluation-requirements");
    // 缺商品范围的两项不冒充“适用要求”，只在 withheld 里说明缺什么。
    expect(
      panel.findAll(".requirement-head b").map((node) => node.text()),
    ).toEqual(["售后原声"]);
    expect(
      panel.findAll(".withheld-notice li span").map((node) => node.text()),
    ).toEqual(["竞争供给证据", "目标价格带"]);
  });

  it("shows a recoverable error when the queue cannot load", async () => {
    listProductOpportunities
      .mockRejectedValueOnce(new Error("选品队列暂不可用"))
      .mockResolvedValueOnce({
        contractVersion: "product-opportunity-page.v1",
        items: [opportunity()],
        pageSize: 100,
        nextCursor: null,
      });
    const wrapper = await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain("选品队列暂不可用");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(listProductOpportunities).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("加拿大站宠物出行需求上升");
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/workspaces/product-selection",
        component: ProductSelectionWorkbench,
      },
    ],
  });
  await router.push("/workspaces/product-selection");
  await router.isReady();
  const wrapper = mount(ProductSelectionWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title", "summary"],
          template: "<header><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function opportunity(
  overrides: Partial<ProductOpportunityV1> = {},
): ProductOpportunityV1 {
  return {
    handoff: {
      contractVersion: "market_opportunity_handoff.v1",
      handoffId: "44444444-4444-4444-8444-444444444444",
      version: 1,
      signalId: "22222222-2222-4222-8222-222222222222",
      signalVersion: 2,
      title: "加拿大站宠物出行需求上升",
      recipientQueueCode: "product_selection",
      marketCode: "CA",
      channelCode: null,
      categoryRef: null,
      observedFactSummary: "站内搜索量上升。",
      evidenceRefs: [],
      hypothesis: "可能存在折叠出行产品机会。",
      opportunityStatement: "验证宠物出行机会是否值得立项。",
      judgmentNote: null,
      pendingFieldCodes: ["channel_code", "category_ref", "evidence_refs"],
      createdBy: "market-owner",
      createdAt: "2026-09-25T02:00:00.000Z",
      idempotencyKey: "handoff-test",
    },
    intakeState: "queued",
    intakeVersion: 1,
    assignedActorId: null,
    ...overrides,
  };
}
