import { Inject, Injectable } from "@nestjs/common";
import type {
  AssignmentState,
  BlockSummary,
  BusinessDecisionState,
  CommitState,
  ConfidenceState,
  ContainerShipmentContextV1,
  EvidenceValidity,
  FlowInstanceState,
  LifecycleNodeCode,
  LifecycleNodeState,
  NodeApplicability,
  NodeSummary,
  NodeTaskState,
  ProfessionalFactSummary,
  ReceptionState,
  SyncOperationSummary,
  TaskCompletionEligibility,
  TaskReadinessState,
  TaskSummary,
  TimeSlot,
  WorkOrderApplicability,
  WorkOrderState,
  WorkOrderSummary,
} from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ContainerOperationalProjection,
  ContainerOperationalViewQuery,
  ContainerOperationalViewRepository,
} from "../domain/container-operational-view.repository";

const NODE_SEQUENCE = new Map(
  lifecycleNodes.map((node) => [node.nodeCode, node.sequence]),
);

const flowSelect = Prisma.validator<Prisma.FlowInstanceSelect>()({
  id: true,
  state: true,
  currentNodeCode: true,
  version: true,
  definitionVersion: true,
  nodes: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      nodeCode: true,
      state: true,
      applicability: true,
      completedAt: true,
      blocks: {
        where: { resolution: { is: null } },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          blockType: true,
          occurredAt: true,
          nodeInstanceId: true,
          projectionVersion: true,
        },
      },
    },
  },
});

const dateFactSelect = Prisma.validator<Prisma.LifecycleDateFactSelect>()({
  id: true,
  nodeCode: true,
  eventCode: true,
  timeKind: true,
  occurredAt: true,
  segmentId: true,
  verificationState: true,
  confidenceState: true,
  validity: true,
  evidenceRefs: true,
  projectionVersion: true,
});

const taskSelect = Prisma.validator<Prisma.NodeTaskSelect>()({
  id: true,
  nodeInstanceId: true,
  taskDefinitionKey: true,
  state: true,
  applicability: true,
  readinessState: true,
  completionEligibility: true,
  conditionFactRefs: true,
  version: true,
  workOrders: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      workOrderDefinitionKey: true,
      state: true,
      applicability: true,
      assignmentState: true,
      dueAt: true,
      version: true,
      factApplications: {
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
        select: { id: true },
      },
    },
  },
});

const evidenceSelect = Prisma.validator<Prisma.EvidenceRecordSelect>()({
  id: true,
  verificationState: true,
  confidenceState: true,
  validity: true,
  decisions: {
    orderBy: { verificationSequence: "desc" },
    take: 1,
    select: { verificationSequence: true },
  },
});

const containerShipmentLinkSelect =
  Prisma.validator<Prisma.ShipmentContainerLinkSelect>()({
    id: true,
    version: true,
    evidenceRefs: true,
    shipment: {
      select: {
        id: true,
        shipmentNumber: true,
        currentLifecycleStatus: true,
        relationshipVersion: true,
        carrierCode: true,
        vesselName: true,
        voyageNumber: true,
        originCountryCode: true,
        originUnlocode: true,
        destinationCountryCode: true,
        destinationUnlocode: true,
        cargoOwnerId: true,
        cargoOwner: {
          select: {
            legalName: true,
            salesCountry: { select: { alpha2: true } },
          },
        },
        atdAt: true,
        etaAt: true,
        transportDocuments: {
          where: { state: "active", supersededAt: null },
          orderBy: [
            { documentType: "asc" },
            { documentNumber: "asc" },
            { id: "asc" },
          ],
          select: {
            id: true,
            documentType: true,
            documentNumber: true,
            scac: true,
            parentDocumentId: true,
            version: true,
            effectiveFrom: true,
            containerLinks: {
              select: { containerRecordId: true },
              orderBy: { containerRecordId: "asc" },
            },
          },
        },
        upstreamReferences: {
          where: { state: "active", supersededAt: null },
          orderBy: [
            { referenceType: "asc" },
            { sourceRecordId: "asc" },
            { id: "asc" },
          ],
          select: {
            id: true,
            containerRecordId: true,
            shipmentCargoLineId: true,
            referenceType: true,
            sourceSystem: true,
            sourceRecordId: true,
            sourceVersion: true,
            sourceLineId: true,
            version: true,
          },
        },
      },
    },
  });

