import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
import OceanOperationsWorkbench from "./OceanOperationsWorkbench.vue";
import type { OceanFocusItem } from "../api/oceanOperations";

const focus: OceanFocusItem[] = [
  {
    code: "progress",
    title: "运输进展",
    status: "information",
    summary: "按已有运输事实继续跟踪",
    evidence: ["当前目的港 ETA：2026-11-01"],
    standard: "预计不等于实际",
    trigger: null,
    actions: ["view_sources"],
  },
  {
    code: "arrival_change",
    title: "到港时间变化",
    status: "information",
    summary: "当前预计抵港 2026-11-01；没有可比前值",
    evidence: ["预计抵港：2026-11-01"],
    standard: "同事件比较",
    trigger: null,
    actions: ["view_sources", "record_assessment"],
  },
  {
    code: "route_risk",
    title: "航程及承运风险",
    status: "unavailable",
    summary: "航程风险信号尚未接入",
    evidence: [],
    standard: "风险信号可先核查",
    trigger: null,
    actions: ["view_sources"],
  },
  {
    code: "information",
    title: "信息缺失或冲突",
    status: "information",
    summary: "当前未识别需核对的信息项",
    evidence: [],
    standard: "待核不阻断信息共享",
    trigger: null,
    actions: ["view_sources", "record_assessment"],
  },
  {
    code: "coordination",
    title: "下游信息与协同",
    status: "unavailable",
    summary: "不以海运判断或接收回执作为准备工作的开工许可",
    evidence: [],
    standard: "只限制具体依赖动作",
    trigger: null,
    actions: ["view_sources", "record_assessment"],
  },
];

const listQueue = vi.fn();
const getProjection = vi.fn();
const saveReview = vi.fn();
const listTasks = vi.fn();
const listCollaboration = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

