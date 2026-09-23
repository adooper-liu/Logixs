import { createHash } from "node:crypto";
import type {
  ContainerHandoffV1,
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
  ShipmentHandoffPreflightResultV1,
} from "@logix/contracts";

export interface NormalizedShipmentHandoffPreflight {
  command: ShipmentHandoffCommandV1;
  result: ShipmentHandoffPreflightResultV1;
}

export function preflightShipmentHandoff(
  input: ShipmentHandoffCommandV1,
): NormalizedShipmentHandoffPreflight {
  const command = normalizeShipmentHandoff(input);
  const issues: ShipmentHandoffIssueV1[] = [];

  validateUniqueReferences(command, issues);
  validateVersionChain(command, issues);
  validateSourceProfile(command, issues);
  validateBillReferences(command, issues);
  validateCargoAndUpstreamReferences(command, issues);

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(command), "utf8")
    .digest("hex");
  const decision = issues.some((issue) =>
    isRejectingShipmentHandoffIssue(issue.code),
  )
    ? "rejected"
    : issues.length > 0
      ? "review_required"
      : "ready";

  return {
    command,
    result: {
      decision,
      payloadHash,
      issues,
      traceId: command.source.traceId,
    },
  };
}

function validateVersionChain(
  command: ShipmentHandoffCommandV1,
  issues: ShipmentHandoffIssueV1[],
): void {
  const correction = command.source.handoffVersion > 1;
  if (correction && !command.source.supersedesExternalHandoffId) {
    issues.push({
      code: "SUPERSEDED_HANDOFF_NOT_FOUND",
      fieldCodes: ["supersedes_external_handoff_id"],
      messageKey: "shipment_handoff_superseded_handoff_required",
    });
  }
  if (!correction && command.source.supersedesExternalHandoffId) {
    issues.push({
      code: "INVALID_SOURCE_VALUE",
      fieldCodes: ["supersedes_external_handoff_id"],
      messageKey: "shipment_handoff_first_version_cannot_supersede",
    });
  }
  if (correction && !command.shipment.expectedRelationshipVersion) {
    issues.push({
      code: "INVALID_SOURCE_VALUE",
      fieldCodes: ["expected_relationship_version"],
      messageKey: "shipment_handoff_expected_relationship_version_required",
    });
  }
}

function normalizeShipmentHandoff(
  input: ShipmentHandoffCommandV1,
): ShipmentHandoffCommandV1 {
  return {
    ...input,
    source: { ...input.source },
    shipment: { ...input.shipment },
    billsOfLading: [...input.billsOfLading]
      .map((bill) => ({ ...bill }))
      .sort((left, right) =>
        left.referenceId.localeCompare(right.referenceId),
      ) as ShipmentHandoffCommandV1["billsOfLading"],
    containers: [...input.containers]
      .map(normalizeContainer)
      .sort((left, right) =>
        left.referenceId.localeCompare(right.referenceId),
      ) as ShipmentHandoffCommandV1["containers"],
    documentReferences: [...(input.documentReferences ?? [])].sort(),
    evidenceReferences: [
      ...input.evidenceReferences,
    ].sort() as ShipmentHandoffCommandV1["evidenceReferences"],
  };
}

function normalizeContainer(input: ContainerHandoffV1): ContainerHandoffV1 {
  return {
    ...input,
    billReferences: [
      ...input.billReferences,
    ].sort() as ContainerHandoffV1["billReferences"],
    upstreamReferences: [...input.upstreamReferences].sort((left, right) =>
      [
        left.referenceType,
        left.sourceSystem,
        left.sourceRecordId,
        left.sourceLineId ?? "",
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.referenceType,
            right.sourceSystem,
            right.sourceRecordId,
            right.sourceLineId ?? "",
          ].join("\u0000"),
        ),
    ),
    ...(input.cargoAllocations
      ? {
          cargoAllocations: [...input.cargoAllocations].sort((left, right) =>
            left.sourceLineId.localeCompare(right.sourceLineId),
          ) as NonNullable<ContainerHandoffV1["cargoAllocations"]>,
        }
      : {}),
  };
}

function validateUniqueReferences(
  command: ShipmentHandoffCommandV1,
  issues: ShipmentHandoffIssueV1[],
): void {
  addDuplicateIssues(
    command.billsOfLading.map(({ referenceId }) => referenceId),
    "bills_of_lading",
    issues,
  );
  addDuplicateIssues(
    command.containers.map(({ referenceId }) => referenceId),
    "containers",
    issues,
  );
  addDuplicateIssues(
    command.containers.map(({ containerNumber }) => containerNumber),
    "container_numbers",
    issues,
  );
  for (const container of command.containers) {
    addDuplicateIssues(
      (container.cargoAllocations ?? []).map(
        ({ sourceLineId }) => sourceLineId,
      ),
      `cargo_${container.referenceId}`,
      issues,
    );
    addDuplicateIssues(
      container.upstreamReferences.map((reference) =>
        [
          reference.referenceType,
          reference.sourceSystem,
          reference.sourceRecordId,
          reference.sourceLineId ?? "",
        ].join("\u0000"),
      ),
      `upstream_${container.referenceId}`,
      issues,
    );
  }
}

function addDuplicateIssues(
  values: string[],
  subjectRef: string,
  issues: ShipmentHandoffIssueV1[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push({
        code: "DUPLICATE_REFERENCE",
        subjectRef,
        messageKey: "shipment_handoff_duplicate_reference",
      });
      return;
    }
    seen.add(value);
  }
}

