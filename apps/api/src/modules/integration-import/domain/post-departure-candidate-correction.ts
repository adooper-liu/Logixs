import type {
  PostDepartureReferencePortV1,
  PostDepartureSourceCandidateCorrectionV1,
  PostDepartureSourceCandidateV1,
  ShipmentHandoffIssueV1,
} from "@logix/contracts";
import type { PostDepartureSourceCandidateCorrectionRecord } from "./import.repository";

const RESOLVED_FIELD_CODES = new Set([
  "shipment_grouping",
  "origin_port_code",
  "destination_port_code",
  "departure_proof",
]);

export function decoratePostDepartureIssue(
  issue: ShipmentHandoffIssueV1,
): ShipmentHandoffIssueV1 {
  if (
    issue.code === "SOURCE_RANGE_METADATA_INVALID" ||
    issue.code === "SOURCE_DATA_INCOMPLETE" ||
    issue.code === "DEPARTURE_PROOF_REQUIRED" ||
    issue.code === "EXTERNAL_SHIPMENT_MATCH_REQUIRED" ||
    issue.code === "UNKNOWN_REFERENCE_CODE" ||
    issue.code === "CARGO_DETAIL_INCOMPLETE"
  ) {
    const systemHandled = issue.code === "SOURCE_RANGE_METADATA_INVALID";
    const upstream =
      issue.code === "SOURCE_DATA_INCOMPLETE" ||
      issue.code === "CARGO_DETAIL_INCOMPLETE" ||
      issue.fieldCodes?.some((field) =>
        ["cargo_owner_reference_id", "sales_country_code"].includes(field),
      );
    return {
      ...issue,
      blocking: false,
      resolutionState: systemHandled
        ? "system_handled"
        : upstream
          ? "upstream_action_required"
          : "operator_action_required",
    };
  }
  return {
    ...issue,
    blocking: true,
    resolutionState: "operator_action_required",
  };
}

export function isBlockingPostDepartureIssue(
  issue: ShipmentHandoffIssueV1,
): boolean {
  return issue.blocking ?? issue.code !== "SOURCE_RANGE_METADATA_INVALID";
}

export function applyPostDepartureCandidateCorrection(input: {
  candidate: PostDepartureSourceCandidateV1;
  correction: PostDepartureSourceCandidateCorrectionRecord;
  originPort?: PostDepartureReferencePortV1;
  destinationPort?: PostDepartureReferencePortV1;
}): PostDepartureSourceCandidateV1 {
  const issues = input.candidate.issues
    .filter((issue) => !isResolvedByCorrection(issue, input.correction))
    .map(decoratePostDepartureIssue);
  const blockingIssues = issues.filter(isBlockingPostDepartureIssue);
  const cargoAllocations = (input.correction.cargoLines ?? []).map((line) => ({
    sourceLineId: line.sourceLineId,
    replenishmentOrderNumber: line.replenishmentOrderNumber,
    productSkuId: line.productSkuId,
    productNumber: line.productNumber,
    quantity: line.quantity,
    quantityUnit: line.quantityUnit,
    ...(line.replenishmentOrderLineId
      ? { replenishmentOrderLineId: line.replenishmentOrderLineId }
      : {}),
  }));
  const shipmentGrouping = toShipmentGrouping(input.correction);
  const hasDepartureProof = Boolean(
    input.correction.departureOccurredAt &&
    input.correction.departureSourceTimezone &&
    input.correction.departureEvidenceId,
  );
  const correction: PostDepartureSourceCandidateCorrectionV1 = {
    correctionId: input.correction.id,
    version: input.correction.version,
    ...(shipmentGrouping ? { shipmentGrouping } : {}),
    ...(input.originPort ? { originPort: input.originPort } : {}),
    ...(input.destinationPort
      ? { destinationPort: input.destinationPort }
      : {}),
    ...(hasDepartureProof
      ? {
          departureProof: {
            kind: "actual_departure_time" as const,
            occurredAt: input.correction.departureOccurredAt!.toISOString(),
            sourceTimezone: input.correction.departureSourceTimezone!,
            evidenceRef: input.correction.departureEvidenceId!,
          },
        }
      : {}),
    ...(input.correction.departureLocal
      ? { departureLocal: input.correction.departureLocal }
      : {}),
    ...(input.correction.departureSourceTimezone
      ? {
          departureSourceTimezone: input.correction.departureSourceTimezone,
        }
      : {}),
    ...(input.correction.departureEvidenceId
      ? { departureEvidenceRef: input.correction.departureEvidenceId }
      : {}),
    ...(cargoAllocations.length > 0
      ? {
          cargoAllocations: cargoAllocations as NonNullable<
            PostDepartureSourceCandidateCorrectionV1["cargoAllocations"]
          >,
        }
      : {}),
    reasonCode: input.correction.reasonCode,
    correctedAt: input.correction.createdAt.toISOString(),
  };
  return {
    ...input.candidate,
    decision: blockingIssues.length === 0 ? "ready" : "review_required",
    correction,
    issues,
  };
}

function toShipmentGrouping(
  correction: PostDepartureSourceCandidateCorrectionRecord,
): PostDepartureSourceCandidateCorrectionV1["shipmentGrouping"] | undefined {
  if (
    correction.shipmentGroupingKind === "existing_shipment" &&
    correction.targetShipmentId &&
    correction.targetRelationshipVersion
  ) {
    return {
      kind: "existing_shipment",
      shipmentId: correction.targetShipmentId,
      expectedRelationshipVersion: correction.targetRelationshipVersion,
    };
  }
  if (correction.shipmentGroupingKind === "new_independent_shipment") {
    return { kind: "new_independent_shipment" };
  }
  if (
    correction.shipmentGroupingKind === "authorized_new_shipment" &&
    correction.shipmentNumber
  ) {
    return {
      kind: "authorized_new_shipment",
      shipmentNumber: correction.shipmentNumber,
    };
  }
  return undefined;
}

function isResolvedByCorrection(
  issue: ShipmentHandoffIssueV1,
  correction?: PostDepartureSourceCandidateCorrectionRecord,
): boolean {
  if (
    issue.code === "CARGO_DETAIL_INCOMPLETE" &&
    correction?.cargoLines?.length
  ) {
    return true;
  }
  if (
    issue.code !== "UNKNOWN_REFERENCE_CODE" &&
    issue.code !== "DEPARTURE_PROOF_REQUIRED" &&
    issue.code !== "EXTERNAL_SHIPMENT_MATCH_REQUIRED"
  ) {
    return false;
  }
  return Boolean(
    issue.fieldCodes?.length &&
    issue.fieldCodes.every((fieldCode) => {
      if (!RESOLVED_FIELD_CODES.has(fieldCode)) return false;
      if (fieldCode === "shipment_grouping") {
        return Boolean(correction?.shipmentGroupingKind);
      }
      if (fieldCode === "origin_port_code") {
        return Boolean(correction?.originPortId);
      }
      if (fieldCode === "destination_port_code") {
        return Boolean(correction?.destinationPortId);
      }
      return Boolean(
        correction?.departureOccurredAt &&
        correction.departureSourceTimezone &&
        correction.departureEvidenceId,
      );
    }),
  );
}
