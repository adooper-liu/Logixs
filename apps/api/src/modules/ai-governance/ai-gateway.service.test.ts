import { describe, expect, it } from "vitest";
import { buildDeterministicOpsAnswer } from "./ai-gateway.service";

describe("buildDeterministicOpsAnswer", () => {
  it("includes notification context when present", () => {
    const answer = buildDeterministicOpsAnswer({
      question: "怎么办？",
      notificationContext: "outbox_dead_letter: 死信",
      history: [],
    });
    expect(answer).toContain("outbox_dead_letter");
    expect(answer).toContain("怎么办？");
    expect(answer).toContain("看失败");
  });
});
