import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ShipmentPendingCargoCompletionCommandV1,
  ShipmentPendingDocumentCompletionCommandV1,
} from "@logix/contracts";
import {
  acceptInternalShipmentHandoffCandidate,
  acceptInternalShipmentHandoffCandidates,
  bindShipmentPendingSku,
  completeShipmentPendingCargo,
  completeShipmentPendingDocuments,
  completeShipmentPendingFacts,
  listDepartedShipments,
  listInternalShipmentHandoffCandidates,
  listShipmentPendingCompletion,
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

  it("accepts all visible internal candidates through one batch command", async () => {
    const candidateRefs = [
      `internal:${"a".repeat(64)}`,
      `internal:${"b".repeat(64)}`,
    ] as [string, ...string[]];
    const result = {
      contractVersion: "internal-shipment-handoff-batch-accept-result.v1",
      items: [],
      totals: {
        groups: 2,
        accepted: 1,
        duplicate: 0,
        conflict: 1,
        rejected: 0,
        failed: 0,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);
    const command = {
      contractVersion: "internal-shipment-handoff-batch-accept.v1" as const,
      candidateRefs,
      idempotencyKey: "internal-batch:test-1",
    };

    await expect(
      acceptInternalShipmentHandoffCandidates(command),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shipment-handoffs/internal-candidates/accept-batch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  });
});

describe("pending Shipment completion", () => {
  it("loads the persistent queue from the Shipment read model", async () => {
    const page = {
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
      asOf: "2026-09-24T00:00:00.000Z",
      projectionVersion: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => page,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listShipmentPendingCompletion()).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shipments/pending-completion?pageSize=100",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("saves operator facts through the versioned Handoff boundary", async () => {
    const result = {
      contractVersion: "shipment-pending-fact-completion-result.v1",
      status: "saved",
      shipmentId: "11111111-1111-4111-8111-111111111111",
      relationshipVersion: 2,
      traceId: "trace-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);
    const command = {
      contractVersion: "shipment-pending-fact-completion.v1" as const,
      expectedRelationshipVersion: 1,
      occurredAt: "2026-09-24T08:00:00.000Z",
      idempotencyKey: "pending-facts-1",
      facts: { carrierCode: "HMM" },
    };

    await expect(
      completeShipmentPendingFacts(result.shipmentId, command),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/shipment-handoffs/shipments/${result.shipmentId}/pending-facts`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Roles": "operations_dispatcher",
        }),
        body: JSON.stringify(command),
      }),
    );
  });

  it("saves SKU loading rows through the audited cargo boundary", async () => {
    const shipmentId = "11111111-1111-4111-8111-111111111111";
    const result = {
      contractVersion: "shipment-pending-cargo-completion-result.v1",
      status: "saved",
      shipmentId,
      relationshipVersion: 1,
      cargoLineCount: 1,
      unmatchedSkuCount: 0,
      traceId: "cargo-trace-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);
    const command: ShipmentPendingCargoCompletionCommandV1 = {
      contractVersion: "shipment-pending-cargo-completion.v1" as const,
      expectedRelationshipVersion: 1,
      occurredAt: "2026-09-24T08:00:00.000Z",
      idempotencyKey: "pending-cargo-1",
      lines: [
        {
          containerRecordId: "22222222-2222-4222-8222-222222222222",
          productNumber: "SKU-001",
          quantity: "10",
          quantityUnit: "piece",
        },
      ],
    };

    await expect(
      completeShipmentPendingCargo(shipmentId, command),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/shipment-handoffs/shipments/${shipmentId}/pending-cargo`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  });

  it("binds an unmatched cargo line through the audited SKU boundary", async () => {
    const shipmentId = "11111111-1111-4111-8111-111111111111";
    const command = {
      contractVersion: "shipment-pending-sku-binding.v1" as const,
      expectedRelationshipVersion: 1,
      expectedCargoLineVersion: 2,
      occurredAt: "2026-09-25T08:00:00.000Z",
      idempotencyKey: "pending-sku-1",
      cargoLineId: "22222222-2222-4222-8222-222222222222",
    };
    const result = {
      contractVersion: "shipment-pending-sku-binding-result.v1",
      status: "saved",
      shipmentId,
      relationshipVersion: 1,
      cargoLineId: command.cargoLineId,
      cargoLineVersion: 3,
      productSkuId: "33333333-3333-4333-8333-333333333333",
      productNumber: "SKU-NEW",
      skuResolution: "registered",
      traceId: "sku-trace-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bindShipmentPendingSku(shipmentId, command)).resolves.toEqual(
      result,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/shipment-handoffs/shipments/${shipmentId}/pending-sku-binding`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  });

  it("saves a transport document with its selected container scope", async () => {
    const shipmentId = "11111111-1111-4111-8111-111111111111";
    const command: ShipmentPendingDocumentCompletionCommandV1 = {
      contractVersion: "shipment-pending-document-completion.v1",
      expectedRelationshipVersion: 1,
      occurredAt: "2026-09-25T08:00:00.000Z",
      idempotencyKey: "pending-document-1",
      documents: [
        {
          documentType: "mbl" as const,
          documentNumber: "NBOZ9FF56400",
          scac: "HMMU",
          containerRecordIds: ["22222222-2222-4222-8222-222222222222"],
        },
      ],
    };
    const result = {
      contractVersion: "shipment-pending-document-completion-result.v1",
      status: "saved",
      shipmentId,
      relationshipVersion: 1,
      documentCount: 1,
      traceId: "document-trace-1",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      completeShipmentPendingDocuments(shipmentId, command),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/shipment-handoffs/shipments/${shipmentId}/pending-documents`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  });
});
