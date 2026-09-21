import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { LifecycleDateFactReviewsController } from "./lifecycle-date-fact-reviews.controller";

describe("LifecycleDateFactReviewsController", () => {
  it("列表和批准都要求证据复核能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleDateFactReviewsController.prototype.list,
      ),
    ).toEqual(["evidence.review"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        LifecycleDateFactReviewsController.prototype.approve,
      ),
    ).toEqual(["evidence.review"]);
  });

  it("批准只采用服务端身份和请求事实主键", async () => {
    const approve = {
      execute: vi.fn().mockResolvedValue({
        factId: "new-fact",
        recordState: "recorded",
        applicationState: "pending_application",
        reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
        canonicalEventId: null,
        projectionVersion: 3,
      }),
    };
    const controller = new LifecycleDateFactReviewsController(
      { execute: vi.fn() } as never,
      approve as never,
    );

    await controller.approve(
      "fact-1",
      {
        reasonCode: "date_fact_review_approved",
        expectedVersion: 2,
        idempotencyKey: "review-1",
      },
      "trace-1",
      {
        identity: {
          tenantId: "tenant-1",
          actorId: "reviewer-1",
          capabilities: ["evidence.review"],
        },
      },
    );

    expect(approve.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      reviewerId: "reviewer-1",
      actorCapabilities: ["evidence.review"],
      factId: "fact-1",
      reasonCode: "date_fact_review_approved",
      expectedVersion: 2,
      idempotencyKey: "review-1",
      traceId: "trace-1",
    });
  });
});
