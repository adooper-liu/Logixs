import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import type { SaveProductInitiativeDraftService } from "../application/save-product-initiative-draft.service";
import type { DecideProductInitiativeService } from "../application/decide-product-initiative.service";
import type { GetProductInitiativeService } from "../application/get-product-initiative.service";
import type { ListProductInitiativesService } from "../application/list-product-initiatives.service";
import { ProductInitiativesController } from "./product-initiatives.controller";

const COMMAND = {
  contractVersion: "product-initiative-decision-draft-save.v1" as const,
  expectedDraftVersion: 0,
  initiativeVersionSeen: 0,
  objective: null,
  reviewPoints: [],
  businessCaseDraft: [],
  riskAssessmentDraft: [],
  unitEconomicsDraft: null,
  negativeConservativeReason: null,
  idempotencyKey: "draft-save-1",
};

describe("ProductInitiativesController neutral draft", () => {
  it("requires planning.draft and binds actor from authentication", async () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ProductInitiativesController.prototype.saveDraft,
      ),
    ).toEqual(["planning.draft"]);

    const save = { execute: vi.fn().mockResolvedValue({}) };
    const controller = new ProductInitiativesController(
      {} as ListProductInitiativesService,
      {} as GetProductInitiativeService,
      {} as DecideProductInitiativeService,
      save as unknown as SaveProductInitiativeDraftService,
    );
    await controller.saveDraft(
      { identity: { tenantId: "tenant-1", actorId: "selector-1" } },
      "handoff-1",
      COMMAND,
    );
    expect(save.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "selector-1",
      handoffId: "handoff-1",
      command: COMMAND,
    });
  });
});
