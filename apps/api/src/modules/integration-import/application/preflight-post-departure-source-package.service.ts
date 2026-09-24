import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PostDepartureSourceCandidateV1,
  PostDepartureSourceKindV1,
  PostDepartureSourcePackagePreflightCommandV1,
  PostDepartureSourcePackagePreflightResultV1,
  ShipmentHandoffIssueV1,
} from "@logix/contracts";
import { createHash, randomUUID } from "node:crypto";
import {
  REFERENCE_PORT_DIRECTORY,
  type ReferencePortDirectoryPort,
} from "../../master-data";
import {
  prepareLegacyDepartedSourceCandidate,
  type LegacyDepartedSourceRecord,
} from "../../shipment-lifecycle-orchestration";
import {
  IMPORT_REPOSITORY,
  type ImportBatchWithRows,
  type ImportRepository,
} from "../domain/import.repository";
import {
  applyPostDepartureCandidateCorrection,
  decoratePostDepartureIssue,
  isBlockingPostDepartureIssue,
} from "../domain/post-departure-candidate-correction";

const SOURCE_KINDS = [
  "container",
  "customs",
  "logistics",
  "warehouse",
] as const satisfies readonly PostDepartureSourceKindV1[];

const REQUIRED_HEADERS: Record<PostDepartureSourceKindV1, readonly string[]> = {
  container: ["箱号(集装箱号)", "备货单号", "提单号"],
  customs: ["集装箱号", "备货单号", "提单号"],
  logistics: ["集装箱号", "备货单号", "提单号"],
  warehouse: ["集装箱号", "备货单号", "提单号"],
};

type LoadedSource = {
  kind: PostDepartureSourceKindV1;
  batch: ImportBatchWithRows;
};

@Injectable()
export class PreflightPostDepartureSourcePackageService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
  ) {}

  async execute(
    command: unknown,
    tenantId: string,
  ): Promise<PostDepartureSourcePackagePreflightResultV1> {
    assertCommand(command);
    const requestedSources = [...command.sources].sort(
      (left, right) =>
        SOURCE_KINDS.indexOf(left.kind) - SOURCE_KINDS.indexOf(right.kind),
    );
    const sources = await Promise.all(
      requestedSources.map(async (source): Promise<LoadedSource> => {
        const kind = source.kind;
        const batch = await this.repository.findById(source.batchId, tenantId);
        if (!batch) throw new NotFoundException("SOURCE_BATCH_NOT_FOUND");
        assertSourceShape(kind, batch);
        return { kind, batch };
      }),
    );

    const rowsByKind = Object.fromEntries(
      SOURCE_KINDS.map((kind) => {
        const source = sources.find((item) => item.kind === kind);
        return [kind, source ? indexRows(kind, source.batch) : new Map()];
      }),
    ) as Record<
      PostDepartureSourceKindV1,
      Map<string, Record<string, string>[]>
    >;
    const containerNumbers = [
      ...new Set(sources.flatMap(({ kind }) => [...rowsByKind[kind].keys()])),
    ].sort();
    let candidates = containerNumbers.map((containerNumber) =>
      buildCandidate(containerNumber, sources, rowsByKind),
    );
    const packageId = createHash("sha256")
      .update(
        sources.map(({ kind, batch }) => `${kind}:${batch.batch.id}`).join("|"),
      )
      .digest("hex");
    const review =
      await this.repository.findPostDepartureSourcePackageReviewByPackage(
        tenantId,
        packageId,
      );
    if (review) {
      const corrections =
        await this.repository.listLatestPostDepartureSourceCandidateCorrections(
          review.id,
          tenantId,
        );
      if (corrections.length > 0) {
        const portRecords = await this.ports.findByIds(
          corrections
            .flatMap((correction) => [
              correction.originPortId,
              correction.destinationPortId,
            ])
            .filter((value): value is string => Boolean(value)),
        );
        const portsById = new Map(
          portRecords.map((port) => [port.portId, port]),
        );
        const correctionsByCandidate = new Map(
          corrections.map((correction) => [
            correction.candidateRef,
            correction,
          ]),
        );
        candidates = candidates.map((candidate) => {
          const correction = correctionsByCandidate.get(candidate.candidateRef);
          if (!correction) return candidate;
          const originPort = correction.originPortId
            ? portsById.get(correction.originPortId)
            : undefined;
          const destinationPort = correction.destinationPortId
            ? portsById.get(correction.destinationPortId)
            : undefined;
          if (
            (correction.originPortId && !originPort) ||
            (correction.destinationPortId && !destinationPort)
          ) {
            throw new BadRequestException("REFERENCE_PORT_HISTORY_MISSING");
          }
          return applyPostDepartureCandidateCorrection({
            candidate,
            correction,
            originPort,
            destinationPort,
          });
        });
      }
    }

    return {
      packageId,
      sources: sources.map(({ kind, batch }) => ({
        kind,
        batchId: batch.batch.id,
        fileName: batch.batch.fileName,
        rowCount: batch.batch.rowCount,
        columnCount: batch.batch.columnCount,
      })) as PostDepartureSourcePackagePreflightResultV1["sources"],
      candidates,
      totals: {
        containers: candidates.length,
        bills: uniqueCount(candidates.flatMap((item) => item.billNumbers)),
        replenishmentOrders: uniqueCount(
          candidates.flatMap((item) => item.replenishmentOrderNumbers),
        ),
        ready: candidates.filter((item) => item.decision === "ready").length,
        reviewRequired: candidates.filter(
          (item) => item.decision === "review_required",
        ).length,
        rejected: candidates.filter((item) => item.decision === "rejected")
          .length,
      },
      traceId: randomUUID(),
    };
  }
}

