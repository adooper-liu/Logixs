import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendContainerUnloadingReport,
  getContainerUnloadingReport,
} from "./containerUnloading";

afterEach(() => vi.unstubAllGlobals());

describe("container unloading API", () => {
  it("loads the current report with the warehouse role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    await getContainerUnloadingReport("container/1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F1/unloading-report",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Roles": "warehouse_operator" }),
      }),
    );
  });

  it("posts the exact versioned unloading report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      expectedVersion: 0,
      warehouseLocationId: "22222222-2222-4222-8222-222222222222",
      operationState: "started" as const,
      startedAt: "2026-04-23T06:00:00.000Z",
      completedAt: null,
      expectedQuantity: "524",
      unloadedQuantity: "0",
      remainingQuantity: "524",
      damagedQuantity: "0",
      shortageQuantity: "0",
      quantityUnit: "carton" as const,
      sealCheck: "matched" as const,
      exceptionResolved: false,
      exceptionNotes: null,
      evidenceRefs: ["33333333-3333-4333-8333-333333333333"] as [string],
      reasonCode: "unloading_started",
      idempotencyKey: "unloading-v1",
    };
    await appendContainerUnloadingReport("container-1", input);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container-1/unloading-report",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
