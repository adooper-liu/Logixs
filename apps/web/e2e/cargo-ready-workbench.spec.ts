import { expect, test } from "@playwright/test";

test("cargo-ready operator can move from role queue to SKU readiness and allowed action", async ({
  page,
}) => {
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = responseFor(url.pathname);
    await route.fulfill({ status: 200, contentType: "application/json", json });
  });

  await page.goto("/workspaces/cargo-ready");

  await expect(page.getByRole("heading", { name: "备货工作台" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /完成备货确认/ }),
  ).toBeVisible();
  await expect(page.getByText("专业整改", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /完成备货确认/ }).click();

  await expect(page).toHaveURL(
    /containerId=container-1.*taskId=task-1|taskId=task-1.*containerId=container-1/,
  );
  await expect(page.getByRole("heading", { name: "SKU 齐备度" })).toBeVisible();
  await expect(page.getByText("833-066V00BK", { exact: true })).toBeVisible();
  await expect(page.getByText("缺少有效产品证书")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "领取", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("node-cargo_ready")).toHaveCount(0);

  const pageWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client + 1);
});

function responseFor(pathname: string): unknown {
  if (pathname === "/api/containers") return containerPage;
  if (pathname === "/api/node-tasks") return taskPage;
  if (pathname === "/api/work-items") return workItemPage;
  if (pathname === "/api/containers/container-1/cargo") return cargo;
  if (pathname === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (pathname === "/api/containers/container-1/compliance/cargo-ready")
    return assessment;
  if (pathname === "/api/containers/container-1") return container;
  throw new Error(`Unhandled API path in cargo-ready E2E: ${pathname}`);
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "not_shipped",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

const containerPage = {
  items: [container],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};

const task = {
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
};

const taskPage = {
  items: [task],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};

const remediation = {
  id: "work-item-1",
  sourceModule: "compliance-management",
  sourceType: "cargo_ready_assessment",
  sourceRecordId: "assessment-1",
  sourceVersion: 1,
  containerId: "container-1",
  taskDefinitionKey: "cargo-ready-remediation",
  title: "补齐欧盟证书",
  detail: "提交有效的 CE 证书",
  priority: "high",
  state: "open",
  assignedRoleCode: "compliance_operator",
  evidenceRefs: [],
  dueAt: null,
  createdAt: "2026-09-21T00:00:00.000Z",
};

const workItemPage = {
  items: [remediation],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};

const cargo = {
  containerRecordId: "container-1",
  allocationSetId: "allocation-1",
  allocationSetVersion: 2,
  items: [
    {
      replenishmentOrderLineId: "line-1",
      productSkuId: "sku-1",
      productNumber: "833-066V00BK",
      allocatedQuantity: "50",
      quantityUnit: "carton",
    },
  ],
};

const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "cargo_ready",
    version: 1,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "cargo_ready",
      sequence: 1,
      state: "active",
      applicability: "required",
      completedAt: null,
      isCurrent: true,
    },
  ],
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};

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
      productNumber: "833-066V00BK",
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
      ruleCode: "EU-CERT",
      version: 1,
      productSkuId: "sku-1",
      requirementLayer: "destination_country",
      requiredCertificateTypes: ["ce"],
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
