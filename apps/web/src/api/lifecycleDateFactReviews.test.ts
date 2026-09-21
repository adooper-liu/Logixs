import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveLifecycleDateFactReview,
  listLifecycleDateFactReviews,
} from "./lifecycleDateFactReviews";

describe("lifecycle date fact review API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the review queue with the review supervisor identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 30 },
          asOf: "2026-09-21T00:00:00Z",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listLifecycleDateFactReviews({ pageSize: 30 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lifecycle-date-fact-reviews?pageSize=30",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Roles": "review_supervisor" }),
      }),
    );
  });

  it("sends only the approved command fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          factId: "new-fact",
          recordState: "recorded",
          applicationState: "applied",
          projectionVersion: 4,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await approveLifecycleDateFactReview("fact-1", {
      reasonCode: "date_fact_review_approved",
      expectedVersion: 3,
      idempotencyKey: "review-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lifecycle-date-fact-reviews/fact-1/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reasonCode: "date_fact_review_approved",
          expectedVersion: 3,
          idempotencyKey: "review-1",
        }),
      }),
    );
  });
});
