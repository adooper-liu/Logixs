import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DateFactReviewWorkbench from "./DateFactReviewWorkbench.vue";

const listReviews = vi.fn();
const approveReview = vi.fn();

vi.mock("../api/lifecycleDateFactReviews", () => ({
  listLifecycleDateFactReviews: (...args: unknown[]) => listReviews(...args),
  approveLifecycleDateFactReview: (...args: unknown[]) =>
    approveReview(...args),
}));

const item = {
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
  submittedBy: "operator-1",
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

describe("DateFactReviewWorkbench", () => {
  beforeEach(() => {
    listReviews.mockReset().mockResolvedValue({
      items: [item],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 30 },
      asOf: "2026-09-21T02:02:00Z",
    });
    approveReview.mockReset().mockResolvedValue({
      factId: "fact-2",
      recordState: "recorded",
      applicationState: "pending_application",
      reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
      canonicalEventId: null,
      projectionVersion: 4,
    });
  });

  it("shows the business context and submits an append-only approval", async () => {
    const wrapper = mount(DateFactReviewWorkbench, {
      global: {
        stubs: {
          PageHeader: {
            props: ["title"],
            template: "<header><h1>{{ title }}</h1></header>",
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("KOCU4960726");
    expect(wrapper.text()).toContain("2026-09-21 10:00（+08:00）");
    expect(wrapper.text()).toContain("1 / 1 合格");

    await wrapper.get('[data-testid="approve-date-fact"]').trigger("click");
    await flushPromises();

    expect(approveReview).toHaveBeenCalledWith(
      "fact-1",
      expect.objectContaining({
        reasonCode: "date_fact_review_approved",
        expectedVersion: 3,
      }),
    );
    expect(wrapper.get('[data-testid="review-result"]').text()).toContain(
      "自动重放",
    );
  });

  it("keeps blocked facts read-only and explains why", async () => {
    listReviews.mockResolvedValue({
      items: [
        {
          ...item,
          evidence: [
            {
              ...item.evidence[0],
              verificationState: "pending",
              qualified: false,
            },
          ],
          blockingReasons: ["EVIDENCE_NOT_QUALIFIED"],
          allowedActions: [],
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 30 },
      asOf: "2026-09-21T02:02:00Z",
    });
    const wrapper = mount(DateFactReviewWorkbench, {
      global: {
        stubs: {
          PageHeader: {
            props: ["title"],
            template: "<header><h1>{{ title }}</h1></header>",
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("证据尚未全部核验为有效");
    expect(
      wrapper.get('[data-testid="approve-date-fact"]').attributes("disabled"),
    ).toBeDefined();
  });
});
