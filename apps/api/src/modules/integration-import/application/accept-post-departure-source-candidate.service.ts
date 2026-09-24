import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PostDepartureSourceCandidateAcceptCommandV1,
  PostDepartureSourceCandidateAcceptResultV1,
  PostDepartureSourceCandidateV1,
  ShipmentHandoffCommandV2,
} from "@logix/contracts";
import {
  ACCEPT_SHIPMENT_HANDOFF,
  type AcceptShipmentHandoffPort,
  type ShipmentHandoffRequestContext,
} from "../../shipment-lifecycle-orchestration";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
} from "../domain/import.repository";
import { PreflightPostDepartureSourcePackageService } from "./preflight-post-departure-source-package.service";

const CARRIER_CODE_PATTERN = /^[A-Z0-9]{2,10}$/;
const PACKAGE_ID_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_KINDS = new Set([
  "container",
  "customs",
  "logistics",
  "warehouse",
]);

@Injectable()
export class AcceptPostDepartureSourceCandidateService {
  constructor(
    private readonly preflightPackage: PreflightPostDepartureSourcePackageService,
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
    @Inject(ACCEPT_SHIPMENT_HANDOFF)
    private readonly acceptHandoff: AcceptShipmentHandoffPort,
  ) {}

  async execute(
    packageId: string,
    candidateRef: string,
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<PostDepartureSourceCandidateAcceptResultV1> {
    assertCommand(input);
    if (input.packageId !== packageId || input.candidateRef !== candidateRef) {
      throw new BadRequestException("SOURCE_CANDIDATE_ACCEPT_PATH_MISMATCH");
    }

    const preflight = await this.preflightPackage.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: input.sources,
      },
      context.tenantId,
    );
    if (preflight.packageId !== packageId) {
      throw new ConflictException("SOURCE_PACKAGE_CHANGED");
    }
    const selected = preflight.candidates.find(
      (candidate) => candidate.candidateRef === candidateRef,
    );
    if (!selected) throw new NotFoundException("SOURCE_CANDIDATE_NOT_FOUND");

    const groupingKey = candidateGroupingKey(selected);
    const shipmentCandidates = groupingKey
      ? preflight.candidates.filter(
          (candidate) => candidateGroupingKey(candidate) === groupingKey,
        )
      : [selected];
    const rejected = shipmentCandidates.filter(
      ({ decision }) => decision === "rejected",
    );
    if (rejected.length > 0) {
      throw new ConflictException({
        code: "SOURCE_CANDIDATE_REJECTED",
        candidateRefs: rejected.map(({ candidateRef }) => candidateRef),
        issues: rejected.flatMap(({ issues }) => issues),
      });
    }

    const sourceBatches = await Promise.all(
      input.sources.map(async (source) => {
        const batch = await this.repository.findById(
          source.batchId,
          context.tenantId,
        );
        if (!batch) throw new NotFoundException("SOURCE_BATCH_NOT_FOUND");
        return batch.batch;
      }),
    );
    const occurredAt = sourceBatches.reduce(
      (latest, batch) => (batch.createdAt > latest ? batch.createdAt : latest),
      sourceBatches[0]!.createdAt,
    );
    const command = buildHandoffCommand({
      packageId,
      idempotencyKey: input.idempotencyKey,
      candidates: shipmentCandidates,
      occurredAt,
      sourceBatchId:
        input.sources.length === 1 ? input.sources[0]!.batchId : undefined,
      context,
    });
    const handoff = await this.acceptHandoff.accept(command, context);
    return {
      contractVersion: "post-departure-source-candidate-accept-result.v1",
      acceptedCandidateRefs: shipmentCandidates.map(
        ({ candidateRef }) => candidateRef,
      ) as PostDepartureSourceCandidateAcceptResultV1["acceptedCandidateRefs"],
      handoff,
    };
  }
}

