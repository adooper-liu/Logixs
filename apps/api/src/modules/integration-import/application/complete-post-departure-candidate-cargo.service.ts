import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PostDepartureSourceCandidateCargoCommandV1,
  PostDepartureSourceCandidateCorrectionResultV1,
} from "@logix/contracts";
import { createHash, randomUUID } from "node:crypto";
import {
  REFERENCE_PORT_DIRECTORY,
  RESOLVE_PRODUCT_SKUS,
  type ReferencePortDirectoryPort,
  type ResolveProductSkusPort,
} from "../../master-data";
import {
  RESOLVE_REPLENISHMENT_ORDER_LINES,
  type ResolveReplenishmentOrderLinesPort,
} from "../../shipment-registry";
import {
  IMPORT_REPOSITORY,
  PostDepartureCorrectionIdempotencyConflictError,
  PostDepartureCorrectionVersionConflictError,
  type ImportRepository,
  type NewPostDepartureSourceCandidateCargoLine,
} from "../domain/import.repository";
import { applyPostDepartureCandidateCorrection } from "../domain/post-departure-candidate-correction";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STABLE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const QUANTITY_PATTERN = /^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,3})?$/;
const QUANTITY_UNITS = new Set(["piece", "carton", "set", "pallet"]);

@Injectable()
export class CompletePostDepartureCandidateCargoService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(RESOLVE_PRODUCT_SKUS)
    private readonly resolveProductSkus: ResolveProductSkusPort,
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
    @Inject(RESOLVE_REPLENISHMENT_ORDER_LINES)
    private readonly resolveReplenishmentLines: ResolveReplenishmentOrderLinesPort,
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
    const corrections =
      await this.repository.listLatestPostDepartureSourceCandidateCorrections(
        reviewId,
        tenantId,
      );
    const current = corrections.find(
      (item) => item.candidateRef === candidateRef,
    );
    if (
      !current ||
      !current.shipmentGroupingKind ||
      !current.originPortId ||
      !current.originUnlocode ||
      !current.destinationPortId ||
      !current.destinationUnlocode ||
      !current.departureOccurredAt ||
      !current.departureSourceTimezone ||
      !current.departureEvidenceId
    ) {
      throw new ConflictException("SOURCE_CANDIDATE_BASE_CORRECTION_REQUIRED");
    }

    const allowedOrders = new Set(candidate.replenishmentOrderNumbers);
    const normalizedLines = command.cargoLines.map((line, index) => ({
      lineNumber: index + 1,
      sourceLineRef: line.sourceLineRef?.trim(),
      replenishmentOrderNumber: line.replenishmentOrderNumber.trim(),
      productNumber: line.productNumber.trim(),
      quantity: normalizeQuantity(line.quantity),
      quantityUnit: line.quantityUnit,
    }));
    const invalidOrders = [
      ...new Set(
        normalizedLines
          .filter((line) => !allowedOrders.has(line.replenishmentOrderNumber))
          .map((line) => line.replenishmentOrderNumber),
      ),
    ];
    if (invalidOrders.length > 0) {
      throw new BadRequestException({
        code: "CARGO_REPLENISHMENT_ORDER_MISMATCH",
        replenishmentOrderNumbers: invalidOrders,
      });
    }

    const resolved = await this.resolveProductSkus.execute({
      tenantId,
      productNumbers: normalizedLines.map((line) => line.productNumber),
    });
    const skuByProductNumber = new Map(
      resolved.map((sku) => [sku.productNumber, sku]),
    );
    const unknownProductNumbers = [
      ...new Set(
        normalizedLines
          .filter((line) => !skuByProductNumber.has(line.productNumber))
          .map((line) => line.productNumber),
      ),
    ];
    if (unknownProductNumbers.length > 0) {
      throw new BadRequestException({
        code: "CARGO_PRODUCT_SKU_NOT_FOUND",
        productNumbers: unknownProductNumbers,
      });
    }

    const replenishmentLines = await this.resolveReplenishmentLines.execute({
      tenantId,
      identities: normalizedLines.map((line) => ({
        replenishmentOrderNumber: line.replenishmentOrderNumber,
        productNumber: line.productNumber,
      })),
    });
    const linesByIdentity = new Map<string, typeof replenishmentLines>();
    for (const line of replenishmentLines) {
      const key = `${line.replenishmentOrderNumber}\u0000${line.productNumber}`;
      const matches = linesByIdentity.get(key) ?? [];
      matches.push(line);
      linesByIdentity.set(key, matches);
    }

    const cargoLines: NewPostDepartureSourceCandidateCargoLine[] =
      normalizedLines.map((line) => ({
        id: randomUUID(),
        lineNumber: line.lineNumber,
        sourceLineId:
          line.sourceLineRef ??
          `manual:${line.lineNumber}:${sha256(
            `${candidateRef}\u0000${line.replenishmentOrderNumber}\u0000${line.productNumber}`,
          ).slice(0, 32)}`,
        replenishmentOrderNumber: line.replenishmentOrderNumber,
        productSkuId: skuByProductNumber.get(line.productNumber)!.productSkuId,
        productNumber: line.productNumber,
        quantity: line.quantity,
        quantityUnit: line.quantityUnit,
        replenishmentOrderLineId: uniqueMatchingReplenishmentLineId(
          linesByIdentity.get(
            `${line.replenishmentOrderNumber}\u0000${line.productNumber}`,
          ) ?? [],
          skuByProductNumber.get(line.productNumber)!.productSkuId,
        ),
      }));
    if (
      new Set(cargoLines.map((line) => line.sourceLineId)).size !==
      cargoLines.length
    ) {
      throw new BadRequestException("CARGO_SOURCE_LINE_DUPLICATE");
    }

    const normalized = {
      contractVersion: command.contractVersion,
      packageId,
      reviewId,
      candidateRef,
      expectedVersion: command.expectedVersion,
      cargoLines: normalizedLines,
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
          shipmentGroupingKind: current.shipmentGroupingKind,
          shipmentNumber: current.shipmentNumber,
          targetShipmentId: current.targetShipmentId,
          targetRelationshipVersion: current.targetRelationshipVersion,
          originPortId: current.originPortId,
          originUnlocode: current.originUnlocode,
          destinationPortId: current.destinationPortId,
          destinationUnlocode: current.destinationUnlocode,
          departureLocal: current.departureLocal,
          departureOccurredAt: current.departureOccurredAt,
          departureSourceTimezone: current.departureSourceTimezone,
          departureEvidenceId: current.departureEvidenceId,
          operatorId,
          reasonCode: normalized.reasonCode,
          idempotencyKey: normalized.idempotencyKey,
          payloadHash: sha256(JSON.stringify(normalized)),
          cargoLines,
        });
      const originPortId = saved.correction.originPortId;
      const destinationPortId = saved.correction.destinationPortId;
      if (!originPortId || !destinationPortId) {
        throw new BadRequestException("REFERENCE_PORT_HISTORY_MISSING");
      }
      const selectedPorts = await this.ports.findByIds([
        originPortId,
        destinationPortId,
      ]);
      const byId = new Map(selectedPorts.map((port) => [port.portId, port]));
      const originPort = byId.get(originPortId);
      const destinationPort = byId.get(destinationPortId);
      if (!originPort || !destinationPort) {
        throw new BadRequestException("REFERENCE_PORT_HISTORY_MISSING");
      }
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
): asserts value is PostDepartureSourceCandidateCargoCommandV1 {
  if (!isRecord(value)) throw invalid();
  const cargoLines = value.cargoLines;
  if (
    !HASH_PATTERN.test(packageId) ||
    !UUID_PATTERN.test(reviewId) ||
    !candidateRef.trim() ||
    candidateRef.length > 200 ||
    value.contractVersion !== "post-departure-source-candidate-cargo.v1" ||
    value.packageId !== packageId ||
    value.reviewId !== reviewId ||
    value.candidateRef !== candidateRef ||
    !Number.isInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1 ||
    !Array.isArray(cargoLines) ||
    cargoLines.length < 1 ||
    cargoLines.length > 1000 ||
    !cargoLines.every(isCargoLine) ||
    typeof value.reasonCode !== "string" ||
    !STABLE_CODE_PATTERN.test(value.reasonCode) ||
    !validText(value.idempotencyKey, 200)
  ) {
    throw invalid();
  }
}

