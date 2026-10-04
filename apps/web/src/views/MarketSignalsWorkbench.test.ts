import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCommandV1,
  MarketSignalDetailV1,
  MarketSignalV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { computed } from "vue";
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
const takeBackSelectionReturn = vi.fn();
const listProductOpportunities = vi.fn();

vi.mock("../api/marketSignals", () => ({
  listMarketSignals: (...args: unknown[]) => listMarketSignals(...args),
  getMarketSignal: (...args: unknown[]) => getMarketSignal(...args),
  createMarketSignal: (...args: unknown[]) => createMarketSignal(...args),
  updateMarketSignal: (...args: unknown[]) => updateMarketSignal(...args),
  registerMarketSignalEvidence: (...args: unknown[]) =>
    registerMarketSignalEvidence(...args),
  decideMarketSignal: (...args: unknown[]) => decideMarketSignal(...args),
  takeBackSelectionReturn: (...args: unknown[]) =>
    takeBackSelectionReturn(...args),
  listProductOpportunities: (...args: unknown[]) =>
    listProductOpportunities(...args),
}));

vi.mock("../auth/useAuthSession", () => ({
  useAuthSession: () => ({ actorId: computed(() => "operator-dev") }),
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

    listMarketSignals.mockImplementation(
      async (input: { destination: MarketSignalV1["currentDestination"] }) => {
        const items = signals.filter(
          (signal) => signal.currentDestination === input.destination,
        );
        return {
          contractVersion: "market-signal-page.v1",
          items,
          pageSize: 50,
          totalCount: items.length,
          nextCursor: null,
        };
      },
    );
    getMarketSignal.mockImplementation(async (id: string) => details.get(id));
    registerMarketSignalEvidence.mockResolvedValue(undefined);
    takeBackSelectionReturn.mockResolvedValue({});
    listProductOpportunities.mockResolvedValue({
      contractVersion: "product-opportunity-page.v1",
      items: [],
      pageSize: 50,
      totalCount: 0,
      nextCursor: null,
    });
  });

  it("keeps claimed handoffs in market follow-up and removes them after acceptance", async () => {
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: "已交选品的加拿大机会",
        currentDestination: "handed_off",
        pendingFieldCodes: [],
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    let opportunity = productOpportunity("claimed");
    listProductOpportunities.mockImplementation(
      async (input: { responsibilityStatus?: string; signalId?: string }) => ({
        contractVersion: "product-opportunity-page.v1",
        items:
          input.signalId ||
          (input.responsibilityStatus === "retained_by_market" &&
            opportunity.responsibility.status === "retained_by_market")
            ? [opportunity]
            : [],
        pageSize: 50,
        totalCount:
          opportunity.responsibility.status === "retained_by_market" ? 1 : 0,
        nextCursor: null,
      }),
    );

    const claimed = await mountPage(`?signalId=${signalOneId}`);
    await tab(claimed, "已交选品·待接受").trigger("click");
    expect(claimed.text()).toContain("selector-1 于");
    expect(claimed.text()).toContain("结果责任仍在经营与市场团队");
    claimed.unmount();

    opportunity = productOpportunity("accepted");
    const accepted = await mountPage(`?signalId=${signalOneId}`);
    expect(
      accepted
        .findAll('[role="tab"]')
        .find((tab) => tab.text().includes("已交选品·待接受"))!
        .text(),
    ).toContain("0");
    expect(accepted.text()).toContain("选品已接受");
    expect(accepted.text()).toContain("选品暂缓");
    expect(accepted.text()).toContain("当前责任选品团队");
  });

  it("shows the structured return request and lets market take it back", async () => {
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: "选品请求补充市场方向",
        currentDestination: "selection_return_requested",
        version: 3,
      }),
    ];
    details = new Map([
      [
        signalOneId,
        {
          signal: signals[0]!,
          evidence: [],
          selectionReturnBasis: "wrong_direction",
          selectionReturnReason: "请重新核对目标市场与渠道",
        },
      ],
    ]);
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    expect(wrapper.text()).toContain("方向错误");
    expect(wrapper.text()).toContain("请重新核对目标市场与渠道");
    await wrapper.get(".return-request button").trigger("click");
    await flushPromises();
    expect(takeBackSelectionReturn).toHaveBeenCalledWith(
      signalOneId,
      expect.objectContaining({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: 3,
      }),
    );
    expect(wrapper.text()).toContain("已接回");

    await wrapper.get(".return-request button").trigger("click");
    await flushPromises();
    expect(takeBackSelectionReturn).toHaveBeenCalledTimes(2);
    const firstCommand = takeBackSelectionReturn.mock.calls[0]?.[1];
    const replayCommand = takeBackSelectionReturn.mock.calls[1]?.[1];
    expect(replayCommand.idempotencyKey).toBe(firstCommand.idempotencyKey);
    expect(wrapper.text()).toContain("已接回");
  });

  it("does not render an empty state when a needs-decision signal is selected", async () => {
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    expect(wrapper.findAll(".empty-workbench")).toHaveLength(0);
    expect(wrapper.text()).toContain("美国站庭院收纳需求连续三周上升");
  });

  it("does not invent an insufficient-evidence basis while return details load", async () => {
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: "选品请求补充市场方向",
        currentDestination: "selection_return_requested",
        version: 3,
      }),
    ];
    details = new Map([
      [
        signalOneId,
        {
          signal: signals[0]!,
          evidence: [],
          selectionReturnBasis: null,
          selectionReturnReason: "请重新核对目标市场与渠道",
        },
      ],
    ]);

    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    expect(wrapper.get(".return-request").text()).toContain(
      "请重新核对目标市场与渠道",
    );
    expect(wrapper.get(".return-request").text()).not.toContain("证据不足");
    expect(wrapper.get(".return-request").text()).not.toContain("方向错误");
  });

  it("loads the work reason and separates observed facts from hypotheses", async () => {
    const wrapper = await mountPage();

    expect(listMarketSignals).toHaveBeenCalledTimes(8);
    expect(getMarketSignal).toHaveBeenCalledWith(signalOneId);
    expect(wrapper.text()).toContain("为什么现在处理");
    expect(wrapper.text()).toContain("已观察到");
    expect(wrapper.text()).toContain("经营判断");
    expect(wrapper.text()).toContain("1 条来源");
    expect(wrapper.text()).toContain("依据与判断");
    await wrapper.get(".evidence-fold").trigger("click");
    expect(wrapper.text()).toContain("美国站周度搜索报告");
    expect(wrapper.text()).toContain("经营与市场负责人");
  });

  it("locks hypothesis until an observed fact exists and verbs field actions", async () => {
    const wrapper = await mountPage(`?signalId=${signalTwoId}`);

    const selectedQueueItem = wrapper.get(".queue-item.selected");
    expect(selectedQueueItem.text()).toContain("CA · 渠道未填");
    expect(selectedQueueItem.text()).toContain("依据缺 5 项");
    expect(selectedQueueItem.text()).not.toContain("不影响先处理");
    expect(wrapper.find('button[aria-label="填写经营判断"]').exists()).toBe(
      false,
    );
    expect(wrapper.get(".lock-hint").text()).toContain("先补齐观察事实");
    expect(wrapper.find('button[aria-label="添加事实"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="选择渠道"]').exists()).toBe(true);
    expect(wrapper.find(".gap-strip").exists()).toBe(false);
  });

  it("confirms title-derived market prefill into the update API", async () => {
    const created = marketSignal({
      signalId: "55555555-5555-4555-8555-555555555555",
      title: "法国站出现新的户外用餐场景",
    });
    const updated = marketSignal({
      ...created,
      marketCode: "法国",
      version: 2,
      pendingFieldCodes: created.pendingFieldCodes.filter(
        (code) => code !== "market_code",
      ),
    });
    details.set(created.signalId, {
      signal: created,
      evidence: [],
      selectionReturnReason: null,
    });
    listMarketSignals.mockImplementation(async () => ({
      contractVersion: "market-signal-page.v1",
      items: [created],
      pageSize: 100,
      nextCursor: null,
    }));
    updateMarketSignal.mockImplementation(async () => {
      details.set(created.signalId, {
        signal: updated,
        evidence: [],
        selectionReturnReason: null,
      });
      return updated;
    });
    const wrapper = await mountPage(`?signalId=${created.signalId}`);

    await wrapper.get(".prefill-banner .primary-action").trigger("click");
    await flushPromises();

    expect(updateMarketSignal).toHaveBeenCalledWith(
      created.signalId,
      expect.objectContaining({
        marketCode: "法国",
      }),
    );
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
    expect(wrapper.get(".evidence-panel").text()).toContain("依据完备度");
    expect(wrapper.get(".evidence-panel").text()).toContain("必填剩");
    expect(wrapper.get(".evidence-panel").text()).toContain("尚未登记观察事实");
    expect(wrapper.get(".evidence-panel").text()).toContain("尚无来源证据");
    expect(wrapper.find(".gap-strip").exists()).toBe(false);
    expect(wrapper.get(".evidence-panel").text()).toContain("从标题预填");
    expect(wrapper.get(".evidence-panel").text()).toContain("已自动推导");
    expect(wrapper.get(".evidence-panel").text()).toContain(
      "先补齐观察事实后，再填写经营判断",
    );
  });

  it("opens the persisted evidence and links to its original source", async () => {
    const wrapper = await mountPage();

    await wrapper.get(".evidence-fold").trigger("click");
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

    await wrapper.get('button[aria-label="选择渠道"]').trigger("click");
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
    expect(wrapper.find('button[aria-label="选择渠道"]').exists()).toBe(false);
  });

  it("lets the session actor schedule one resumable validation commitment", async () => {
    const watching = marketSignal({
      ...signals[0]!,
      currentDestination: "watching",
      version: 2,
      activeValidation: {
        responsibleActorId: "operator-dev",
        nextReviewDate: "2026-02-12",
        watchFocus: "确认趋势是否持续两周",
        waitingReason: "等待第二客服队列",
      },
    });
    decideMarketSignal.mockResolvedValue({
      contractVersion: "market-signal-decision-result.v1",
      status: "saved",
      signal: watching,
      decisionId: "66666666-6666-4666-8666-666666666666",
      decisionVersion: 1,
      completion: "completed",
      handoff: null,
    });
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    const tabCount = (label: string) =>
      wrapper
        .findAll('[role="tab"]')
        .find((tab) => tab.text().includes(label))!
        .get("b")
        .text();
    expect(tabCount("待判断")).toBe("2");
    expect(tabCount("继续观察")).toBe("0");

    const watchRadio = wrapper.get('input[value="watch"]');
    await watchRadio.setValue(true);
    await wrapper.get('input[type="date"]').setValue("2026-02-12");
    await wrapper
      .get('textarea[aria-label="这次要验证什么"]')
      .setValue("确认趋势是否持续两周");
    await wrapper
      .get('textarea[aria-label="当前在等什么"]')
      .setValue("等待第二客服队列");
    await wrapper.get(".decision-panel").trigger("submit");
    await flushPromises();

    expect(decideMarketSignal).toHaveBeenCalledWith(
      signalOneId,
      expect.objectContaining({
        decisionType: "watch",
        nextReviewDate: "2026-02-12",
        watchFocus: "确认趋势是否持续两周",
        waitingReason: "等待第二客服队列",
      }),
    );
    expect(decideMarketSignal.mock.calls[0]![1]).not.toHaveProperty(
      "responsibleActorId",
    );
    expect(wrapper.text()).toContain("当前验证承诺");
    expect(wrapper.text()).toContain("负责人：我");
    expect(wrapper.text()).toContain("等待第二客服队列");
    expect(wrapper.text()).not.toContain("机会已证明");
    expect(tabCount("待判断")).toBe("1");
    expect(tabCount("继续观察")).toBe("1");
  });

  it("shows legacy watching rows without inventing a validation focus", async () => {
    signals = [
      marketSignal({
        ...signals[0]!,
        currentDestination: "watching",
        activeValidation: {
          responsibleActorId: "operator-dev",
          nextReviewDate: "2026-02-12",
          watchFocus: null,
          waitingReason: null,
        },
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    expect(wrapper.text()).toContain("旧记录未填写，需重新安排");
    expect(wrapper.text()).not.toContain("机会已证明");
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
    expect(wrapper.get('[role="status"]').text()).toContain("尚未填写");
    expect(wrapper.get('[role="status"]').text()).toContain("商品类别待选择");
    expect(wrapper.get('[role="status"]').text()).toContain("来源证据待补");
  });

  it("shows an actionable error and retries the queue request", async () => {
    const working = listMarketSignals.getMockImplementation()!;
    listMarketSignals.mockRejectedValue(new Error("经营信号服务暂不可用"));
    const wrapper = await mountPage();

    expect(wrapper.get(".operation-error").text()).toContain(
      "经营信号服务暂不可用",
    );
    listMarketSignals.mockImplementation(working);
    await wrapper.get(".operation-error button").trigger("click");
    await flushPromises();

    expect(listMarketSignals).toHaveBeenCalledTimes(16);
    expect(wrapper.text()).toContain(signals[0]!.title);
  });

  it("keeps healthy groups usable when one group fails and retries only that group", async () => {
    const working = listMarketSignals.getMockImplementation()!;
    signals = [
      ...signals,
      marketSignal({
        signalId: "77777777-7777-4777-8777-777777777777",
        title: "已归档的历史信号",
        currentDestination: "archived",
      }),
    ];
    listMarketSignals.mockImplementation(async (input) =>
      input.destination === "archived"
        ? Promise.reject(new Error("归档分组暂不可用"))
        : working(input),
    );
    const wrapper = await mountPage();

    expect(wrapper.find(".operation-error").exists()).toBe(false);
    expect(wrapper.text()).toContain(signals[0]!.title);
    await tab(wrapper, "已归档").trigger("click");
    await flushPromises();
    expect(wrapper.get(".group-error").text()).toContain("归档分组暂不可用");

    listMarketSignals.mockImplementation(working);
    await wrapper.get(".group-error button").trigger("click");
    await flushPromises();

    expect(listMarketSignals).toHaveBeenLastCalledWith({
      destination: "archived",
      pageSize: 50,
    });
    expect(listMarketSignals).toHaveBeenCalledTimes(9);
    expect(wrapper.find(".group-error").exists()).toBe(false);
    expect(wrapper.get(".queue-list").text()).toContain("已归档的历史信号");
  });

  it("opens an unloaded deep link after in-place route navigation", async () => {
    const deepId = "88888888-8888-4888-8888-888888888888";
    const deep = marketSignal({
      signalId: deepId,
      title: "第二页上的观察信号",
      currentDestination: "watching",
      activeValidation: {
        responsibleActorId: "operator-dev",
        nextReviewDate: "2026-06-01",
        watchFocus: "确认第二页对象可直接打开",
        waitingReason: null,
      },
    });
    details.set(deepId, {
      signal: deep,
      evidence: [],
      selectionReturnReason: null,
    });
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    getMarketSignal.mockClear();

    await wrapper.vm.$router.push(
      `/workspaces/market-signals?signalId=${deepId}`,
    );
    await flushPromises();

    expect(
      getMarketSignal.mock.calls.filter(([id]) => id === deepId),
    ).toHaveLength(1);
    expect(wrapper.get('[aria-label="信号事实与依据"]').text()).toContain(
      "第二页上的观察信号",
    );
    expect(tab(wrapper, "继续观察").attributes("aria-selected")).toBe("true");
    expect(wrapper.get(".queue-list").text()).toContain(
      "确认第二页对象可直接打开",
    );
  });

  it("drops a stale detail response that arrives after a newer saved version", async () => {
    let releaseStale: (value: unknown) => void = () => undefined;
    const saved = marketSignal({
      ...signals[0]!,
      currentDestination: "watching",
      version: 2,
      updatedAt: "2026-09-26T00:00:00.000Z",
      activeValidation: {
        responsibleActorId: "operator-dev",
        nextReviewDate: "2026-02-12",
        watchFocus: "确认趋势是否持续两周",
        waitingReason: null,
      },
    });
    details.set(signalOneId, {
      ...details.get(signalOneId)!,
      selectionReturnReason: "选品要求补充季节窗口证据",
    });
    // 首屏详情读取被拖慢；用户在它返回前保存出 v2。
    getMarketSignal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseStale = resolve;
        }),
    );
    decideMarketSignal.mockResolvedValue(decisionResult(saved));
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    await scheduleWatch(wrapper, "2026-02-12", "确认趋势是否持续两周");
    releaseStale(details.get(signalOneId));
    await flushPromises();

    expect(wrapper.get(".active-validation").text()).toContain(
      "确认趋势是否持续两周",
    );
    expect(tab(wrapper, "继续观察").attributes("aria-selected")).toBe("true");
    expect(wrapper.get(".evidence-panel").text()).toContain("1 条来源");
    expect(wrapper.text()).toContain("选品要求补充季节窗口证据");
  });

  it("keeps loaded evidence after saving a watch decision", async () => {
    decideMarketSignal.mockResolvedValue(
      decisionResult(
        marketSignal({
          ...signals[0]!,
          currentDestination: "watching",
          version: 2,
          activeValidation: {
            responsibleActorId: "operator-dev",
            nextReviewDate: "2026-02-12",
            watchFocus: "确认趋势是否持续两周",
            waitingReason: null,
          },
        }),
      ),
    );
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    expect(wrapper.get(".evidence-panel").text()).toContain("1 条来源");
    const detailReads = getMarketSignal.mock.calls.length;

    await scheduleWatch(wrapper, "2026-02-12", "确认趋势是否持续两周");

    expect(getMarketSignal.mock.calls.length).toBe(detailReads);
    expect(wrapper.get(".evidence-panel").text()).toContain("1 条来源");
  });

  it("does not let an older full reload roll back a saved signal", async () => {
    const initialList = listMarketSignals.getMockImplementation()!;
    let releaseReload: (value: unknown) => void = () => undefined;
    const saved = marketSignal({
      ...signals[0]!,
      currentDestination: "watching",
      version: 2,
      activeValidation: {
        responsibleActorId: "operator-dev",
        nextReviewDate: "2026-02-12",
        watchFocus: "保存后的新承诺",
        waitingReason: null,
      },
    });
    decideMarketSignal.mockResolvedValue(decisionResult(saved));
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    listMarketSignals.mockImplementation(async (input) => {
      if (input.destination === "needs_decision") {
        return new Promise((resolve) => {
          releaseReload = resolve;
        });
      }
      return initialList(input);
    });

    const reload = (
      wrapper.vm as unknown as { loadSignals: () => Promise<void> }
    ).loadSignals();
    await scheduleWatch(wrapper, "2026-02-12", "保存后的新承诺");
    releaseReload({
      contractVersion: "market-signal-page.v1",
      items: [signals[0]],
      pageSize: 50,
      totalCount: 1,
      nextCursor: null,
    });
    await reload;
    await flushPromises();

    expect(wrapper.get(".active-validation").text()).toContain(
      "保存后的新承诺",
    );
    expect(tab(wrapper, "继续观察").attributes("aria-selected")).toBe("true");
  });

  it("replaces stale group membership on retry and refreshes existing rows on load more", async () => {
    const movedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const movedV1 = marketSignal({
      signalId: movedId,
      title: "第二页后已移走",
      currentDestination: "watching",
      version: 1,
    });
    signals = [signals[0]!, movedV1];
    details.set(movedId, {
      signal: movedV1,
      evidence: [],
      selectionReturnReason: null,
    });
    const working = listMarketSignals.getMockImplementation()!;
    listMarketSignals.mockImplementation(async (input) => {
      const page = await working(input);
      return input.destination === "watching"
        ? { ...page, nextCursor: "watching-page-2" }
        : page;
    });
    const wrapper = await mountPage(`?signalId=${movedId}`);
    expect(wrapper.text()).toContain("第二页后已移走");

    listMarketSignals.mockImplementation(async (input) => {
      if (input.cursor) {
        return {
          contractVersion: "market-signal-page.v1",
          items: [{ ...movedV1, version: 2, title: "第二页新版本" }],
          pageSize: 50,
          totalCount: 1,
          nextCursor: null,
        };
      }
      const page = await working(input);
      return input.destination === "watching"
        ? { ...page, items: [], totalCount: 0, nextCursor: "watching-page-2" }
        : page;
    });
    await (
      wrapper.vm as unknown as {
        retryGroup: (destination: string) => Promise<void>;
      }
    ).retryGroup("watching");
    expect(wrapper.text()).not.toContain("第二页后已移走");

    await tab(wrapper, "继续观察").trigger("click");
    await wrapper.get(".load-more").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("第二页新版本");
  });

  it("re-sorts the watching group locally after a reschedule", async () => {
    const watchingSignal = (
      signalId: string,
      title: string,
      nextReviewDate: string | null,
      updatedAt: string,
    ) =>
      marketSignal({
        signalId,
        title,
        currentDestination: "watching",
        updatedAt,
        activeValidation: nextReviewDate
          ? {
              responsibleActorId: "operator-dev",
              nextReviewDate,
              watchFocus: `验证 ${title}`,
              waitingReason: null,
            }
          : null,
      });
    signals = [
      watchingSignal(signalOneId, "甲", "2026-03-01", "2026-09-20T00:00:00Z"),
      watchingSignal(signalTwoId, "乙", "2026-03-05", "2026-09-21T00:00:00Z"),
      watchingSignal(
        "99999999-9999-4999-8999-999999999999",
        "丙旧行",
        null,
        "2026-09-22T00:00:00Z",
      ),
    ];
    details = new Map(
      signals.map((signal) => [
        signal.signalId,
        { signal, evidence: [], selectionReturnReason: null },
      ]),
    );
    decideMarketSignal.mockResolvedValue(
      decisionResult(
        watchingSignal(signalOneId, "甲", "2026-03-09", "2026-09-25T00:00:00Z"),
        { version: 2 },
      ),
    );
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    const order = () =>
      wrapper.findAll(".queue-item strong").map((item) => item.text());
    expect(order()).toEqual(["甲", "乙", "丙旧行"]);
    expect(wrapper.get(".queue-list").text()).toContain(
      "旧记录没有当前验证承诺，需重新安排",
    );

    await scheduleWatch(wrapper, "2026-03-09", "验证 甲");

    expect(order()).toEqual(["乙", "甲", "丙旧行"]);
  });

  it("loads more of one group only once while a request is in flight", async () => {
    const working = listMarketSignals.getMockImplementation()!;
    let releaseMore: (value: unknown) => void = () => undefined;
    listMarketSignals.mockImplementation(async (input) => {
      if (input.cursor) {
        return new Promise((resolve) => {
          releaseMore = resolve;
        });
      }
      const page = await working(input);
      return input.destination === "needs_decision"
        ? { ...page, nextCursor: "cursor-page-2" }
        : page;
    });
    const wrapper = await mountPage();

    const more = wrapper.get(".load-more");
    await more.trigger("click");
    await more.trigger("click");
    await flushPromises();
    expect(
      listMarketSignals.mock.calls.filter(([input]) => input.cursor),
    ).toHaveLength(1);
    expect(wrapper.get(".load-more").attributes("disabled")).toBeDefined();

    releaseMore({
      contractVersion: "market-signal-page.v1",
      items: [
        marketSignal({
          signalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "第二页待判断信号",
        }),
      ],
      pageSize: 50,
      totalCount: 3,
      nextCursor: null,
    });
    await flushPromises();
    expect(wrapper.get(".queue-list").text()).toContain("第二页待判断信号");
    expect(wrapper.find(".load-more").exists()).toBe(false);
  });

  it("falls back to one cross-destination list when the API predates destination paging", async () => {
    const legacyItems = signals.map((signal) => {
      const legacy = { ...signal };
      delete legacy.activeValidation;
      return legacy as MarketSignalV1;
    });
    listMarketSignals.mockImplementation(async () => ({
      contractVersion: "market-signal-page.v1",
      items: legacyItems,
      pageSize: 50,
      nextCursor: null,
    }));
    const wrapper = await mountPage();

    expect(wrapper.findAll(".queue-item")).toHaveLength(2);
    expect(tab(wrapper, "待判断").get("b").text()).toBe("2");

    listMarketSignals.mockClear();
    await (
      wrapper.vm as unknown as { loadSignals: () => Promise<void> }
    ).loadSignals();
    await flushPromises();

    expect(listMarketSignals).toHaveBeenCalledTimes(1);
    expect(listMarketSignals).toHaveBeenCalledWith({ pageSize: 50 });
  });

  it("moves between queue tabs with arrow, Home and End keys", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const wrapper = await mountPage("", host);
    const tabs = () => wrapper.findAll('[role="tab"]');
    const last = tabs().length - 1;
    expect(tabs().map((item) => item.attributes("tabindex"))).toEqual([
      "0",
      ...Array.from({ length: last }, () => "-1"),
    ]);
    expect(wrapper.get('[role="tabpanel"]').attributes("aria-labelledby")).toBe(
      tabs()[0]!.attributes("id"),
    );

    await tabs()[0]!.trigger("keydown", { key: "ArrowRight" });
    expect(tabs()[1]!.attributes("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[1]!.element);
    await tabs()[1]!.trigger("keydown", { key: "End" });
    expect(tabs()[last]!.attributes("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[last]!.element);
    await tabs()[last]!.trigger("keydown", { key: "ArrowRight" });
    expect(tabs()[0]!.attributes("aria-selected")).toBe("true");
    await tabs()[0]!.trigger("keydown", { key: "ArrowLeft" });
    expect(tabs()[last]!.attributes("aria-selected")).toBe("true");
    await tabs()[last]!.trigger("keydown", { key: "Home" });
    expect(tabs()[0]!.attributes("aria-selected")).toBe("true");
    expect(tabs()[0]!.attributes("tabindex")).toBe("0");
    wrapper.unmount();
    host.remove();
  });

  it("blocks completed exits on another person's commitment and explains why", async () => {
    signals = [
      marketSignal({
        ...signals[0]!,
        currentDestination: "watching",
        activeValidation: {
          responsibleActorId: "market-colleague",
          nextReviewDate: "2026-02-12",
          watchFocus: "同事负责的验证",
          waitingReason: null,
        },
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    await wrapper.get('input[value="handoff"]').setValue(true);
    expect(wrapper.get(".validation-owner-conflict").text()).toContain(
      "market-colleague",
    );
    expect(wrapper.get(".primary-action").attributes("disabled")).toBeDefined();

    await wrapper.get('input[value="dismiss"]').setValue(true);
    expect(wrapper.get(".validation-owner-conflict").text()).toContain(
      "market-colleague",
    );
    expect(wrapper.get(".primary-action").attributes("disabled")).toBeDefined();
    await wrapper.get("select").setValue("证据不足");
    expect(wrapper.get(".primary-action").attributes("disabled")).toBeDefined();

    for (const decision of ["void", "archive"] as const) {
      await wrapper.get(`input[value="${decision}"]`).setValue(true);
      expect(wrapper.get(".validation-owner-conflict").text()).toContain(
        "market-colleague",
      );
      expect(
        wrapper.get(".primary-action").attributes("disabled"),
      ).toBeDefined();
    }
  });

  it("does not submit incomplete exits from the Web", async () => {
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    for (const decision of ["dismiss", "void", "archive"] as const) {
      await wrapper.get(`input[value="${decision}"]`).setValue(true);
      expect(
        wrapper.get(".primary-action").attributes("disabled"),
      ).toBeDefined();
      await wrapper.get(".decision-panel").trigger("submit");
    }

    expect(decideMarketSignal).not.toHaveBeenCalled();
  });

  it("restores the conflict feedback and reloads detail after a 409", async () => {
    signals = [
      marketSignal({
        ...signals[0]!,
        currentDestination: "watching",
        activeValidation: {
          responsibleActorId: "operator-dev",
          nextReviewDate: "2026-02-12",
          watchFocus: "我的验证",
          waitingReason: null,
        },
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    decideMarketSignal.mockRejectedValue(
      new Error("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT"),
    );
    const wrapper = await mountPage(`?signalId=${signalOneId}`);
    const detailReads = getMarketSignal.mock.calls.length;

    await scheduleWatch(wrapper, "2026-02-20", "改期后的验证");

    expect(wrapper.get(".operation-error").text()).toContain(
      "MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT",
    );
    expect(getMarketSignal.mock.calls.length).toBe(detailReads + 1);
    expect(
      (
        wrapper.get('textarea[aria-label="这次要验证什么"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("改期后的验证");
  });

  it("clears detail panes when switching queue filters", async () => {
    const handedOffTitle = "已交接的折叠推车需求";
    const voidedTitle = "已作废的重复登记信号";
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: handedOffTitle,
        currentDestination: "handed_off",
        observedFactSummary: "已交接事实",
        pendingFieldCodes: [],
      }),
      marketSignal({
        signalId: signalTwoId,
        title: voidedTitle,
        currentDestination: "voided",
        observedFactSummary: "已作废事实",
        pendingFieldCodes: [],
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
      [
        signalTwoId,
        { signal: signals[1]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    expect(wrapper.get('[aria-label="信号事实与依据"]').text()).toContain(
      handedOffTitle,
    );

    const voidTab = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes("已作废"));
    expect(voidTab).toBeTruthy();
    await voidTab!.trigger("click");
    await flushPromises();

    expect(wrapper.get('[aria-label="信号事实与依据"]').text()).not.toContain(
      handedOffTitle,
    );
    expect(wrapper.get('[aria-label="信号事实与依据"]').text()).toContain(
      "请从左侧当前分组选择一条信号。",
    );
    expect(wrapper.get('[aria-label="信号处理动作"]').text()).toContain(
      "请从左侧当前分组选择一条信号后再判断去向。",
    );
    expect(wrapper.get('[aria-label="信号处理动作"]').text()).not.toContain(
      "给这条信号一个去向",
    );
  });

  it("treats voided signals as a closed page mode without supplement CTAs", async () => {
    signals = [
      marketSignal({
        signalId: signalOneId,
        title: "udu",
        currentDestination: "voided",
        pendingFieldCodes: [
          "market_code",
          "channel_code",
          "category_ref",
          "observed_fact_summary",
          "hypothesis",
        ],
      }),
    ];
    details = new Map([
      [
        signalOneId,
        { signal: signals[0]!, evidence: [], selectionReturnReason: null },
      ],
    ]);
    const wrapper = await mountPage(`?signalId=${signalOneId}`);

    expect(wrapper.get('[aria-label="信号关闭结论"]').text()).toContain(
      "已作废关闭",
    );
    expect(wrapper.get('[aria-label="信号关闭结论"]').text()).toContain("udu");
    expect(wrapper.get(".closed-gap-summary").text()).toContain(
      "关闭时 5 项未补齐",
    );
    expect(wrapper.find('button[aria-label^="补充"]').exists()).toBe(false);
    expect(wrapper.find(".gap-strip").exists()).toBe(false);
    expect(wrapper.find('[aria-label="信号处理动作"]').exists()).toBe(false);
    expect(wrapper.get(".queue-item--closed").text()).toContain(
      "关闭时未补 5 项",
    );
    expect(wrapper.get(".queue-item--closed").text()).not.toContain(
      "不影响先处理",
    );
  });
});

async function mountPage(query = "", attachTo?: Element) {
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
    ...(attachTo ? { attachTo } : {}),
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

function productOpportunity(
  state: "claimed" | "accepted",
): ProductOpportunityV1 {
  const source = marketSignal({
    signalId: signalOneId,
    title: "已交选品的加拿大机会",
    currentDestination: "handed_off",
    pendingFieldCodes: [],
  });
  const accepted = state === "accepted";
  return {
    handoff: handoff(source, "验证加拿大机会是否值得立项"),
    supplementedFieldCodes: [],
    intakeState: state,
    intakeVersion: accepted ? 2 : 1,
    assignedActorId: "selector-1",
    responsibility: {
      status: accepted ? "transferred_to_selection" : "retained_by_market",
      responsibleTeamCode: accepted
        ? "product_selection"
        : "market_intelligence",
      handedOffAt: "2026-10-04T00:00:00.000Z",
      assignedActorId: "selector-1",
      claimedAt: "2026-10-04T00:10:00.000Z",
      acceptedAt: accepted ? "2026-10-04T00:20:00.000Z" : null,
    },
    latestSelectionDecision: accepted
      ? {
          outcome: "defer",
          completion: "completed",
          currentDestination: "deferred",
          responsibleActorId: "selector-1",
          reason: "等待下一轮成本验证",
          returnBasis: null,
          decidedAt: "2026-10-04T00:30:00.000Z",
        }
      : null,
  };
}

type PageWrapper = Awaited<ReturnType<typeof mountPage>>;

function tab(wrapper: PageWrapper, label: string) {
  return wrapper
    .findAll('[role="tab"]')
    .find((item) => item.text().includes(label))!;
}

async function scheduleWatch(
  wrapper: PageWrapper,
  nextReviewDate: string,
  watchFocus: string,
): Promise<void> {
  await wrapper.get('input[value="watch"]').setValue(true);
  await wrapper.get('input[type="date"]').setValue(nextReviewDate);
  await wrapper
    .get('textarea[aria-label="这次要验证什么"]')
    .setValue(watchFocus);
  await wrapper.get(".decision-panel").trigger("submit");
  await flushPromises();
}

function decisionResult(
  signal: MarketSignalV1,
  overrides: Partial<MarketSignalV1> = {},
) {
  return {
    contractVersion: "market-signal-decision-result.v1",
    status: "saved",
    signal: { ...signal, ...overrides },
    decisionId: "66666666-6666-4666-8666-666666666666",
    decisionVersion: 1,
    completion: "completed",
    handoff: null,
  };
}
