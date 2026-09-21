import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getContainerStuffingSnapshot,
  replaceContainerStuffingSnapshot,
} from "./containerStuffing";

afterEach(() => vi.unstubAllGlobals());

describe("container stuffing API", () => {
  it("reads the current snapshot with the operating role", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null,
    });
    vi.stubGlobal("fetch", fetchMock);

    await getContainerStuffingSnapshot("container/1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F1/stuffing-snapshot",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
      }),
    );
  });

  it("posts the exact versioned stuffing command", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      expectedVersion: 0,
      allocationSetId: "allocation-1",
      allocationSetVersion: 2,
      containerNumber: "KOCU4960726",
      sealNumber: "SEAL-1",
      packageCount: 524,
      grossWeight: "8319",
      netWeight: null,
      volume: "66.74",
      vgm: null,
      evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
      reasonCode: "stuffing_confirmed",
      idempotencyKey: "command-1",
    };

    await replaceContainerStuffingSnapshot("container-1", input);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container-1/stuffing-snapshot",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
