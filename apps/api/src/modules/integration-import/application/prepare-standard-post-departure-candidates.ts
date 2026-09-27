import type {
  CargoAllocationV1,
  PostDepartureSourceCandidateV1,
  ShipmentHandoffIssueV1,
  UpstreamReferenceV1,
} from "@logix/contracts";
import cargoOwnerCatalog from "@logix/contracts/cargo-owners.json";
import type { ImportBatchWithRows } from "../domain/import.repository";
import { decoratePostDepartureIssue } from "../domain/post-departure-candidate-correction";

const CONTAINER_PATTERN = /^[A-Z]{4}[0-9]{7}$/;
const PORT_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const CARRIER_PATTERN = /^[A-Z0-9]{2,10}$/;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,3})?$/;
const QUANTITY_UNITS = new Set(["piece", "carton", "set", "pallet"]);

export function prepareStandardPostDepartureCandidates(input: {
  batch: ImportBatchWithRows;
  validPortCodes: ReadonlySet<string>;
}): PostDepartureSourceCandidateV1[] {
  const containerRows = input.batch.rows.filter(
    ({ values }) => values.__record_type === "shipment_container",
  );
  const cargoRows = input.batch.rows.filter(
    ({ values }) => values.__record_type === "cargo_line",
  );
  const containerKeys = new Set(
    containerRows.map(({ values }) => identityKey(values)),
  );
  const unmatchedCargoRows = cargoRows.filter(
    ({ values }) => !containerKeys.has(identityKey(values)),
  );
  if (unmatchedCargoRows.length > 0) {
    throw new Error(
      `STANDARD_IMPORT_CARGO_REFERENCE_INVALID:${unmatchedCargoRows
        .map(({ values }) => sourceRow(values))
        .join(",")}`,
    );
  }

  const rowsByContainer = groupBy(containerRows, ({ values }) =>
    normalizeUpper(values.container_number),
  );
  const cargoByContainer = groupBy(cargoRows, ({ values }) =>
    normalizeUpper(values.container_number),
  );
  const candidates = [...rowsByContainer.entries()].map(
    ([containerNumber, rows]) => {
      const primary = rows[0]!;
      const values = primary.values;
      const shipmentNumber = normalize(values.shipment_number);
      const issues: ShipmentHandoffIssueV1[] = [];
      if (!CONTAINER_PATTERN.test(containerNumber)) {
        issues.push(
          issue(
            "INVALID_SOURCE_VALUE",
            containerNumber,
            ["container_number"],
            [sourceRow(values)],
          ),
        );
      }
      if (rows.length > 1) {
        issues.push(
          issue(
            "DUPLICATE_REFERENCE",
            containerNumber,
            ["container_number"],
            rows.map(({ values: rowValues }) => sourceRow(rowValues)),
          ),
        );
      }
      validateOptionalCode(
        values.origin_port_code,
        "origin_port_code",
        PORT_PATTERN,
        input.validPortCodes,
        issues,
        values,
      );
      validateOptionalCode(
        values.destination_port_code,
        "destination_port_code",
        PORT_PATTERN,
        input.validPortCodes,
        issues,
        values,
      );
      validatePattern(
        values.sales_country_code,
        "sales_country_code",
        COUNTRY_PATTERN,
        issues,
        values,
      );
      validatePattern(
        values.carrier_code,
        "carrier_code",
        CARRIER_PATTERN,
        issues,
        values,
      );
      validateOptionalDateTime(
        values.estimated_arrival_at,
        "estimated_arrival_at",
        issues,
        values,
      );
      const departureProof = prepareDepartureProof(
        values,
        input.batch.batch.id,
        issues,
      );
      const owner = prepareCargoOwner(values, issues);
      for (const fieldCode of [
        "package_count",
        "gross_weight_kg",
        "volume_m3",
      ] as const) {
        validateOptionalDecimal(values[fieldCode], fieldCode, issues, values);
      }
      const cargo = cargoByContainer.get(containerNumber) ?? [];
      const preparedCargoLines = cargo.flatMap(({ values: cargoValues }) =>
        prepareCargoAllocation(cargoValues, issues).map((allocation) => ({
          allocation,
          replenishmentOrderNumber: optional(
            cargoValues.replenishment_order_number,
          ),
        })),
      );
      const cargoAllocations = preparedCargoLines.map(
        ({ allocation }) => allocation,
      );
      if (cargo.length === 0) {
        issues.push(
          issue(
            "CARGO_DETAIL_INCOMPLETE",
            containerNumber,
            ["cargo_allocations"],
            [sourceRow(values)],
          ),
        );
      }
      for (const fieldCode of [
        "container_type_code",
        "replenishment_order_number",
        "carrier_code",
        "vessel_name",
        "voyage_number",
        "origin_port_code",
        "destination_port_code",
      ] as const) {
        if (!normalize(values[fieldCode])) {
          issues.push(
            issue(
              "SOURCE_DATA_INCOMPLETE",
              containerNumber,
              [fieldCode],
              [sourceRow(values)],
            ),
          );
        }
      }
      if (!owner) {
        issues.push(
          issue(
            "SOURCE_DATA_INCOMPLETE",
            containerNumber,
            ["cargo_owner_name", "sales_country_code"],
            [sourceRow(values)],
          ),
        );
      }
      const billsOfLading = prepareBills(values);
      if (billsOfLading.length === 0) {
        issues.push(
          issue(
            "SOURCE_DATA_INCOMPLETE",
            containerNumber,
            ["bill_of_lading"],
            [sourceRow(values)],
          ),
        );
      }
      const replenishmentOrderNumbers = [
        ...new Set(
          [
            normalize(values.replenishment_order_number),
            ...cargo.map(({ values: cargoValues }) =>
              normalize(cargoValues.replenishment_order_number),
            ),
          ].filter(Boolean),
        ),
      ].sort();
      const upstreamReferences = deduplicateUpstreamReferences([
        ...replenishmentOrderNumbers.map((orderNumber) =>
          stockingOrderReference(orderNumber),
        ),
        ...preparedCargoLines.flatMap(
          ({ allocation, replenishmentOrderNumber }) =>
            replenishmentOrderNumber
              ? [
                  stockingOrderReference(
                    replenishmentOrderNumber,
                    allocation.sourceLineId,
                  ),
                ]
              : [],
        ),
      ]);
      const decoratedIssues = deduplicateIssues(issues).map(
        decoratePostDepartureIssue,
      );
      return omitUndefined({
        candidateRef: `${shipmentNumber}:${containerNumber}`,
        decision: candidateDecision(decoratedIssues),
        containerNumber,
        replenishmentOrderNumbers,
        billNumbers: billsOfLading.map(({ documentNumber }) => documentNumber),
        carrierCode: optional(values.carrier_code),
        vesselName: optional(values.vessel_name),
        voyageNumber: optional(values.voyage_number),
        originPortRaw: optionalUpper(values.origin_port_code),
        destinationPortRaw: optionalUpper(values.destination_port_code),
        cargoOwnerName: owner?.legalName,
        departureRaw: optional(values.departure_at),
        estimatedArrivalRaw: optional(values.estimated_arrival_at),
        containerTypeCode: optionalUpper(values.container_type_code),
        packageCount: validDecimal(values.package_count),
        grossWeightKg: validDecimal(values.gross_weight_kg),
        volumeM3: validDecimal(values.volume_m3),
        preparedHandoff: omitUndefined({
          shipmentGrouping: {
            kind: "authorized_new_shipment" as const,
            shipmentNumber,
          },
          sourceRecordId: optional(values.source_record_id),
          bookingNumber: optional(values.booking_number),
          sealNumber: optional(values.seal_number),
          originPortCode: validPort(
            values.origin_port_code,
            input.validPortCodes,
          ),
          destinationPortCode: validPort(
            values.destination_port_code,
            input.validPortCodes,
          ),
          ...(owner
            ? {
                salesCountryCode: owner.salesCountryCode,
                cargoOwnerReferenceId: owner.id,
                cargoOwnerName: owner.legalName,
              }
            : {}),
          estimatedArrivalAt: validDateTime(values.estimated_arrival_at),
          departureProof,
          cargoAllocations,
          upstreamReferences,
          billsOfLading,
        }),
        issues: decoratedIssues,
      }) as PostDepartureSourceCandidateV1;
    },
  );
  return markShipmentFactConflicts(candidates);
}

