import type { ShipmentHandoffIssueV1 } from "@logix/contracts";
import cargoOwnerCatalog from "@logix/contracts/cargo-owners.json";

export interface LegacyDepartedSourceRecord {
  sourceFile: string;
  sourceSha256: string;
  sourceSheet: string;
  declaredRange: string;
  actualRange: string;
  containerNumber: string;
  replenishmentOrderNumber: string;
  billNumber: string;
  values: Record<string, unknown>;
}

export interface LegacyDepartedSourceCandidate {
  sourceIdentity: {
    sourceFile: string;
    sourceSha256: string;
    sourceSheet: string;
    sourceRange: string;
  };
  containerNumber: string;
  replenishmentOrderNumber: string;
  billNumber: string;
  observedShipment: {
    carrierCode: string | null;
    vesselName: string | null;
    voyageNumber: string | null;
    originPortRaw: string | null;
    destinationPortRaw: string | null;
    cargoOwnerNameRaw: string | null;
    cargoOwnerName: string | null;
    cargoOwnerReferenceId: string | null;
    internalCountryShortCode: string | null;
    salesCountryCode: string | null;
    departureRaw: string | null;
    estimatedArrivalRaw: string | null;
    sourceLogisticsStatus: string | null;
  };
  observedContainer: {
    containerTypeCode: string | null;
    packageCount: string | null;
    grossWeightKg: string | null;
    volumeM3: string | null;
  };
  issues: ShipmentHandoffIssueV1[];
}

export function prepareLegacyDepartedSourceCandidate(
  record: LegacyDepartedSourceRecord,
): LegacyDepartedSourceCandidate {
  const issues: ShipmentHandoffIssueV1[] = [];
  if (
    record.declaredRange === "A1" &&
    record.actualRange.toUpperCase() !== "A1"
  ) {
    issues.push(
      issue(
        "SOURCE_RANGE_METADATA_INVALID",
        "shipment_handoff_source_range_metadata_invalid",
        record.sourceFile,
        ["source_range"],
      ),
    );
  }

  const cargoOwnerName = stringValue(
    record.values["销往国家"] ?? record.values["国别"],
  );
  const cargoOwner = resolveCargoOwner(cargoOwnerName);
  if (cargoOwnerName && !cargoOwner) {
    issues.push(
      issue(
        "UNKNOWN_REFERENCE_CODE",
        "shipment_handoff_cargo_owner_mapping_required",
        record.containerNumber,
        ["cargo_owner_reference_id", "sales_country_code"],
      ),
    );
  }
  for (const [rawHeader, fieldCode] of [
    ["起运港", "origin_port_code"],
    ["目的港", "destination_port_code"],
  ] as const) {
    const value = stringValue(record.values[rawHeader]);
    if (value && !/^[A-Z]{2}[A-Z0-9]{3}$/.test(value)) {
      issues.push(
        issue(
          "UNKNOWN_REFERENCE_CODE",
          "shipment_handoff_port_mapping_required",
          record.containerNumber,
          [fieldCode],
        ),
      );
    }
  }
  const departure = stringValue(record.values["出运日期"]);
  if (departure && !hasUtcOffset(departure)) {
    issues.push(
      issue(
        "DEPARTURE_PROOF_REQUIRED",
        "shipment_handoff_departure_timezone_or_authority_required",
        record.containerNumber,
        ["departure_proof"],
      ),
    );
  }
  issues.push(
    issue(
      "CARGO_DETAIL_INCOMPLETE",
      "shipment_handoff_cargo_detail_incomplete",
      record.containerNumber,
      ["cargo_allocations"],
    ),
  );

  return {
    sourceIdentity: {
      sourceFile: record.sourceFile,
      sourceSha256: record.sourceSha256,
      sourceSheet: record.sourceSheet,
      sourceRange: record.actualRange,
    },
    containerNumber: record.containerNumber,
    replenishmentOrderNumber: record.replenishmentOrderNumber,
    billNumber: record.billNumber,
    observedShipment: {
      carrierCode: stringValue(record.values["船公司"]),
      vesselName: stringValue(record.values["船名"]),
      voyageNumber: stringValue(record.values["航次"]),
      originPortRaw: stringValue(record.values["起运港"]),
      destinationPortRaw: stringValue(record.values["目的港"]),
      cargoOwnerNameRaw: cargoOwnerName,
      cargoOwnerName: cargoOwner?.legalName ?? null,
      cargoOwnerReferenceId: cargoOwner?.id ?? null,
      internalCountryShortCode: cargoOwner?.internalCountryShortCode ?? null,
      salesCountryCode: cargoOwner?.salesCountryCode ?? null,
      departureRaw: departure,
      estimatedArrivalRaw: stringValue(record.values["预计到港日期"]),
      sourceLogisticsStatus: stringValue(record.values["物流状态"]),
    },
    observedContainer: {
      containerTypeCode: stringValue(record.values["柜型"]),
      packageCount: decimalValue(record.values["箱数合计"]),
      grossWeightKg: decimalValue(record.values["毛重合计(KG)"]),
      volumeM3: decimalValue(record.values["体积合计(m3)"]),
    },
    issues,
  };
}

function resolveCargoOwner(value: string | null) {
  if (!value) return null;
  const normalized = normalizeCompanyName(value);
  return (
    cargoOwnerCatalog.records.find(
      ({ legalName }) => normalizeCompanyName(legalName) === normalized,
    ) ?? null
  );
}

function normalizeCompanyName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

function issue(
  code: ShipmentHandoffIssueV1["code"],
  messageKey: string,
  subjectRef: string,
  fieldCodes: string[],
): ShipmentHandoffIssueV1 {
  return { code, messageKey, subjectRef, fieldCodes };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decimalValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (
    typeof value === "string" &&
    value.trim() &&
    !Number.isNaN(Number(value))
  ) {
    return value.trim();
  }
  return null;
}

function hasUtcOffset(value: string): boolean {
  return /(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(value);
}
