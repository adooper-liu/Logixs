import { expect, test } from "@playwright/test";

test("review supervisor approves a verified manual actual date", async ({
  page,
}) => {
  let approved = false;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/lifecycle-date-fact-reviews") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          items: approved ? [] : [reviewItem],
          pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 30 },
          asOf: "2026-09-21T02:02:00Z",
        },
      });
      return;
    }
    if (
      url.pathname === "/api/lifecycle-date-fact-reviews/fact-1/approve" &&
      request.method() === "POST"
    ) {
      expect(request.headers()["x-roles"]).toBe("review_supervisor");
      expect(request.postDataJSON()).toMatchObject({
        reasonCode: "date_fact_review_approved",
        expectedVersion: 3,
      });
      approved = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          factId: "fact-2",
          recordState: "recorded",
          applicationState: "pending_application",
          reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
          canonicalEventId: null,
          projectionVersion: 4,
        },
      });
      return;
    }
    throw new Error(`Unhandled date review API path: ${url.pathname}`);
  });

  await page.goto("/reviews/date-facts");
  await expect(
    page.getByRole("heading", { name: "日期事实复核" }),
  ).toBeVisible();
  await expect(page.getByText("KOCU4960726").first()).toBeVisible();
  await expect(page.getByText("1 / 1 合格")).toBeVisible();
  await page.getByRole("button", { name: "批准并申请推进" }).click();
  await expect(page.getByTestId("review-result")).toContainText("自动重放");
  await expect(page.getByText("当前没有待复核的人工实际日期")).toBeVisible();

  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
});

const reviewItem = {
  factId: "fact-1",
  containerId: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  nodeCode: "shipment_dispatch",
  eventCode: "loaded",
  occurredAt: "2026-09-21T02:00:00Z",
  rawValue: "2026-09-21 10:00",
  sourceUtcOffset: "+08:00",
  captureSource: "manual_backfill",
  sourceSystem: "logix.manual",
  authoritySystem: "ops-team",
  location: null,
  submittedBy: "dev-operator",
  recordedAt: "2026-09-21T02:01:00Z",
  projectionVersion: 3,
  evidence: [
    {
      evidenceId: "evidence-1",
      evidenceType: "document",
      verificationState: "verified",
      validity: "effective",
      qualified: true,
    },
  ],
  blockingReasons: [],
  allowedActions: ["approve"],
};
