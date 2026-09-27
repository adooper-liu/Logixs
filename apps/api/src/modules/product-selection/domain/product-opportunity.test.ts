import { describe, expect, it } from "vitest";
import {
  ProductOpportunityConflictError,
  prepareOpportunityIntake,
} from "./product-opportunity";

describe("product opportunity intake", () => {
  it("claims a queued handoff for the acting selector", () => {
    const prepared = prepareOpportunityIntake(
      { version: 0, state: "queued", assignedActorId: null },
      "selector-1",
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "claim",
        expectedIntakeVersion: 0,
        idempotencyKey: "claim-1",
      },
    );

    expect(prepared).toMatchObject({
      state: "claimed",
      assignedActorId: "selector-1",
    });
  });

  it("accepts only after the same actor has claimed it", () => {
    expect(
      prepareOpportunityIntake(
        { version: 1, state: "claimed", assignedActorId: "selector-1" },
        "selector-1",
        {
          contractVersion: "product-opportunity-intake.v1",
          action: "accept",
          expectedIntakeVersion: 1,
          idempotencyKey: "accept-1",
        },
      ).state,
    ).toBe("accepted");
    expect(() =>
      prepareOpportunityIntake(
        { version: 1, state: "claimed", assignedActorId: "selector-1" },
        "selector-2",
        {
          contractVersion: "product-opportunity-intake.v1",
          action: "accept",
          expectedIntakeVersion: 1,
          idempotencyKey: "accept-2",
        },
      ),
    ).toThrow(ProductOpportunityConflictError);
  });

  it("does not accept an unclaimed handoff", () => {
    expect(() =>
      prepareOpportunityIntake(
        { version: 0, state: "queued", assignedActorId: null },
        "selector-1",
        {
          contractVersion: "product-opportunity-intake.v1",
          action: "accept",
          expectedIntakeVersion: 0,
          idempotencyKey: "accept-unclaimed",
        },
      ),
    ).toThrow(ProductOpportunityConflictError);
  });
});