function prepareDepartureProof(
  values: Record<string, string>,
  evidenceRef: string,
  issues: ShipmentHandoffIssueV1[],
) {
  const departureAt = normalize(values.departure_at);
  const precision = normalize(values.departure_time_precision);
  const timezone = normalize(values.departure_source_timezone);
  const incomplete = !departureAt || !precision || !timezone;
  if (incomplete) {
    issues.push(
      issue(
        "DEPARTURE_PROOF_REQUIRED",
        normalizeUpper(values.container_number),
        ["departure_proof"],
        [sourceRow(values)],
      ),
    );
  }
  const invalidFields = [
    ...(departureAt && !validDateTime(departureAt) ? ["departure_at"] : []),
    ...(precision && !["date_only", "date_time"].includes(precision)
      ? ["departure_time_precision"]
      : []),
    ...(timezone && !validTimezone(timezone)
      ? ["departure_source_timezone"]
      : []),
  ];
  if (invalidFields.length > 0) {
    issues.push(
      issue(
        "INVALID_SOURCE_VALUE",
        normalizeUpper(values.container_number),
        invalidFields,
        [sourceRow(values)],
      ),
    );
  }
  if (incomplete || invalidFields.length > 0) {
    return undefined;
  }
  const occurredAt = validDateTime(departureAt)!;
  return {
    kind: "actual_departure_time" as const,
    occurredAt,
    sourceTimezone: timezone,
    evidenceRef,
  };
}

