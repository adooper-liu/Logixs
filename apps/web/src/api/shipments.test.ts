import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptInternalShipmentHandoffCandidate,
  listDepartedShipments,
  listInternalShipmentHandoffCandidates,
} from "./shipments";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listDepartedShipments", () => {
  it("loads departed Shipments with an authorized operating role", async () => {
    const items = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        shipmentNumber: "SHP-001",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items,
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
        asOf: "2026-09-24T00:00:00.000Z",
        projectionVersion: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listDepartedShipments()).resolves.toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shipments?pageSize=100&status=departed",
      {
        headers: {
          "X-Tenant-Id": "demo-real-sample-20260921",
          "X-Operator-Id": "dev-operator",
          "X-Roles": "operations_dispatcher",
        },
      },
    );
  });

  it("returns an actionable fallback when existing Shipments cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(listDepartedShipments()).rejects.toThrow(
      "暂时无法加载现有出运；仍可选择新建独立出运",
    );
  });
});

describe("internal Shipment handoff", () => {
  it("loads internal candidates from the shared handoff boundary", async () => {
    const page = {
      items: [],
      asOf: "2026-09-24T00:00:00.000Z",
      projectionVersion: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => page,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listInternalShipmentHandoffCandidates()).resolves.toEqual(
      page,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shipment-handoffs/internal-candidates",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("accepts an internal candidate without asking for duplicate file input", async () => {
    const result = {
      contractVersion: "internal-shipment-handoff-accept-result.v1",
      candidateRef: `internal:${"a".repeat(64)}`,
      handoff: { shipmentId: "shipment-1" },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      acceptInternalShipmentHandoffCandidate({
        contractVersion: "internal-shipment-handoff-accept.v1",
        candidateRef: result.candidateRef,
        idempotencyKey: "internal:test-1",
      }),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shipment-handoffs/internal-candidates/accept",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(result.candidateRef),
      }),
    );
  });
});
