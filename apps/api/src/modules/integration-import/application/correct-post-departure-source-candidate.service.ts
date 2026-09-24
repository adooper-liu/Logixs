import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PostDepartureShipmentGroupingV1,
  PostDepartureSourceCandidateCorrectionCommandV1,
  PostDepartureSourceCandidateCorrectionResultV1,
} from "@logix/contracts";
import { createHash, randomUUID } from "node:crypto";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  REFERENCE_PORT_DIRECTORY,
  type ReferencePortDirectoryPort,
} from "../../master-data";
import { GetShipmentService } from "../../shipment-registry";
import {
  IMPORT_REPOSITORY,
  PostDepartureCorrectionIdempotencyConflictError,
  PostDepartureCorrectionVersionConflictError,
  type ImportRepository,
} from "../domain/import.repository";
import { applyPostDepartureCandidateCorrection } from "../domain/post-departure-candidate-correction";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const STABLE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const OFFSET_DATETIME_PATTERN = /(?:Z|[+-][0-9]{2}:[0-9]{2})$/;
const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

@Injectable()
export class CorrectPostDepartureSourceCandidateService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    private readonly getShipment: GetShipmentService,
  ) {}

  async execute(
    packageId: string,
    reviewId: string,
    candidateRef: string,
    command: unknown,
    tenantId: string,
    operatorId: string,
  ): Promise<PostDepartureSourceCandidateCorrectionResultV1> {
    assertCommand(packageId, reviewId, candidateRef, command);
    const review =
      await this.repository.findPostDepartureSourcePackageReviewById(
        reviewId,
        tenantId,
      );
    if (!review) throw new NotFoundException("SOURCE_PACKAGE_REVIEW_NOT_FOUND");
    if (review.packageHash !== packageId) {
      throw new BadRequestException("SOURCE_PACKAGE_REVIEW_MISMATCH");
    }
    const candidate = review.snapshot.candidates.find(
      (item) => item.candidateRef === candidateRef,
    );
    if (!candidate) {
      throw new NotFoundException("SOURCE_PACKAGE_CANDIDATE_NOT_FOUND");
    }
    const current = (
      await this.repository.listLatestPostDepartureSourceCandidateCorrections(
        reviewId,
        tenantId,
      )
    ).find((item) => item.candidateRef === candidateRef);

    const originPortCode = nullableText(command.originPortCode);
    const destinationPortCode = nullableText(command.destinationPortCode);
    const selectedPortCodes = [originPortCode, destinationPortCode].filter(
      (value): value is string => Boolean(value),
    );
    const selectedPorts = selectedPortCodes.length
      ? await this.ports.findByUnlocodes(selectedPortCodes)
      : [];
    const byCode = new Map(selectedPorts.map((port) => [port.unlocode, port]));
    const originPort = originPortCode ? byCode.get(originPortCode) : undefined;
    const destinationPort = destinationPortCode
      ? byCode.get(destinationPortCode)
      : undefined;
    if (
      (originPortCode && !originPort) ||
      (destinationPortCode && !destinationPort)
    ) {
      throw new BadRequestException("REFERENCE_PORT_NOT_ACTIVE");
    }
    const legacyProof = command.departureProof;
    const departureLocal = nullableText(command.departureLocal);
    const departureSourceTimezone =
      nullableText(command.departureSourceTimezone) ??
      legacyProof?.sourceTimezone ??
      null;
    const departureEvidenceId =
      nullableText(command.departureEvidenceRef) ??
      legacyProof?.evidenceRef ??
      null;
    if (departureSourceTimezone && !isIanaTimezone(departureSourceTimezone)) {
      throw new BadRequestException("SOURCE_TIMEZONE_INVALID");
    }
    if (departureEvidenceId) {
      await this.assertEvidenceRefs.execute({
        tenantId,
        subjectType: "domain_fact",
        subjectId: reviewId,
        evidenceIds: [departureEvidenceId],
      });
    }
    const shipmentGrouping = command.shipmentGrouping
      ? normalizeGrouping(command.shipmentGrouping)
      : null;
    if (shipmentGrouping?.kind === "existing_shipment") {
      const target = await this.getShipment.execute({
        tenantId,
        id: shipmentGrouping.shipmentId,
      });
      if (
        target.shipment.relationshipVersion !==
        shipmentGrouping.expectedRelationshipVersion
      ) {
        throw new ConflictException("TARGET_SHIPMENT_VERSION_CONFLICT");
      }
      if (target.shipment.currentLifecycleStatus !== "departed") {
        throw new ConflictException("TARGET_SHIPMENT_NOT_DEPARTED");
      }
    }

    const departureOccurredAt = legacyProof
      ? new Date(legacyProof.occurredAt)
      : departureLocal && departureSourceTimezone
        ? zonedLocalDateTimeToDate(departureLocal, departureSourceTimezone)
        : null;
    const normalized = {
      contractVersion: command.contractVersion,
      packageId,
      reviewId,
      candidateRef,
      expectedVersion: command.expectedVersion,
      shipmentGrouping,
      originPortCode,
      destinationPortCode,
      departureLocal,
      departureSourceTimezone,
      departureEvidenceRef: departureEvidenceId,
      reasonCode: command.reasonCode,
      idempotencyKey: command.idempotencyKey.trim(),
    };

    try {
      const saved =
        await this.repository.savePostDepartureSourceCandidateCorrection({
          id: randomUUID(),
          tenantId,
          reviewId,
          candidateRef,
          expectedVersion: normalized.expectedVersion,
          ...groupingPersistence(normalized.shipmentGrouping),
          originPortId: originPort?.portId ?? null,
          originUnlocode: originPort?.unlocode ?? null,
          destinationPortId: destinationPort?.portId ?? null,
          destinationUnlocode: destinationPort?.unlocode ?? null,
          departureLocal,
          departureOccurredAt,
          departureSourceTimezone,
          departureEvidenceId,
          operatorId,
          reasonCode: normalized.reasonCode,
          idempotencyKey: normalized.idempotencyKey,
          payloadHash: sha256(JSON.stringify(normalized)),
          cargoLines:
            current?.cargoLines.map((line) => ({
              ...line,
              id: randomUUID(),
            })) ?? [],
        });
      const corrected = applyPostDepartureCandidateCorrection({
        candidate,
        correction: saved.correction,
        originPort,
        destinationPort,
      });
      const remainingIssues = corrected.issues.filter(
        (issue) => issue.resolutionState !== "system_handled",
      );
      return {
        contractVersion: "post-departure-source-candidate-correction-result.v1",
        status: saved.created ? "saved" : "duplicate",
        correctionId: saved.correction.id,
        version: saved.correction.version,
        candidate: corrected,
        remainingIssues,
        decision: corrected.decision,
        traceId: randomUUID(),
      };
    } catch (error) {
      if (error instanceof PostDepartureCorrectionIdempotencyConflictError) {
        throw new ConflictException("IDEMPOTENCY_PAYLOAD_CONFLICT");
      }
      if (error instanceof PostDepartureCorrectionVersionConflictError) {
        throw new ConflictException(
          "POST_DEPARTURE_CORRECTION_VERSION_CONFLICT",
        );
      }
      throw error;
    }
  }
}

