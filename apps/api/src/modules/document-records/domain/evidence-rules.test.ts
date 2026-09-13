import { describe, expect, it } from "vitest";
import { isContentHash, isQualifiedEvidence, isUuid } from "./evidence-rules";

describe("evidence-rules", () => {
  it("识别 UUID 与 sha256 hex", () => {
    expect(isUuid("10000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-uuid")).toBe(false);
    expect(isContentHash("a".repeat(64))).toBe(true);
    expect(isContentHash("A".repeat(64))).toBe(false);
  });

  it("合格判定拆出租户与对象/核验失败", () => {
    const base = {
      tenantId: "t1",
      subjectType: "container",
      subjectId: "c1",
      verificationState: "verified",
      validity: "effective",
      expectedTenantId: "t1",
      expectedSubjectType: "container",
      expectedSubjectId: "c1",
    };
    expect(isQualifiedEvidence(base)).toBe("ok");
    expect(isQualifiedEvidence({ ...base, tenantId: "other" })).toBe("tenant");
    expect(isQualifiedEvidence({ ...base, verificationState: "pending" })).toBe(
      "unqualified",
    );
  });
});