function validateSourceProfile(
  command: ShipmentHandoffCommandV1,
  issues: ShipmentHandoffIssueV1[],
): void {
  if (command.sourceProfile === "legacy_departed_file_v1") {
    if (!command.source.sourceBatchId) {
      issues.push({
        code: "SOURCE_BATCH_REQUIRED",
        fieldCodes: ["source_batch_id"],
        messageKey: "shipment_handoff_source_batch_required",
      });
    }
    if (!command.source.mappingVersion) {
      issues.push({
        code: "MAPPING_VERSION_REQUIRED",
        fieldCodes: ["mapping_version"],
        messageKey: "shipment_handoff_mapping_version_required",
      });
    }
    if (!command.shipment.externalShipmentId) {
      issues.push({
        code: "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
        fieldCodes: ["external_shipment_id"],
        messageKey: "shipment_handoff_external_match_required",
      });
    }
    for (const container of command.containers) {
      if (!container.cargoAllocations?.length) {
        issues.push({
          code: "CARGO_DETAIL_INCOMPLETE",
          subjectRef: container.referenceId,
          fieldCodes: ["cargo_allocations"],
          messageKey: "shipment_handoff_cargo_detail_incomplete",
        });
      }
    }
    return;
  }

  if (!command.shipment.externalShipmentId) {
    issues.push({
      code: "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
      fieldCodes: ["external_shipment_id"],
      messageKey: "shipment_handoff_external_shipment_required",
    });
  }
  for (const container of command.containers) {
    if (command.sourceProfile === "packing_platform_v1") {
      if (!container.stuffingSnapshotRef) {
        issues.push({
          code: "STUFFING_SNAPSHOT_REQUIRED",
          subjectRef: container.referenceId,
          fieldCodes: ["stuffing_snapshot_ref"],
          messageKey: "shipment_handoff_stuffing_snapshot_required",
        });
      }
    }
    if (!container.cargoAllocations?.length) {
      issues.push({
        code: "CARGO_ALLOCATION_REQUIRED",
        subjectRef: container.referenceId,
        fieldCodes: ["cargo_allocations"],
        messageKey: "shipment_handoff_cargo_allocation_required",
      });
    }
  }
}

function validateCargoAndUpstreamReferences(
  command: ShipmentHandoffCommandV1,
  issues: ShipmentHandoffIssueV1[],
): void {
  const cargoBySourceLine = new Map<string, string>();
  for (const container of command.containers) {
    for (const cargo of container.cargoAllocations ?? []) {
      const identity = JSON.stringify({
        productSkuId: cargo.productSkuId ?? null,
        productNumber: cargo.productNumber,
        quantityUnit: cargo.quantityUnit,
        packageUnit: cargo.packageUnit ?? null,
        weightUnit: cargo.weightUnit ?? null,
        volumeUnit: cargo.volumeUnit ?? null,
        replenishmentOrderLineId: cargo.replenishmentOrderLineId ?? null,
      });
      const existing = cargoBySourceLine.get(cargo.sourceLineId);
      if (existing && existing !== identity) {
        issues.push({
          code: "INVALID_SOURCE_VALUE",
          subjectRef: cargo.sourceLineId,
          fieldCodes: ["cargo_allocations"],
          messageKey: "shipment_handoff_cargo_source_line_inconsistent",
        });
      } else {
        cargoBySourceLine.set(cargo.sourceLineId, identity);
      }
    }
  }
  for (const container of command.containers) {
    for (const reference of container.upstreamReferences) {
      if (
        reference.sourceLineId &&
        !cargoBySourceLine.has(reference.sourceLineId)
      ) {
        issues.push({
          code: "INVALID_SOURCE_VALUE",
          subjectRef: reference.sourceLineId,
          fieldCodes: ["upstream_references"],
          messageKey: "shipment_handoff_upstream_source_line_not_found",
        });
      }
    }
  }
}

function validateBillReferences(
  command: ShipmentHandoffCommandV1,
  issues: ShipmentHandoffIssueV1[],
): void {
  const bills = new Map(
    command.billsOfLading.map((bill) => [bill.referenceId, bill]),
  );
  for (const bill of command.billsOfLading) {
    if (
      bill.parentReferenceId &&
      (!bills.has(bill.parentReferenceId) ||
        bill.parentReferenceId === bill.referenceId)
    ) {
      issues.push({
        code: "BILL_REFERENCE_NOT_FOUND",
        subjectRef: bill.referenceId,
        fieldCodes: ["parent_bill_reference"],
        messageKey: "shipment_handoff_parent_bill_not_found",
      });
    }
  }
  for (const container of command.containers) {
    for (const billReference of container.billReferences) {
      if (!bills.has(billReference)) {
        issues.push({
          code: "BILL_REFERENCE_NOT_FOUND",
          subjectRef: container.referenceId,
          fieldCodes: ["bill_references"],
          messageKey: "shipment_handoff_bill_reference_not_found",
        });
      }
    }
  }
}

export function isRejectingShipmentHandoffIssue(
  code: ShipmentHandoffIssueV1["code"],
): boolean {
  return new Set<ShipmentHandoffIssueV1["code"]>([
    "SOURCE_BATCH_REQUIRED",
    "MAPPING_VERSION_REQUIRED",
    "STUFFING_SNAPSHOT_REQUIRED",
    "CARGO_ALLOCATION_REQUIRED",
    "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
    "CONTAINER_SOURCE_IDENTITY_CONFLICT",
    "IDEMPOTENCY_PAYLOAD_CONFLICT",
    "SHIPMENT_SOURCE_IDENTITY_CONFLICT",
    "SHIPMENT_NUMBER_CONFLICT",
    "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT",
    "STUFFING_SNAPSHOT_VERSION_STALE",
    "BILL_REFERENCE_NOT_FOUND",
    "DUPLICATE_REFERENCE",
    "INVALID_SOURCE_VALUE",
    "SUPERSEDED_HANDOFF_NOT_FOUND",
  ]).has(code);
}
