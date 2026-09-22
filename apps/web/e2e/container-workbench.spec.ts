import { expect, test } from "@playwright/test";

test("operator can scan all lifecycle nodes and inspect the selected time tracks", async ({
  page,
}) => {
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: responseFor(url.pathname),
    });
  });

  await page.goto("/container/container-1");

  await expect(page.getByRole("heading", { name: "一柜一档" })).toBeVisible();
  await expect(page.getByLabel("标记与异常")).toContainText("异常2");

  const rail = page.getByLabel("货柜生命周期节点");
  await expect(rail.getByRole("button")).toHaveCount(14);
  await expect(rail.getByRole("button", { name: /清关/ })).toHaveAttribute(
    "aria-current",
    "step",
  );

  const timeCard = page.getByLabel("节点三轨时间");
  await expect(timeCard).toContainText("清关");
  await expect(timeCard).toContainText("2026-09-22");

  await rail.getByRole("button", { name: /还箱/ }).click();
  await expect(timeCard).toContainText("还箱");
  await expect(timeCard).toContainText("2026-10-02");
  await expect(timeCard.getByTestId("time-track").last()).toContainText("—");

  const railWidths = await rail.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(railWidths.scroll).toBeGreaterThan(railWidths.client);

  const pageWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client + 1);
});

function responseFor(pathname: string): unknown {
  if (pathname === "/api/containers/container-1") return container;
  if (pathname === "/api/containers/container-1/lifecycle-nodes") {
    return lifecycleNodes;
  }
  if (pathname === "/api/containers/container-1/lifecycle-events") {
    return emptyPage;
  }
  if (pathname === "/api/containers/container-1/activities") {
    return { ...emptyPage, nextActions: [] };
  }
  if (pathname === "/api/node-tasks") return emptyPage;
  if (pathname === "/api/client-operations") return emptyPage;
  throw new Error(`Unhandled API path in container workbench E2E: ${pathname}`);
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "in_transit",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

const nodeCodes = [
  "cargo_ready",
  "container_stuffing",
  "shipment_dispatch",
  "origin_departure",
  "ocean_transit",
  "transshipment",
  "customs_clearance",
  "destination_arrival",
  "rail_transfer",
  "container_pickup",
  "warehouse_delivery",
  "container_unloading",
  "container_unstuffing",
  "empty_return",
] as const;

const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "customs_clearance",
    version: 3,
  },
  nodes: nodeCodes.map((nodeCode, index) => {
    const sequence = index + 1;
    const isCurrent = nodeCode === "customs_clearance";
    const isNotApplicable =
      nodeCode === "transshipment" || nodeCode === "rail_transfer";
    return {
      nodeInstanceId: `node-${sequence}`,
      nodeCode,
      sequence,
      state: isNotApplicable
        ? "pending"
        : sequence < 7
          ? "completed"
          : isCurrent
            ? "active"
            : "pending",
      applicability: isNotApplicable ? "optional_not_applicable" : "required",
      completedAt:
        sequence < 7 && !isNotApplicable
          ? `2026-09-${String(14 + sequence).padStart(2, "0")}T00:00:00.000Z`
          : null,
      blockedReasonRefs: isCurrent ? ["missing-release", "document-hold"] : [],
      isCurrent,
      times: isCurrent
        ? {
            plannedAt: "2026-09-21T16:00:00.000Z",
            estimatedAt: "2026-09-21T18:00:00.000Z",
            actualAt: null,
          }
        : nodeCode === "empty_return"
          ? {
              plannedAt: "2026-10-01T16:00:00.000Z",
              estimatedAt: null,
              actualAt: null,
            }
          : { plannedAt: null, estimatedAt: null, actualAt: null },
    };
  }),
  asOf: "2026-09-22T00:00:00.000Z",
  projectionVersion: 3,
};

const emptyPage = {
  items: [],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
  asOf: "2026-09-22T00:00:00.000Z",
  projectionVersion: 1,
};
