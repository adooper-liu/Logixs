import { expect, test, type Page } from "@playwright/test";

test("cargo-ready operator moves from an order reason to the real SKU gap and allowed action", async ({
  page,
}) => {
  await routeWorkbench(page, [orderWithEvidenceGap]);
  await page.goto("/workspaces/cargo-ready?orderId=order-1");

  await expect(page.getByRole("heading", { name: "备货工作台" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /补合规资料.*26DSC01812/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "26DSC01812" })).toBeVisible();
  await expect(page.getByText("SKU 311-023V01CW")).toBeVisible();
  await expect(page.getByText("含电池 · 随设备包装")).toBeVisible();
  await expect(
    page.getByText("运输条件鉴定缺失或无效", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("电池未评审")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "领取", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("workbench-container-select")).toHaveCount(0);
});

test("an unallocated replenishment order remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await routeWorkbench(page, [orderWithoutContainer]);
  await page.goto("/workspaces/cargo-ready?orderId=order-2");

  await expect(page.getByText("尚未分配", { exact: true })).toBeVisible();
  await expect(page.getByText("安排装柜", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /已齐备 1 个 SKU/ }).click();
  await expect(page.getByText("SKU 311-013GY")).toBeVisible();

  const pageWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client + 1);
});

async function routeWorkbench(
  page: Page,
  orders: readonly Record<string, unknown>[],
): Promise<void> {
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const json = responseFor(url.pathname, orders);
    await route.fulfill({ status: 200, contentType: "application/json", json });
  });
}

function responseFor(
  pathname: string,
  orders: readonly Record<string, unknown>[],
): unknown {
  if (pathname === "/api/replenishment-orders") {
    return {
      items: orders,
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
      asOf: "2026-09-21T00:00:00.000Z",
      projectionVersion: 1,
    };
  }
  if (pathname === "/api/node-tasks") return taskPage;
  if (pathname === "/api/work-items") return workItemPage;
  if (pathname === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (pathname === "/api/containers/container-1/compliance/cargo-ready")
    return assessment;
  throw new Error(`Unhandled API path in cargo-ready E2E: ${pathname}`);
}

const profile = {
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
};

const orderWithEvidenceGap = {
  id: "order-1",
  orderNumber: "26DSC01812",
  updatedAt: "2026-09-21T00:00:00.000Z",
  workReason: {
    code: "waiting_other",
    label: "补合规资料",
    detail: "1 个 SKU 缺少适用资料",
    responsibility: "mine",
  },
  nextAction: {
    code: "work_execution.continue_cargo_ready",
    label: "继续备货确认",
  },
  relatedContainers: [{ id: "container-1", containerNumber: "HMMU4956442" }],
  lines: [
    {
      id: "line-1",
      productSkuId: "sku-1",
      productNumber: "311-023V01CW",
      shippedQuantity: "30",
      quantityUnit: "piece",
      allocatedQuantity: "30",
      unallocatedQuantity: "0",
      allocations: [
        {
          containerId: "container-1",
          containerNumber: "HMMU4956442",
          allocatedQuantity: "30",
          quantityUnit: "piece",
        },
      ],
      profile,
      gaps: [],
    },
  ],
};

const orderWithoutContainer = {
  id: "order-2",
  orderNumber: "26DSC01811",
  updatedAt: "2026-09-20T00:00:00.000Z",
  workReason: {
    code: "allocate_cargo",
    label: "分配装柜",
    detail: "1 个明细仍有未分配数量",
    responsibility: "mine",
  },
  nextAction: { code: "shipment.allocate_cargo", label: "安排装柜" },
  relatedContainers: [],
  lines: [
    {
      id: "line-2",
      productSkuId: "sku-2",
      productNumber: "311-013GY",
      shippedQuantity: "20",
      quantityUnit: "piece",
      allocatedQuantity: "0",
      unallocatedQuantity: "20",
      allocations: [],
      profile: {
        ...profile,
        profileId: "profile-2",
        battery: { presenceState: "absent", packingMode: null },
      },
      gaps: [],
    },
  ],
};

const taskPage = {
  items: [
    {
      id: "task-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "cargo_ready",
      containerId: "container-1",
      taskDefinitionKey: "node-cargo_ready",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [],
      outcome: null,
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "work-order-1",
        workOrderDefinitionKey: "wo-cargo_ready",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: "2026-09-22T02:00:00.000Z",
      },
    },
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
};

const workItemPage = {
  items: [
    {
      id: "work-item-1",
      sourceModule: "compliance-management",
      sourceType: "cargo_ready_assessment",
      sourceRecordId: "assessment-1",
      sourceVersion: 1,
      containerId: "container-1",
      taskDefinitionKey: "cargo-ready-remediation",
      title: "补齐运输条件鉴定",
      detail: "提交有效的运输条件鉴定",
      priority: "high",
      state: "open",
      assignedRoleCode: "compliance_operator",
      evidenceRefs: [],
      dueAt: null,
      createdAt: "2026-09-21T00:00:00.000Z",
    },
  ],
};

const lifecycleNodes = { flow: null, nodes: [] };

const assessment = {
  assessmentId: "assessment-1",
  containerRecordId: "container-1",
  version: 1,
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