function assertCommand(
  packageId: string,
  reviewId: string,
  candidateRef: string,
  value: unknown,
): asserts value is PostDepartureSourceCandidateCorrectionCommandV1 {
  if (!isRecord(value)) throw invalid();
  const grouping = value.shipmentGrouping;
  const proof = value.departureProof;
  if (
    !HASH_PATTERN.test(packageId) ||
    !UUID_PATTERN.test(reviewId) ||
    !candidateRef.trim() ||
    candidateRef.length > 200 ||
    value.contractVersion !== "post-departure-source-candidate-correction.v1" ||
    value.packageId !== packageId ||
    value.reviewId !== reviewId ||
    value.candidateRef !== candidateRef ||
    !Number.isInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 0 ||
    (grouping !== undefined &&
      grouping !== null &&
      (!isRecord(grouping) || !validGrouping(grouping))) ||
    !nullablePattern(value.originPortCode, UNLOCODE_PATTERN) ||
    !nullablePattern(value.destinationPortCode, UNLOCODE_PATTERN) ||
    (proof !== undefined && proof !== null && !validDepartureProof(proof)) ||
    !nullablePattern(value.departureLocal, LOCAL_DATETIME_PATTERN) ||
    !nullableTextValue(value.departureSourceTimezone, 100) ||
    !nullablePattern(value.departureEvidenceRef, UUID_PATTERN) ||
    typeof value.reasonCode !== "string" ||
    !STABLE_CODE_PATTERN.test(value.reasonCode) ||
    !validText(value.idempotencyKey, 200)
  ) {
    throw invalid();
  }
}

