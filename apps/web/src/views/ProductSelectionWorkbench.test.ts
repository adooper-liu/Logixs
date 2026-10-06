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

  it("shows compact opportunity facts and keeps handoff gaps on demand", async () => {
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("加拿大站宠物出行需求上升");
    expect(wrapper.text()).toContain("验证宠物出行机会是否值得立项");
    expect(wrapper.get(".opportunity-queue").text()).toContain("渠道未填");
    expect(wrapper.get(".opportunity-facts").text()).toContain("经营范围");
    expect(wrapper.get(".opportunity-facts").text()).toContain("证据");
    expect(wrapper.get(".opportunity-status").text()).toContain("交接缺失");
    expect(wrapper.text()).not.toContain("经营团队交来了什么");
    expect(wrapper.text()).not.toContain("希望选品验证");
    expect(wrapper.text()).not.toContain("交接时未填");
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
    expect(panel.get("h3").text()).toBe("专业要求");
    expect(panel.findAll('[aria-label="查看专业要求说明"]')).toHaveLength(3);
    expect(panel.text()).not.toContain("为什么适用");
    expect(panel.text()).not.toContain("评估阶段才会出现");

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
    expect(panel.get(".withheld-notice summary").text()).toContain("另有 2 项");
    await panel.get(".withheld-notice summary").trigger("click");
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

  it("读取全部机会分页，并把第二页的暂缓到期项排在最前", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      opportunity({
        handoff: {
          ...opportunity().handoff,
          handoffId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          title: `普通机会 ${String(index + 1).padStart(3, "0")}`,
        },
      }),
    );
    const due = opportunity({
      handoff: {
        ...opportunity().handoff,
        handoffId: SECOND_HANDOFF_ID,
        title: "第二页暂缓到期机会",
      },
    });
    listProductOpportunities
      .mockResolvedValueOnce({
        contractVersion: "product-opportunity-page.v1",
        items: firstPage,
        pageSize: 100,
        nextCursor: "opportunity/page-2",
      })
      .mockResolvedValueOnce({
        contractVersion: "product-opportunity-page.v1",
        items: [due],
        pageSize: 100,
        nextCursor: null,
      });
    listProductInitiatives.mockResolvedValue({
      contractVersion: "product-initiative-queue.v1",
      items: [
        {
          handoffId: SECOND_HANDOFF_ID,
          outcome: "defer",
          currentDestination: "deferred",
          queueGroup: "defer_reconsideration_due",
          reconsiderationDate: "2026-10-04",
          pendingFieldCodes: [],
          updatedAt: "2026-10-04T00:00:00.000Z",
        },
      ],
      pageSize: 200,
      nextCursor: null,
    });

    const wrapper = await mountPage();

    expect(listProductOpportunities).toHaveBeenNthCalledWith(1, {
      pageSize: 100,
    });
    expect(listProductOpportunities).toHaveBeenNthCalledWith(2, {
      pageSize: 100,
      cursor: "opportunity/page-2",
    });
    expect(wrapper.findAll(".queue-item")).toHaveLength(101);
    expect(wrapper.findAll(".queue-group")[0]!.text()).toBe("暂缓到期");
    expect(wrapper.findAll(".queue-item strong")[0]!.text()).toBe(
      "第二页暂缓到期机会",
    );
    expect(wrapper.findAll(".queue-item strong")[1]!.text()).toBe(
      "普通机会 001",
    );
    expect(wrapper.findAll(".queue-item strong")[100]!.text()).toBe(
      "普通机会 100",
    );
  });

  it("机会分页重复游标时明确失败并停止继续请求", async () => {
    listProductOpportunities
      .mockResolvedValueOnce({
        contractVersion: "product-opportunity-page.v1",
        items: [opportunity()],
        pageSize: 100,
        nextCursor: "opportunity/repeated",
      })
      .mockResolvedValueOnce({
        contractVersion: "product-opportunity-page.v1",
        items: [opportunity()],
        pageSize: 100,
        nextCursor: "opportunity/repeated",
      });

    const wrapper = await mountPage();

    expect(listProductOpportunities).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "机会队列分页异常（重复游标），请重新加载。",
    );
    expect(wrapper.findAll(".queue-item")).toHaveLength(0);
  });

  it("只给已接受的机会显示立项判断，待领取的先不显示", async () => {
    const queued = await mountPage();

    expect(queued.find(".product-initiative-review").exists()).toBe(false);
    expect(queued.find(".product-initiative-outcome").exists()).toBe(false);
    expect(getProductInitiative).not.toHaveBeenCalled();
  });

  it("立项前把缺口聚合为五类，并由导航直达当前编辑区域", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.text()).toContain("先补齐上方 5 类");
    const gaps = wrapper
      .findAll(".initiative-gap-groups button")
      .map((node) => node.text());
    expect(gaps.slice(0, 4)).toEqual([
      "目标结果· 1 项未齐",
      "责任与资源· 3 项未齐",
      "时间与下一决策· 3 项未齐",
      "评审依据· 4 项未齐",
    ]);
    expect(gaps[4]).toMatch(/^单位经济· \d+ 项未齐$/);
    await wrapper
      .get(".initiative-gap-groups button:nth-child(2)")
      .trigger("click");
    await wrapper.vm.$nextTick();
    expect(
      wrapper
        .get('[data-gap-panel="responsibility_resources"]')
        .attributes("style"),
    ).toBeUndefined();
  });

  it("补齐资源承诺、目标结果与四项要点后立项", async () => {
    listProductOpportunities.mockResolvedValue(
      acceptedPage([acceptedOpportunityWithChannel()]),
    );
    const wrapper = await mountPage();

    await fillApprovalDraft(wrapper);

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.text()).toContain("立项并交给产品开发");
    expect(wrapper.get(".progress-head").text()).toContain(
      "待处理 0 类 · 已齐 5/5",
    );
    await button.trigger("click");
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledWith(
      HANDOFF_ID,
      expect.objectContaining({
        outcome: "approve",
        expectedInitiativeVersion: 0,
        objective: "把折叠宠物出行包做成可发布版本",
        acceptResponsibility: true,
        receivingTeamOrRole: "产品开发 / NPI",
        resourceDescription: "结构工程 1 人，采购验证 1 人",
        targetDate: "2026-11-15",
        nextDecisionDate: "2026-10-20",
        nextDecisionQuestion: "是否进入 EVT 打样",
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

  it("负贡献理由缺口写失败后保留行动区和草稿，可就地补理由重提", async () => {
    listProductOpportunities.mockResolvedValue(
      acceptedPage([acceptedOpportunityWithChannel()]),
    );
    decideProductInitiative
      .mockRejectedValueOnce(
        new Error(
          "暂时无法保存本次立项判断（400）：PRODUCT_INITIATIVE_INCOMPLETE: negativeConservativeReason",
        ),
      )
      .mockResolvedValueOnce({});
    const wrapper = await mountPage();
    await fillApprovalDraft(wrapper);

    await wrapper.get(".outcome-submit").trigger("click");
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("单位经济 · 仍要投入的理由");
    expect(alert.find("button").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(true);
    expect(wrapper.find(".outcome-submit").exists()).toBe(true);
    expect(
      (
        wrapper.get('[aria-label="基准情景 销售价 最低值"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("100.00");
    expect(
      (
        wrapper.get('[aria-label="保守情景 销售价 最高值"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("120.00");

    const reason = wrapper.get('textarea[aria-label="仍要投入的理由"]');
    await reason.setValue("战略品类入口仍需小规模验证");
    expect(
      wrapper.get(".outcome-submit").attributes("disabled"),
    ).toBeUndefined();
    await wrapper.get(".outcome-submit").trigger("click");
    await flushPromises();

    expect(decideProductInitiative).toHaveBeenCalledTimes(2);
    expect(decideProductInitiative.mock.calls[1]![1]).toEqual(
      expect.objectContaining({
        negativeConservativeReason: "战略品类入口仍需小规模验证",
        unitEconomicsDraft: expect.objectContaining({
          currencyCode: "CAD",
          scenarios: expect.objectContaining({
            baseline: expect.any(Object),
            conservative: expect.any(Object),
          }),
        }),
      }),
    );
  });

  it("四个去向的原因各存各的，来回切换不丢已写内容", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);
    await wrapper
      .get('textarea[aria-label="这次要验证什么"]')
      .setValue("证据还不够，先放着");
    await wrapper.get(".destination:nth-of-type(4) input").setValue(true);

    expect(
      wrapper.get('textarea[aria-label="市场需要补什么"]').element,
    ).toHaveProperty("value", "");
    await wrapper
      .get('textarea[aria-label="市场需要补什么"]')
      .setValue("该由经营团队重新判断");
    await wrapper.get(".destination:nth-of-type(2) input").setValue(true);

    expect(
      wrapper.get('textarea[aria-label="这次要验证什么"]').element,
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

  it("请求退回市场时必须先选择退回依据", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    await wrapper.get(".destination:nth-of-type(4) input").setValue(true);

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.text()).toContain("请选择退回依据");
    await button.trigger("click");
    expect(decideProductInitiative).not.toHaveBeenCalled();

    await wrapper
      .get('select[aria-label="退回依据"]')
      .setValue("wrong_direction");
    expect(button.attributes("disabled")).toBeUndefined();
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

  it("切换任务期间不把上一条的冻结结论混进当前机会", async () => {
    let releaseSecond!: (value: ReturnType<typeof initiativeDetail>) => void;
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
    getProductInitiative.mockImplementation((handoffId: string) =>
      handoffId === HANDOFF_ID
        ? Promise.resolve(initiativeDetail({ initiative: initiativeRecord() }))
        : new Promise((resolve) => {
            releaseSecond = resolve;
          }),
    );
    const wrapper = await mountPage();

    expect(wrapper.get(".initiative-result").text()).toContain("已交 NPI");

    await wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();

    expect(wrapper.get(".pane--detail").text()).toContain(
      "正在读取该机会已有的立项判断",
    );
    expect(wrapper.get(".pane--action").text()).toContain(
      "正在读取该机会已有的立项判断",
    );
    expect(wrapper.find(".initiative-result").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("已交 NPI");
    expect(wrapper.text()).not.toContain("结论已冻结");

    releaseSecond(initiativeDetail({ handoffId: SECOND_HANDOFF_ID }));
    await flushPromises();

    expect(wrapper.find(".initiative-result").exists()).toBe(false);
    expect(wrapper.get(".opportunity-detail").text()).toContain(
      "德国站收纳需求上升",
    );
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(true);
  });

  it("换一条机会时专业要求的半开证据表单和草稿不会跟着过去", async () => {
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
      .get(".evaluation-requirements button.add-evidence")
      .trigger("click");
    await wrapper
      .get(".evaluation-requirements textarea")
      .setValue("这条是写给第一条机会的");
    expect(wrapper.find(".evidence-form").exists()).toBe(true);

    await wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();

    // 表单属于上一条机会：留着它会导致这条内容被登记到另一条机会的信号上
    expect(wrapper.find(".evidence-form").exists()).toBe(false);

    await wrapper.findAll(".queue-item")[0]!.trigger("click");
    await flushPromises();

    expect(wrapper.find(".evidence-form").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("这条是写给第一条机会的");
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
        wrapper.get('textarea[aria-label="市场需要补什么"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("该由经营团队重新判断");
  });

  it("退回请求在三栏各处都显示等待市场接回，不伪造 NPI 交接", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          outcome: "return_to_market",
          completion: "completed",
          currentDestination: "return_requested",
          reason: "请市场重新核对目标方向",
          returnBasis: "wrong_direction",
        },
      }),
    );
    const wrapper = await mountPage();

    expect(wrapper.findAll(".pane")).toHaveLength(3);
    expect(wrapper.get("header").text()).toContain("等待市场接回");
    expect(wrapper.get(".initiative-result").text()).toContain("等待市场接回");
    expect(wrapper.get(".pane--action").text()).toContain("等待市场接回");
    expect(wrapper.get(".pane--action").text()).toContain("当前责任仍在选品");
    expect(wrapper.text()).not.toContain("已交 NPI");
    expect(wrapper.text()).not.toContain("NPI 承接");
  });

  it("已立项后展示结果摘要，不把历史缺失显示成当前待补", async () => {
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

    const result = wrapper.get(".initiative-result");
    expect(result.text()).toContain("已立项 · 已交 NPI");
    expect(result.text()).toContain("立项责任");
    expect(result.text()).toContain("历史未记录");
    expect(result.text()).toContain("头部集中");
    expect(result.text()).toContain("1 项证据");
    expect(result.text()).toContain("历史立项未记录");
    expect(result.text()).not.toContain("待补");
    expect(result.find("input, select, textarea").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-review").exists()).toBe(false);
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

  it("在办理中与已交 NPI 机会间往返时固定三栏壳，只切换详情与右栏", async () => {
    const working = acceptedOpportunityWithChannel();
    const handedOff = acceptedOpportunity({
      handoff: {
        ...acceptedOpportunity().handoff,
        handoffId: SECOND_HANDOFF_ID,
        title: "加拿大站宠物出行已立项机会",
      },
    });
    listProductOpportunities.mockResolvedValue(
      acceptedPage([working, handedOff]),
    );
    getProductInitiative.mockImplementation((handoffId: string) =>
      Promise.resolve(
        handoffId === SECOND_HANDOFF_ID
          ? initiativeDetail({
              handoffId: SECOND_HANDOFF_ID,
              initiative: initiativeRecord(),
            })
          : initiativeDetail(),
      ),
    );
    const wrapper = await mountPage();

    expect(wrapper.findAll(".pane")).toHaveLength(3);
    expect(wrapper.find(".work-context").exists()).toBe(true);
    expect(wrapper.find(".initiative-result").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(true);

    await wrapper
      .findAll(".queue-item")
      .find((item) => item.text().includes("已立项机会"))!
      .trigger("click");
    await flushPromises();

    expect(wrapper.classes()).not.toContain("selection-workbench--initiated");
    expect(wrapper.findAll(".pane")).toHaveLength(3);
    expect(wrapper.find(".work-context").exists()).toBe(true);
    expect(wrapper.get(".initiative-result").text()).toContain(
      "已立项 · 已交 NPI",
    );
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(false);
    expect(wrapper.get(".pane--action").text()).toContain("结论已冻结");

    await wrapper
      .findAll(".queue-item")
      .find((item) => item.text().includes("加拿大站宠物出行需求上升"))!
      .trigger("click");
    await flushPromises();

    expect(wrapper.findAll(".pane")).toHaveLength(3);
    expect(wrapper.find(".initiative-result").exists()).toBe(false);
    expect(wrapper.find(".product-initiative-outcome").exists()).toBe(true);
    expect(wrapper.text()).toContain("选品岗位工作台");
  });

  it("已交 NPI 后当前责任来自承接团队，不沿用机会领取人", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          receivingTeamOrRole: "产品开发 / NPI",
        },
      }),
    );
    const wrapper = await mountPage();

    const header = wrapper.get(".initiative-result__strip");
    expect(header.text()).toContain("产品开发 / NPI");
    expect(header.text()).toContain("立项责任");
    expect(header.text()).not.toContain("当前责任");
  });

  it("结果态只显示立项快照中的贡献摘要", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    getProductInitiative.mockResolvedValue(
      initiativeDetail({
        initiative: {
          ...initiativeRecord(),
          unitEconomicsSnapshot: {
            currencyCode: "CAD",
            scenarios: {
              baseline: { contribution: { min: "12.00", max: "18.00" } },
              conservative: { contribution: { min: "4.00", max: "8.00" } },
            },
          },
        },
      }),
    );
    const wrapper = await mountPage();

    const result = wrapper.get(".initiative-result");
    expect(result.text()).toContain("基准贡献");
    expect(result.text()).toContain("12.00～18.00 CAD");
    expect(result.text()).toContain("4.00～8.00 CAD");
    expect(result.text()).not.toContain("历史立项未记录");
  });

  it("接受后仅显示完备度与缺口导航，不自动生成目标结果", async () => {
    listProductOpportunities.mockResolvedValue(acceptedPage());
    const wrapper = await mountPage();

    expect(wrapper.get(".progress-head").text()).toContain(
      "待处理 5 类 · 已齐 0/5",
    );
    expect(wrapper.find(".progress-head__apply").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("已自动带入交接合并视图");
    expect(wrapper.text()).not.toContain("目标结果已有内容，未覆盖");
    expect(
      (
        wrapper.get('textarea[aria-label="目标结果"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("");
    await wrapper
      .get('textarea[aria-label="目标结果"]')
      .setValue("把折叠宠物出行包做成可发布版本");
    expect(wrapper.get(".progress-head").text()).toContain(
      "待处理 4 类 · 已齐 1/5",
    );
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
    responsibility: {
      status: "transferred_to_selection",
      responsibleTeamCode: "product_selection",
      handedOffAt: "2026-09-25T02:00:00.000Z",
      assignedActorId: "dev-operator",
      claimedAt: "2026-09-25T02:10:00.000Z",
      acceptedAt: "2026-09-25T02:20:00.000Z",
    },
    ...overrides,
  });
}

function acceptedOpportunityWithChannel(): ProductOpportunityV1 {
  const accepted = acceptedOpportunity();
  return {
    ...accepted,
    handoff: {
      ...accepted.handoff,
      channelCode: "Amazon CA",
      pendingFieldCodes: accepted.handoff.pendingFieldCodes.filter(
        (code) => code !== "channel_code",
      ),
    },
  };
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
    currencyOptions: [
      { code: "CAD", name: "Canadian Dollar", minorUnit: 2 },
      { code: "USD", name: "US Dollar", minorUnit: 2 },
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
          props: ["eyebrow", "title", "summary"],
          template:
            "<header><small>{{ eyebrow }}</small><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

async function fillUnitEconomics(
  wrapper: Awaited<ReturnType<typeof mountPage>>,
): Promise<void> {
  await wrapper.get('[aria-label="单位经济币种"]').setValue("CAD");
  for (const scenario of ["基准情景", "保守情景"]) {
    for (const field of [
      "销售价",
      "落地成本",
      "平台费",
      "履约费",
      "广告成本",
      "退货成本",
    ]) {
      const minimum = field === "销售价" ? "100.00" : "5.00";
      const maximum = field === "销售价" ? "120.00" : "10.00";
      await wrapper
        .get('[aria-label="' + scenario + " " + field + ' 最低值"]')
        .setValue(minimum);
      await wrapper
        .get('[aria-label="' + scenario + " " + field + ' 最高值"]')
        .setValue(maximum);
      await wrapper
        .get('[aria-label="' + scenario + " " + field + ' 依据类型"]')
        .setValue("assumption");
    }
  }
}

async function fillApprovalDraft(
  wrapper: Awaited<ReturnType<typeof mountPage>>,
): Promise<void> {
  await wrapper
    .get('textarea[aria-label="目标结果"]')
    .setValue("把折叠宠物出行包做成可发布版本");
  await wrapper.get(".responsibility-check input").setValue(true);
  await wrapper
    .get('input[aria-label="承接团队或岗位"]')
    .setValue("产品开发 / NPI");
  await wrapper
    .get('textarea[aria-label="资源说明"]')
    .setValue("结构工程 1 人，采购验证 1 人");
  await wrapper.get('input[aria-label="目标日期"]').setValue("2026-11-15");
  await wrapper.get('input[aria-label="下一决策日期"]').setValue("2026-10-20");
  await wrapper
    .get('textarea[aria-label="下一决策问题"]')
    .setValue("是否进入 EVT 打样");
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
  await fillUnitEconomics(wrapper);
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
    responsibility: {
      status: "retained_by_market",
      responsibleTeamCode: "market_intelligence",
      handedOffAt: "2026-09-25T02:00:00.000Z",
      assignedActorId: null,
      claimedAt: null,
      acceptedAt: null,
    },
    latestSelectionDecision: null,
    ...overrides,
  };
}
