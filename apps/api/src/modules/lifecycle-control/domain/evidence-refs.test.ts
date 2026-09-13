import { describe, expect, it } from "vitest";
import { parseEvidenceRefs } from "./evidence-refs";

describe("parseEvidenceRefs", () => {
  it("空列表视为缺合格证据", () => {
    expect(() => parseEvidenceRefs([])).toThrow("EVIDENCE_REQUIRED");
    expect(() => parseEvidenceRefs(undefined)).toThrow("EVIDENCE_REQUIRED");
  });

  it("重复或非法 UUID 明确失败", () => {
    expect(() =>
      parseEvidenceRefs([
        "22222222-2222-4222-8222-222222222222",
        "22222222-2222-4222-8222-222222222222",
      ]),
    ).toThrow("VALIDATION_FORMAT");
    expect(() => parseEvidenceRefs(["not-uuid"])).toThrow("VALIDATION_FORMAT");
  });
});
