import { expect, test } from "@playwright/test";

/**
 * 事项交接走完整环：出运运营把票级事项交给专业岗位 → 岗位上的人领取 → 办完写结论了结。
 *
 * 断言的是**业务结果**（这一票有没有人接、交办的人看没看到结论），不是接口被调过没有。
 */
test("shipment operator hands a ticket to a professional queue, and the queue works it", async ({
  page,
}) => {
  const handoffs: Record<string, unknown>[] = [];

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/shipments/risk-queue") {
      await route.fulfill({ json: riskQueue() });
      return;
    }
    if (path === "/api/work-handoffs/by-shipment/shipment-1") {
      await route.fulfill({ json: handoffs });
      return;
    }
    if (path === "/api/work-handoffs" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      handoffs.push(workHandoff({ title: String(body.title) }));
      await route.fulfill({ json: handoffs[0] });
      return;
    }
    if (path === "/api/work-handoffs/queue") {
      const recipient = url.searchParams.get("recipient");
      await route.fulfill({
        json: {
          contractVersion: "shipment-work-handoff-queue.v1",
          recipientQueueCode: recipient,
          items: recipient === "customs" ? handoffs : [],
          pageSize: 50,
          nextCursor: null,
        },
      });
      return;
    }
    if (
      path === "/api/work-handoffs/handoff-1/claims" &&
      request.method() === "POST"
    ) {
      handoffs[0] = workHandoff({
        title: "缺随车单，请补",
        state: "claimed",
        version: 2,
        claimedByActorId: "dev-operator",
        claimedAt: "2026-09-28T11:00:00.000Z",
      });
      await route.fulfill({ json: handoffs[0] });
      return;
    }
    if (
      path === "/api/work-handoffs/handoff-1/closures" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      handoffs[0] = workHandoff({
        title: "缺随车单，请补",
        state: "closed",
        version: 3,
        claimedByActorId: "dev-operator",
        claimedAt: "2026-09-28T11:00:00.000Z",
        closedByActorId: "dev-operator",
        closedAt: "2026-09-28T12:00:00.000Z",
        conclusion: String(body.conclusion),
      });
      await route.fulfill({ json: handoffs[0] });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  // 出运工作台的在途视图：队列按「该谁动」分组，"临期"只做标签。
  await page.goto("/workspaces/dispatch?view=risk");

  await expect(page.getByRole("heading", { name: "待我处理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "等待他人" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "先处理异常" })).toBeVisible();
  await expect(page.getByText(/已逾期|还有 /).first()).toBeVisible();

  // 交给专业岗位 —— 只到岗位不到人。
  await page.getByLabel("要他们做什么").fill("缺随车单，请补");
  await page.getByRole("button", { name: "交给该岗位" }).click();
  await expect(page.getByText(/已交给清关岗位/)).toBeVisible();
  await expect(page.getByText("还没人接")).toBeVisible();

  // 岗位待办那一侧：领取、写结论、了结。
  await page.goto("/workspaces/work-inbox");

  await expect(page.getByRole("heading", { name: "等我领取" })).toBeVisible();
  await page.getByRole("button", { name: "领取这件" }).click();
  await expect(page.getByText(/已领取/)).toBeVisible();

  await expect(page.getByRole("heading", { name: "我在办" })).toBeVisible();
  await page.getByLabel("缺随车单，请补 的结论").fill("已补齐随车单并复核");
  await page.getByRole("button", { name: "了结" }).click();

  await expect(page.getByText(/已了结/)).toBeVisible();
});

function riskQueue() {
  return {
    contractVersion: "shipment-risk-queue.v1",
    items: [
      {
        shipment: shipment(),
        risk: {
          nearestDeadline: {
            kind: "eta",
            at: "2026-09-27T08:00:00.000Z",
          },
          overdue: true,
          reasons: ["overdue_deadline", "pending_gaps"],
          openExceptionCount: 0,
          unassignedExceptionCount: 0,
        },
        pendingItems: [
          {
            code: "carrier_missing",
            label: "补充船公司",
            subjectType: "shipment",
            subjectRef: "shipment-1",
            currentValue: null,
            sourceSystem: "logix",
            sourceValue: null,
            candidateValues: [],
            responsibility: {
              roleCode: "operations_dispatcher",
              roleLabel: "出运运营",
            },
            deadline: {
              dueAt: null,
              source: "not_configured",
              label: "未设定",
            },
            restrictedActions: [],
            directAction: { code: "edit_shipment_facts", label: "补录船公司" },
          },
        ],
      },
    ],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
    asOf: "2026-09-28T12:00:00.000Z",
    projectionVersion: 1,
    sort: "nearest_deadline",
  };
}

function shipment() {
  return {
    id: "shipment-1",
    shipmentNumber: "SHIP-1",
    transportMode: "ocean",
    carrierCode: "HMM",
    vesselName: "ONE TRUTH",
    voyageNumber: "V001",
    originCountryCode: "CN",
    originUnlocode: "CNNGB",
    destinationCountryCode: "US",
    destinationUnlocode: "USLAX",
    salesCountryCode: null,
    cargoOwnerReferenceId: null,
    cargoOwnerName: null,
    atdAt: null,
    etaAt: null,
    currentLifecycleStatus: "in_transit",
    lifecycleVersion: 1,
    relationshipVersion: 1,
    activeContainerCount: 1,
    activeCargoLineCount: 1,
    lifecycleInitializationState: "ready",
    updatedAt: "2026-09-28T10:00:00.000Z",
  };
}

function workHandoff(overrides: {
  title: string;
  state?: string;
  version?: number;
  claimedByActorId?: string | null;
  claimedAt?: string | null;
  closedByActorId?: string | null;
  closedAt?: string | null;
  conclusion?: string | null;
}) {
  return {
    contractVersion: "shipment-work-handoff.v1",
    handoffId: "handoff-1",
    shipmentId: "shipment-1",
    containerRecordId: null,
    recipientQueueCode: "customs",
    title: overrides.title,
    detail: null,
    state: overrides.state ?? "raised",
    version: overrides.version ?? 1,
    raisedBy: "dev-operator",
    raisedAt: "2026-09-28T10:00:00.000Z",
    claimedByActorId: overrides.claimedByActorId ?? null,
    claimedAt: overrides.claimedAt ?? null,
    closedByActorId: overrides.closedByActorId ?? null,
    closedAt: overrides.closedAt ?? null,
    conclusion: overrides.conclusion ?? null,
    createdAt: "2026-09-28T10:00:00.000Z",
    updatedAt: "2026-09-28T10:00:00.000Z",
  };
}
