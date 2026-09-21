import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCustomsClearanceCase,
  replaceCustomsClearanceCase,
} from "./customsClearance";

afterEach(() => vi.unstubAllGlobals());

describe("customs clearance API", () => {
  it("loads a case with the operating role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    await getCustomsClearanceCase("container/1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F1/customs-clearance-case",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
      }),
    );
  });

  it("posts the exact versioned case", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
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
    await replaceCustomsClearanceCase("container-1", input);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container-1/customs-clearance-case",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