function buildHandoffCommand(input: {
  packageId: string;
  idempotencyKey: string;
  candidates: PostDepartureSourceCandidateV1[];
  occurredAt: Date;
  sourceBatchId?: string;
  context: ShipmentHandoffRequestContext;
}): ShipmentHandoffCommandV2 {
  const { candidates } = input;
  const grouping = sharedObject(
    candidates,
    (candidate) => candidate.correction?.shipmentGrouping,
    "shipment_grouping",
  );
  const originPort = sharedValue(
    candidates,
    (candidate) => candidate.correction?.originPort?.unlocode,
    "origin_port",
  );
  const destinationPort = sharedValue(
    candidates,
    (candidate) => candidate.correction?.destinationPort?.unlocode,
    "destination_port",
  );
  const destinationCountry = sharedValue(
    candidates,
    (candidate) => candidate.correction?.destinationPort?.areaCode,
    "destination_country",
  );
  const departureProof = sharedObject(
    candidates,
    (candidate) => candidate.correction?.departureProof,
    "departure_proof",
  );
  const carrierCode = sharedValue(
    candidates,
    (candidate) =>
      candidate.carrierCode && CARRIER_CODE_PATTERN.test(candidate.carrierCode)
        ? candidate.carrierCode
        : undefined,
    "carrier_code",
  );
  const vesselName = sharedValue(
    candidates,
    (candidate) => candidate.vesselName,
    "vessel_name",
  );
  const voyageNumber = sharedValue(
    candidates,
    (candidate) => candidate.voyageNumber,
    "voyage_number",
  );
  const groupIdentity = createHash("sha256")
    .update(
      candidates
        .map(({ candidateRef }) => candidateRef)
        .sort()
        .join("|"),
    )
    .digest("hex");
  const mappedContainers = candidates.map((candidate) => {
    const allocations = (candidate.correction?.cargoAllocations ?? []).map(
      (allocation) => ({
        sourceLineId: allocation.sourceLineId,
        productSkuId: allocation.productSkuId,
        productNumber: allocation.productNumber,
        quantity: allocation.quantity,
        quantityUnit: allocation.quantityUnit,
        ...(allocation.replenishmentOrderLineId
          ? {
              replenishmentOrderLineId: allocation.replenishmentOrderLineId,
            }
          : {}),
      }),
    );
    return {
      referenceId: candidate.candidateRef,
      externalContainerId: candidate.candidateRef,
      ...(candidate.containerNumber
        ? { containerNumber: candidate.containerNumber }
        : {}),
      ...(candidate.containerTypeCode
        ? { containerTypeCode: candidate.containerTypeCode }
        : {}),
      billReferences: [],
      upstreamReferences: candidate.replenishmentOrderNumbers.map(
        (orderNumber) => ({
          referenceType: "stocking_order" as const,
          sourceSystem: "post_departure_source_package",
          sourceRecordId: orderNumber,
        }),
      ),
      ...(allocations[0]
        ? {
            cargoAllocations: [
              allocations[0],
              ...allocations.slice(1),
            ] as NonNullable<
              ShipmentHandoffCommandV2["containers"][number]["cargoAllocations"]
            >,
          }
        : {}),
    };
  });
  const firstContainer = mappedContainers[0];
  if (!firstContainer) throw new Error("SOURCE_CANDIDATE_GROUP_EMPTY");

  return {
    contractVersion: "shipment-handoff.v2",
    tenantId: input.context.tenantId,
    sourceProfile: "legacy_departed_file_v1",
    source: {
      channel: "file_import",
      system: "post_departure_source_package",
      externalHandoffId: `${input.packageId}:${groupIdentity}`,
      handoffVersion: 1,
      occurredAt: input.occurredAt.toISOString(),
      idempotencyKey: input.idempotencyKey,
      ...(input.sourceBatchId ? { sourceBatchId: input.sourceBatchId } : {}),
      mappingVersion: "post_departure_source_package.v1",
      correlationId: deterministicUuid(`${input.packageId}:${groupIdentity}`),
      traceId: `post-departure:${input.packageId.slice(0, 32)}`,
    },
    shipment: {
      transportMode: "ocean",
      ...(grouping?.kind === "authorized_new_shipment"
        ? { shipmentNumber: grouping.shipmentNumber }
        : {}),
      ...(grouping?.kind === "existing_shipment"
        ? {
            targetShipmentId: grouping.shipmentId,
            expectedRelationshipVersion: grouping.expectedRelationshipVersion,
          }
        : {}),
      ...(carrierCode ? { carrierCode } : {}),
      ...(vesselName ? { vesselName } : {}),
      ...(voyageNumber ? { voyageNumber } : {}),
      ...(originPort ? { originPortCode: originPort } : {}),
      ...(destinationPort ? { destinationPortCode: destinationPort } : {}),
      ...(destinationCountry
        ? { destinationCountryCode: destinationCountry }
        : {}),
      ...(departureProof ? { departureProof } : {}),
    },
    billsOfLading: [],
    containers: [firstContainer, ...mappedContainers.slice(1)],
    evidenceReferences: [
      ...new Set(
        candidates
          .map((candidate) => candidate.correction?.departureProof?.evidenceRef)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort(),
  };
}

function candidateGroupingKey(
  candidate: PostDepartureSourceCandidateV1,
): string | undefined {
  const grouping = candidate.correction?.shipmentGrouping;
  if (!grouping) return undefined;
  if (grouping.kind === "authorized_new_shipment") {
    return `legacy-number:${grouping.shipmentNumber}`;
  }
  if (grouping.kind === "existing_shipment") {
    return `existing:${grouping.shipmentId}`;
  }
  return `new:${candidate.candidateRef}`;
}

function sharedValue(
  candidates: PostDepartureSourceCandidateV1[],
  select: (candidate: PostDepartureSourceCandidateV1) => string | undefined,
  field: string,
): string | undefined {
  const values = [
    ...new Set(candidates.map(select).filter(Boolean)),
  ] as string[];
  if (values.length > 1) {
    throw new ConflictException({
      code: "SOURCE_CANDIDATE_GROUP_FACT_CONFLICT",
      field,
    });
  }
  return values[0];
}

function sharedObject<T>(
  candidates: PostDepartureSourceCandidateV1[],
  select: (candidate: PostDepartureSourceCandidateV1) => T | undefined,
  field: string,
): T | undefined {
  const values = candidates
    .map(select)
    .filter((value): value is T => Boolean(value));
  const serialized = [...new Set(values.map((value) => JSON.stringify(value)))];
  if (serialized.length > 1) {
    throw new ConflictException({
      code: "SOURCE_CANDIDATE_GROUP_FACT_CONFLICT",
      field,
    });
  }
  return values[0];
}

function deterministicUuid(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
}

function assertCommand(
  value: unknown,
): asserts value is PostDepartureSourceCandidateAcceptCommandV1 {
  if (
    !isRecord(value) ||
    value.contractVersion !== "post-departure-source-candidate-accept.v1" ||
    typeof value.packageId !== "string" ||
    !PACKAGE_ID_PATTERN.test(value.packageId) ||
    typeof value.candidateRef !== "string" ||
    value.candidateRef.length < 1 ||
    value.candidateRef.length > 200 ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length < 1 ||
    value.idempotencyKey.length > 200 ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 4 ||
    !value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.kind === "string" &&
        SOURCE_KINDS.has(source.kind) &&
        typeof source.batchId === "string" &&
        UUID_PATTERN.test(source.batchId),
    ) ||
    new Set(
      value.sources.map((source) =>
        isRecord(source) ? source.kind : undefined,
      ),
    ).size !== value.sources.length
  ) {
    throw new BadRequestException("SOURCE_CANDIDATE_ACCEPT_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
