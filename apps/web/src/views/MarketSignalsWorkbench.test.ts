import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCommandV1,
  MarketSignalDetailV1,
  MarketSignalV1,
} from "@logix/contracts";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketSignalsWorkbench from "./MarketSignalsWorkbench.vue";

const listMarketSignals = vi.fn();
const getMarketSignal = vi.fn();
const createMarketSignal = vi.fn();
const updateMarketSignal = vi.fn();
const registerMarketSignalEvidence = vi.fn();
const decideMarketSignal = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listMarketSignals: (...args: unknown[]) => listMarketSignals(...args),
  getMarketSignal: (...args: unknown[]) => getMarketSignal(...args),
  createMarketSignal: (...args: unknown[]) => createMarketSignal(...args),
  updateMarketSignal: (...args: unknown[]) => updateMarketSignal(...args),
  registerMarketSignalEvidence: (...args: unknown[]) =>
    registerMarketSignalEvidence(...args),
  decideMarketSignal: (...args: unknown[]) => decideMarketSignal(...args),
}));

const signalOneId = "11111111-1111-4111-8111-111111111111";
const signalTwoId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "33333333-3333-4333-8333-333333333333";
const handoffId = "44444444-4444-4444-8444-444444444444";

describe("MarketSignalsWorkbench", () => {
  let signals: MarketSignalV1[];
  let details: Map<string, MarketSignalDetailV1>;

  beforeEach(() => {
    vi.clearAllMocks();
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: "美国站庭院收纳需求连续三周上升",
        marketCode: "US",
        channelCode: "Amazon US",
        categoryRef: "庭院收纳",
        observedFactSummary: "搜索量连续三周增长。",
        hypothesis: "紧凑型产品可能存在供给缺口。",
        evidenceRefs: [evidenceId],
        pendingFieldCodes: [],
      }),
      marketSignal({
        signalId: signalTwoId,
        title: "加拿大站宠物出行需求上升",
        marketCode: "CA",
        pendingFieldCodes: [
          "channel_code",
          "category_ref",
          "observed_fact_summary",
          "hypothesis",
          "evidence_refs",
        ],
      }),
    ];
    details = new Map([
      [
        signalOneId,
        {
          signal: signals[0]!,
          evidence: [
            {
              evidenceId,
              sourceName: "美国站周度搜索报告",
              summary: "搜索量连续三周增长。",
              contentRef: "https://example.com/source-report",
              recordedAt: "2026-09-25T01:00:00.000Z",
              verificationState: "verified",
            },
          ],
          selectionReturnReason: null,
        },
      ],
      [
        signalTwoId,
        { signal: signals[1]!, evidence: [], selectionReturnReason: null },
      ],
    ]);

    listMarketSignals.mockImplementation(async () => ({
      contractVersion: "market-signal-page.v1",
      items: signals,
      pageSize: 100,
      nextCursor: null,
    }));
    getMarketSignal.mockImplementation(async (id: string) => details.get(id));
    registerMarketSignalEvidence.mockResolvedValue(undefined);
  });

  it("loads the work reason and separates observed facts from hypotheses", async () => {
    const wrapper = await mountPage();

    expect(listMarketSignals).toHaveBeenCalledOnce();
    expect(getMarketSignal).toHaveBeenCalledWith(signalOneId);
    expect(wrapper.text()).toContain("为什么现在处理");
    expect(wrapper.text()).toContain("已观察到");
    expect(wrapper.text()).toContain("尚待验证");
    expect(wrapper.text()).toContain("美国站周度搜索报告");
    expect(wrapper.text()).toContain("经营与市场负责人");
  });

  it("registers a title-only signal and keeps ordinary information as gaps", async () => {
    const created = marketSignal({
      signalId: "55555555-5555-4555-8555-555555555555",
      title: "法国站出现新的户外用餐场景",
    });
    createMarketSignal.mockResolvedValue(created);
    details.set(created.signalId, {
      signal: created,
      evidence: [],
      selectionReturnReason: null,
    });
    const wrapper = await mountPage();

    await wrapper.get(".create-button").trigger("click");
    await wrapper
      .get('.create-form input[placeholder^="例如：美国站"]')
      .setValue(created.title);
    await wrapper.get(".create-form").trigger("submit");
    await flushPromises();

    expect(createMarketSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "market-signal-create.v1",
        title: created.title,
      }),
    );
    expect(wrapper.get(".evidence-panel").text()).toContain(created.title);
    expect(wrapper.get(".evidence-panel").text()).toContain(
      "待补，不影响先处理",
    );
    expect(wrapper.get(".evidence-panel").text()).toContain("观察事实待补");
    expect(wrapper.get(".evidence-panel").text()).toContain("来源证据待补");
  });

  it("opens the persisted evidence and links to its original source", async () => {
    const wrapper = await mountPage();

    await wrapper.get(".source-trigger").trigger("click");

    expect(wrapper.get(".source-preview").text()).toContain(
      "搜索量连续三周增长",
    );
    expect(wrapper.get(".source-preview a").attributes("href")).toBe(
      "https://example.com/source-report",
    );
  });

  it("saves an ordinary gap in place through the controlled update API", async () => {
    const updated = marketSignal({
      ...signals[1]!,
      channelCode: "Aosom.ca",
      version: 2,
      pendingFieldCodes: [
        "category_ref",
        "observed_fact_summary",
        "hypothesis",
        "evidence_refs",
      ],
    });
    updateMarketSignal.mockImplementation(async () => {
      details.set(signalTwoId, {
        signal: updated,
        evidence: [],
        selectionReturnReason: null,
      });
      return updated;
    });
    const wrapper = await mountPage(`?signalId=${signalTwoId}`);

    await wrapper.get('button[aria-label="补充渠道"]').trigger("click");
    await wrapper.get('input[aria-label="渠道"]').setValue("Aosom.ca");
    await wrapper.get(".gap-editor form").trigger("submit");
    await flushPromises();

    expect(updateMarketSignal).toHaveBeenCalledWith(
      signalTwoId,
      expect.objectContaining({
        contractVersion: "market-signal-update.v1",
        expectedSignalVersion: 1,
        channelCode: "Aosom.ca",
      }),
    );
    expect(wrapper.get(".signal-scope").text()).toContain("Aosom.ca");
    expect(wrapper.find('button[aria-label="补充渠道"]').exists()).toBe(false);
  });

  it("hands ordinary gaps to the product-selection queue without blocking", async () => {
    const handedOff = marketSignal({
      ...signals[1]!,
      currentDestination: "handed_off",
      version: 2,
    });
    decideMarketSignal.mockImplementation(
      async (_id: string, command: MarketSignalDecisionCommandV1) => ({
        contractVersion: "market-signal-decision-result.v1",
        status: "saved",
        signal: handedOff,
        decisionId: "66666666-6666-4666-8666-666666666666",
        decisionVersion: 1,
        completion: "completed",
        handoff: handoff(handedOff, command.opportunityStatement ?? null),
      }),
    );
    const wrapper = await mountPage(`?signalId=${signalTwoId}`);

    await wrapper
      .get('textarea[placeholder="用一句话说明希望选品进一步验证什么"]')
      .setValue("验证宠物出行机会是否值得立项。");
    await wrapper.get(".decision-panel").trigger("submit");
    await flushPromises();

    expect(decideMarketSignal).toHaveBeenCalledWith(
      signalTwoId,
      expect.objectContaining({
        decisionType: "handoff",
        opportunityStatement: "验证宠物出行机会是否值得立项。",
      }),
    );
    expect(wrapper.get('[role="status"]').text()).toContain(
      "已交给选品团队队列",
    );
    expect(wrapper.get('[role="status"]').text()).toContain(
      "下一责任选品团队（待领取）",
    );
    expect(wrapper.get('[role="status"]').text()).toContain("商品类别待选择");
    expect(wrapper.get('[role="status"]').text()).toContain("来源证据待补");
  });

  it("shows an actionable error and retries the queue request", async () => {
    listMarketSignals
      .mockRejectedValueOnce(new Error("经营信号服务暂不可用"))
      .mockImplementation(async () => ({
        contractVersion: "market-signal-page.v1",
        items: signals,
        pageSize: 100,
        nextCursor: null,
      }));
    const wrapper = await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "经营信号服务暂不可用",
    );
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(listMarketSignals).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain(signals[0]!.title);
  });
});