function prepareCargoOwner(
  values: Record<string, string>,
  issues: ShipmentHandoffIssueV1[],
) {
  const name = normalizeCompanyName(values.cargo_owner_name);
  const country = normalizeUpper(values.sales_country_code);
  if (!name || !country) return undefined;
  const owner = cargoOwnerCatalog.records.find(
    (record) => normalizeCompanyName(record.legalName) === name,
  );
  if (!owner || owner.salesCountryCode !== country) {
    issues.push(
      issue(
        "FIELD_SEMANTIC_MISMATCH",
        normalizeUpper(values.container_number),
        ["cargo_owner_name", "sales_country_code"],
        [sourceRow(values)],
      ),
    );
    return undefined;
  }
  return owner;
}

function prepareCargoAllocation(
  values: Record<string, string>,
  issues: ShipmentHandoffIssueV1[],
): CargoAllocationV1[] {
  for (const fieldCode of [
    "package_count",
    "gross_weight_kg",
    "volume_m3",
  ] as const) {
    validateOptionalDecimal(values[fieldCode], fieldCode, issues, values);
  }
  const quantity = validPositiveDecimal(values.quantity);
  const unit = normalize(values.quantity_unit);
  if (!quantity || !QUANTITY_UNITS.has(unit)) {
    issues.push(
      issue(
        "INVALID_SOURCE_VALUE",
        normalizeUpper(values.container_number),
        ["quantity", "quantity_unit"],
        [sourceRow(values)],
      ),
    );
    return [];
  }
  return [
    omitUndefined({
      sourceLineId:
        normalize(values.source_line_id) || `standard:${sourceRow(values)}`,
      productNumber: normalize(values.product_number),
      quantity,
      quantityUnit: unit as "piece" | "carton" | "set" | "pallet",
      packageCount: validDecimal(values.package_count),
      packageUnit: validDecimal(values.package_count) ? "carton" : undefined,
      grossWeight: validDecimal(values.gross_weight_kg),
      weightUnit: validDecimal(values.gross_weight_kg)
        ? ("kg" as const)
        : undefined,
      volume: validDecimal(values.volume_m3),
      volumeUnit: validDecimal(values.volume_m3) ? ("m3" as const) : undefined,
    }) as CargoAllocationV1,
  ];
}