vi.mock("../api/oceanOperations", () => ({
  listOceanOperationsQueue: (...args: unknown[]) => listQueue(...args),
  getOceanOperationsProjection: (...args: unknown[]) => getProjection(...args),
  saveOceanOperationsReview: (...args: unknown[]) => saveReview(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listTasks(...args),
}));
vi.mock("../api/taskCollaboration", () => ({
  listTaskCollaboration: (...args: unknown[]) => listCollaboration(...args),
  postTaskCollaborationMessage: vi.fn(),
}));
vi.mock("../components/ui/PageHeader.vue", () => ({
  default: {
    props: ["eyebrow", "title", "summary"],
    template:
      "<header><span>{{ eyebrow }}</span><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
  },
}));

const projection = {
  container: { id: "container-1", number: "MEDU7620177", status: "in_transit" },
  shipment: {
    id: "shipment-1",
    number: null,
    carrier: "MSC",
    vessel: "MSC MAKALU III",
    voyage: "HD638A",
    billNumbers: ["1811F026PE36668R2"],
    plannedDepartureAt: "2026-09-23T00:00:00.000Z",
    actualDepartureAt: null,
    actualDepartureSource: null,
    origin: { code: "CNFOC", name: "福州" },
    destination: { code: "USSAV", name: "萨凡纳" },
  },
  references: {
    replenishmentOrderNumber: "26DSA01885",
    houseBillNumber: "1811F026PE36668R2",
  },
  task: {
    title: "核对目的港 ETA，供清关到港准备使用",
    question: "当前目的港 ETA 能否作为清关开始到港准备的依据？",
    currentResponsibility: "海运运营",
    deadline: null,
    deadlineStatus: "unknown" as const,
  },
  focus,
  observations: [
    {
      id: "lifecycle:eta-1",
      semanticKey: "arrived",
      sourceSystem: "development_demo.retained_source_package",
      sourceVersion: "post-departure-20260923-v1",
      parseState: "valid",
      sourcePrecision: "date-only",
      rawValue: "2026-11-01",
      normalizedValue: "2026-11-01T05:00:00.000Z",
      timeKind: "estimated",
      evidenceRefs: ["retained-fixture:MEDU7620177:eta"],
      isCurrent: true,
      conflict: false,
    },
  ],
  review: null as null | {
    id: string;
    decision: "review_required";
    reason: string;
    version: number;
    sourceObservationId: string;
    reviewedAt: string;
    writeBackTarget: string;
  },
  arrivalPreparation: null as null | {
    id: string;
    result:
      | "usable_for_customs_preparation"
      | "pending_evidence"
      | "not_suitable_for_customs_preparation";
    reason: string;
    sourceObservationId: string;
    sourceVersion: string;
    purpose: "customs_arrival_preparation";
    currentResponsibility: "海运运营";
    nextStep: string;
    version: number;
    recordedAt: string;
  },
  downstream: {
    status: "not_connected" as const,
    message: "办理结论已记录；清关尚未接收，接收入口未接通",
    purpose: "供清关到港准备使用",
    missingFacts: ["清关最晚行动时间未取得", "实际到港尚未回流"],
    nextStep: "清关接收入口接通后引用本次判断；实际到港回流后核验 ETA 偏差",
  },
  financialProjection: {
    incomeContribution: {
      status: "awaiting_actual" as const,
      message: "与到货可售窗口相关；待销售/库存结果回流",
    },
    costFee: {
      status: "source_amount_pending_verification" as const,
      amount: "3925",
      currency: "USD",
      sourceReference: "retained-fixture:MEDU7620177:ocean-freight",
      message: "来源金额、待核费；不是已核定应付",
    },
    cash: { status: "awaiting_actual" as const, message: "现金结果待回流" },
    inventory: {
      status: "awaiting_actual" as const,
      message: "库存本金及实际可售时间待回流",
    },
  },
  traceability: {
    sourceVersion: "post-departure-20260923-v1",
    reviewVersion: null,
    arrivalPreparationVersion: null,
    consumer: "customs_arrival_preparation" as const,
    actualArrivalStatus: "awaiting_actual" as const,
  },
};

function projectionFor(id: string, number: string) {
  return {
    ...projection,
    container: { ...projection.container, id, number },
    shipment: projection.shipment ? { ...projection.shipment } : null,
    observations: projection.observations.map((item) => ({ ...item })),
  };
}

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

async function mountWorkbench() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/workspaces/ocean-operations",
        component: OceanOperationsWorkbench,
      },
    ],
  });
  await router.push("/workspaces/ocean-operations");
  await router.isReady();
  const wrapper = mount(OceanOperationsWorkbench, {
    global: { plugins: [router] },
  });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