function assertCommand(
  command: unknown,
): asserts command is PostDepartureSourcePackagePreflightCommandV1 {
  if (
    !isRecord(command) ||
    command.contractVersion !== "post-departure-source-package-preflight.v1" ||
    !Array.isArray(command.sources)
  ) {
    throw new BadRequestException("SOURCE_PACKAGE_INCOMPLETE");
  }
  const sources = command.sources;
  if (
    sources.length < 1 ||
    sources.length > SOURCE_KINDS.length ||
    !sources.every(isSourceBatch) ||
    new Set(sources.map(({ kind }) => kind)).size !== sources.length
  ) {
    throw new BadRequestException("SOURCE_PACKAGE_INCOMPLETE");
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourceBatch(
  value: unknown,
): value is PostDepartureSourcePackagePreflightCommandV1["sources"][number] {
  return (
    isRecord(value) &&
    SOURCE_KINDS.includes(value.kind as PostDepartureSourceKindV1) &&
    typeof value.batchId === "string" &&
    UUID_PATTERN.test(value.batchId)
  );
}

function assertSourceShape(
  kind: PostDepartureSourceKindV1,
  batch: ImportBatchWithRows,
): void {
  const headers = new Set(batch.rows.flatMap((row) => Object.keys(row.values)));
  const missing = REQUIRED_HEADERS[kind].filter(
    (header) => !headers.has(header),
  );
  if (batch.rows.length === 0 || missing.length > 0) {
    throw new BadRequestException(
      `SOURCE_PACKAGE_SCHEMA_MISMATCH:${kind}:${missing.join(",")}`,
    );
  }
}

function indexRows(
  kind: PostDepartureSourceKindV1,
  batch: ImportBatchWithRows,
): Map<string, Record<string, string>[]> {
  const index = new Map<string, Record<string, string>[]>();
  const containerHeader = kind === "container" ? "箱号(集装箱号)" : "集装箱号";
  for (const row of batch.rows) {
    const containerNumber = normalize(row.values[containerHeader]);
    if (!containerNumber) continue;
    const current = index.get(containerNumber) ?? [];
    current.push(row.values);
    index.set(containerNumber, current);
  }
  return index;
}

function buildCandidate(
  containerNumber: string,
  sources: LoadedSource[],
  rowsByKind: Record<
    PostDepartureSourceKindV1,
    Map<string, Record<string, string>[]>
  >,
): PostDepartureSourceCandidateV1 {
  const rows = Object.fromEntries(
    SOURCE_KINDS.map((kind) => [
      kind,
      rowsByKind[kind].get(containerNumber) ?? [],
    ]),
  ) as Record<PostDepartureSourceKindV1, Record<string, string>[]>;
  const values = mergeSourceValues(rows);
  const identityIssues = collectIdentityIssues(
    containerNumber,
    rows,
    new Set(sources.map(({ kind }) => kind)),
  );
  const primarySource =
    sources.find(({ kind }) => rows[kind].length > 0) ?? sources[0]!;
  const record: LegacyDepartedSourceRecord = {
    sourceFile: primarySource.batch.batch.fileName,
    sourceSha256: primarySource.batch.batch.fileHash,
    sourceSheet: "列表数据",
    declaredRange: "A1",
    actualRange: toActualRange(primarySource.batch.batch),
    containerNumber,
    replenishmentOrderNumber: normalize(values["备货单号"]),
    billNumber: normalize(values["提单号"]),
    values,
  };
  const prepared = prepareLegacyDepartedSourceCandidate(record);
  const issues = deduplicateIssues([
    ...identityIssues,
    ...prepared.issues,
    issue(
      "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
      "shipment_handoff_external_shipment_match_required",
      containerNumber,
      ["shipment_grouping"],
    ),
  ]).map(decoratePostDepartureIssue);
  const rejected = issues.some(
    ({ code }) =>
      code === "INVALID_SOURCE_VALUE" || code === "DUPLICATE_REFERENCE",
  );

  return omitUndefined({
    candidateRef: containerNumber,
    decision: rejected
      ? "rejected"
      : issues.some(isBlockingPostDepartureIssue)
        ? "review_required"
        : "ready",
    containerNumber,
    replenishmentOrderNumbers: collectIdentity(rows, "备货单号"),
    billNumbers: collectIdentity(rows, "提单号"),
    carrierCode: prepared.observedShipment.carrierCode ?? undefined,
    vesselName: prepared.observedShipment.vesselName ?? undefined,
    voyageNumber: prepared.observedShipment.voyageNumber ?? undefined,
    originPortRaw: prepared.observedShipment.originPortRaw ?? undefined,
    destinationPortRaw:
      prepared.observedShipment.destinationPortRaw ?? undefined,
    cargoOwnerName:
      prepared.observedShipment.cargoOwnerName ??
      prepared.observedShipment.cargoOwnerNameRaw ??
      undefined,
    departureRaw: prepared.observedShipment.departureRaw ?? undefined,
    estimatedArrivalRaw:
      prepared.observedShipment.estimatedArrivalRaw ?? undefined,
    containerTypeCode:
      prepared.observedContainer.containerTypeCode ?? undefined,
    packageCount: prepared.observedContainer.packageCount ?? undefined,
    grossWeightKg: prepared.observedContainer.grossWeightKg ?? undefined,
    volumeM3: prepared.observedContainer.volumeM3 ?? undefined,
    issues,
  }) as PostDepartureSourceCandidateV1;
}

function mergeSourceValues(
  rows: Record<PostDepartureSourceKindV1, Record<string, string>[]>,
): Record<string, string> {
  const values = Object.assign(
    {},
    rows.warehouse[0] ?? {},
    rows.logistics[0] ?? {},
    rows.customs[0] ?? {},
    rows.container[0] ?? {},
  );
  values["预计到港日期"] = firstValue(
    values["预计到港日期(ETA)"],
    values["ETA修正（组织）"],
    values["ETA修正"],
  );
  return values;
}

function collectIdentityIssues(
  containerNumber: string,
  rows: Record<PostDepartureSourceKindV1, Record<string, string>[]>,
  providedKinds: ReadonlySet<PostDepartureSourceKindV1>,
): ShipmentHandoffIssueV1[] {
  const issues: ShipmentHandoffIssueV1[] = [];
  for (const kind of SOURCE_KINDS) {
    if (rows[kind].length === 0) {
      issues.push(
        issue(
          "SOURCE_DATA_INCOMPLETE",
          providedKinds.has(kind)
            ? "shipment_handoff_source_row_missing"
            : "shipment_handoff_source_not_provided",
          containerNumber,
          [`source.${kind}`],
        ),
      );
    } else if (rows[kind].length > 1) {
      issues.push(
        issue(
          "DUPLICATE_REFERENCE",
          "shipment_handoff_source_row_duplicate",
          containerNumber,
          [`source.${kind}`],
        ),
      );
    }
  }
  for (const field of ["备货单号", "提单号"] as const) {
    if (collectIdentity(rows, field).length > 1) {
      issues.push(
        issue(
          "FIELD_SEMANTIC_MISMATCH",
          "shipment_handoff_cross_source_identity_mismatch",
          containerNumber,
          [field === "备货单号" ? "replenishment_order" : "bill_of_lading"],
        ),
      );
    }
  }
  return issues;
}

function collectIdentity(
  rows: Record<PostDepartureSourceKindV1, Record<string, string>[]>,
  field: string,
): string[] {
  return [
    ...new Set(
      SOURCE_KINDS.flatMap((kind) => rows[kind])
        .map((row) => normalize(row[field]))
        .filter(Boolean),
    ),
  ].sort();
}

function issue(
  code: ShipmentHandoffIssueV1["code"],
  messageKey: string,
  subjectRef: string,
  fieldCodes: string[],
): ShipmentHandoffIssueV1 {
  return { code, messageKey, subjectRef, fieldCodes };
}

function deduplicateIssues(
  issues: ShipmentHandoffIssueV1[],
): ShipmentHandoffIssueV1[] {
  const seen = new Set<string>();
  return issues.filter((current) => {
    const key = `${current.code}:${current.subjectRef ?? ""}:${(current.fieldCodes ?? []).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toActualRange(batch: ImportBatchWithRows["batch"]): string {
  return `A1:${columnName(batch.columnCount)}${batch.rowCount + 1}`;
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result || "A";
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstValue(...values: unknown[]): string {
  return values.map(normalize).find(Boolean) ?? "";
}

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
