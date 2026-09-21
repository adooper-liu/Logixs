import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getWarehouseDeliveryInstruction,
  replaceWarehouseDeliveryInstruction,
} from "./warehouseDelivery";

afterEach(() => vi.unstubAllGlobals());

describe("warehouse delivery API", () => {
  it("loads the current instruction with the operating role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    await getWarehouseDeliveryInstruction("container/1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container%2F1/delivery-instruction",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
      }),
    );
  });

  it("posts the exact versioned instruction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      expectedVersion: 0,
      warehouseLocationId: "33333333-3333-4333-8333-333333333333",
      warehouseCode: "VLS",
      warehouseName: "Barcelona VLS",
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
      appointmentStartAt: null,
      appointmentEndAt: null,
      appointmentReference: null,
      evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
      reasonCode: "delivery_instruction_confirmed",
      idempotencyKey: "delivery-instruction-1",
    };
    await replaceWarehouseDeliveryInstruction("container-1", input);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/containers/container-1/delivery-instruction",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