describe("OceanOperationsWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listQueue.mockResolvedValue([
      {
        containerId: "container-1",
        containerNumber: "MEDU7620177",
        shipmentNumber: null,
        status: "in_transit",
        observationCount: 1,
        conflictCount: 0,
        reviewDecision: null,
        updatedAt: "2026-10-26T00:00:00.000Z",
      },
    ]);
    getProjection.mockResolvedValue(
      projectionFor("container-1", "MEDU7620177"),
    );
    listTasks.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-10-30T00:00:00.000Z",
      projectionVersion: 1,
    });
    listCollaboration.mockResolvedValue({
      contractVersion: "task-collaboration-page.v1",
      thread: null,
      subjectRef: { kind: "container", id: "container-1" },
      workRef: { kind: "node_task", id: "task-ocean" },
      visibility: "task_scope",
      visibilityLabel: "当前任务参与者",
      messages: [],
      asOf: "2026-10-30T00:00:00.000Z",
      pageSize: 25,
      nextCursor: null,
      canPost: false,
      postDisabledReason: "当前任务协作只读。",
      mentionOptions: [],
      evidenceOptions: [],
    });
    saveReview.mockResolvedValue({
      recordState: "recorded",
      review: {
        id: "review-1",
        decision: "review_required",
        reason: "等待清关最晚行动时间",
        version: 1,
        sourceObservationId: "lifecycle:eta-1",
        reviewedAt: "2026-10-26T08:00:00.000Z",
        writeBackTarget: "none",
      },
      arrivalPreparation: {
        id: "arrival-result-1",
        result: "pending_evidence",
        reason: "等待清关最晚行动时间",
        sourceObservationId: "lifecycle:eta-1",
        sourceVersion: "post-departure-20260923-v1",
        purpose: "customs_arrival_preparation",
        currentResponsibility: "海运运营",
        nextStep: "等待清关接收入口接通",
        version: 1,
        recordedAt: "2026-10-26T08:00:00.000Z",
      },
    });
  });

  it("labels date and attachment selections as temporary rather than saved business results", async () => {
    const wrapper = await mountWorkbench();
    expect(wrapper.get(".date-form").text()).toContain("未保存");
    expect(wrapper.get(".date-form").text()).toContain("刷新丢失");
    await wrapper.get('[data-tab="information"]').trigger("click");
    const customs = wrapper.get('[aria-label="清关资料与发送"]');
    expect(customs.text()).toContain("未上传");
    const input = customs.get('input[aria-label="提单附件"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["test"], "draft.txt")],
      configurable: true,
    });
    await input.trigger("change");
    expect(customs.text()).toContain("本地已选 · 未核验");
    expect(customs.text()).not.toContain("1 / 9 已满足");
  });

  it("shows standard carrier names while keeping legacy type and port values explicit", async () => {
    getProjection.mockResolvedValueOnce({
      ...projectionFor("container-1", "MEDU7620177"),
      container: { ...projection.container, typeCode: "40HQ" },
      standards: {
        carrier: {
          rawCode: "MSC",
          canonicalCode: "MSC",
          name: "地中海航运",
          status: "recognized",
          version: "1.1.0",
        },
        containerType: {
          rawCode: "40HQ",
          canonicalCode: null,
          name: null,
          status: "pending_review",
          version: "1.1.0",
        },
        origin: {
          rawCode: "CNFOC",
          canonicalCode: null,
          name: null,
          status: "unrecognized",
          version: null,
        },
        destination: {
          rawCode: "USSAV",
          canonicalCode: "USSAV",
          name: "萨凡纳",
          status: "recognized",
          version: null,
        },
      },
    });
    const wrapper = await mountWorkbench();
    expect(wrapper.get(".transport-vessel").text()).toContain("地中海航运");
    expect(wrapper.get(".transport-overview").text()).toContain("40HQ");
    expect(wrapper.get(".transport-overview").text()).toContain("映射待核");
    expect(wrapper.get(".route-port--origin").text()).toContain("CNFOC");
    expect(wrapper.get(".route-port--origin").text()).toContain("来源码");
    expect(wrapper.findAll("[data-tab]").map((tab) => tab.text())).toEqual([
      "运输进展",
      "风险",
      "信息缺失或冲突",
      "下游信息与协同",
      "财务",
    ]);
    expect(wrapper.text()).not.toContain("到港时间变化");
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("shows concern tabs with recording on the same view", async () => {
    const wrapper = await mountWorkbench();
    expect(wrapper.findAll("[data-tab]")).toHaveLength(5);
    expect(wrapper.find('[data-focus="progress"]').exists()).toBe(false);
    expect(wrapper.find('[data-side="record"]').exists()).toBe(false);
    expect(wrapper.get(".queue-kicker").text()).not.toContain("待判断");
    expect(wrapper.get(".focus-context").text()).toContain("运输进展");
    expect(wrapper.get(".focus-context").text()).toContain("最晚提柜");
    expect(wrapper.find("textarea").exists()).toBe(false);
    await wrapper.get('[data-tab="coordination"]').trigger("click");
    expect(wrapper.get(".focus-context").text()).toContain("下游信息与协同");
    expect(wrapper.text()).not.toContain("来源观察处理");
    expect(wrapper.text()).not.toContain("记录到港准备判断");
    await wrapper.get('[data-tab="information"]').trigger("click");
    const customs = wrapper.get('[aria-label="清关资料与发送"]');
    expect(customs.text()).toContain("清关资料与附件");
    expect(customs.text()).toContain("未满足");
    expect(customs.text()).toContain("提单");
    expect(customs.text()).toContain("发给清关行");
    expect(customs.text()).toContain("未核验");
    expect(customs.text()).not.toContain("选择文件");
    expect(customs.text()).not.toContain("附件保存未接通");
    expect(
      customs.get('input[aria-label="提单附件"]').attributes("multiple"),
    ).toBeDefined();
    expect(customs.text().indexOf("发给清关行")).toBeLessThan(
      customs.text().indexOf("提单"),
    );
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("presents arrival preparation in business order with evidence and impact", async () => {
    const wrapper = await mountWorkbench();
    expect(wrapper.get("h1").text()).toBe("海运运营");
    expect(wrapper.text()).not.toContain("海运关注");
    expect(wrapper.findAll("[data-tab]")).toHaveLength(5);
    expect(wrapper.text()).toContain("MSC MAKALU III");
    expect(wrapper.text()).toContain("HD638A");
    expect(wrapper.text()).toContain("福州");
    expect(wrapper.text()).toContain("萨凡纳");
    expect(wrapper.text()).toContain("26DSA01885");
    expect(wrapper.text()).toContain("1811F026PE36668R2");
    expect(wrapper.text()).toContain("2026/11/1");
    expect(wrapper.text()).not.toContain("来源依据与已有记录");
    expect(wrapper.text()).not.toContain("财务影响");
    await wrapper.get('[data-tab="fees"]').trigger("click");
    expect(wrapper.text()).toContain("USD 3,925");
    expect(wrapper.text()).toContain("待核");
    expect(wrapper.text()).toContain("滞港费");
    expect(wrapper.text()).toContain("免费期与费率未接入");
    expect(wrapper.text()).not.toContain("记录到港准备判断");
    expect(wrapper.get('[data-mobile-target="context"]').text()).toBe("办理");

    const overview = wrapper.get(".transport-overview").element;
    const rail = wrapper.get('[aria-label="运输环节"]').element;
    expect(
      overview.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("pairs estimated and actual dates without presenting demo departure as production ATD", async () => {
    const wrapper = await mountWorkbench();
    const overview = wrapper.get(".transport-overview");
    expect(overview.get('[aria-label="出运时间"]').text()).toContain("ETD");
    expect(overview.get('[aria-label="出运时间"]').text()).toContain(
      "ATD 待回流",
    );
    expect(overview.get('[aria-label="到港时间"]').text()).toContain(
      "ETA 2026/11/1",
    );
    expect(overview.get('[aria-label="到港时间"]').text()).toContain(
      "ATA 待回流",
    );
    expect(overview.get(".route-status").text()).toBe("货物状态：在途");
    expect(overview.get(".transport-identity").text()).toContain("MEDU7620177");
    expect(overview.get(".transport-identity").text()).toContain("26DSA01885");
    expect(overview.get(".transport-vessel").text()).toContain(
      "MSC MAKALU III / HD638A",
    );
    expect(overview.find(".demo-departure").exists()).toBe(false);
    expect(overview.find(".departure-source").exists()).toBe(false);
  });

  it("groups the HBL after the replenishment order without repeating it in source notes", async () => {
    const wrapper = await mountWorkbench();
    const overview = wrapper.get(".transport-overview");
    expect(
      overview
        .get(".transport-identity")
        .findAll("strong")
        .map((field) => field.text()),
    ).toEqual(["MEDU7620177", "26DSA01885", "1811F026PE36668R2"]);
    expect(overview.get(".transport-identity").text()).toContain(
      "提单号（HBL）",
    );
    expect(overview.text().match(/1811F026PE36668R2/g)).toHaveLength(1);
  });

  it("keeps the HBL identity slot marked pending when the reference is missing", async () => {
    getProjection.mockResolvedValueOnce({
      ...projectionFor("container-1", "MEDU7620177"),
      references: { ...projection.references, houseBillNumber: null },
    });
    const wrapper = await mountWorkbench();
    const fields = wrapper.get(".transport-identity").findAll("strong");
    expect(fields.map((field) => field.text())).toEqual([
      "MEDU7620177",
      "26DSA01885",
      "待补",
    ]);
  });

  it("uses actual departure only when present and never guesses an unknown cargo state", async () => {
    const actual = projectionFor("container-1", "MEDU7620177");
    actual.container.status = "future_state";
    getProjection.mockResolvedValueOnce({
      ...actual,
      shipment: {
        ...actual.shipment,
        actualDepartureAt: "2026-10-01T08:00:00.000Z",
        actualDepartureSource: {
          classification: "development_demo.synthetic_scenario",
          sourceVersion: "ocean-reference-case-v1",
          sourcePrecision: "date-time",
        },
      },
    });
    const wrapper = await mountWorkbench();
    const actualDate = wrapper.get('.departure-dates time[data-kind="actual"]');
    expect(actualDate.attributes("datetime")).toBe("2026-10-01T08:00:00.000Z");
    expect(wrapper.get(".transport-overview").text()).not.toContain("合成演示");
    expect(wrapper.get(".transport-overview").text()).not.toContain(
      "不代表生产事实",
    );
    expect(wrapper.get(".route-status").text()).toContain("未知");
    expect(wrapper.get(".route-status").text()).not.toContain("已离港");
  });

  it("keeps facts in the detail pane and judgment, receipt, and recovery in a stable context pane", async () => {
    const wrapper = await mountWorkbench();
    const paneOrder = () =>
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane"));
    expect(paneOrder()).toEqual(["queue", "detail", "context"]);
    expect(wrapper.getComponent(WorkbenchLayout).props("responsiveMode")).toBe(
      "standard",
    );
    const detail = wrapper.get('[data-workbench-pane="detail"]');
    const context = wrapper.get('[data-workbench-pane="context"]');
    expect(detail.text()).not.toContain("最晚提柜");
    expect(context.text()).toContain("最晚提柜");
    expect(detail.find("textarea").exists()).toBe(false);
    expect(context.find("textarea").exists()).toBe(false);
    expect(context.text()).not.toContain("来源观察处理");
    expect(paneOrder()).toEqual(["queue", "detail", "context"]);
    expect(
      wrapper.get('[data-workbench-pane="queue"]').findAll(".queue-item"),
    ).toHaveLength(1);
  });

  it("restores collapsed rails and mobile detail without losing the draft or queue access", async () => {
    const wrapper = await mountWorkbench();
    await wrapper.get('[aria-label="折叠运输待办"]').trigger("click");
    await wrapper.get('[aria-label="折叠到港准备办理"]').trigger("click");
    expect(wrapper.getComponent(WorkbenchLayout).props("leftCollapsed")).toBe(
      true,
    );
    expect(wrapper.getComponent(WorkbenchLayout).props("rightCollapsed")).toBe(
      true,
    );
    await wrapper.get('[aria-label="展开运输待办"]').trigger("click");
    await wrapper.get('[aria-label="展开到港准备办理"]').trigger("click");
    expect(wrapper.getComponent(WorkbenchLayout).props("rightCollapsed")).toBe(
      false,
    );
    await wrapper.get('[data-mobile-target="context"]').trigger("click");
    expect(
      wrapper
        .get('[data-workbench-pane="context"]')
        .attributes("data-mobile-active"),
    ).toBe("true");
    await wrapper.get('[data-mobile-target="detail"]').trigger("click");
    expect(
      wrapper
        .get('[data-workbench-pane="detail"]')
        .attributes("data-mobile-active"),
    ).toBe("true");
    await wrapper.get('[data-mobile-target="queue"]').trigger("click");
    expect(
      wrapper.get('[data-workbench-pane="queue"]').find(".queue-item").exists(),
    ).toBe(true);
  });

  it("opens the selected detail screen even when its projection fails so retry stays reachable", async () => {
    getProjection.mockRejectedValueOnce(new Error("运输详情 API 500"));
    const wrapper = await mountWorkbench();
    getProjection.mockRejectedValueOnce(new Error("运输详情 API 500"));
    await wrapper.get(".queue-item").trigger("click");
    await flushPromises();
    const detail = wrapper.get('[data-workbench-pane="detail"]');
    expect(detail.attributes("data-mobile-active")).toBe("true");
    expect(detail.text()).toContain("运输详情 API 500");
    await detail.get("button.reread").trigger("click");
    await flushPromises();
    expect(detail.text()).toContain("MSC MAKALU III");
    await wrapper.get('[data-mobile-target="queue"]').trigger("click");
    expect(wrapper.find(".queue-item").exists()).toBe(true);
  });

  it("shows object reload errors and retry in detail even when a previous projection remains", async () => {
    const wrapper = await mountWorkbench();
    getProjection.mockRejectedValueOnce(new Error("连接已断开"));
    await wrapper.get(".queue-item").trigger("click");
    await flushPromises();
    const detail = wrapper.get('[data-workbench-pane="detail"]');
    expect(detail.text()).toContain("连接已断开");
    await detail.get("button.reread").trigger("click");
    await flushPromises();
    expect(detail.text()).not.toContain("连接已断开");
    expect(detail.text()).toContain("MSC MAKALU III");
  });

  it("does not paint the old arrival record onto the customs document tab", async () => {
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="information"]').trigger("click");
    expect(wrapper.text()).not.toContain("记录到港准备判断");
    expect(wrapper.text()).not.toContain("审批后方可准备");
    expect(wrapper.get('[aria-label="清关资料与发送"]').text()).toContain(
      "未核验",
    );
    await wrapper.get("button.refresh-current").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="到港时间"]').text()).toContain(
      "ATA 待回流",
    );
  });

  it("shows failure and retry without also showing the successful empty state", async () => {
    listQueue.mockRejectedValueOnce(new Error("API 500"));
    const wrapper = await mountWorkbench();
    expect(wrapper.get("[role=alert]").text()).toContain("API 500");
    expect(wrapper.text()).not.toContain("暂无运输待办");
    expect(wrapper.get("button.retry-queue").text()).toContain("重试");
  });

  it("ignores a late projection response after the operator switches objects", async () => {
    const a = deferred<ReturnType<typeof projectionFor>>();
    const b = deferred<ReturnType<typeof projectionFor>>();
    listQueue.mockResolvedValue([
      { containerId: "container-a", containerNumber: "A", observationCount: 1 },
      { containerId: "container-b", containerNumber: "B", observationCount: 1 },
    ]);
    getProjection.mockImplementation((id: string) =>
      id === "container-a" ? a.promise : b.promise,
    );
    const wrapper = await mountWorkbench();
    void wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();
    b.resolve(projectionFor("container-b", "B"));
    await flushPromises();
    a.resolve(projectionFor("container-a", "A"));
    await flushPromises();
    expect(wrapper.get(".transport-overview h2").text()).toContain("B");
  });

  it("keeps the selected object when another container is opened", async () => {
    listQueue.mockResolvedValue([
      { containerId: "container-1", containerNumber: "A", observationCount: 1 },
      { containerId: "container-2", containerNumber: "B", observationCount: 1 },
    ]);
    getProjection.mockImplementation((id: string) =>
      Promise.resolve(projectionFor(id, id === "container-1" ? "A" : "B")),
    );
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="information"]').trigger("click");
    await wrapper.findAll(".queue-item")[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.get(".transport-overview h2").text()).toContain("B");
    expect(wrapper.get('[aria-label="清关资料与发送"]').text()).toContain(
      "未核验",
    );
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("shows the shared AI assistance surface beside collaboration", async () => {
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="coordination"]').trigger("click");
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    const ai = wrapper.get("[data-task-ai-assistance-panel]");
    expect(ai.text()).toContain("AI 辅助");
    expect(ai.text()).toContain("领取建议");
    expect(wrapper.text()).toContain("MEDU7620177");
  });

  it("shows voyage facts and unconnected risk signals without a score", async () => {
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="route_risk"]').trigger("click");
    const risk = wrapper.get('[aria-label="风险"]');
    expect(risk.text()).not.toContain("MSC MAKALU III");
    expect(risk.text()).not.toContain("福州");
    expect(risk.text()).toContain("中转");
    expect(risk.text()).toContain("甩柜或改港");
    expect(risk.text()).toContain("长时间无更新");
    expect(risk.text()).toContain("承运安排变化");
    expect(risk.text()).toContain("未接入");
    expect(risk.text()).toContain("新鲜度未定");
    expect(risk.text()).not.toContain("无风险");
    expect(risk.text()).not.toContain("风险分");
  });

  it("uses the shared task conversation for downstream coordination", async () => {
    listTasks.mockResolvedValue({
      items: [
        {
          id: "task-ocean",
          nodeCode: "ocean_transit",
          containerId: "container-1",
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-10-30T00:00:00.000Z",
      projectionVersion: 1,
    });
    listCollaboration.mockResolvedValue({
      contractVersion: "task-collaboration-page.v1",
      thread: null,
      subjectRef: { kind: "container", id: "container-1" },
      workRef: { kind: "node_task", id: "task-ocean" },
      visibility: "task_scope",
      visibilityLabel: "当前任务参与者",
      messages: [
        {
          contractVersion: "task-collaboration-message.v1",
          messageId: "11111111-1111-4111-8111-111111111111",
          threadId: "22222222-2222-4222-8222-222222222222",
          author: {
            kind: "actor",
            id: "actor-1",
            displayName: "海运值班",
          },
          body: "清关可以按 11/1 窗口开始准备",
          parentMessageId: null,
          mentions: [],
          evidenceRefs: [],
          sourceRefs: [],
          occurredAt: "2026-10-30T01:00:00.000Z",
          recordedAt: "2026-10-30T01:00:01.000Z",
        },
      ],
      asOf: "2026-10-30T01:00:00.000Z",
      pageSize: 25,
      nextCursor: null,
      canPost: true,
      postDisabledReason: null,
      mentionOptions: [],
      evidenceOptions: [],
    });
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="coordination"]').trigger("click");
    await flushPromises();
    const thread = wrapper.get('[aria-label="下游信息与协同"]');
    expect(thread.get("[data-task-collaboration-panel]").text()).toContain(
      "清关可以按 11/1 窗口开始准备",
    );
    expect(thread.get('textarea[aria-label="协作消息"]').exists()).toBe(true);
    expect(listTasks).toHaveBeenCalledWith({
      containerId: "container-1",
      pageSize: 50,
    });
    expect(listCollaboration).toHaveBeenCalledWith(
      "task-ocean",
      expect.objectContaining({
        subjectRef: { kind: "container", id: "container-1" },
      }),
      expect.any(AbortSignal),
    );
  });

  it("keeps downstream conversation disconnected without an ocean task", async () => {
    const wrapper = await mountWorkbench();
    await wrapper.get('[data-tab="coordination"]').trigger("click");
    await flushPromises();
    const thread = wrapper.get('[aria-label="下游信息与协同"]');
    expect(thread.get("[data-task-collaboration-panel]").text()).toContain(
      "还没有协作消息",
    );
    expect(thread.get('textarea[aria-label="协作消息"]').exists()).toBe(true);
    expect(thread.text()).not.toContain("协同对话未接通");
    expect(listCollaboration).not.toHaveBeenCalled();
  });

  it("does not reuse the arrival judgment form on the concern tabs", async () => {
    const wrapper = await mountWorkbench();
    for (const tab of ["route_risk", "information", "coordination", "fees"]) {
      await wrapper.get(`[data-tab="${tab}"]`).trigger("click");
      expect(wrapper.text()).not.toContain("来源观察处理");
      expect(wrapper.text()).not.toContain("记录到港准备判断");
    }
    await wrapper.get('[data-tab="information"]').trigger("click");
    expect(wrapper.get('[aria-label="清关资料与发送"]').text()).toContain(
      "未满足",
    );
  });
});
