import type {
  ShipmentDetailV1,
  ShipmentPendingCompletionItemV1,
  ShipmentPendingItemV1,
} from "@logix/contracts";

export function shipmentPendingItemFixture(
  overrides: Partial<ShipmentPendingItemV1> = {},
): ShipmentPendingItemV1 {
  return {
    code: "cargo_detail_missing",
    label: "补充 SKU 装载明细",
    subjectType: "cargo",
    subjectRef: "55555555-5555-4555-8555-555555555555",
    currentValue: null,
    sourceSystem: "legacy-departed-file",
    sourceValue: null,
    candidateValues: [],
    responsibility: {
      roleCode: "operations_dispatcher",
      roleLabel: "出运运营",
    },
    deadline: { dueAt: null, source: "not_configured", label: "未设定" },
    restrictedActions: [],
    directAction: { code: "add_cargo_lines", label: "补录明细" },
    ...overrides,
  };
}

export function pendingCompletionItemFixture(): ShipmentPendingCompletionItemV1 {
  return {
    shipment: {
      id: "55555555-5555-4555-8555-555555555555",
      shipmentNumber: "SHIP-001",
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      salesCountryCode: "US",
      cargoOwnerReferenceId: null,
      cargoOwnerName: "AOSOM LLC",
      atdAt: "2026-09-22T00:00:00.000Z",
      etaAt: null,
      currentLifecycleStatus: "departed",
      lifecycleVersion: 2,
      relationshipVersion: 1,
      activeContainerCount: 1,
      activeCargoLineCount: 0,
      lifecycleInitializationState: "ready",
      updatedAt: "2026-09-24T00:00:00.000Z",
    },
    pendingItems: [shipmentPendingItemFixture()],
  };
}

export function shipmentPendingDetailFixture(): ShipmentDetailV1 {
  const { shipment, pendingItems } = pendingCompletionItemFixture();
  return {
    shipment,
    handoff: null,
    containers: [
      {
        linkId: "66666666-6666-4666-8666-666666666666",
        containerRecordId: "77777777-7777-4777-8777-777777777777",
        containerNumber: "MSNU9762671",
        containerTypeCode: "40HQ",
        sealNumber: null,
        currentStatus: "shipped",
        linkVersion: 1,
        currentNodeCode: null,
        flowState: null,
        allocations: [],
      },
    ],
    cargoLines: [],
    transportDocuments: [],
    upstreamReferences: [],
    pendingItems,
    lifecycleInitialization: {
      state: "ready",
      activeContainerCount: 1,
      initializedContainerCount: 1,
      relationshipVersion: 1,
      lastErrorCode: null,
    },
    projectionVersion: 2,
    asOf: "2026-09-24T00:00:00.000Z",
  };
}
