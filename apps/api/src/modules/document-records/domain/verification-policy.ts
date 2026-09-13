// 人工核验第一刀占位策略：不是复合 SourceAuthorityPolicy，只标记本刀已执行的检查。
export const MANUAL_VERIFY_POLICY_ID =
  "30000000-0000-4000-8000-000000000001";
export const MANUAL_VERIFY_POLICY_VERSION = 1;
export const MANUAL_VERIFY_CHECKS = ["manual_review"] as const;
