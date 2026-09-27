import type { ProductOpportunityV1 } from "@logix/contracts";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductSelectionWorkbench from "./ProductSelectionWorkbench.vue";

const listProductOpportunities = vi.fn();
const intakeProductOpportunity = vi.fn();
const registerMarketSignalEvidence = vi.fn();
const getProductInitiative = vi.fn();
const decideProductInitiative = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listProductOpportunities: (...args: unknown[]) =>
    listProductOpportunities(...args),
  intakeProductOpportunity: (...args: unknown[]) =>
    intakeProductOpportunity(...args),
  registerMarketSignalEvidence: (...args: unknown[]) =>
    registerMarketSignalEvidence(...args),
  getProductInitiative: (...args: unknown[]) => getProductInitiative(...args),
  decideProductInitiative: (...args: unknown[]) =>
    decideProductInitiative(...args),
}));

describe("ProductSelectionWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMarketSignalEvidence.mockResolvedValue(undefined);
    getProductInitiative.mockResolvedValue(initiativeDetail());
    decideProductInitiative.mockResolvedValue({});
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
    // 接受之后主动作就地换成立项结论：同一页面上继续做完，不再只提示"下一步"。
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(true);
    expect(wrapper.find(".product-initiative-review").exists()).toBe(true);
    expect(wrapper.find(".action-body").exists()).toBe(false);
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

  it("只给已接受的机会显示立项判断，待领取的先不显示", async () => {
    const queued = await mountPage();

    expect(queued.find(".product-initiative-review").exists()).toBe(false);
    expect(queued.find(".product-initiative-outcome").exists()).toBe(false);
    expect(getProductInitiative).not.toHaveBeenCalled();
  });

  it("立项前先说清还差几项，并逐项列出缺口", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.text()).toContain("还差 5 项才能立项");
    expect(wrapper.findAll(".gap-list li").map((node) => node.text())).toEqual([
      "目标结果",
      "目标用户与市场",
      "竞争供给",
      "价格带与利润",
      "合规风险",
    ]);
  });

  it("补齐目标结果与四项要点后立项，带服务端版本与机会来源", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    await wrapper
      .get('textarea[aria-label="目标结果"]')
      .setValue("把折叠宠物出行包做成可发布版本");
    const labels = ["目标用户与市场", "竞争供给", "价格带与利润", "合规风险"];
    for (const [index, label] of labels.entries()) {
      const point = wrapper.findAll(".review-point")[index]!;
      await point.get(".picker-toggle").trigger("click");
      await point
        .get(`input[type="checkbox"][value="${EVIDENCE_ID}"]`)
        .setValue(true);
      await wrapper
        .get(`textarea[aria-label="${label}结论"]`)
        .setValue(`${label} 的判断`);
    }

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.text()).toContain("立项并交给产品开发");
    await button.trigger("click");
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledWith(
      HANDOFF_ID,
      expect.objectContaining({
        outcome: "approve",
        expectedInitiativeVersion: 0,
        objective: "把折叠宠物出行包做成可发布版本",
        reviewPoints: expect.arrayContaining([
          expect.objectContaining({
            code: "compliance_risk",
            evidenceRefs: [EVIDENCE_ID],
            conclusion: "合规风险 的判断",
          }),
        ]),
      }),
    );
    expect(wrapper.get('[role="status"]').text()).toContain("已立项");
  });

  it("四个去向的原因各存各的，来回切换不丢已写内容", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);
    await wrapper
      .get('textarea[aria-label="暂缓原因"]')
      .setValue("证据还不够，先放着");
    await wrapper.get(".destination:nth-of-type(4) input").setValue(true);

    expect(
      wrapper.get('textarea[aria-label="退回原因"]').element,
    ).toHaveProperty("value", "");
    await wrapper
      .get('textarea[aria-label="退回原因"]')
      .setValue("该由经营团队重新判断");
    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);

    expect(
      wrapper.get('textarea[aria-label="暂缓原因"]').element,
    ).toHaveProperty("value", "证据还不够，先放着");
  });

  it("暂缓没填原因也提交，服务端按待补保存而不是拒绝", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);
    await wrapper.get(".outcome-submit").trigger("click");
    await flushPromises();

    const [, command] = decideProductInitiative.mock.calls[0]!;
    expect(command).toEqual(expect.objectContaining({ outcome: "defer" }));
    expect(command).not.toHaveProperty("deferReason");
  });

  it("换一条机会时重新读该机会的立项判断，不沿用上一条", async () => {
    const second = acceptedOpportunity({
      handoff: {
        ...opportunity().handoff,
        handoffId: SECOND_HANDOFF_ID,
        title: "德国站收纳需求上升",
      },
      intakeVersion: 3,
    });
    listProductOpportunities.mockResolvedValue(
      acceptedPage([acceptedOpportunity(), second]),
    );
    getProductInitiative.mockImplementation(async (handoffId: string) =>
      initiativeDetail({ handoffId }),
    );
    const wrapper = await mountPage();

    await wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();

    expect(getProductInitiative).toHaveBeenLastCalledWith(SECOND_HANDOFF_ID);
  });

  it("版本冲突时显示服务端说明，不静默失败", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    decideProductInitiative.mockRejectedValue(
      new Error(
        "暂时无法保存本次立项判断（409）：PRODUCT_INITIATIVE_VERSION_CONFLICT",
      ),
    );
    const wrapper = await mountPage();

    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);
    await wrapper.get(".outcome-submit").trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "PRODUCT_INITIATIVE_VERSION_CONFLICT",
    );
  });

  it("已立项的机会只显示终态，不再给判断动作", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          initiativeId: "55555555-5555-4555-8555-555555555555",
          outcome: "approve",
          completion: "completed",
          currentDestination: "handed_off",
          responsibleActorId: "dev-operator",
          objective: "做成可发布版本",
          reviewPoints: [],
          reason: null,
          pendingFieldCodes: [],
          version: 1,
          createdAt: "2026-09-27T00:00:00.000Z",
          updatedAt: "2026-09-27T00:00:00.000Z",
        },
      }),
    );
    const wrapper = await mountPage();

    expect(wrapper.find(".destination").exists()).toBe(false);
    expect(wrapper.find(".outcome-submit").exists()).toBe(false);
    expect(wrapper.get(".product-initiative-outcome").text()).toContain(
      "已立项",
    );
  });
});

const HANDOFF_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_HANDOFF_ID = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";

function acceptedOpportunity(
  overrides: Partial<ProductOpportunityV1> = {},
): ProductOpportunityV1 {
  return opportunity({
    intakeState: "accepted",
    intakeVersion: 3,
    assignedActorId: "dev-operator",
    ...overrides,
  });
}

function acceptedPage(items: ProductOpportunityV1[] = [acceptedOpportunity()]) {
  return {
    contractVersion: "product-opportunity-page.v1",
    items,
    pageSize: 100,
    nextCursor: null,
  };
}

function initiativeDetail(overrides: Record<string, unknown> = {}) {
  return {
    handoffId: HANDOFF_ID,
    initiative: null,
    evidenceCandidates: [
      {
        evidenceId: EVIDENCE_ID,
        sourceName: "站点类目周报",
        summary: "在售同款 320 个",
        contentRef: "https://example.test/report",
        recordedAt: "2026-09-27T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

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
