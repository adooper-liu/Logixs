import { describe, expect, it } from "vitest";
import {
  CustomsClearanceCaseValidationError,
  normalizeCustomsClearanceCaseCommand,
} from "./customs-clearance-case";

const command = () => ({
  tenantId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "22222222-2222-4222-8222-222222222222",
  expectedVersion: 0,
  jurisdictionCountryCode: "US",
  customsBrokerPartyId: "33333333-3333-4333-8333-333333333333",
  declarationNumber: "ENTRY-001",
  filingState: "accepted" as const,
  decisionState: "released" as const,
  activeHoldCodes: [],
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix.web",
  evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
  actorId: "55555555-5555-4555-8555-555555555555",
  reasonCode: "CUSTOMS_RELEASE_CONFIRMED",
  idempotencyKey: "customs-case-1",
});

describe("normalizeCustomsClearanceCaseCommand", () => {
  it("normalizes a released customs case and hashes business fields", () => {
    const result = normalizeCustomsClearanceCaseCommand(command());

    expect(result.jurisdictionCountryCode).toBe("US");
    expect(result.activeHoldCodes).toEqual([]);
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires an accepted filing and evidence before release", () => {
    expect(() =>
      normalizeCustomsClearanceCaseCommand({
        ...command(),
        filingState: "filed",
      }),
    ).toThrow(CustomsClearanceCaseValidationError);
    expect(() =>
      normalizeCustomsClearanceCaseCommand({
        ...command(),
        evidenceRefs: [],
      }),
    ).toThrow("EVIDENCE_REQUIRED");
  });

  it("requires active hold codes only while the case is held", () => {
    expect(() =>
      normalizeCustomsClearanceCaseCommand({
        ...command(),
        decisionState: "held",
        activeHoldCodes: [],
      }),
    ).toThrow("CUSTOMS_HOLD_CODE_REQUIRED");
    expect(() =>
      normalizeCustomsClearanceCaseCommand({
        ...command(),
        activeHoldCodes: ["DOCUMENT_REVIEW"],
      }),
    ).toThrow("CUSTOMS_ACTIVE_HOLD_CONFLICT");
  });
});