async function mountPage(query = "") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/workspaces/market-signals",
        component: MarketSignalsWorkbench,
      },
      {
        path: "/workspaces/product-selection",
        component: { template: "<div>选品立项</div>" },
      },
    ],
  });
  await router.push(`/workspaces/market-signals${query}`);
  await router.isReady();
  const wrapper = mount(MarketSignalsWorkbench, {
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

function marketSignal(
  overrides: Partial<MarketSignalV1> &
    Pick<MarketSignalV1, "signalId" | "title">,
): MarketSignalV1 {
  const { signalId, title, ...optionalOverrides } = overrides;
  return {
    signalId,
    title,
    marketCode: null,
    channelCode: null,
    categoryRef: null,
    observedFactSummary: null,
    hypothesis: null,
    evidenceRefs: [],
    currentDestination: "needs_decision",
    ownerTeamCode: "market_intelligence",
    version: 1,
    pendingFieldCodes: [
      "market_code",
      "channel_code",
      "category_ref",
      "observed_fact_summary",
      "hypothesis",
      "evidence_refs",
    ],
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...optionalOverrides,
  };
}

function handoff(
  signal: MarketSignalV1,
  opportunityStatement: string | null,
): MarketOpportunityHandoffV1 {
  return {
    contractVersion: "market_opportunity_handoff.v1",
    handoffId,
    version: 1,
    signalId: signal.signalId,
    signalVersion: signal.version,
    title: signal.title,
    recipientQueueCode: "product_selection",
    marketCode: signal.marketCode,
    channelCode: signal.channelCode,
    categoryRef: signal.categoryRef,
    observedFactSummary: signal.observedFactSummary,
    evidenceRefs: signal.evidenceRefs,
    hypothesis: signal.hypothesis,
    opportunityStatement,
    judgmentNote: null,
    pendingFieldCodes: signal.pendingFieldCodes,
    createdBy: "market-owner",
    createdAt: "2026-09-25T02:00:00.000Z",
    idempotencyKey: "handoff-test",
  };
}
