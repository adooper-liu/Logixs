import { describe, expect, it } from "vitest";
import type { SaveProductInitiativeDecisionDraftCommandV1 } from "@logix/contracts";
import {
  ProductInitiativeDraftConflictError,
  prepareProductInitiativeDecisionDraft,
} from "./product-initiative-draft";

const ACTOR = "selector-1";

function command(
  overrides: Partial<SaveProductInitiativeDecisionDraftCommandV1> = {},
): SaveProductInitiativeDecisionDraftCommandV1 {
  return {
    contractVersion: "product-initiative-decision-draft-save.v1",
    expectedDraftVersion: 0,
    initiativeVersionSeen: 3,
    objective: "验证户外储物需求",
    reviewPoints: [],
    businessCaseDraft: [],
    riskAssessmentDraft: [],
    unitEconomicsDraft: null,
    negativeConservativeReason: null,
    idempotencyKey: "draft-save-1",
    ...overrides,
  };
}

describe("prepareProductInitiativeDecisionDraft", () => {
  it("normalizes a typed draft without producing a business decision", () => {
    const prepared = prepareProductInitiativeDecisionDraft(ACTOR, command());

    expect(prepared).not.toHaveProperty("outcome");
    expect(prepared).not.toHaveProperty("currentDestination");
    expect(prepared.objective).toBe("验证户外储物需求");
    expect(prepared.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a stale draft version", () => {
    expect(() =>
      prepareProductInitiativeDecisionDraft(ACTOR, command(), {
        draftVersion: 2,
        initiativeVersion: 3,
      }),
    ).toThrowError(
      new ProductInitiativeDraftConflictError(
        "PRODUCT_INITIATIVE_DRAFT_VERSION_CONFLICT",
      ),
    );
  });

  it("rejects a stale initiative version", () => {
    expect(() =>
      prepareProductInitiativeDecisionDraft(
        ACTOR,
        command({ expectedDraftVersion: 2, initiativeVersionSeen: 2 }),
        { draftVersion: 2, initiativeVersion: 3 },
      ),
    ).toThrowError(
      new ProductInitiativeDraftConflictError(
        "PRODUCT_INITIATIVE_DRAFT_BASE_VERSION_CONFLICT",
      ),
    );
  });
});
