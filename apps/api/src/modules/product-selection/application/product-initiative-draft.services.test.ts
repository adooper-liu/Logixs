import { describe, expect, it, vi } from "vitest";
import { SaveProductInitiativeDraftService } from "./save-product-initiative-draft.service";

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const SIGNAL_ID = "11111111-1111-4111-8111-111111111111";

function harness() {
  const drafts = {
    findByHandoffId: vi.fn().mockResolvedValue(null),
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    persist: vi.fn().mockResolvedValue({
      duplicate: false,
      record: {
        draftId: "33333333-3333-4333-8333-333333333333",
        handoffId: HANDOFF_ID,
        draftVersion: 1,
        initiativeVersionSeen: 0,
        objective: "验证户外储物需求",
        reviewPoints: [],
        businessCaseDraft: [],
        riskAssessmentDraft: [],
        unitEconomicsDraft: null,
        negativeConservativeReason: null,
        createdAt: new Date("2026-10-14T08:00:00.000Z"),
        updatedAt: new Date("2026-10-14T08:00:00.000Z"),
      },
    }),
  };
  const initiatives = {
    currentVersion: vi.fn().mockResolvedValue(0),
    findByHandoffId: vi.fn().mockResolvedValue(null),
  };
  const opportunities = {
    findByHandoffId: vi.fn().mockResolvedValue({
      intakeState: "accepted",
      handoff: { signalId: SIGNAL_ID },
    }),
  };
  const evidence = { execute: vi.fn().mockResolvedValue({ [SIGNAL_ID]: [] }) };
  return {
    drafts,
    initiatives,
    service: new SaveProductInitiativeDraftService(
      drafts as never,
      initiatives as never,
      opportunities as never,
      evidence as never,
    ),
  };
}

describe("SaveProductInitiativeDraftService", () => {
  it("persists typed working material without persisting a business decision", async () => {
    const { service, drafts, initiatives } = harness();

    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "selector-1",
        handoffId: HANDOFF_ID,
        command: {
          contractVersion: "product-initiative-decision-draft-save.v1",
          expectedDraftVersion: 0,
          initiativeVersionSeen: 0,
          objective: "验证户外储物需求",
          reviewPoints: [],
          businessCaseDraft: [],
          riskAssessmentDraft: [],
          unitEconomicsDraft: null,
          negativeConservativeReason: null,
          idempotencyKey: "draft-save-1",
        },
      }),
    ).resolves.toMatchObject({ draftVersion: 1 });

    expect(drafts.persist).toHaveBeenCalledTimes(1);
    expect(initiatives).not.toHaveProperty("persistDecision");
    expect(drafts.persist.mock.calls[0]?.[0].command).not.toHaveProperty(
      "outcome",
    );
  });
});