function isCargoLine(
  value: unknown,
): value is PostDepartureSourceCandidateCargoCommandV1["cargoLines"][number] {
  if (!isRecord(value)) return false;
  const allowed = new Set([
    "sourceLineRef",
    "replenishmentOrderNumber",
    "productNumber",
    "quantity",
    "quantityUnit",
  ]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    (value.sourceLineRef === undefined ||
      validText(value.sourceLineRef, 200)) &&
    validText(value.replenishmentOrderNumber, 100) &&
    validText(value.productNumber, 200) &&
    typeof value.quantity === "string" &&
    QUANTITY_PATTERN.test(value.quantity) &&
    Number(value.quantity) > 0 &&
    typeof value.quantityUnit === "string" &&
    QUANTITY_UNITS.has(value.quantityUnit)
  );
}

function normalizeQuantity(value: string): string {
  const [whole, fraction] = value.split(".");
  const normalizedFraction = fraction?.replace(/0+$/, "");
  return normalizedFraction
    ? `${BigInt(whole)}.${normalizedFraction}`
    : String(BigInt(whole));
}

function invalid(): BadRequestException {
  return new BadRequestException("SOURCE_CANDIDATE_CARGO_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value.trim().length <= maxLength
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueMatchingReplenishmentLineId(
  matches: Array<{
    replenishmentOrderLineId: string;
    productSkuId: string | null;
  }>,
  productSkuId: string,
): string | null {
  const compatible = matches.filter(
    (line) => line.productSkuId === null || line.productSkuId === productSkuId,
  );
  return compatible.length === 1
    ? compatible[0]!.replenishmentOrderLineId
    : null;
}
