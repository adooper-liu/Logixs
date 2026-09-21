import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { CustomsClearanceCommandController } from "./customs-clearance-command.controller";

const body = {
  expectedVersion: 0,
  jurisdictionCountryCode: "US",
  customsBrokerPartyId: "33333333-3333-4333-8333-333333333333",
  declarationNumber: "ENTRY-001",
  filingState: "accepted" as const,
  decisionState: "released" as const,
  activeHoldCodes: [],
  evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
  reasonCode: "CUSTOMS_RELEASE_CONFIRMED",
  idempotencyKey: "customs-1",
};

describe("CustomsClearanceCommandController", () => {
  it("injects the manual source and authenticated actor", async () => {
    const replace = {
      execute: vi.fn().mockResolvedValue({ caseId: "case-1" }),
    };
    const controller = new CustomsClearanceCommandController(replace as never);
    await controller.replace("container-1", body, {
      identity: {
        tenantId: "11111111-1111-4111-8111-111111111111",
        actorId: "55555555-5555-4555-8555-555555555555",
      },
    });
    expect(replace.execute).toHaveBeenCalledWith({
      ...body,
      tenantId: "11111111-1111-4111-8111-111111111111",
      containerRecordId: "container-1",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      actorId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("requires server-side container operate capability", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        CustomsClearanceCommandController.prototype.replace,
      ),
    ).toEqual(["container.operate"]);
  });
});
