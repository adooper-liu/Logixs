import { describe, expect, it } from "vitest";
import { decideVerificationTransition } from "./verification-decision";

describe("decideVerificationTransition", () => {
  it("pending 可核验或拒绝；已是目标态则 already_done", () => {
    expect(
      decideVerificationTransition({
        currentState: "pending",
        currentValidity: "effective",
        decision: "verified",
        latestVerifiedDecisionId: null,
      }),
    ).toMatchObject({ kind: "apply", nextState: "verified" });
    expect(
      decideVerificationTransition({
        currentState: "pending",
        currentValidity: "effective",
        decision: "rejected",
        latestVerifiedDecisionId: null,
      }),
    ).toMatchObject({ kind: "apply", nextState: "rejected" });
    expect(
      decideVerificationTransition({
        currentState: "verified",
        currentValidity: "effective",
        decision: "verified",
        latestVerifiedDecisionId: "d1",
      }).kind,
    ).toBe("already_done");
  });

  it("撤销必须从 verified/effective 出发并引用原决定", () => {
    expect(
      decideVerificationTransition({
        currentState: "verified",
        currentValidity: "effective",
        decision: "revoked",
        latestVerifiedDecisionId: "d1",
      }),
    ).toEqual({
      kind: "apply",
      nextState: "revoked",
      nextValidity: "revoked",
    });
    expect(
      decideVerificationTransition({
        currentState: "verified",
        currentValidity: "effective",
        decision: "revoked",
        latestVerifiedDecisionId: null,
      }).kind,
    ).toBe("reject");
    expect(
      decideVerificationTransition({
        currentState: "pending",
        currentValidity: "effective",
        decision: "revoked",
        latestVerifiedDecisionId: "d1",
      }).kind,
    ).toBe("reject");
  });
});
