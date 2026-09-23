import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CargoReadyWorkbench from "./CargoReadyWorkbench.vue";

const listReplenishmentOrders = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const listExternalWorkItems = vi.fn();
const getCargoReadyCompliance = vi.fn();

vi.mock("../api/replenishmentOrders", () => ({
  listReplenishmentOrders: (...args: unknown[]) =>
    listReplenishmentOrders(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listLifecycleNodes(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  DEV_OPERATOR_ID: "dev-operator",
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
  claimWorkOrder: vi.fn(),
  completeWorkOrder: vi.fn(),
}));
vi.mock("../api/workItems", () => ({
  listExternalWorkItems: (...args: unknown[]) => listExternalWorkItems(...args),
}));
vi.mock("../api/cargoReadyCompliance", () => ({
  getCargoReadyCompliance: (...args: unknown[]) =>
    getCargoReadyCompliance(...args),
}));

describe("CargoReadyWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listReplenishmentOrders,
      listLifecycleNodes,
      listNodeTasks,
      listExternalWorkItems,
      getCargoReadyCompliance,
    ]) {
      mock.mockReset();
    }
    listReplenishmentOrders.mockResolvedValue({ items: [order(true)] });
    listLifecycleNodes.mockResolvedValue({ flow: null, nodes: [] });
    listNodeTasks.mockResolvedValue({ items: [] });
    listExternalWorkItems.mockResolvedValue({ items: [] });
    getCargoReadyCompliance.mockResolvedValue(assessment());
  });

  it("starts from the replenishment order and shows only real SKU facts and gaps", async () => {
    const wrapper = await mountPage("?orderId=order-1");

    expect(wrapper.text()).toContain("26DSC01812");
    expect(wrapper.text()).toContain("SKU 311-023V01CW");
    expect(wrapper.text()).toContain("含电池 · 随设备包装");
    expect(wrapper.text()).toContain("非危险品");
    expect(wrapper.text()).toContain("不含制冷剂");
    expect(wrapper.text()).toContain("运输条件鉴定缺失或无效");
    expect(wrapper.get('[aria-label="备货单工作列表"]').text()).toContain(
      "补合规资料",
    );
    expect(wrapper.text()).not.toContain("电池未评审");
    expect(wrapper.text()).not.toContain("SKU 齐备度");
    expect(
      wrapper.find('[data-testid="workbench-container-select"]').exists(),
    ).toBe(false);
  });

  it("keeps an order usable before any container exists", async () => {
    listReplenishmentOrders.mockResolvedValue({ items: [order(false)] });
    const wrapper = await mountPage("?orderId=order-1");

    await wrapper.get(".ready-toggle").trigger("click");
    expect(wrapper.text()).toContain("SKU 311-023V01CW");
    expect(wrapper.text()).toContain("尚未分配");
    expect(wrapper.text()).toContain("安排装柜");
    expect(listLifecycleNodes).not.toHaveBeenCalled();
    expect(listNodeTasks).not.toHaveBeenCalled();
    expect(getCargoReadyCompliance).not.toHaveBeenCalled();
  });

  it("retains order facts and reports an auxiliary projection failure", async () => {
    listExternalWorkItems.mockRejectedValue(new Error("network"));
    const wrapper = await mountPage("?orderId=order-1");

    expect(wrapper.text()).toContain("SKU 311-023V01CW");
    expect(wrapper.text()).toContain("合规整改项暂时没能加载");
  });
});

async function mountPage(query: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/workspaces/cargo-ready", component: CargoReadyWorkbench },
      { path: "/import", component: { template: "<div />" } },
      { path: "/compliance", component: { template: "<div />" } },
    ],
  });
  await router.push(`/workspaces/cargo-ready${query}`);
  await router.isReady();
  const wrapper = mount(CargoReadyWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title"],
          template:
            "<header><h1>{{ title }}</h1><slot name='actions' /></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function order(withContainer: boolean) {
  return {
    id: "order-1",
    orderNumber: "26DSC01812",
    updatedAt: "2026-09-21T00:00:00.000Z",
    workReason: {
      code: withContainer ? "waiting_other" : "allocate_cargo",
      label: withContainer ? "补合规资料" : "分配装柜",
      detail: withContainer
        ? "1 个 SKU 缺少适用资料"
        : "1 个明细仍有未分配数量",
      responsibility: "mine",
    },
    nextAction: withContainer
      ? null
      : { code: "shipment.allocate_cargo", label: "安排装柜" },
    relatedContainers: withContainer
      ? [{ id: "container-1", containerNumber: "HMMU4956442" }]
      : [],
    lines: [
      {
        id: "line-1",
        productSkuId: "sku-1",
        productNumber: "311-023V01CW",
        shippedQuantity: "30",
        quantityUnit: "piece",
        allocatedQuantity: withContainer ? "30" : "0",
        unallocatedQuantity: withContainer ? "0" : "30",
        allocations: withContainer
          ? [
              {
                containerId: "container-1",
                containerNumber: "HMMU4956442",
                allocatedQuantity: "30",
                quantityUnit: "piece",
              },
            ]
          : [],
        profile: {
          profileId: "profile-1",
          version: 1,
          verificationState: "verified",
          sourceSystem: "verified-master-data",
          createdAt: "2026-09-20T00:00:00.000Z",
          battery: {
            presenceState: "present",
            packingMode: "packed_with_equipment",
          },
          refrigerant: { presenceState: "absent" },
          dangerousGoods: { classificationState: "not_regulated" },
          inspectionRequirements: [],
        },
        gaps: [],
      },
    ],
  };
}

function assessment() {
  return {
    assessmentId: "assessment-1",
    containerRecordId: "container-1",
    version: 3,
    state: "action_required",
    jurisdictionCountryCode: "ES",
    assessmentDate: "2026-09-21",
    allocationSetId: "allocation-1",
    allocationSetVersion: 2,
    items: [
      {
        replenishmentOrderLineId: "line-1",
        productSkuId: "sku-1",
        productNumber: "311-023V01CW",
        complianceProfileId: "profile-1",
        complianceProfileVersion: 1,
      },
    ],
    findings: [
      {
        code: "REQUIRED_CERTIFICATE_MISSING_OR_INVALID",
        productSkuId: "sku-1",
        ruleVersionId: "rule-1",
        detail: "certificate missing",
      },
    ],
    applicableRules: [
      {
        ruleVersionId: "rule-1",
        ruleCode: "EU-BATTERY",
        version: 1,
        productSkuId: "sku-1",
        requirementLayer: "destination_country",
        requiredCertificateTypes: ["transport_safety_assessment"],
        blockingNodeCodes: ["cargo_ready"],
        severity: "blocking",
        officialSourceUrl: "https://example.invalid",
        legalCitation: "EU rule",
      },
    ],
    evidenceRefs: [],
    actorId: "reviewer",
    reasonCode: "initial",
    currentDecision: null,
    createdAt: "2026-09-21T00:00:00.000Z",
  };
}
