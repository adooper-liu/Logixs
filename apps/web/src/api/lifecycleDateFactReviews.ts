import type {
  ApproveLifecycleDateFactReviewCommand,
  LifecycleDateFactReviewPage,
  LifecycleDateFactResult,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export async function listLifecycleDateFactReviews(input?: {
  pageSize?: number;
  cursor?: string;
}): Promise<LifecycleDateFactReviewPage> {
  const query = new URLSearchParams();
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  return requestJson<LifecycleDateFactReviewPage>(
    `/api/lifecycle-date-fact-reviews${query.size ? `?${query}` : ""}`,
    { fallback: "加载日期事实复核队列失败" },
  );
}

export async function approveLifecycleDateFactReview(
  factId: string,
  command: ApproveLifecycleDateFactReviewCommand,
): Promise<LifecycleDateFactResult> {
  return requestJson<LifecycleDateFactResult>(
    `/api/lifecycle-date-fact-reviews/${encodeURIComponent(factId)}/approve`,
    { method: "POST", body: command, fallback: "日期事实未能批准" },
  );
}
