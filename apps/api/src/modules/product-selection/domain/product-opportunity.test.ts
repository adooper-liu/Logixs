import { describe, expect, it } from "vitest";
import {
  ProductOpportunityConflictError,
  projectMarketOpportunityResponsibility,
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

describe("market opportunity responsibility projection", () => {
  const handedOffAt = "2026-10-04T00:00:00.000Z";
  const claimedAt = new Date("2026-10-04T00:10:00.000Z");
  const acceptedAt = new Date("2026-10-04T00:20:00.000Z");

  it.each([
    ["queued", null, null],
    ["claimed", claimedAt, null],
  ] as const)(
    "keeps %s opportunities with market",
    (intakeState, claimed, accepted) => {
      expect(
        projectMarketOpportunityResponsibility({
          intakeState,
          handedOffAt,
          assignedActorId: claimed ? "selector-1" : null,
          claimedAt: claimed,
          acceptedAt: accepted,
        }),
      ).toMatchObject({
        status: "retained_by_market",
        responsibleTeamCode: "market_intelligence",
        claimedAt: claimed?.toISOString() ?? null,
        acceptedAt: null,
      });
    },
  );

  it("transfers responsibility only when selection accepts", () => {
    expect(
      projectMarketOpportunityResponsibility({
        intakeState: "accepted",
        handedOffAt,
        assignedActorId: "selector-1",
        claimedAt,
        acceptedAt,
      }),
    ).toEqual({
      status: "transferred_to_selection",
      responsibleTeamCode: "product_selection",
      handedOffAt,
      assignedActorId: "selector-1",
      claimedAt: claimedAt.toISOString(),
      acceptedAt: acceptedAt.toISOString(),
    });
  });
});
