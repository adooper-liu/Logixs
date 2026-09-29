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
const listProductInitiatives = vi.fn();

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
  listProductInitiatives: (...args: unknown[]) =>
    listProductInitiatives(...args),
}));

describe("ProductSelectionWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMarketSignalEvidence.mockResolvedValue(undefined);
    getProductInitiative.mockResolvedValue(initiativeDetail());
    decideProductInitiative.mockResolvedValue({});
    listProductInitiatives.mockResolvedValue({
      contractVersion: "product-initiative-queue.v1",
      items: [],
      pageSize: 200,
      nextCursor: null,
    });
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
      "合并信号后补后仍缺这些；不阻止领取和评估",
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
      "目标结果在上面的「目标结果」里补",
      "目标用户与市场在评审要点面板里补",
      "竞争供给在评审要点面板里补",
      "价格带与利润在评审要点面板里补",
      "合规风险在评审要点面板里补",
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

  it("换一条机会时半开的证据登记表单不会跟着过去", async () => {
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

    await wrapper
      .findAll(".product-initiative-review button.add-evidence")[0]!
      .trigger("click");
    await wrapper
      .get('textarea[aria-label="目标用户与市场证据内容"]')
      .setValue("这条是写给第一条机会的");
    expect(wrapper.find(".evidence-form").exists()).toBe(true);

    await wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();

    // 表单属于上一条机会：留着它会导致这条内容被登记到另一条机会的信号上
    expect(wrapper.find(".evidence-form").exists()).toBe(false);
  });

  it("队列上能分出「看过但先放着」与「还没看过」", async () => {
    const untouched = acceptedOpportunity({
      handoff: {
        ...opportunity().handoff,
        handoffId: SECOND_HANDOFF_ID,
        title: "德国站收纳需求上升",
      },
      intakeVersion: 3,
    });
    listProductOpportunities.mockResolvedValue(
      acceptedPage([acceptedOpportunity(), untouched]),
    );
    listProductInitiatives.mockResolvedValue({
      contractVersion: "product-initiative-queue.v1",
      items: [
        {
          handoffId: HANDOFF_ID,
          outcome: "defer",
          currentDestination: "needs_decision",
          pendingFieldCodes: ["defer_reason"],
          updatedAt: "2026-09-27T00:00:00.000Z",
        },
      ],
      pageSize: 200,
      nextCursor: null,
    });
    const wrapper = await mountPage();

    const items = wrapper.findAll(".queue-item");
    expect(items[0]!.text()).toContain("看过，先放着");
    expect(items[0]!.text()).toContain("待补 1 项");
    // 第二条没有立项记录：不能被标成"看过"，否则岗位会以为已经处理过
    expect(items[1]!.text()).not.toContain("看过，先放着");
    expect(items[1]!.text()).not.toContain("已暂缓");
  });

  it("暂缓过的机会在队列上标成已暂缓，不再显示成待处理", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    listProductInitiatives.mockResolvedValue({
      contractVersion: "product-initiative-queue.v1",
      items: [
        {
          handoffId: HANDOFF_ID,
          outcome: "defer",
          currentDestination: "deferred",
          pendingFieldCodes: [],
          updatedAt: "2026-09-27T00:00:00.000Z",
        },
      ],
      pageSize: 200,
      nextCursor: null,
    });
    const wrapper = await mountPage();

    expect(wrapper.get(".queue-item").text()).toContain("已暂缓");
  });

  it("版本冲突给人话而不是机器代号，并已重新读取最新版本", async () => {
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

    const alert = wrapper.get('[role="alert"]').text();
    expect(alert).toContain("已被其他人更新过");
    expect(alert).not.toContain("PRODUCT_INITIATIVE_VERSION_CONFLICT");
    // 冲突后重读，否则下一次提交还拿旧版本再撞一次
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
  });

  it("已退回的机会按服务端事实说明本次结果，不停在“形成立项结论”", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          outcome: "return_to_market",
          completion: "completed",
          currentDestination: "returned_to_market",
          reason: "该由经营团队重新判断",
        },
      }),
    );
    const wrapper = await mountPage();

    const context = wrapper.get(".work-context");
    expect(context.text()).toContain("已退回经营团队");
    expect(context.text()).not.toContain("形成立项结论");
    // 已记下的原因回填，重放同一去向不会把它抹掉
    expect(
      (
        wrapper.get('textarea[aria-label="退回原因"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("该由经营团队重新判断");
  });

  it("已立项后评审要点只读，不再提供系统不会接受的编辑", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          outcome: "approve",
          completion: "completed",
          currentDestination: "handed_off",
        },
      }),
    );
    const wrapper = await mountPage();

    const review = wrapper.get(".product-initiative-review");
    const conclusion = review.get('textarea[aria-label="竞争供给结论"]');
    expect(conclusion.attributes("readonly")).toBeDefined();
    // 专业要求面板另有自己的“添加证据”，这里只断言评审要点面板不再给写入口
    expect(review.find("button.add-evidence").exists()).toBe(false);
    expect(review.find(".picker-toggle").exists()).toBe(false);
    // 短句落在档位单选；补充框为空不算丢结论
    expect(
      (
        review.get(
          '.review-point[data-code="competitive_supply"] input[value="concentrated"]',
        ).element as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect((conclusion.element as HTMLTextAreaElement).value).toBe("");
    expect(
      review
        .get(
          '.review-point[data-code="competitive_supply"] .review-point__facts',
        )
        .text(),
    ).toContain("在售同款 320 个");
  });

  it("立项判断读不出来时不提供判断动作，先让人重新加载", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockRejectedValue(
      new Error("暂时无法加载立项判断（500）"),
    );
    const wrapper = await mountPage();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "暂时无法加载立项判断",
    );
    expect(wrapper.find(".outcome-submit").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-review").exists()).toBe(false);
  });

  it("从专业要求登记的证据也会进评审要点的候选里", async () => {
    listProductOpportunities.mockResolvedValue(
      acceptedPage([
        acceptedOpportunity({
          handoff: { ...opportunity().handoff, categoryRef: "宠物出行" },
        }),
      ]),
    );
    const wrapper = await mountPage();
    expect(getProductInitiative).toHaveBeenCalledTimes(1);

    await wrapper.findAll("button.add-evidence")[0]!.trigger("click");
    await wrapper
      .get('textarea[aria-label="竞争供给证据"]')
      .setValue("类目页显示在售同款 320 个。");
    await wrapper.get(".evidence-form").trigger("submit");
    await flushPromises();

    // 新证据挂同一个来源信号，评审要点的可引用列表必须跟着更新
    expect(getProductInitiative).toHaveBeenCalledTimes(2);
  });

  it("已立项的机会整页 Mode：结论条优先，无右侧判断动作", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          outcome: "approve",
          completion: "completed",
          currentDestination: "handed_off",
        },
      }),
    );
    const wrapper = await mountPage();

    expect(wrapper.classes()).toContain("selection-workbench--initiated");
    expect(wrapper.get(".conclusion-strip").text()).toContain("已立项");
    expect(wrapper.find(".destination").exists()).toBe(false);
    expect(wrapper.find(".outcome-submit").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(false);
    expect(wrapper.find(".progress-head").exists()).toBe(false);
  });

  it("接受后显示完备度进度头与带入，待补不进进度头以外的催办墙", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    expect(wrapper.get(".progress-head").text()).toMatch(/必填剩/);
    expect(wrapper.get(".progress-head__apply").text()).toContain("带入");
    await wrapper.get(".progress-head__apply").trigger("click");
    expect(wrapper.get('[role="status"]').text()).toContain("已自动带入");
  });
});

function initiativeRecord() {
  return {
    initiativeId: "55555555-5555-4555-8555-555555555555",
    outcome: "approve" as const,
    completion: "completed" as const,
    currentDestination: "handed_off" as const,
    responsibleActorId: "dev-operator",
    objective: "做成可发布版本",
    reviewPoints: [
      {
        code: "competitive_supply" as const,
        evidenceRefs: [EVIDENCE_ID],
        conclusion: "头部集中",
      },
    ],
    reason: null,
    pendingFieldCodes: [],
    version: 1,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
}

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
    supplementedFieldCodes: [],
    ...overrides,
  };
}