function stockingOrderReference(
  orderNumber: string,
  sourceLineId?: string,
): UpstreamReferenceV1 {
  return {
    referenceType: "stocking_order",
    sourceSystem: "post_departure_source_package",
    sourceRecordId: orderNumber,
    ...(sourceLineId ? { sourceLineId } : {}),
  };
}

function deduplicateUpstreamReferences(
  references: UpstreamReferenceV1[],
): UpstreamReferenceV1[] {
  return [
    ...new Map(
      references.map((reference) => [
        JSON.stringify([
          reference.referenceType,
          reference.sourceSystem,
          reference.sourceRecordId,
          reference.sourceVersion ?? null,
          reference.sourceLineId ?? null,
        ]),
        reference,
      ]),
    ).values(),
  ];
}

function prepareBills(values: Record<string, string>) {
  const booking = normalize(values.booking_number);
  const mbl = normalize(values.mbl_number);
  const hbl = normalize(values.hbl_number);
  const bills: Array<{
    referenceId: string;
    documentType: "booking" | "mbl" | "hbl";
    documentNumber: string;
    parentReferenceId?: string;
    version: number;
  }> = [];
  if (booking)
    bills.push({
      referenceId: `booking:${booking}`,
      documentType: "booking",
      documentNumber: booking,
      version: 1,
    });
  if (mbl)
    bills.push({
      referenceId: `mbl:${mbl}`,
      documentType: "mbl",
      documentNumber: mbl,
      version: 1,
    });
  if (hbl)
    bills.push({
      referenceId: `hbl:${hbl}`,
      documentType: "hbl",
      documentNumber: hbl,
      ...(mbl ? { parentReferenceId: `mbl:${mbl}` } : {}),
      version: 1,
    });
  return bills;
}

function markShipmentFactConflicts(
  candidates: PostDepartureSourceCandidateV1[],
) {
  const byShipment = groupBy(candidates, (candidate) =>
    candidate.preparedHandoff?.shipmentGrouping.kind ===
    "authorized_new_shipment"
      ? candidate.preparedHandoff.shipmentGrouping.shipmentNumber
      : candidate.candidateRef,
  );
  for (const group of byShipment.values()) {
    for (const field of [
      "carrierCode",
      "vesselName",
      "voyageNumber",
      "originPortRaw",
      "destinationPortRaw",
      "cargoOwnerName",
      "departureRaw",
    ] as const) {
      const values = new Set(
        group.map((candidate) => candidate[field]).filter(Boolean),
      );
      if (values.size <= 1) continue;
      for (const candidate of group) {
        candidate.issues.push(
          decoratePostDepartureIssue(
            issue(
              "FIELD_SEMANTIC_MISMATCH",
              candidate.containerNumber,
              [toFieldCode(field)],
              [],
            ),
          ),
        );
        candidate.decision = "rejected";
      }
    }
  }
  return candidates;
}

function validateOptionalCode(
  raw: string | undefined,
  fieldCode: string,
  pattern: RegExp,
  validCodes: ReadonlySet<string>,
  issues: ShipmentHandoffIssueV1[],
  values: Record<string, string>,
): void {
  const value = normalizeUpper(raw);
  if (!value) return;
  if (!pattern.test(value) || !validCodes.has(value))
    issues.push(
      issue(
        "INVALID_SOURCE_VALUE",
        normalizeUpper(values.container_number),
        [fieldCode],
        [sourceRow(values)],
      ),
    );
}

function validatePattern(
  raw: string | undefined,
  fieldCode: string,
  pattern: RegExp,
  issues: ShipmentHandoffIssueV1[],
  values: Record<string, string>,
): void {
  const value = normalizeUpper(raw);
  if (value && !pattern.test(value))
    issues.push(
      issue(
        "INVALID_SOURCE_VALUE",
        normalizeUpper(values.container_number),
        [fieldCode],
        [sourceRow(values)],
      ),
    );
}