function validGrouping(value: Record<string, unknown>): boolean {
  if (value.kind === "authorized_new_shipment") {
    return validText(value.shipmentNumber, 100);
  }
  if (value.kind === "existing_shipment") {
    return (
      typeof value.shipmentId === "string" &&
      UUID_PATTERN.test(value.shipmentId) &&
      Number.isInteger(value.expectedRelationshipVersion) &&
      (value.expectedRelationshipVersion as number) > 0
    );
  }
  return value.kind === "new_independent_shipment";
}

function normalizeGrouping(
  grouping: PostDepartureShipmentGroupingV1,
): PostDepartureShipmentGroupingV1 {
  if (grouping.kind === "authorized_new_shipment") {
    return { ...grouping, shipmentNumber: grouping.shipmentNumber.trim() };
  }
  return { ...grouping };
}

function groupingPersistence(
  grouping: PostDepartureShipmentGroupingV1 | null,
): {
  shipmentGroupingKind: PostDepartureShipmentGroupingV1["kind"] | null;
  shipmentNumber: string | null;
  targetShipmentId: string | null;
  targetRelationshipVersion: number | null;
} {
  if (!grouping) {
    return {
      shipmentGroupingKind: null,
      shipmentNumber: null,
      targetShipmentId: null,
      targetRelationshipVersion: null,
    };
  }
  if (grouping.kind === "authorized_new_shipment") {
    return {
      shipmentGroupingKind: grouping.kind,
      shipmentNumber: grouping.shipmentNumber,
      targetShipmentId: null,
      targetRelationshipVersion: null,
    };
  }
  if (grouping.kind === "existing_shipment") {
    return {
      shipmentGroupingKind: grouping.kind,
      shipmentNumber: null,
      targetShipmentId: grouping.shipmentId,
      targetRelationshipVersion: grouping.expectedRelationshipVersion,
    };
  }
  return {
    shipmentGroupingKind: grouping.kind,
    shipmentNumber: null,
    targetShipmentId: null,
    targetRelationshipVersion: null,
  };
}

function invalid(): BadRequestException {
  return new BadRequestException("SOURCE_CANDIDATE_CORRECTION_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value.length <= maxLength
  );
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function nullableTextValue(value: unknown, maxLength: number): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      (value.length === 0 || validText(value, maxLength)))
  );
}

function nullablePattern(value: unknown, pattern: RegExp): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && (value.length === 0 || pattern.test(value)))
  );
}

function validDepartureProof(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.kind === "actual_departure_time" &&
    typeof value.occurredAt === "string" &&
    OFFSET_DATETIME_PATTERN.test(value.occurredAt) &&
    !Number.isNaN(Date.parse(value.occurredAt)) &&
    validText(value.sourceTimezone, 100) &&
    typeof value.evidenceRef === "string" &&
    UUID_PATTERN.test(value.evidenceRef)
  );
}

function isIanaTimezone(value: string): boolean {
  if (/^(?:GMT|UTC)[+-]/i.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedLocalDateTimeToDate(
  localDateTime: string,
  timeZone: string,
): Date {
  const match = LOCAL_DATETIME_PATTERN.exec(localDateTime);
  if (!match) throw new BadRequestException("SOURCE_LOCAL_TIME_INVALID");
  const parts = match.slice(1, 7).map((value) => Number(value ?? 0));
  const millisecond = Number((match[7] ?? "").padEnd(3, "0") || "0");
  const expected = [...parts, millisecond];
  const [year, month, day, hour, minute, second = 0] = parts;
  const localAsUtc = Date.UTC(
    year!,
    month! - 1,
    day!,
    hour!,
    minute!,
    second,
    millisecond,
  );
  let instant = localAsUtc - offsetAt(localAsUtc, timeZone);
  instant = localAsUtc - offsetAt(instant, timeZone);
  if (!matchesLocalParts(instant, timeZone, expected)) {
    throw new BadRequestException("SOURCE_LOCAL_TIME_INVALID");
  }
  return new Date(instant);
}

function offsetAt(instant: number, timeZone: string): number {
  const values = formattedParts(instant, timeZone);
  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) -
    Math.floor(instant / 1000) * 1000
  );
}

function matchesLocalParts(
  instant: number,
  timeZone: string,
  expected: number[],
): boolean {
  const actual = formattedParts(instant, timeZone);
  const localPartsMatch = [
    actual.year,
    actual.month,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
  ].every((value, index) => value === (expected[index] ?? 0));
  const millisecond = ((instant % 1000) + 1000) % 1000;
  return localPartsMatch && millisecond === (expected[6] ?? 0);
}

function formattedParts(instant: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(instant))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  return values as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
