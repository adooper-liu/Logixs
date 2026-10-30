import { createHash, randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { buildOceanFocus, comparableObservations } from "../domain/ocean-operations-focus";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ARRIVAL_PREPARATION_RESULTS,
  SOURCE_REVIEW_DECISIONS,
  type ArrivalPreparationResult,
  type OceanOperationsReviewProjection,
  type SourceObservation,
  type SourceReviewDecision,
  type SourceReviewQueueItem,
} from "../domain/ocean-operations-source-review";

import type {
  ListSourceReviewsInput,
  OceanOperationsSourceReviewRepository,
  SaveSourceReviewInput,
} from "../domain/ocean-operations-source-review.repository";

@Injectable()
export class PrismaOceanOperationsSourceReviewRepository implements OceanOperationsSourceReviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listQueue(
    input: ListSourceReviewsInput,
  ): Promise<SourceReviewQueueItem[]> {
    const tenantId = required(input.tenantId, "AUTHORIZATION_SCOPE_DENIED");
    const [
      timeFactContainers,
      lifecycleFactContainers,
      providerEventContainers,
      reviewContainers,
    ] = await Promise.all([
      this.prisma.shipmentTimeFact.findMany({
        where: { tenantId, isCurrent: true },
        select: {
          containerRecordId: true,
          factCode: true,
          eventCode: true,
        },
      }),
      this.prisma.lifecycleDateFact.findMany({
        where: { tenantId, isCurrent: true },
        select: { containerId: true, nodeCode: true, eventCode: true },
      }),
      this.prisma.oceanProviderEventIngestion.findMany({
        where: { tenantId, containerRecordId: { not: null } },
        select: {
          containerRecordId: true,
          canonicalEventCode: true,
          rawCode: true,
        },
      }),
      this.prisma.oceanOperationsSourceReview.findMany({
        where: { tenantId },
        select: { containerId: true },
      }),
    ]);
    const observedContainerIds = [
      ...new Set(
        [
          ...timeFactContainers
            .filter((fact) =>
              isOceanObservation({
                semanticKey: fact.eventCode ?? fact.factCode,
              }),
            )
            .map(({ containerRecordId }) => containerRecordId),
          ...lifecycleFactContainers
            .filter((fact) =>
              isOceanObservation({
                semanticKey: fact.eventCode,
                nodeCode: fact.nodeCode,
              }),
            )
            .map(({ containerId }) => containerId),
          ...providerEventContainers
            .filter((event) =>
              isOceanObservation({
                semanticKey: event.canonicalEventCode ?? event.rawCode,
              }),
            )
            .flatMap(({ containerRecordId }) =>
              containerRecordId ? [containerRecordId] : [],
            ),
          ...reviewContainers.map(({ containerId }) => containerId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    if (observedContainerIds.length === 0) return [];
    const containers = await this.prisma.containerRecord.findMany({
      where: {
        tenantId,
        id: { in: observedContainerIds },
        ...(input.containerNumber?.trim()
          ? {
              containerNumber: {
                contains: input.containerNumber.trim(),
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        containerNumber: true,
        currentStatus: true,
        updatedAt: true,
      },
    });
    if (containers.length === 0) return [];
    const ids = containers.map(({ id }) => id);
    const [timeFacts, lifecycleFacts, providerEvents, reviews, links] =
      await Promise.all([
        this.prisma.shipmentTimeFact.findMany({
          where: { tenantId, containerRecordId: { in: ids }, isCurrent: true },
          select: {
            id: true,
            containerRecordId: true,
            rawValue: true,
            timeKind: true,
            factCode: true,
            eventCode: true,
          },
        }),
        this.prisma.lifecycleDateFact.findMany({
          where: { tenantId, containerId: { in: ids }, isCurrent: true },
          select: {
            id: true,
            containerId: true,
            rawValue: true,
            timeKind: true,
            eventCode: true,
            nodeCode: true,
          },
        }),
        this.prisma.oceanProviderEventIngestion.findMany({
          where: { tenantId, containerRecordId: { in: ids } },
          select: {
            id: true,
            containerRecordId: true,
            eventTimeRaw: true,
            timeKind: true,
            rawCode: true,
            canonicalEventCode: true,
            authorityDecision: true,
            normalizationKind: true,
          },
          orderBy: { receivedAt: "desc" },
        }),
        this.prisma.oceanOperationsSourceReview.findMany({
          where: { tenantId, containerId: { in: ids } },
          orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        }),
        this.prisma.shipmentContainerLink.findMany({
          where: {
            tenantId,
            containerRecordId: { in: ids },
            state: "active",
            supersededAt: null,
            shipment: { transportMode: "ocean" },
          },
          orderBy: [{ version: "desc" }, { joinedAt: "desc" }, { id: "asc" }],
          include: {
            shipment: { select: { shipmentNumber: true, transportMode: true } },
          },
        }),
      ]);
    const latestReviews = new Map<string, (typeof reviews)[number]>();
    for (const review of reviews)
      if (!latestReviews.has(review.containerId))
        latestReviews.set(review.containerId, review);
    const counts = new Map<
      string,
      { observations: number; conflicts: number }
    >();
    for (const id of ids) counts.set(id, { observations: 0, conflicts: 0 });
    const observationRows = new Map<
      string,
      { semanticKey: string; rawValue: string; rejected: boolean }[]
    >();
    const addObservation = (
      containerId: string,
      row: { semanticKey: string; rawValue: string; rejected?: boolean },
    ) => {
      const rows = observationRows.get(containerId) ?? [];
      rows.push({ ...row, rejected: row.rejected ?? false });
      observationRows.set(containerId, rows);
    };
    const oceanTimeFacts = timeFacts.filter((fact) =>
      isOceanObservation({
        semanticKey: fact.eventCode ?? fact.factCode,
      }),
    );
    const oceanLifecycleFacts = lifecycleFacts.filter((fact) =>
      isOceanObservation({
        semanticKey: fact.eventCode,
        nodeCode: fact.nodeCode,
      }),
    );
    const oceanProviderEvents = providerEvents.filter((event) =>
      isOceanObservation({
        semanticKey: event.canonicalEventCode ?? event.rawCode,
      }),
    );
    for (const fact of oceanTimeFacts)
      addObservation(fact.containerRecordId, {
        semanticKey: fact.eventCode ?? fact.factCode,
        rawValue: fact.rawValue,
      });
    for (const fact of oceanLifecycleFacts)
      addObservation(fact.containerId, {
        semanticKey: fact.eventCode,
        rawValue: fact.rawValue,
      });
    for (const event of oceanProviderEvents)
      if (event.containerRecordId)
        addObservation(event.containerRecordId, {
          semanticKey: event.canonicalEventCode ?? event.rawCode,
          rawValue: event.eventTimeRaw,
          rejected: event.authorityDecision === "review_required",
        });
    for (const [containerId, rows] of observationRows) {
      const valuesByKey = new Map<string, Set<string>>();
      for (const row of rows) {
        const values = valuesByKey.get(row.semanticKey) ?? new Set<string>();
        values.add(row.rawValue);
        valuesByKey.set(row.semanticKey, values);
      }
      const count = counts.get(containerId);
      if (count) {
        count.conflicts = rows.filter(
          (row) =>
            row.rejected || (valuesByKey.get(row.semanticKey)?.size ?? 0) > 1,
        ).length;
      }
    }
    for (const fact of [
      ...oceanTimeFacts,
      ...oceanLifecycleFacts,
      ...oceanProviderEvents,
    ]) {
      const id =
        "containerRecordId" in fact ? fact.containerRecordId : fact.containerId;
      if (!id) continue;
      const count = counts.get(id);
      if (count) count.observations += 1;
    }
    const byContainer = new Map<string, string | null>();
    const linksByContainer = new Map<string, typeof links>();
    for (const link of links) {
      const rows = linksByContainer.get(link.containerRecordId) ?? [];
      rows.push(link);
      linksByContainer.set(link.containerRecordId, rows);
    }
    for (const [containerId, containerLinks] of linksByContainer)
      byContainer.set(
        containerId,
        uniqueOceanShipmentLink(containerLinks)?.shipment.shipmentNumber ??
          null,
      );
    return containers.flatMap((container) => {
      const count = counts.get(container.id) ?? {
        observations: 0,
        conflicts: 0,
      };
      const review = latestReviews.get(container.id);
      if (count.observations === 0 && !review) return [];
      return [
        {
          containerId: container.id,
          containerNumber: container.containerNumber,
          shipmentNumber: byContainer.get(container.id) ?? null,
          status: container.currentStatus,
          observationCount: count.observations,
          conflictCount: count.conflicts,
          reviewDecision:
            (review?.reviewDecision as SourceReviewDecision | undefined) ??
            null,
          updatedAt: container.updatedAt.toISOString(),
        },
      ];
    });
  }

  async getProjection(
    tenantId: string,
    containerId: string,
  ): Promise<OceanOperationsReviewProjection> {
    const scope = required(tenantId, "AUTHORIZATION_SCOPE_DENIED");
    const container = await this.prisma.containerRecord.findFirst({
      where: { id: containerId, tenantId: scope },
      select: {
        id: true,
        containerNumber: true,
        containerTypeCode: true,
        currentStatus: true,
        orderNumber: true,
        mainOrderNumber: true,
      },
    });
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const [
      links,
      timeFacts,
      lifecycleFacts,
      providerEvents,
      reviews,
      arrivalPreparations,
    ] = await Promise.all([
      this.prisma.shipmentContainerLink.findMany({
        where: {
          tenantId: scope,
          containerRecordId: container.id,
          state: "active",
          supersededAt: null,
          shipment: { transportMode: "ocean" },
        },
        orderBy: [{ version: "desc" }, { joinedAt: "desc" }, { id: "asc" }],
        include: {
          shipment: {
            include: {
              transportDocuments: {
                where: { state: "active" },
                select: { documentNumber: true },
              },
              upstreamReferences: {
                where: { state: "active" },
                select: {
                  referenceType: true,
                  sourceSystem: true,
                  sourceRecordId: true,
                  sourceVersion: true,
                  metadata: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.shipmentTimeFact.findMany({
        where: {
          tenantId: scope,
          containerRecordId: container.id,
          isCurrent: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.lifecycleDateFact.findMany({
        where: {
          tenantId: scope,
          containerId: container.id,
        },
        orderBy: { recordedAt: "asc" },
      }),
      this.prisma.oceanProviderEventIngestion.findMany({
        where: { tenantId: scope, containerRecordId: container.id },
        orderBy: { receivedAt: "asc" },
      }),
      this.prisma.oceanOperationsSourceReview.findMany({
        where: { tenantId: scope, containerId: container.id },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
      }),
      this.prisma.oceanOperationsArrivalPreparationResult.findMany({
        where: { tenantId: scope, containerId: container.id },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
      }),
    ]);
    const shipment = uniqueOceanShipmentLink(links)?.shipment ?? null;
    const departureProvenance = shipment?.upstreamReferences.find(
      (reference) => {
        const metadata = reference.metadata as Record<string, unknown> | null;
        return (
          shipment.atdAt &&
          metadata?.classification === "development_demo.synthetic_scenario" &&
          typeof metadata.actualDepartureAt === "string" &&
          new Date(metadata.actualDepartureAt).toISOString() ===
            shipment.atdAt.toISOString()
        );
      },
    );
    const shipmentIdentity = shipment
      ? {
          id: shipment.id,
          number: shipment.shipmentNumber,
          carrier: shipment.carrierCode,
          vessel: shipment.vesselName,
          voyage: shipment.voyageNumber,
          billNumbers: shipment.transportDocuments.map(
            ({ documentNumber }) => documentNumber,
          ),
          plannedDepartureAt: shipment.etdAt?.toISOString() ?? null,
          actualDepartureAt: shipment.atdAt?.toISOString() ?? null,
          actualDepartureSource: departureProvenance
            ? {
                classification: "development_demo.synthetic_scenario",
                sourceVersion: departureProvenance.sourceVersion ?? "unknown",
                sourcePrecision: String(
                  (departureProvenance.metadata as Record<string, unknown>)
                    ?.sourcePrecision ?? "unknown",
                ),
              }
            : null,
          origin: {
            code: shipment.originUnlocode,
            name: locationName(shipment.originUnlocode),
          },
          destination: {
            code: shipment.destinationUnlocode,
            name: locationName(shipment.destinationUnlocode),
          },
        }
      : null;
    const oceanTimeFacts = timeFacts.filter((fact) =>
      isOceanObservation({
        semanticKey: fact.eventCode ?? fact.factCode,
      }),
    );
    const oceanLifecycleFacts = lifecycleFacts.filter((fact) =>
      isOceanObservation({
        semanticKey: fact.eventCode,
        nodeCode: fact.nodeCode,
      }),
    );
    const oceanProviderEvents = providerEvents.filter((event) =>
      isOceanObservation({
        semanticKey: event.canonicalEventCode ?? event.rawCode,
      }),
    );
    const lifecycleObservations: SourceObservation[] = oceanLifecycleFacts.map((fact) => ({
      id: `lifecycle:${fact.id}`,
      nodeCode: fact.nodeCode, segmentId: fact.segmentId ?? null, unlocode: fact.unlocode ?? null,
      supersedesObservationId: fact.supersedesFactId ? `lifecycle:${fact.supersedesFactId}` : null,
      reviewRequired: fact.applicationState === "review_required",
      semanticKey: fact.eventCode, sourceSystem: fact.sourceSystem,
      sourceVersion: fact.mappingVersion ?? fact.projectionVersion.toString(),
      parseState: fact.validity, sourcePrecision: precisionFor(fact.rawValue),
      rawValue: fact.rawValue, normalizedValue: normalizedSourceDate(fact.validity, fact.occurredAt),
      timeKind: fact.timeKind,
      evidenceRefs: Array.isArray(fact.evidenceRefs) ? fact.evidenceRefs.filter((value): value is string => typeof value === "string") : [],
      isCurrent: fact.isCurrent, conflict: false,
    }));
    const observations: SourceObservation[] = [
      ...oceanTimeFacts.map((fact) => ({
        id: `shipment-time:${fact.id}`,
        semanticKey: fact.eventCode ?? fact.factCode,
        sourceSystem: fact.sourceSystem,
        sourceVersion: fact.sourceBatchId,
        parseState: fact.sourceStatus ?? "unknown",
        sourcePrecision: precisionFor(fact.rawValue),
        rawValue: fact.rawValue,
        normalizedValue: normalizedSourceDate(
          fact.sourceStatus ?? "unknown",
          fact.occurredAtUtc,
        ),
        timeKind: fact.timeKind,
        evidenceRefs: fact.evidenceRef ? [fact.evidenceRef] : [],
        isCurrent: fact.isCurrent,
        conflict: false,
      })),
      ...lifecycleObservations.filter((item) => item.isCurrent),
      ...oceanProviderEvents.map((event) => ({
        id: `provider:${event.id}`,
        semanticKey: event.canonicalEventCode ?? event.rawCode,
        sourceSystem: event.provider,
        sourceVersion: event.mappingVersion,
        parseState: event.normalizationKind,
        sourcePrecision: precisionFor(event.eventTimeRaw),
        rawValue: event.eventTimeRaw,
        normalizedValue: event.occurredAt
          ? normalizedSourceDate(event.normalizationKind, event.occurredAt)
          : null,
        timeKind: event.timeKind,
        evidenceRefs: [],
        isCurrent: true,
        reviewRequired: event.authorityDecision === "review_required",
        conflict: false,
      })),
    ];
    markObservationConflicts(observations);
    const latestReview = reviews[0] ?? null;
    const latestArrivalPreparation = arrivalPreparations[0] ?? null;
    const houseBillNumber =
      shipment?.transportDocuments[0]?.documentNumber ?? null;
    const financialSource = shipment
      ? financialSourceFrom(shipment.upstreamReferences ?? [])
      : null;
    const etaSource = observations.find(isDestinationEtaObservation) ?? null;
    return {
      container: {
        id: container.id,
        number: container.containerNumber,
        typeCode: container.containerTypeCode ?? null,
        status: container.currentStatus,
      },
      shipment: shipmentIdentity,
      references: {
        replenishmentOrderNumber:
          container.mainOrderNumber ?? container.orderNumber ?? null,
        houseBillNumber,
      },
      task: {
        title: "跟踪运输进展与变化",
        question: "按关注事项查看依据，按需办理；不作为下游开工审批",
        currentResponsibility: "海运运营",
        deadline: null,
        deadlineStatus: "unknown",
      },
      focus: buildOceanFocus({
        shipmentLinked: Boolean(shipment), actualDepartureAt: shipmentIdentity?.actualDepartureAt ?? null,
        observations, history: lifecycleObservations.filter((item) => !item.isCurrent),
      }),
      observations,
      review: latestReview
        ? {
            id: latestReview.id,
            decision: latestReview.reviewDecision as SourceReviewDecision,
            reason: latestReview.reason,
            version: latestReview.version,
            sourceObservationId: latestReview.sourceObservationId,
            reviewedAt: latestReview.reviewedAt.toISOString(),
            writeBackTarget: latestReview.writeBackTarget,
          }
        : null,
      arrivalPreparation: latestArrivalPreparation
        ? toArrivalPreparation(latestArrivalPreparation)
        : null,
      downstream: {
        status: "not_connected",
        purpose: "供清关到港准备使用",
        missingFacts: [],
        nextStep:
          latestArrivalPreparation?.nextStep ??
          "按本岗条件开展准备；仅具体依赖缺失信息的动作受限",
        message: "下游接收记录尚未接通，不代表禁止准备或已经完成交接",
      },
      financialProjection: {
        incomeContribution: {
          status: "awaiting_actual",
          message: "与到货可售窗口相关；待销售/库存结果回流",
        },
        costFee: financialSource
          ? {
              status: "source_amount_pending_verification",
              amount: financialSource.amount,
              currency: financialSource.currency,
              sourceReference: financialSource.sourceReference,
              message: "来源金额、待核费；不是已核定应付",
            }
          : {
              status: "not_connected",
              amount: null,
              currency: null,
              sourceReference: null,
              message: "费用来源尚未接入",
            },
        cash: { status: "awaiting_actual", message: "现金结果待回流" },
        inventory: {
          status: "awaiting_actual",
          message: "库存本金及实际可售时间待回流",
        },
      },
      traceability: {
        sourceVersion: etaSource?.sourceVersion ?? null,
        reviewVersion: latestReview?.version ?? null,
        arrivalPreparationVersion: latestArrivalPreparation?.version ?? null,
        consumer: "customs_arrival_preparation",
        actualArrivalStatus: "awaiting_actual",
      },
    };
  }

  async save(input: SaveSourceReviewInput): Promise<{
    recordState: "recorded" | "duplicate";
    review: NonNullable<OceanOperationsReviewProjection["review"]>;
    arrivalPreparation: OceanOperationsReviewProjection["arrivalPreparation"];
  }> {
    const tenantId = required(input.tenantId, "AUTHORIZATION_SCOPE_DENIED");
    const actorId = required(input.actorId, "AUTHORIZATION_SCOPE_DENIED");
    const traceId = required(input.traceId, "TRACE_ID_REQUIRED");
    const containerId = required(input.containerId, "RESOURCE_NOT_FOUND");
    const sourceObservationId = required(
      input.sourceObservationId,
      "SOURCE_OBSERVATION_REQUIRED",
    );
    const idempotencyKey = required(
      input.idempotencyKey,
      "SOURCE_REVIEW_IDEMPOTENCY_REQUIRED",
    );
    if (idempotencyKey.length > 200)
      throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_INVALID");
    if (
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0
    )
      throw new ConflictException("SOURCE_REVIEW_VERSION_INVALID");
    if (!SOURCE_REVIEW_DECISIONS.includes(input.reviewDecision))
      throw new ConflictException("SOURCE_REVIEW_DECISION_INVALID");
    if (
      input.arrivalPreparationResult !== undefined &&
      !ARRIVAL_PREPARATION_RESULTS.includes(input.arrivalPreparationResult)
    )
      throw new ConflictException("ARRIVAL_PREPARATION_RESULT_INVALID");
    const nextStep = input.nextStep?.trim() ?? "";
    if (input.arrivalPreparationResult !== undefined && !nextStep)
      throw new ConflictException("ARRIVAL_PREPARATION_NEXT_STEP_REQUIRED");
    if (nextStep.length > 1000)
      throw new ConflictException("ARRIVAL_PREPARATION_NEXT_STEP_INVALID");
    if (
      input.expectedArrivalPreparationVersion !== undefined &&
      (!Number.isSafeInteger(input.expectedArrivalPreparationVersion) ||
        input.expectedArrivalPreparationVersion < 0)
    )
      throw new ConflictException("ARRIVAL_PREPARATION_VERSION_INVALID");
    const reason = input.reason.trim();
    if (!reason) throw new ConflictException("SOURCE_REVIEW_REASON_REQUIRED");
    if (reason.length > 1000)
      throw new ConflictException("SOURCE_REVIEW_REASON_INVALID");
    const container = await this.prisma.containerRecord.findFirst({
      where: { id: containerId, tenantId },
      select: { id: true },
    });
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");
    const sourceObservation = await this.findSourceObservation(
      tenantId,
      containerId,
      sourceObservationId,
    );
    if (!sourceObservation)
      throw new ConflictException("SOURCE_OBSERVATION_NOT_FOUND");
    const normalized = sourceObservation.normalizedValue
      ? new Date(sourceObservation.normalizedValue)
      : null;
    if (normalized && Number.isNaN(normalized.getTime()))
      throw new ConflictException("SOURCE_REVIEW_DATE_INVALID");
    const shipmentLinks = await this.prisma.shipmentContainerLink.findMany({
      where: {
        tenantId,
        containerRecordId: containerId,
        state: "active",
        supersededAt: null,
        shipment: { transportMode: "ocean" },
      },
      orderBy: [{ version: "desc" }, { joinedAt: "desc" }, { id: "asc" }],
      select: { shipmentId: true },
    });
    if (shipmentLinks.length > 1)
      throw new ConflictException("SHIPMENT_IDENTITY_AMBIGUOUS");
    const shipmentLink = shipmentLinks[0]?.shipmentId ?? null;
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          containerId,
          sourceObservationId,
          sourceSystem: sourceObservation.sourceSystem,
          sourceVersion: sourceObservation.sourceVersion,
          parseState: sourceObservation.parseState,
          sourcePrecision: sourceObservation.sourcePrecision,
          rawValue: sourceObservation.rawValue,
          normalizedValue: sourceObservation.normalizedValue,
          reviewDecision: input.reviewDecision,
          reason,
        }),
      )
      .digest("hex");
    const arrivalPayloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          containerId,
          sourceObservationId,
          sourceVersion: sourceObservation.sourceVersion,
          result: input.arrivalPreparationResult ?? null,
          reason,
          purpose: "customs_arrival_preparation",
          nextStep: nextStep || null,
        }),
      )
      .digest("hex");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.oceanOperationsSourceReview.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash)
            throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_CONFLICT");
          const existingArrival =
            await tx.oceanOperationsArrivalPreparationResult.findUnique({
              where: {
                tenantId_idempotencyKey: {
                  tenantId,
                  idempotencyKey,
                },
              },
            });
          if (input.arrivalPreparationResult !== undefined && !existingArrival)
            throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_CONFLICT");
          if (
            existingArrival &&
            existingArrival.payloadHash !== arrivalPayloadHash
          )
            throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_CONFLICT");
          return {
            recordState: "duplicate" as const,
            review: toReview(existing),
            arrivalPreparation: existingArrival
              ? toArrivalPreparation(existingArrival)
              : null,
          };
        }
        const previous = await tx.oceanOperationsSourceReview.findFirst({
          where: { tenantId, containerId },
          orderBy: { version: "desc" },
        });
        const currentVersion = previous?.version ?? 0;
        if (currentVersion !== input.expectedVersion)
          throw new ConflictException("SOURCE_REVIEW_VERSION_CONFLICT");
        const previousArrival = input.arrivalPreparationResult
          ? await tx.oceanOperationsArrivalPreparationResult.findFirst({
              where: { tenantId, containerId },
              orderBy: { version: "desc" },
            })
          : null;
        const currentArrivalVersion = previousArrival?.version ?? 0;
        if (
          input.arrivalPreparationResult !== undefined &&
          currentArrivalVersion !==
            (input.expectedArrivalPreparationVersion ?? 0)
        )
          throw new ConflictException("ARRIVAL_PREPARATION_VERSION_CONFLICT");
        const created = await tx.oceanOperationsSourceReview.create({
          data: {
            id: randomUUID(),
            tenantId,
            containerId,
            shipmentId: shipmentLink,
            sourceObservationId,
            sourceSystem: sourceObservation.sourceSystem,
            sourceVersion: sourceObservation.sourceVersion,
            parseState: sourceObservation.parseState,
            sourcePrecision: sourceObservation.sourcePrecision,
            rawValue: sourceObservation.rawValue,
            normalizedValue: normalized,
            reviewDecision: input.reviewDecision,
            reason,
            actorId,
            reviewedAt: new Date(),
            previousReviewId: previous?.id ?? null,
            writeBackTarget:
              input.reviewDecision === "adopt_observation_for_review"
                ? "ocean_operations.review_projection"
                : "none",
            version: currentVersion + 1,
            idempotencyKey,
            payloadHash,
            traceId,
          },
        });
        const createdArrival = input.arrivalPreparationResult
          ? await tx.oceanOperationsArrivalPreparationResult.create({
              data: {
                id: randomUUID(),
                tenantId,
                containerId,
                shipmentId: shipmentLink,
                sourceObservationId,
                sourceVersion: sourceObservation.sourceVersion,
                result: input.arrivalPreparationResult,
                reason,
                purpose: "customs_arrival_preparation",
                currentResponsibility: "海运运营",
                nextStep,
                actorId,
                recordedAt: new Date(),
                previousResultId: previousArrival?.id ?? null,
                version: currentArrivalVersion + 1,
                idempotencyKey,
                payloadHash: arrivalPayloadHash,
                traceId,
              },
            })
          : null;
        return {
          recordState: "recorded" as const,
          review: toReview(created),
          arrivalPreparation: createdArrival
            ? toArrivalPreparation(createdArrival)
            : null,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing =
          await this.prisma.oceanOperationsSourceReview.findUnique({
            where: {
              tenantId_idempotencyKey: {
                tenantId,
                idempotencyKey,
              },
            },
          });
        if (existing) {
          if (existing.payloadHash !== payloadHash)
            throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_CONFLICT");
          const existingArrival =
            await this.prisma.oceanOperationsArrivalPreparationResult.findUnique(
              {
                where: {
                  tenantId_idempotencyKey: {
                    tenantId,
                    idempotencyKey,
                  },
                },
              },
            );
          if (
            existingArrival &&
            existingArrival.payloadHash !== arrivalPayloadHash
          )
            throw new ConflictException("SOURCE_REVIEW_IDEMPOTENCY_CONFLICT");
          return {
            recordState: "duplicate" as const,
            review: toReview(existing),
            arrivalPreparation: existingArrival
              ? toArrivalPreparation(existingArrival)
              : null,
          };
        }
        throw new ConflictException("SOURCE_REVIEW_VERSION_CONFLICT");
      }
      throw error;
    }
  }

  private async findSourceObservation(
    tenantId: string,
    containerId: string,
    sourceObservationId: string,
  ): Promise<PersistedSourceObservation | null> {
    const separator = sourceObservationId.indexOf(":");
    if (separator < 1) return null;
    const kind = sourceObservationId.slice(0, separator);
    const id = sourceObservationId.slice(separator + 1);
    if (!id) return null;
    if (kind === "shipment-time")
      return this.prisma.shipmentTimeFact
        .findFirst({
          where: {
            id,
            tenantId,
            containerRecordId: containerId,
            isCurrent: true,
          },
          select: {
            factCode: true,
            eventCode: true,
            sourceSystem: true,
            sourceBatchId: true,
            sourceStatus: true,
            rawValue: true,
            occurredAtUtc: true,
          },
        })
        .then((row) =>
          row &&
          isOceanObservation({
            semanticKey: row.eventCode ?? row.factCode,
          })
            ? {
                sourceSystem: row.sourceSystem,
                sourceVersion: row.sourceBatchId,
                parseState: row.sourceStatus ?? "unknown",
                sourcePrecision: precisionFor(row.rawValue),
                rawValue: row.rawValue,
                normalizedValue: normalizedSourceDate(
                  row.sourceStatus ?? "unknown",
                  row.occurredAtUtc,
                ),
              }
            : null,
        );
    if (kind === "lifecycle")
      return this.prisma.lifecycleDateFact
        .findFirst({
          where: { id, tenantId, containerId, isCurrent: true },
          select: {
            nodeCode: true,
            eventCode: true,
            sourceSystem: true,
            mappingVersion: true,
            validity: true,
            rawValue: true,
            occurredAt: true,
          },
        })
        .then((row) =>
          row &&
          isOceanObservation({
            semanticKey: row.eventCode,
            nodeCode: row.nodeCode,
          })
            ? {
                sourceSystem: row.sourceSystem,
                sourceVersion: row.mappingVersion ?? "unknown",
                parseState: row.validity,
                sourcePrecision: precisionFor(row.rawValue),
                rawValue: row.rawValue,
                normalizedValue: normalizedSourceDate(
                  row.validity,
                  row.occurredAt,
                ),
              }
            : null,
        );
    if (kind === "provider")
      return this.prisma.oceanProviderEventIngestion
        .findFirst({
          where: { id, tenantId, containerRecordId: containerId },
          select: {
            canonicalEventCode: true,
            rawCode: true,
            provider: true,
            mappingVersion: true,
            normalizationKind: true,
            eventTimeRaw: true,
            occurredAt: true,
          },
        })
        .then((row) =>
          row &&
          isOceanObservation({
            semanticKey: row.canonicalEventCode ?? row.rawCode,
          })
            ? {
                sourceSystem: row.provider,
                sourceVersion: row.mappingVersion,
                parseState: row.normalizationKind,
                sourcePrecision: precisionFor(row.eventTimeRaw),
                rawValue: row.eventTimeRaw,
                normalizedValue: row.occurredAt
                  ? normalizedSourceDate(row.normalizationKind, row.occurredAt)
                  : null,
              }
            : null,
        );
    return null;
  }
}

function locationName(code: string | null): string | null {
  if (code === "CNFOC") return "福州";
  if (code === "USSAV") return "萨凡纳";
  return null;
}

function isDestinationEtaObservation(observation: SourceObservation): boolean {
  return (
    observation.semanticKey.toLowerCase() === "arrived" &&
    observation.timeKind === "estimated"
  );
}

function financialSourceFrom(
  references: {
    referenceType: string;
    sourceSystem: string;
    sourceRecordId: string;
    sourceVersion: string | null;
    metadata: unknown;
  }[],
): { amount: string; currency: string; sourceReference: string } | null {
  for (const reference of references) {
    if (
      reference.referenceType !== "stocking_order" ||
      !reference.metadata ||
      typeof reference.metadata !== "object" ||
      Array.isArray(reference.metadata)
    )
      continue;
    const metadata = reference.metadata as Record<string, unknown>;
    if (
      typeof metadata.oceanFreightAmount === "string" &&
      typeof metadata.oceanFreightCurrency === "string"
    )
      return {
        amount: metadata.oceanFreightAmount,
        currency: metadata.oceanFreightCurrency,
        sourceReference:
          typeof metadata.oceanFreightSourceReference === "string"
            ? metadata.oceanFreightSourceReference
            : `${reference.sourceSystem}:${reference.sourceRecordId}:${reference.sourceVersion ?? "unknown"}`,
      };
  }
  return null;
}

function required(value: string, error: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new ForbiddenException(error);
  return normalized;
}

function precisionFor(rawValue: string): string {
  const value = rawValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date-only";
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) return "date-time";
  return "unknown";
}

function markObservationConflicts(observations: SourceObservation[]): void {
  for (const observation of observations) {
    observation.conflict = observations.some((other) =>
      other.id !== observation.id && comparableObservations(observation, other) &&
      observation.normalizedValue && other.normalizedValue &&
      (observation.sourcePrecision === "date-only"
        ? observation.rawValue !== other.rawValue
        : Date.parse(observation.normalizedValue) !== Date.parse(other.normalizedValue)),
    );
  }
}

function toReview(row: {
  id: string;
  reviewDecision: string;
  reason: string;
  version: number;
  sourceObservationId: string;
  reviewedAt: Date;
  writeBackTarget: string;
}): NonNullable<OceanOperationsReviewProjection["review"]> {
  return {
    id: row.id,
    decision: row.reviewDecision as SourceReviewDecision,
    reason: row.reason,
    version: row.version,
    sourceObservationId: row.sourceObservationId,
    reviewedAt: row.reviewedAt.toISOString(),
    writeBackTarget: row.writeBackTarget,
  };
}

function toArrivalPreparation(row: {
  id: string;
  result: string;
  reason: string;
  sourceObservationId: string;
  sourceVersion: string;
  purpose: string;
  currentResponsibility: string;
  nextStep: string;
  version: number;
  recordedAt: Date;
}): NonNullable<OceanOperationsReviewProjection["arrivalPreparation"]> {
  return {
    id: row.id,
    result: row.result as ArrivalPreparationResult,
    reason: row.reason,
    sourceObservationId: row.sourceObservationId,
    sourceVersion: row.sourceVersion,
    purpose: "customs_arrival_preparation",
    currentResponsibility: "海运运营",
    nextStep: row.nextStep,
    version: row.version,
    recordedAt: row.recordedAt.toISOString(),
  };
}

interface PersistedSourceObservation {
  sourceSystem: string;
  sourceVersion: string;
  parseState: string;
  sourcePrecision: string;
  rawValue: string;
  normalizedValue: string | null;
}

const OCEAN_NODE_CODES = new Set([
  "shipment_dispatch",
  "origin_departure",
  "ocean_transit",
  "transshipment",
  "destination_arrival",
]);

const OCEAN_EVENT_CODES = new Set([
  "cargo_ready",
  "loaded",
  "departed",
  "sailing",
  "gate_in",
  "transit_arrived",
  "transit_departed",
  "arrived",
  "berthed",
  "discharged",
  "dumped",
  "rolled",
  "changed",
  "delay",
  "departure",
  "arrival_port",
  "eta",
  "etd",
  "vessel_departure",
  "vessel_arrival",
  "mother_vessel_departure",
]);

const NON_OCEAN_TOKENS = [
  "customs",
  "clearance",
  "unload",
  "unstuff",
  "pickup",
  "delivery",
  "warehouse",
  "gate_out",
  "empty_return",
  "rail_",
];

function isOceanObservation(input: {
  semanticKey?: string | null;
  nodeCode?: string | null;
}): boolean {
  const nodeCode = input.nodeCode?.trim().toLowerCase();
  const semanticKey = input.semanticKey?.trim().toLowerCase();
  if (
    [nodeCode, semanticKey].some(
      (value) =>
        value !== undefined &&
        value !== null &&
        NON_OCEAN_TOKENS.some((token) => value.includes(token)),
    )
  )
    return false;
  if (nodeCode)
    return (
      OCEAN_NODE_CODES.has(nodeCode) &&
      (!semanticKey || OCEAN_EVENT_CODES.has(semanticKey))
    );
  return Boolean(semanticKey && OCEAN_EVENT_CODES.has(semanticKey));
}

function normalizedSourceDate(status: string, value: Date): string | null {
  if (!isResolvedSourceStatus(status)) return null;
  return value.toISOString();
}

function isResolvedSourceStatus(status: string): boolean {
  return new Set([
    "parsed",
    "valid",
    "verified",
    "confirmed",
    "effective",
    "normalized",
    "accepted",
  ]).has(status.trim().toLowerCase());
}

function uniqueOceanShipmentLink<
  T extends {
    state: string;
    supersededAt: Date | null;
    shipment: { transportMode: string };
  },
>(links: T[]): T | null {
  const active = links.filter(
    (link) =>
      link.state === "active" &&
      link.supersededAt === null &&
      link.shipment.transportMode === "ocean",
  );
  return active.length === 1 ? active[0] : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