function validateOptionalDecimal(
  raw: string | undefined,
  fieldCode: string,
  issues: ShipmentHandoffIssueV1[],
  values: Record<string, string>,
): void {
  const value = normalize(raw);
  if (!value || validPositiveDecimal(value)) return;
  issues.push(
    issue(
      "INVALID_SOURCE_VALUE",
      normalizeUpper(values.container_number),
      [fieldCode],
      [sourceRow(values)],
    ),
  );
}

function validateOptionalDateTime(
  raw: string | undefined,
  fieldCode: string,
  issues: ShipmentHandoffIssueV1[],
  values: Record<string, string>,
): void {
  const value = normalize(raw);
  if (!value || validDateTime(value)) return;
  issues.push(
    issue(
      "INVALID_SOURCE_VALUE",
      normalizeUpper(values.container_number),
      [fieldCode],
      [sourceRow(values)],
    ),
  );
}

function validPort(
  value: string | undefined,
  validCodes: ReadonlySet<string>,
): string | undefined {
  const code = normalizeUpper(value);
  return PORT_PATTERN.test(code) && validCodes.has(code) ? code : undefined;
}

function validDateTime(value: string | undefined): string | undefined {
  const normalized = normalize(value);
  if (
    !/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
  )
    return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validDecimal(value: string | undefined): string | undefined {
  const normalized = normalize(value);
  return DECIMAL_PATTERN.test(normalized) ? normalized : undefined;
}

function validPositiveDecimal(value: string | undefined): string | undefined {
  const normalized = validDecimal(value);
  return normalized && Number(normalized) > 0 ? normalized : undefined;
}

function identityKey(values: Record<string, string>): string {
  return `${normalize(values.shipment_number)}\u0000${normalizeUpper(values.container_number)}`;
}

function sourceRow(values: Record<string, string>): string {
  return `${values.__sheet_name ?? "?"}!${values.__worksheet_row ?? "?"}`;
}

function issue(
  code: ShipmentHandoffIssueV1["code"],
  subjectRef: string,
  fieldCodes: string[],
  sourceRows: string[],
): ShipmentHandoffIssueV1 {
  return {
    code,
    messageKey: `shipment_handoff_${code.toLowerCase()}`,
    subjectRef,
    fieldCodes,
    ...(sourceRows.length ? { sourceRows } : {}),
  };
}

function candidateDecision(
  issues: ShipmentHandoffIssueV1[],
): PostDepartureSourceCandidateV1["decision"] {
  if (
    issues.some(({ code }) =>
      [
        "INVALID_SOURCE_VALUE",
        "DUPLICATE_REFERENCE",
        "FIELD_SEMANTIC_MISMATCH",
      ].includes(code),
    )
  )
    return "rejected";
  return issues.some(({ blocking }) => blocking) ? "review_required" : "ready";
}

function deduplicateIssues(
  issues: ShipmentHandoffIssueV1[],
): ShipmentHandoffIssueV1[] {
  return [
    ...new Map(
      issues.map((item) => [
        JSON.stringify([
          item.code,
          item.subjectRef,
          item.fieldCodes,
          item.sourceRows,
        ]),
        item,
      ]),
    ).values(),
  ];
}

function groupBy<T>(
  values: T[],
  keyOf: (value: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values)
    result.set(keyOf(value), [...(result.get(keyOf(value)) ?? []), value]);
  return result;
}

function normalize(value: string | undefined): string {
  return value?.normalize("NFKC").trim() ?? "";
}
function normalizeUpper(value: string | undefined): string {
  return normalize(value).toUpperCase();
}
function normalizeCompanyName(value: string | undefined): string {
  return normalizeUpper(value).replace(/\s+/g, " ");
}
function optional(value: string | undefined): string | undefined {
  return normalize(value) || undefined;
}
function optionalUpper(value: string | undefined): string | undefined {
  return normalizeUpper(value) || undefined;
}
function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
function toFieldCode(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
