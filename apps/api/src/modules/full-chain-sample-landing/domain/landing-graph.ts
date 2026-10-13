import {
  canonicalStringify,
  compareCanonicalStrings,
  sha256Hex,
  type BookingCommitmentRecord,
  type CargoReadyReleaseRecord,
  type DispatchFactRecord,
  type ExportCustomsCaseRecord,
  type FullChainCanonicalRecord,
  type FullChainRecordType,
  type ShipmentPlanRecord,
  type StuffingSnapshotLineRecord,
  type ValidatedFullChainPackage,
} from "@logix/full-chain-sample-contracts";
import { landingGraphError } from "./landing-errors";

export type TypedDocumentRef = {
  type: "mbl" | "hbl";
  number: string;
};
export type ShipmentPlanFactInput = {
  planNumber: string;
  bookingNumber: string;
  payloadHash: string;
};
export type BookingCommitmentFactInput = {
  bookingNumber: string;
  displayGroupRefs: string[];
  payloadHash: string;
};
export type BookingDocumentInput = {
  bookingNumber: string;
  documentType: "mbl" | "hbl";
  number: string;
  parentMasterBillNumber: string | null;
};
export type CargoReadyReleaseFactInput = {
  cargoReadyNumber: string;
  displayGroupRef: string;
  quantity: string;
  payloadHash: string;
};
export type PlanCargoReadyLinkInput = {
  planNumber: string;
  cargoReadyNumber: string;
};
export type StuffingLineFactInput = {
  businessKey: string;
  containerNumber: string;
  cargoReadyNumber: string;
  sku: string;
  houseBillNumber: string;
  quantity: string;
  grossWeight: string;
  volume: string;
  payloadHash: string;
};
export type ExportCustomsCaseFactInput = {
  invoiceNumber: string;
  houseBillNumber: string;
  declarationNumber: string;
  amount: string;
  currency: string;
  payloadHash: string;
};
export type DispatchFactInput = {
  containerNumber: string;
  vesselName: string;
  voyageNumber: string;
  masterBillNumber: string;
  gateInDate: string;
  departedAt: string;
  departedPrecision: "date";
  motherVesselDepartedAt: string;
  payloadHash: string;
};
export type DispatchHouseBillLinkInput = {
  containerNumber: string;
  houseBillNumber: string;
};
export type LandingRecordReceiptInput = {
  recordType: FullChainRecordType;
  targetRef: string;
  businessKeyHash: string;
  recordHash: string;
  sourceRefHash: string;
};
export type LandingGapInput = {
  code: string;
  status: string;
  recordRefHash: string | null;
};
export type FullChainLandingGraph = {
  packageHash: string;
  plans: ShipmentPlanFactInput[];
  bookings: BookingCommitmentFactInput[];
  documents: BookingDocumentInput[];
  cargoReadyReleases: CargoReadyReleaseFactInput[];
  planCargoReadyLinks: PlanCargoReadyLinkInput[];
  stuffingLines: StuffingLineFactInput[];
  exportCustomsCases: ExportCustomsCaseFactInput[];
  dispatchFacts: DispatchFactInput[];
  dispatchHouseBillLinks: DispatchHouseBillLinkInput[];
  recordReceipts: LandingRecordReceiptInput[];
  gaps: LandingGapInput[];
};

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
  return items.sort((left, right) =>
    compareCanonicalStrings(key(left), key(right)),
  );
}
function payloadHash(record: FullChainCanonicalRecord): string {
  return sha256Hex(canonicalStringify(record.payload));
}
function recordsOf<T extends FullChainRecordType>(
  records: FullChainCanonicalRecord[],
  recordType: T,
): Extract<FullChainCanonicalRecord, { recordType: T }>[] {
  return records.filter(
    (record): record is Extract<FullChainCanonicalRecord, { recordType: T }> =>
      record.recordType === recordType,
  );
}
function assertUnique(records: FullChainCanonicalRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.recordType}:${record.businessKey}`;
    if (seen.has(key)) landingGraphError("FULL_CHAIN_DUPLICATE_BUSINESS_KEY");
    seen.add(key);
  }
}
function assertTypedBill(number: string): void {
  if (number.includes(" / ") || /^AMS(?:-|$)/u.test(number))
    landingGraphError("FULL_CHAIN_TYPED_REFERENCE_INVALID");
}
function adaptShipmentPlans(
  records: ShipmentPlanRecord[],
): ShipmentPlanFactInput[] {
  return sortBy(
    records.map((record) => ({
      planNumber: record.payload.planNo,
      bookingNumber: record.payload.bookingNo,
      payloadHash: payloadHash(record),
    })),
    (item) => item.planNumber,
  );
}
function adaptBookings(records: BookingCommitmentRecord[]): {
  bookings: BookingCommitmentFactInput[];
  documents: BookingDocumentInput[];
} {
  const bookings = records.map((record) => ({
    bookingNumber: record.payload.bookingNo,
    displayGroupRefs: [...record.payload.containerRefs],
    payloadHash: payloadHash(record),
  }));
  const documents = records.flatMap((record) => {
    assertTypedBill(record.payload.masterBillNo);
    for (const houseBillNo of record.payload.houseBillRefs)
      assertTypedBill(houseBillNo);
    return [
      {
        bookingNumber: record.payload.bookingNo,
        documentType: "mbl" as const,
        number: record.payload.masterBillNo,
        parentMasterBillNumber: null,
      },
      ...record.payload.houseBillRefs.map((houseBillNo) => ({
        bookingNumber: record.payload.bookingNo,
        documentType: "hbl" as const,
        number: houseBillNo,
        parentMasterBillNumber: record.payload.masterBillNo,
      })),
    ];
  });
  return {
    bookings: sortBy(bookings, (item) => item.bookingNumber),
    documents: sortBy(
      documents,
      (item) => `${item.bookingNumber}|${item.documentType}|${item.number}`,
    ),
  };
}
function adaptCargoReady(
  records: CargoReadyReleaseRecord[],
): CargoReadyReleaseFactInput[] {
  return sortBy(
    records.map((record) => ({
      cargoReadyNumber: record.payload.cargoReadyNo,
      displayGroupRef: record.payload.planNo,
      quantity: record.payload.quantity,
      payloadHash: payloadHash(record),
    })),
    (item) => item.cargoReadyNumber,
  );
}
function adaptStuffing(
  records: StuffingSnapshotLineRecord[],
): StuffingLineFactInput[] {
  return sortBy(
    records.map((record) => {
      assertTypedBill(record.payload.houseBillNo);
      return {
        businessKey: record.businessKey,
        containerNumber: record.payload.containerNo,
        cargoReadyNumber: record.payload.cargoReadyNo,
        sku: record.payload.sku,
        houseBillNumber: record.payload.houseBillNo,
        quantity: record.payload.quantity,
        grossWeight: record.payload.grossWeight,
        volume: record.payload.volume,
        payloadHash: payloadHash(record),
      };
    }),
    (item) => item.businessKey,
  );
}
function adaptExportCustoms(
  records: ExportCustomsCaseRecord[],
): ExportCustomsCaseFactInput[] {
  return sortBy(
    records.map((record) => {
      assertTypedBill(record.payload.houseBillNo);
      return {
        invoiceNumber: record.payload.invoiceNo,
        houseBillNumber: record.payload.houseBillNo,
        declarationNumber: record.payload.declarationNo,
        amount: record.payload.amount,
        currency: record.payload.currency,
        payloadHash: payloadHash(record),
      };
    }),
    (item) => item.invoiceNumber,
  );
}
function adaptDispatch(records: DispatchFactRecord[]): {
  dispatchFacts: DispatchFactInput[];
  dispatchHouseBillLinks: DispatchHouseBillLinkInput[];
} {
  const dispatchFacts = records.map((record) => {
    assertTypedBill(record.payload.masterBillNo);
    for (const houseBillNo of record.payload.houseBillRefs)
      assertTypedBill(houseBillNo);
    return {
      containerNumber: record.payload.containerNo,
      vesselName: record.payload.vesselName,
      voyageNumber: record.payload.voyageNo,
      masterBillNumber: record.payload.masterBillNo,
      gateInDate: record.payload.gateInDate,
      departedAt: record.payload.departedAt,
      departedPrecision: record.payload.departedPrecision,
      motherVesselDepartedAt: record.payload.motherVesselDepartedAt,
      payloadHash: payloadHash(record),
    };
  });
  const dispatchHouseBillLinks = records.flatMap((record) =>
    record.payload.houseBillRefs.map((houseBillNumber) => ({
      containerNumber: record.payload.containerNo,
      houseBillNumber,
    })),
  );
  return {
    dispatchFacts: sortBy(dispatchFacts, (item) => item.containerNumber),
    dispatchHouseBillLinks: sortBy(
      dispatchHouseBillLinks,
      (item) => `${item.containerNumber}|${item.houseBillNumber}`,
    ),
  };
}
function assertLineage(packageArtifacts: ValidatedFullChainPackage): void {
  const lineageByRecord = new Map<string, Array<Record<string, unknown>>>();
  const lineageSourceRefs = new Set<string>();
  for (const item of packageArtifacts.lineage) {
    const recordRef = String(item.recordRef ?? "");
    const sourceRef = String(item.sourceRef ?? "");
    lineageSourceRefs.add(sourceRef);
    lineageByRecord.set(recordRef, [
      ...(lineageByRecord.get(recordRef) ?? []),
      item,
    ]);
  }
  for (const record of packageArtifacts.records) {
    const recordRef = `${record.recordType}:${record.businessKey}`;
    const matches = lineageByRecord.get(recordRef) ?? [];
    const actualRefs = new Set(
      matches.map((item) => String(item.sourceRef ?? "")),
    );
    const expectedRefs = record.aggregation?.contributorRefs
      ? new Set(record.aggregation.contributorRefs)
      : new Set([record.source.sourceRef]);
    if (
      matches.length !== expectedRefs.size ||
      actualRefs.size !== expectedRefs.size ||
      [...expectedRefs].some((sourceRef) => !actualRefs.has(sourceRef))
    )
      landingGraphError("FULL_CHAIN_LINEAGE_INCOMPLETE");
    if (record.aggregation?.code === "FC-D07") {
      const contributors = record.aggregation.contributorRefs;
      if (
        contributors.length < 2 ||
        contributors.some((inputRef) => !lineageSourceRefs.has(inputRef))
      )
        landingGraphError("FULL_CHAIN_LINEAGE_INCOMPLETE");
    }
    if (record.derivation?.code === "FC-D07") {
      const contributors = record.derivation.contributorRefs ?? [];
      if (
        contributors.length < 2 ||
        contributors.length !== record.derivation.inputRefs.length ||
        contributors.some(
          (inputRef) =>
            !record.derivation?.inputRefs.includes(inputRef) ||
            !lineageSourceRefs.has(inputRef),
        )
      )
        landingGraphError("FULL_CHAIN_LINEAGE_INCOMPLETE");
    }
    if (
      record.derivation?.inputRefs.some(
        (inputRef) => !lineageSourceRefs.has(inputRef),
      )
    )
      landingGraphError("FULL_CHAIN_LINEAGE_INCOMPLETE");
  }
}
function assertDocumentOwnership(documents: BookingDocumentInput[]): void {
  const owners = new Map<string, string>();
  for (const document of documents) {
    const key = `${document.documentType}:${document.number}`;
    const owner = owners.get(key);
    if (owner && owner !== document.bookingNumber)
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_AMBIGUOUS");
    owners.set(key, document.bookingNumber);
  }
}
function assertReferences(graph: FullChainLandingGraph): void {
  assertDocumentOwnership(graph.documents);
  const bookings = new Set(graph.bookings.map((item) => item.bookingNumber));
  const cargoReady = new Set(
    graph.cargoReadyReleases.map((item) => item.cargoReadyNumber),
  );
  const mbls = new Set(
    graph.documents
      .filter((item) => item.documentType === "mbl")
      .map((item) => item.number),
  );
  const hbls = new Set(
    graph.documents
      .filter((item) => item.documentType === "hbl")
      .map((item) => item.number),
  );
  for (const plan of graph.plans)
    if (!bookings.has(plan.bookingNumber))
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
  for (const link of graph.planCargoReadyLinks)
    if (!cargoReady.has(link.cargoReadyNumber))
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
  for (const line of graph.stuffingLines)
    if (
      !cargoReady.has(line.cargoReadyNumber) ||
      !hbls.has(line.houseBillNumber)
    )
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
  for (const customsCase of graph.exportCustomsCases)
    if (!hbls.has(customsCase.houseBillNumber))
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
  for (const dispatch of graph.dispatchFacts)
    if (!mbls.has(dispatch.masterBillNumber))
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
  for (const link of graph.dispatchHouseBillLinks)
    if (!hbls.has(link.houseBillNumber))
      landingGraphError("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
}

function semanticDecimal(value: string): string {
  if (!value.includes(".")) return value;
  const normalized = value.replace(/0+$/u, "").replace(/\.$/u, "");
  return normalized === "-0" ? "0" : normalized;
}

export function fullChainLandingProjectionHash(
  graph: FullChainLandingGraph,
): string {
  return sha256Hex(
    canonicalStringify({
      plans: graph.plans,
      bookings: graph.bookings,
      documents: graph.documents,
      cargoReadyReleases: graph.cargoReadyReleases.map((item) => ({
        ...item,
        quantity: semanticDecimal(item.quantity),
      })),
      planCargoReadyLinks: graph.planCargoReadyLinks,
      stuffingLines: graph.stuffingLines.map((item) => ({
        ...item,
        quantity: semanticDecimal(item.quantity),
        grossWeight: semanticDecimal(item.grossWeight),
        volume: semanticDecimal(item.volume),
      })),
      exportCustomsCases: graph.exportCustomsCases.map((item) => ({
        ...item,
        amount: semanticDecimal(item.amount),
      })),
      dispatchFacts: graph.dispatchFacts,
      dispatchHouseBillLinks: graph.dispatchHouseBillLinks,
      recordReceipts: graph.recordReceipts.map((receipt) => ({
        recordType: receipt.recordType,
        businessKeyHash: receipt.businessKeyHash,
        recordHash: receipt.recordHash,
        sourceRefHash: receipt.sourceRefHash,
      })),
      gaps: graph.gaps,
    }),
  );
}

export function buildFullChainLandingGraph(
  packageArtifacts: ValidatedFullChainPackage,
): FullChainLandingGraph {
  assertUnique(packageArtifacts.records);
  assertLineage(packageArtifacts);
  const plans = recordsOf(packageArtifacts.records, "shipment_plan");
  const bookingRecords = recordsOf(
    packageArtifacts.records,
    "booking_commitment",
  );
  const cargoReadyRecords = recordsOf(
    packageArtifacts.records,
    "cargo_ready_release",
  );
  const stuffingRecords = recordsOf(
    packageArtifacts.records,
    "stuffing_snapshot_line",
  );
  const customsRecords = recordsOf(
    packageArtifacts.records,
    "export_customs_case",
  );
  const dispatchRecords = recordsOf(packageArtifacts.records, "dispatch_fact");
  const { bookings, documents } = adaptBookings(bookingRecords);
  const { dispatchFacts, dispatchHouseBillLinks } =
    adaptDispatch(dispatchRecords);
  const graph: FullChainLandingGraph = {
    packageHash: packageArtifacts.manifest.packageHash,
    plans: adaptShipmentPlans(plans),
    bookings,
    documents,
    cargoReadyReleases: adaptCargoReady(cargoReadyRecords),
    planCargoReadyLinks: sortBy(
      plans.flatMap((record) =>
        record.payload.containerRefs.map((cargoReadyNumber) => ({
          planNumber: record.payload.planNo,
          cargoReadyNumber,
        })),
      ),
      (item) => `${item.planNumber}|${item.cargoReadyNumber}`,
    ),
    stuffingLines: adaptStuffing(stuffingRecords),
    exportCustomsCases: adaptExportCustoms(customsRecords),
    dispatchFacts,
    dispatchHouseBillLinks,
    recordReceipts: sortBy(
      packageArtifacts.records.map((record) => ({
        recordType: record.recordType,
        targetRef: `${record.recordType}:${record.businessKey}`,
        businessKeyHash: sha256Hex(record.businessKey),
        recordHash: sha256Hex(canonicalStringify(record)),
        sourceRefHash: sha256Hex(record.source.sourceRef),
      })),
      (item) => `${item.recordType}|${item.businessKeyHash}`,
    ),
    gaps: sortBy(
      packageArtifacts.gaps.map((gap) => ({
        code: String(gap.code ?? ""),
        status: String(gap.status ?? ""),
        recordRefHash:
          typeof gap.recordRef === "string" ? sha256Hex(gap.recordRef) : null,
      })),
      (item) => `${item.code}|${item.recordRefHash ?? ""}`,
    ),
  };
  assertReferences(graph);
  return graph;
}