type FlowRow = Prisma.FlowInstanceGetPayload<{ select: typeof flowSelect }>;
type DateFactRow = Prisma.LifecycleDateFactGetPayload<{
  select: typeof dateFactSelect;
}>;
type TaskRow = Prisma.NodeTaskGetPayload<{ select: typeof taskSelect }>;
type EvidenceRow = Prisma.EvidenceRecordGetPayload<{
  select: typeof evidenceSelect;
}>;
type ContainerShipmentLinkRow = Prisma.ShipmentContainerLinkGetPayload<{
  select: typeof containerShipmentLinkSelect;
}>;
type OperationalExceptionRow = {
  id: string;
  exceptionCode: string;
  severity: string;
  occurredAt: Date;
  version: number;
};

@Injectable()
export class PrismaContainerOperationalViewRepository implements ContainerOperationalViewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByContainer(
    query: ContainerOperationalViewQuery,
  ): Promise<ContainerOperationalProjection | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const container = await transaction.containerRecord.findFirst({
          where: {
            id: query.containerId,
            tenantId: query.tenantId,
            containerNumber: { not: null },
          },
          select: { id: true, tenantId: true, containerNumber: true },
        });
        if (!container?.containerNumber) return null;

        const shipmentLink = await transaction.shipmentContainerLink.findFirst({
          where: {
            tenantId: query.tenantId,
            containerRecordId: container.id,
            state: "active",
            supersededAt: null,
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
          select: containerShipmentLinkSelect,
        });
        const flow = await transaction.flowInstance.findUnique({
          where: { containerId: container.id },
          select: flowSelect,
        });
        const dateFacts = await transaction.lifecycleDateFact.findMany({
          where: {
            tenantId: query.tenantId,
            containerId: container.id,
            isCurrent: true,
          },
          orderBy: [
            { occurredAt: "asc" },
            { projectionVersion: "asc" },
            { id: "asc" },
          ],
          select: dateFactSelect,
        });
        const tasks = await transaction.nodeTask.findMany({
          where: { tenantId: query.tenantId, containerId: container.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: taskSelect,
        });
        const customsCase = await transaction.customsClearanceCase.findFirst({
          where: {
            tenantId: query.tenantId,
            containerRecordId: container.id,
            supersededAt: null,
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
          select: { version: true, evidenceRefs: true },
        });
        const delivery =
          await transaction.warehouseDeliveryInstruction.findFirst({
            where: {
              tenantId: query.tenantId,
              containerRecordId: container.id,
              supersededAt: null,
            },
            orderBy: [{ version: "desc" }, { id: "desc" }],
            select: { version: true, evidenceRefs: true },
          });
        const unloading = await transaction.containerUnloadingReport.findFirst({
          where: {
            tenantId: query.tenantId,
            containerRecordId: container.id,
            supersededAt: null,
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
          select: { version: true, evidenceRefs: true },
        });

        const referencedEvidence = uniqueStrings([
          ...stringArray(shipmentLink?.evidenceRefs),
          ...dateFacts.flatMap((fact) => stringArray(fact.evidenceRefs)),
          ...stringArray(customsCase?.evidenceRefs),
          ...stringArray(delivery?.evidenceRefs),
          ...stringArray(unloading?.evidenceRefs),
        ]);
        const workOrderIds = tasks.flatMap((task) =>
          task.workOrders.map(({ id }) => id),
        );
        const evidence = await transaction.evidenceRecord.findMany({
          where: {
            tenantId: query.tenantId,
            OR: [
              { subjectId: container.id },
              ...(referencedEvidence.length > 0
                ? [{ id: { in: referencedEvidence } }]
                : []),
            ],
          },
          orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
          select: evidenceSelect,
        });
        const operations = await transaction.clientOperation.findMany({
          where: {
            tenantId: query.tenantId,
            targetId: { in: [container.id, ...workOrderIds] },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 100,
          select: {
            id: true,
            receptionState: true,
            businessDecisionState: true,
            commitState: true,
            attemptCount: true,
            lastAttemptAt: true,
            nextAttemptAt: true,
            rejectionReasonCode: true,
            traceId: true,
          },
        });
        const exceptions = await transaction.operationalExceptionCase.findMany({
          where: {
            tenantId: query.tenantId,
            containerRecordId: container.id,
            status: { in: ["open", "investigating"] },
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            exceptionCode: true,
            severity: true,
            occurredAt: true,
            version: true,
          },
        });

        return projectOperationalView({
          tenantId: container.tenantId,
          containerId: container.id,
          containerNumber: container.containerNumber,
          shipmentLink,
          flow,
          dateFacts,
          tasks,
          evidence,
          operations,
          exceptions,
          sourceDomainVersions: {
            customs: customsCase?.version ?? null,
            inland: Math.max(delivery?.version ?? 0, unloading?.version ?? 0),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

function projectOperationalView(input: {
  tenantId: string;
  containerId: string;
  containerNumber: string;
  shipmentLink: ContainerShipmentLinkRow | null;
  flow: FlowRow | null;
  dateFacts: DateFactRow[];
  tasks: TaskRow[];
  evidence: EvidenceRow[];
  operations: Array<{
    id: string;
    receptionState: string;
    businessDecisionState: string;
    commitState: string;
    attemptCount: number;
    lastAttemptAt: Date | null;
    nextAttemptAt: Date | null;
    rejectionReasonCode: string | null;
    traceId: string;
  }>;
  exceptions: OperationalExceptionRow[];
  sourceDomainVersions: { customs: number | null; inland: number };
}): ContainerOperationalProjection {
  const asOf = new Date().toISOString();
  const factsForCurrentTime = input.dateFacts.filter(
    (fact) => fact.validity === "effective",
  );
  const nodeTimes = timeSlots(
    factsForCurrentTime.filter((fact) => fact.segmentId === null),
  );
  const segmentTimes = timeSlots(
    factsForCurrentTime.filter((fact) => fact.segmentId !== null),
  );
  const taskByNode = new Map(
    input.tasks.map((task) => [task.nodeInstanceId, task]),
  );
  const timeByNode = new Map(nodeTimes.map((slot) => [slot.nodeCode, slot]));
  const nodes =
    input.flow?.nodes
      .map((node) =>
        toNodeSummary(
          node,
          taskByNode.get(node.id),
          timeByNode.get(node.nodeCode as LifecycleNodeCode),
        ),
      )
      .sort(
        (left, right) =>
          left.sequence - right.sequence ||
          left.nodeInstanceId.localeCompare(right.nodeInstanceId),
      ) ?? [];
  const currentNode =
    nodes.find((node) => node.nodeCode === input.flow?.currentNodeCode) ?? null;
  const blocks = input.flow?.nodes.flatMap((node) => node.blocks) ?? [];
  const blockRefsByNode = new Map<string, string[]>();
  for (const block of blocks) {
    blockRefsByNode.set(block.nodeInstanceId, [
      ...(blockRefsByNode.get(block.nodeInstanceId) ?? []),
      block.id,
    ]);
  }
  const tasks = input.tasks.map((task) =>
    toTaskSummary(task, blockRefsByNode.get(task.nodeInstanceId) ?? []),
  );
  const workOrders = input.tasks.flatMap((task) =>
    toWorkOrderSummaries(task, blockRefsByNode.get(task.nodeInstanceId) ?? []),
  );

  const lifecycleVersion = Math.max(
    input.flow?.version ?? 0,
    ...input.dateFacts.map(({ projectionVersion }) => projectionVersion),
  );
  const workVersion = Math.max(
    0,
    ...input.tasks.flatMap((task) => [
      task.version,
      ...task.workOrders.map(({ version }) => version),
    ]),
  );
  const evidenceVersion = Math.max(
    0,
    ...input.evidence.map(
      (item) => item.decisions[0]?.verificationSequence ?? 0,
    ),
  );
  const sourceVersions = [
    ...(input.shipmentLink
      ? [
          {
            source: "shipment-registry",
            version: input.shipmentLink.shipment.relationshipVersion,
          },
        ]
      : []),
    ...(lifecycleVersion > 0
      ? [{ source: "lifecycle-control", version: lifecycleVersion }]
      : []),
    ...(workVersion > 0
      ? [{ source: "work-execution", version: workVersion }]
      : []),
    ...(input.sourceDomainVersions.customs !== null
      ? [
          {
            source: "customs-compliance",
            version: input.sourceDomainVersions.customs,
          },
        ]
      : []),
    ...(input.sourceDomainVersions.inland > 0
      ? [
          {
            source: "inland-fulfillment",
            version: input.sourceDomainVersions.inland,
          },
        ]
      : []),
    ...(evidenceVersion > 0
      ? [{ source: "document-records", version: evidenceVersion }]
      : []),
    ...(input.exceptions.length > 0
      ? [
          {
            source: "exception-management",
            version: Math.max(
              ...input.exceptions.map(({ version }) => version),
            ),
          },
        ]
      : []),
  ];
  const projectionVersion = Math.max(
    0,
    ...sourceVersions.map(({ version }) => version),
  );

  return {
    tenantId: input.tenantId,
    containerId: input.containerId,
    containerNumber: input.containerNumber,
    shipment: toShipmentContext(input.containerId, input.shipmentLink),
    flow: input.flow
      ? {
          flowInstanceId: input.flow.id,
          state: input.flow.state as FlowInstanceState,
          definitionVersion: input.flow.definitionVersion,
          version: input.flow.version,
        }
      : null,
    currentNode,
    nodes,
    currentTimes: { nodeTimes, segmentTimes },
    tasks,
    workOrders,
    professionalFacts: input.dateFacts.map(toProfessionalFact),
    evidenceSummary: evidenceSummary(input.evidence),
    syncSummary: { operations: input.operations.map(toSyncOperation) },
    activeBlocks: blocks.map((block) => toBlockSummary(input.tenantId, block)),
    activeExceptions: input.exceptions.map((exception) => ({
      exceptionId: exception.id,
      target: {
        tenantId: input.tenantId,
        entityType: "container" as const,
        entityId: input.containerId,
        ownerModule: "shipment-registry" as const,
      },
      exceptionCode: exception.exceptionCode,
      severity: exception.severity,
      occurredAt: exception.occurredAt.toISOString(),
    })),
    projectionVersion,
    sourceVersions,
    asOf,
    freshness: {
      state: "current",
      projectedAt: asOf,
      sourceHighWatermark: String(projectionVersion),
      lagSeconds: 0,
    },
  };
}

function toShipmentContext(
  containerId: string,
  link: ContainerShipmentLinkRow | null,
): ContainerShipmentContextV1 | null {
  if (!link) return null;
  const shipment = link.shipment;
  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    linkId: link.id,
    linkVersion: link.version,
    currentLifecycleStatus:
      shipment.currentLifecycleStatus as ContainerShipmentContextV1["currentLifecycleStatus"],
    relationshipVersion: shipment.relationshipVersion,
    carrierCode: shipment.carrierCode,
    vesselName: shipment.vesselName,
    voyageNumber: shipment.voyageNumber,
    originCountryCode: shipment.originCountryCode,
    originUnlocode: shipment.originUnlocode,
    destinationCountryCode: shipment.destinationCountryCode,
    destinationUnlocode: shipment.destinationUnlocode,
    salesCountryCode: shipment.cargoOwner?.salesCountry.alpha2 ?? null,
    cargoOwnerReferenceId: shipment.cargoOwnerId,
    cargoOwnerName: shipment.cargoOwner?.legalName ?? null,
    atdAt: shipment.atdAt?.toISOString() ?? null,
    etaAt: shipment.etaAt?.toISOString() ?? null,
    transportDocuments: shipment.transportDocuments
      .filter((document) =>
        document.containerLinks.some(
          ({ containerRecordId }) => containerRecordId === containerId,
        ),
      )
      .map((document) => ({
        id: document.id,
        documentType:
          document.documentType as ContainerShipmentContextV1["transportDocuments"][number]["documentType"],
        documentNumber: document.documentNumber,
        scac: document.scac,
        parentDocumentId: document.parentDocumentId,
        containerRecordIds: document.containerLinks.map(
          ({ containerRecordId }) => containerRecordId,
        ),
        version: document.version,
        effectiveFrom: document.effectiveFrom.toISOString(),
      })),
    upstreamReferences: shipment.upstreamReferences
      .filter((reference) => reference.containerRecordId === containerId)
      .map((reference) => ({
        id: reference.id,
        containerRecordId: reference.containerRecordId,
        shipmentCargoLineId: reference.shipmentCargoLineId,
        referenceType:
          reference.referenceType as ContainerShipmentContextV1["upstreamReferences"][number]["referenceType"],
        sourceSystem: reference.sourceSystem,
        sourceRecordId: reference.sourceRecordId,
        sourceVersion: reference.sourceVersion,
        sourceLineId: reference.sourceLineId,
        version: reference.version,
      })),
  };
}

function toNodeSummary(
  node: FlowRow["nodes"][number],
  task: TaskRow | undefined,
  time: TimeSlot | undefined,
): NodeSummary {
  return {
    nodeInstanceId: node.id,
    nodeCode: node.nodeCode as LifecycleNodeCode,
    sequence: NODE_SEQUENCE.get(node.nodeCode as LifecycleNodeCode) ?? 14,
    activationNo: 1,
    applicability: node.applicability as NodeApplicability,
    state: node.state as LifecycleNodeState,
    ...(time?.plannedAt ? { plannedAt: time.plannedAt } : {}),
    ...(time?.estimatedAt ? { estimatedAt: time.estimatedAt } : {}),
    ...(time?.actualAt
      ? { actualAt: time.actualAt }
      : node.completedAt
        ? { actualAt: node.completedAt.toISOString() }
        : {}),
    activeBlockCount: node.blocks.length,
    taskProgress: {
      required:
        task?.workOrders.filter(
          ({ applicability }) => applicability !== "not_applicable",
        ).length ?? 0,
      completed:
        task?.workOrders.filter(({ state }) => state === "completed").length ??
        0,
      blocked:
        task?.workOrders.filter(({ state }) => state === "blocked").length ?? 0,
    },
    version: task?.version ?? 0,
  };
}

function toTaskSummary(task: TaskRow, activeBlockRefs: string[]): TaskSummary {
  const factApplicationRefs = uniqueStrings(
    task.workOrders.flatMap((workOrder) =>
      workOrder.factApplications.map(({ id }) => id),
    ),
  );
  return {
    nodeTaskId: task.id,
    nodeInstanceId: task.nodeInstanceId,
    taskDefinitionKey: task.taskDefinitionKey,
    taskDefinitionVersion: 1,
    state: task.state as NodeTaskState,
    applicability: task.applicability as NodeApplicability,
    readinessState: task.readinessState as TaskReadinessState,
    completionEligibility:
      task.completionEligibility as TaskCompletionEligibility,
    conditionFactRefs: stringArray(task.conditionFactRefs),
    requiredWorkOrderCount: task.workOrders.filter(
      ({ applicability }) => applicability !== "not_applicable",
    ).length,
    completedWorkOrderCount: task.workOrders.filter(
      ({ state }) => state === "completed",
    ).length,
    activeBlockRefs,
    factApplicationRefs,
    version: task.version,
  };
}

function toWorkOrderSummaries(
  task: TaskRow,
  activeBlockRefs: string[],
): WorkOrderSummary[] {
  return task.workOrders.map((workOrder) => ({
    workOrderId: workOrder.id,
    nodeTaskId: task.id,
    workOrderDefinitionKey: workOrder.workOrderDefinitionKey,
    workOrderDefinitionVersion: 1,
    state: workOrder.state as WorkOrderState,
    applicability: workOrder.applicability as WorkOrderApplicability,
    assignmentState: workOrder.assignmentState as AssignmentState,
    ...(workOrder.dueAt ? { dueAt: workOrder.dueAt.toISOString() } : {}),
    completionPredicateCount: 1,
    satisfiedPredicateCount: workOrder.state === "completed" ? 1 : 0,
    activeBlockRefs,
    factApplicationRefs: workOrder.factApplications.map(({ id }) => id),
    version: workOrder.version,
  }));
}

function timeSlots(facts: DateFactRow[]): TimeSlot[] {
  const slots = new Map<string, TimeSlot>();
  for (const fact of facts) {
    if (!["planned", "estimated", "actual"].includes(fact.timeKind)) continue;
    const key = `${fact.nodeCode}:${fact.segmentId ?? "node"}`;
    const slot = slots.get(key) ?? {
      nodeCode: fact.nodeCode as LifecycleNodeCode,
      ...(fact.segmentId ? { segmentId: fact.segmentId } : {}),
    };
    slot[`${fact.timeKind}At` as "plannedAt" | "estimatedAt" | "actualAt"] =
      fact.occurredAt.toISOString();
    slots.set(key, slot);
  }
  return [...slots.values()].sort(
    (left, right) =>
      (NODE_SEQUENCE.get(left.nodeCode) ?? 14) -
        (NODE_SEQUENCE.get(right.nodeCode) ?? 14) ||
      (left.segmentId ?? "").localeCompare(right.segmentId ?? ""),
  );
}

function toProfessionalFact(fact: DateFactRow): ProfessionalFactSummary {
  return {
    domainFactId: fact.id,
    factType: fact.eventCode,
    occurredAt: fact.occurredAt.toISOString(),
    validity: fact.validity as EvidenceValidity,
    confidenceState: fact.confidenceState as ConfidenceState,
    evidenceRefs: stringArray(fact.evidenceRefs),
  };
}

function evidenceSummary(evidence: EvidenceRow[]) {
  return {
    total: evidence.length,
    effective: evidence.filter(
      (item) =>
        item.validity === "effective" && item.verificationState === "verified",
    ).length,
    pending: evidence.filter((item) => item.verificationState === "pending")
      .length,
    disputed: evidence.filter((item) => item.confidenceState === "disputed")
      .length,
    evidenceRefs: evidence.map(({ id }) => id),
    restrictedEvidencePresent: false,
  };
}

function toSyncOperation(operation: {
  id: string;
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  rejectionReasonCode: string | null;
  traceId: string;
}): SyncOperationSummary {
  return {
    clientOperationId: operation.id,
    receptionState: operation.receptionState as ReceptionState,
    businessDecisionState:
      operation.businessDecisionState as BusinessDecisionState,
    commitState: operation.commitState as CommitState,
    attemptCount: operation.attemptCount,
    ...(operation.lastAttemptAt
      ? { lastAttemptAt: operation.lastAttemptAt.toISOString() }
      : {}),
    ...(operation.nextAttemptAt
      ? { nextAttemptAt: operation.nextAttemptAt.toISOString() }
      : {}),
    ...(operation.rejectionReasonCode
      ? { failureCode: operation.rejectionReasonCode }
      : {}),
    traceId: operation.traceId,
  };
}

function toBlockSummary(
  tenantId: string,
  block: FlowRow["nodes"][number]["blocks"][number],
): BlockSummary {
  return {
    blockId: block.id,
    target: {
      tenantId,
      entityType: "node_instance",
      entityId: block.nodeInstanceId,
      ownerModule: "lifecycle-control",
    },
    blockType: block.blockType,
    reasonCode: block.blockType,
    occurredAt: block.occurredAt.toISOString(),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
