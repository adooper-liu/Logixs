import type {
  ApproveLifecycleDateFactReviewCommand,
  LifecycleDateFactReviewPage,
  LifecycleDateFactResult,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const REVIEW_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-reviewer",
  "X-Roles": "review_supervisor",
};

export async function listLifecycleDateFactReviews(input?: {
  pageSize?: number;
  cursor?: string;
}): Promise<LifecycleDateFactReviewPage> {
  const query = new URLSearchParams();
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const response = await fetch(
    `/api/lifecycle-date-fact-reviews${query.size ? `?${query}` : ""}`,
    { headers: REVIEW_HEADERS },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载日期事实复核队列失败",
      ),
    );
  }
  return (await response.json()) as LifecycleDateFactReviewPage;
}

export async function approveLifecycleDateFactReview(
  factId: string,
  command: ApproveLifecycleDateFactReviewCommand,
): Promise<LifecycleDateFactResult> {
  const response = await fetch(
    `/api/lifecycle-date-fact-reviews/${encodeURIComponent(factId)}/approve`,
    {
      method: "POST",
      headers: { ...REVIEW_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "日期事实未能批准",
      ),
    );
  }
  return (await response.json()) as LifecycleDateFactResult;
}
