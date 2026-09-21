import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listLifecycleDateFacts,
  recordLifecycleDateFact,
} from "./lifecycleDateFacts";

afterEach(() => vi.unstubAllGlobals());

describe("lifecycle date facts API", () => {
  it("lists and records facts through the same protected endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], projectionVersion: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listLifecycleDateFacts("container-1");
    await recordLifecycleDateFact("container-1", {
      nodeCode: "container_stuffing",
      eventCode: "stuffed",
      timeKind: "actual",
      occurredAt: "2026-01-23T01:00:00.000Z",
      rawValue: "2026-01-23T09:00",
      sourceUtcOffset: "+08:00",
      authoritySystem: "ops-team",
      evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
      reasonCode: "stuffing_actual_confirmed",
      expectedVersion: 0,
      idempotencyKey: "command-1",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/containers/container-1/date-facts",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/containers/container-1/date-facts",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
