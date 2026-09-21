import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getContainerDispatchSnapshot,
  replaceContainerDispatchSnapshot,
} from "./containerDispatch";

afterEach(() => vi.unstubAllGlobals());

describe("container dispatch API", () => {
  it("loads dispatch with the operating role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    await getContainerDispatchSnapshot("container/1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F1/dispatch-snapshot",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
      }),
    );
  });

  it("posts the exact versioned handoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      expectedVersion: 0,
      stuffingSnapshotId: "stuffing-1",
      stuffingSnapshotVersion: 2,
      bookingNumber: "BKG-1",
      carrierCode: "HMM",
      vesselName: "HMM LEAF",
      voyageNumber: "0002W",
      masterBillNumber: null,
      houseBillNumber: null,
      vgmHandoffState: "accepted" as const,
      evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
      reasonCode: "dispatch_confirmed",
      idempotencyKey: "key-1",
    };
    await replaceContainerDispatchSnapshot("container-1", input);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container-1/dispatch-snapshot",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
