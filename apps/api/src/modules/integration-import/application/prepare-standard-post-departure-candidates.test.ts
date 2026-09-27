import { describe, expect, it } from "vitest";
import type { ImportBatchWithRows } from "../domain/import.repository";
import { prepareStandardPostDepartureCandidates } from "./prepare-standard-post-departure-candidates";

describe("prepareStandardPostDepartureCandidates", () => {
  it("keeps each standard SKU line bound to its replenishment order", () => {
    const secondCargo = cargoRow();
    secondCargo.__worksheet_row = "3";
    secondCargo.replenishment_order_number = "26DSC01813";
    secondCargo.product_number = "842-327V80";
    secondCargo.quantity = "40";
    const [candidate] = prepareStandardPostDepartureCandidates({
      batch: standardBatch([containerRow()], [cargoRow(), secondCargo]),
      validPortCodes: new Set(["CNNGB", "CAVAN"]),
    });

    expect(candidate).toMatchObject({
      candidateRef: "SHP-20260918-001:HMMU4956442",
      decision: "ready",
      containerNumber: "HMMU4956442",
      preparedHandoff: {
        shipmentGrouping: {
          kind: "authorized_new_shipment",
          shipmentNumber: "SHP-20260918-001",
        },
        sourceRecordId: "ERP-20260918-001",
        bookingNumber: "SQSJ26090200041842",
        sealNumber: "26H0407525",
        originPortCode: "CNNGB",
        destinationPortCode: "CAVAN",
        salesCountryCode: "CA",
        cargoOwnerName: "AOSOM CANADA INC.",
        departureProof: {
          occurredAt: "2026-09-17T16:00:00.000Z",
          sourceTimezone: "Asia/Shanghai",
          evidenceRef: "standard-batch",
        },
        cargoAllocations: [
          expect.objectContaining({
            sourceLineId: "standard:SKU装载明细!2",
            productNumber: "331-015",
            quantity: "118",
            quantityUnit: "piece",
          }),
          expect.objectContaining({
            sourceLineId: "standard:SKU装载明细!3",
            productNumber: "842-327V80",
            quantity: "40",
            quantityUnit: "piece",
          }),
        ],
        upstreamReferences: expect.arrayContaining([
          {
            referenceType: "stocking_order",
            sourceSystem: "post_departure_source_package",
            sourceRecordId: "26DSC01812",
          },
          {
            referenceType: "stocking_order",
            sourceSystem: "post_departure_source_package",
            sourceRecordId: "26DSC01812",
            sourceLineId: "standard:SKU装载明细!2",
          },
          {
            referenceType: "stocking_order",
            sourceSystem: "post_departure_source_package",
            sourceRecordId: "26DSC01813",
            sourceLineId: "standard:SKU装载明细!3",
          },
        ]),
        billsOfLading: expect.arrayContaining([
          expect.objectContaining({ documentType: "mbl" }),
          expect.objectContaining({ documentType: "hbl" }),
          expect.objectContaining({ documentType: "booking" }),
        ]),
      },
    });
    expect(candidate!.issues).toEqual([]);
  });

  it("allows a shipment to proceed without SKU rows and records a non-blocking pending item", () => {
    const [candidate] = prepareStandardPostDepartureCandidates({
      batch: standardBatch([containerRow()], []),
      validPortCodes: new Set(["CNNGB", "CAVAN"]),
    });

    expect(candidate!.decision).toBe("ready");
    expect(candidate!.issues).toContainEqual(
      expect.objectContaining({
        code: "CARGO_DETAIL_INCOMPLETE",
        blocking: false,
      }),
    );
  });

  it("rejects invalid supplied standard values but not absent optional facts", () => {
    const row = containerRow();
    row.origin_port_code = "NOT-A-PORT";
    const cargo = cargoRow();
    cargo.quantity = "-1";
    cargo.gross_weight_kg = "not-a-number";

    const [candidate] = prepareStandardPostDepartureCandidates({
      batch: standardBatch([row], [cargo]),
      validPortCodes: new Set(["CNNGB", "CAVAN"]),
    });

    expect(candidate!.decision).toBe("rejected");
    expect(candidate!.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_SOURCE_VALUE",
          fieldCodes: ["origin_port_code"],
        }),
        expect.objectContaining({
          code: "INVALID_SOURCE_VALUE",
          fieldCodes: ["quantity", "quantity_unit"],
        }),
        expect.objectContaining({
          code: "INVALID_SOURCE_VALUE",
          fieldCodes: ["gross_weight_kg"],
        }),
      ]),
    );
  });

  it("rejects invalid supplied times even when the departure proof is incomplete", () => {
    const row = containerRow();
    row.departure_at = "not-a-time";
    row.departure_source_timezone = "";
    row.estimated_arrival_at = "soon";

    const [candidate] = prepareStandardPostDepartureCandidates({
      batch: standardBatch([row], [cargoRow()]),
      validPortCodes: new Set(["CNNGB", "CAVAN"]),
    });

    expect(candidate!.decision).toBe("rejected");
    expect(candidate!.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_SOURCE_VALUE",
          fieldCodes: ["departure_at"],
          blocking: true,
        }),
        expect.objectContaining({
          code: "INVALID_SOURCE_VALUE",
          fieldCodes: ["estimated_arrival_at"],
          blocking: true,
        }),
        expect.objectContaining({
          code: "DEPARTURE_PROOF_REQUIRED",
          blocking: false,
        }),
      ]),
    );
  });

  it("rejects SKU rows that do not reference a declared Shipment-container row", () => {
    const cargo = cargoRow();
    cargo.container_number = "HMMU4207629";

    expect(() =>
      prepareStandardPostDepartureCandidates({
        batch: standardBatch([containerRow()], [cargo]),
        validPortCodes: new Set(["CNNGB", "CAVAN"]),
      }),
    ).toThrow("STANDARD_IMPORT_CARGO_REFERENCE_INVALID:SKU装载明细!2");
  });
});

