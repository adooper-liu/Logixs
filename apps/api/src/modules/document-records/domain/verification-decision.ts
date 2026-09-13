export type VerificationDecision = "verified" | "rejected" | "revoked";

export type VerificationTransition =
  | {
      kind: "apply";
      nextState: VerificationDecision;
      nextValidity: "effective" | "revoked";
    }
  | { kind: "already_done" }
  | { kind: "reject"; code: string; message: string };

export function decideVerificationTransition(input: {
  currentState: string;
  currentValidity: string;
  decision: VerificationDecision;
  latestVerifiedDecisionId: string | null;
}): VerificationTransition {
  if (input.decision === "verified") {
    if (input.currentState === "verified") return { kind: "already_done" };
    if (input.currentState !== "pending") {
      return {
        kind: "reject",
        code: "BUSINESS_STATE_VIOLATION",
        message: "当前验证状态不可核验",
      };
    }
    return {
      kind: "apply",
      nextState: "verified",
      nextValidity: "effective",
    };
  }

  if (input.decision === "rejected") {
    if (input.currentState === "rejected") return { kind: "already_done" };
    if (input.currentState !== "pending") {
      return {
        kind: "reject",
        code: "BUSINESS_STATE_VIOLATION",
        message: "当前验证状态不可拒绝",
      };
    }
    return {
      kind: "apply",
      nextState: "rejected",
      nextValidity: "effective",
    };
  }

  if (input.currentState === "revoked") return { kind: "already_done" };
  if (input.currentState !== "verified" || input.currentValidity !== "effective") {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "只有已核验且有效的证据可以撤销",
    };
  }
  if (!input.latestVerifiedDecisionId) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "撤销必须引用原核验决定",
    };
  }
  return {
    kind: "apply",
    nextState: "revoked",
    nextValidity: "revoked",
  };
}