function standardBatch(
  containers: Record<string, string>[],
  cargo: Record<string, string>[],
): ImportBatchWithRows {
  return {
    batch: {
      id: "standard-batch",
      tenantId: "tenant-1",
      operatorId: "operator-1",
      idempotencyKey: "standard-key",
      fileName: "standard.xlsx",
      fileHash: "a".repeat(64),
      sourceFileStatus: "retained",
      sourceObjectKey: "imports/standard-batch/source",
      sourceContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sourceSizeBytes: 100,
      sourceRetainedAt: new Date("2026-09-25T00:00:00Z"),
      parserVersion: "post-departure-standard-v1",
      replacesBatchId: null,
      status: "parsed",
      rowCount: containers.length + cargo.length,
      columnCount: 36,
      mappingSuggestions: [],
      confirmedQuantityUnit: null,
      createdAt: new Date("2026-09-25T00:00:00Z"),
    },
    rows: [...containers, ...cargo].map((values, index) => ({
      id: `row-${index + 1}`,
      rowNo: index + 1,
      values,
    })),
    reviews: [],
  };
}

function containerRow(): Record<string, string> {
  return {
    __record_type: "shipment_container",
    __sheet_name: "已出运接管",
    __worksheet_row: "2",
    source_record_id: "ERP-20260918-001",
    shipment_number: "SHP-20260918-001",
    container_number: "HMMU4956442",
    container_type_code: "40HQ",
    seal_number: "26H0407525",
    replenishment_order_number: "26DSC01812",
    booking_number: "SQSJ26090200041842",
    mbl_number: "NBOZ9FF56400",
    hbl_number: "NBOZ9FF56400C",
    carrier_code: "HMM",
    vessel_name: "YM MASCULINITY",
    voyage_number: "108E",
    origin_port_code: "CNNGB",
    destination_port_code: "CAVAN",
    sales_country_code: "CA",
    cargo_owner_name: "AOSOM CANADA INC.",
    departure_at: "2026-09-18T00:00:00+08:00",
    departure_time_precision: "date_only",
    departure_source_timezone: "Asia/Shanghai",
    estimated_arrival_at: "2026-10-08T00:00:00-07:00",
    package_count: "504",
    gross_weight_kg: "7723",
    volume_m3: "67.25",
  };
}

function cargoRow(): Record<string, string> {
  return {
    __record_type: "cargo_line",
    __sheet_name: "SKU装载明细",
    __worksheet_row: "2",
    shipment_number: "SHP-20260918-001",
    container_number: "HMMU4956442",
    replenishment_order_number: "26DSC01812",
    product_number: "331-015",
    quantity: "118",
    quantity_unit: "piece",
    package_count: "118",
    gross_weight_kg: "1404.2",
    volume_m3: "19.63",
  };
}
