import { describe, expect, it, vi } from "vitest";
import { PrismaContainerOperationalViewRepository } from "./prisma-container-operational-view.repository";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const CONTAINER_ID = "20000000-0000-4000-8000-000000000001";
const FLOW_ID = "30000000-0000-4000-8000-000000000001";
const NODE_ID = "40000000-0000-4000-8000-000000000001";
const TASK_ID = "50000000-0000-4000-8000-000000000001";
const WORK_ORDER_ID = "60000000-0000-4000-8000-000000000001";
const FACT_ID = "70000000-0000-4000-8000-000000000001";
const EVIDENCE_ID = "80000000-0000-4000-8000-000000000001";
const BLOCK_ID = "90000000-0000-4000-8000-000000000001";
const OPERATION_ID = "a0000000-0000-4000-8000-000000000001";
const SHIPMENT_ID = "b0000000-0000-4000-8000-000000000001";
const LINK_ID = "c0000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "d0000000-0000-4000-8000-000000000001";
const REFERENCE_ID = "e0000000-0000-4000-8000-000000000001";

describe("PrismaContainerOperationalViewRepository", () => {
  it("projects one tenant-scoped operational snapshot from authoritative facts", async () => {
    const transaction = transactionMock();
    transaction.containerRecord.findFirst.mockResolvedValue({
      id: CONTAINER_ID,
      tenantId: TENANT_ID,
      containerNumber: "HMMU4207629",
    });
    transaction.shipmentContainerLink.findFirst.mockResolvedValue({
      id: LINK_ID,
      version: 2,
      evidenceRefs: [EVIDENCE_ID],
      shipment: {
        id: SHIPMENT_ID,
        shipmentNumber: "SHIP-001",
        currentLifecycleStatus: "in_transit",
        relationshipVersion: 5,
        carrierCode: "HMM",
        vesselName: "ONE TRUTH",
        voyageNumber: "V001",
        originCountryCode: "CN",
        originUnlocode: "CNNGB",
        destinationCountryCode: "US",
        destinationUnlocode: "USLAX",
        cargoOwnerId: "cb0d6214-2f8b-5de6-a8e4-afcc0411f4d3",
        cargoOwner: {
          legalName: "AOSOM LLC",
          salesCountry: { alpha2: "US" },
        },
        atdAt: new Date("2026-09-22T08:00:00.000Z"),
        etaAt: new Date("2026-10-10T08:00:00.000Z"),
        transportDocuments: [
          {
            id: DOCUMENT_ID,
            documentType: "mbl",
            documentNumber: "NBOZ9FF56400",
            scac: "HDMU",
            parentDocumentId: null,
            version: 1,
            effectiveFrom: new Date("2026-09-22T08:00:00.000Z"),
            containerLinks: [{ containerRecordId: CONTAINER_ID }],
          },
        ],
        upstreamReferences: [
          {
            id: REFERENCE_ID,
            containerRecordId: CONTAINER_ID,
            shipmentCargoLineId: null,
            referenceType: "stocking_order",
            sourceSystem: "packing-platform",
            sourceRecordId: "26DSC01811",
            sourceVersion: "1",
            sourceLineId: null,
            version: 1,
          },
        ],
      },
    });
    transaction.flowInstance.findUnique.mockResolvedValue({
      id: FLOW_ID,
      state: "active",
      currentNodeCode: "origin_departure",
      version: 3,
      definitionVersion: 1,
      nodes: [
        {
          id: NODE_ID,
          nodeCode: "origin_departure",
          state: "blocked",
          applicability: "required",
          completedAt: null,
          blocks: [
            {
              id: BLOCK_ID,
              blockType: "missing_evidence",
              occurredAt: new Date("2026-09-23T07:30:00.000Z"),
              nodeInstanceId: NODE_ID,
              projectionVersion: 3,
            },
          ],
        },
      ],
    });
    transaction.lifecycleDateFact.findMany.mockResolvedValue([
      {
        id: FACT_ID,
        nodeCode: "origin_departure",
        eventCode: "departed",
        timeKind: "actual",
        occurredAt: new Date("2026-09-22T08:00:00.000Z"),
        segmentId: null,
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        evidenceRefs: [EVIDENCE_ID],
        projectionVersion: 4,
      },
    ]);
    transaction.nodeTask.findMany.mockResolvedValue([
      {
        id: TASK_ID,
        nodeInstanceId: NODE_ID,
        taskDefinitionKey: "node-origin_departure",
        state: "in_progress",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [FACT_ID],
        version: 2,
        workOrders: [
          {
            id: WORK_ORDER_ID,
            workOrderDefinitionKey: "wo-origin_departure",
            state: "in_progress",
            applicability: "required",
            assignmentState: "assigned",
            dueAt: new Date("2026-09-24T08:00:00.000Z"),
            version: 2,
            factApplications: [],
          },
        ],
      },
    ]);
    transaction.customsClearanceCase.findFirst.mockResolvedValue(null);
    transaction.warehouseDeliveryInstruction.findFirst.mockResolvedValue(null);
    transaction.containerUnloadingReport.findFirst.mockResolvedValue(null);
    transaction.evidenceRecord.findMany.mockResolvedValue([
      {
        id: EVIDENCE_ID,
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        decisions: [{ verificationSequence: 2 }],
      },
    ]);
    transaction.clientOperation.findMany.mockResolvedValue([
      {
        id: OPERATION_ID,
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        attemptCount: 1,
        lastAttemptAt: new Date("2026-09-23T08:00:00.000Z"),
        nextAttemptAt: null,
        rejectionReasonCode: null,
        traceId: "trace-1",
      },
    ]);
    transaction.operationalExceptionCase.findMany.mockResolvedValue([]);
    const repository = new PrismaContainerOperationalViewRepository(
      prismaMock(transaction) as never,
    );

    const result = await repository.findByContainer({
      tenantId: TENANT_ID,
      containerId: CONTAINER_ID,
    });

    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      containerId: CONTAINER_ID,
      containerNumber: "HMMU4207629",
      shipment: {
        shipmentId: SHIPMENT_ID,
        linkId: LINK_ID,
        currentLifecycleStatus: "in_transit",
        relationshipVersion: 5,
        salesCountryCode: "US",
        cargoOwnerName: "AOSOM LLC",
        cargoOwnerReferenceId: "cb0d6214-2f8b-5de6-a8e4-afcc0411f4d3",
        transportDocuments: [
          {
            id: DOCUMENT_ID,
            documentNumber: "NBOZ9FF56400",
            containerRecordIds: [CONTAINER_ID],
          },
        ],
        upstreamReferences: [
          {
            id: REFERENCE_ID,
            referenceType: "stocking_order",
            sourceRecordId: "26DSC01811",
          },
        ],
      },
      flow: { flowInstanceId: FLOW_ID, version: 3 },
      currentNode: {
        nodeInstanceId: NODE_ID,
        nodeCode: "origin_departure",
        sequence: 4,
        state: "blocked",
        actualAt: "2026-09-22T08:00:00.000Z",
        activeBlockCount: 1,
        taskProgress: { required: 1, completed: 0, blocked: 0 },
      },
      currentTimes: {
        nodeTimes: [
          {
            nodeCode: "origin_departure",
            actualAt: "2026-09-22T08:00:00.000Z",
          },
        ],
      },
      tasks: [{ nodeTaskId: TASK_ID, conditionFactRefs: [FACT_ID] }],
      workOrders: [{ workOrderId: WORK_ORDER_ID, version: 2 }],
      professionalFacts: [
        { domainFactId: FACT_ID, evidenceRefs: [EVIDENCE_ID] },
      ],
      evidenceSummary: {
        total: 1,
        effective: 1,
        pending: 0,
        disputed: 0,
        evidenceRefs: [EVIDENCE_ID],
      },
      syncSummary: {
        operations: [
          {
            clientOperationId: OPERATION_ID,
            receptionState: "received",
            businessDecisionState: "accepted",
            commitState: "committed",
          },
        ],
      },
      activeBlocks: [
        {
          blockId: BLOCK_ID,
          target: { entityType: "node_instance", entityId: NODE_ID },
          reasonCode: "missing_evidence",
        },
      ],
      projectionVersion: 5,
      freshness: { state: "current", sourceHighWatermark: "5" },
    });
    expect(transaction.containerRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CONTAINER_ID,
          tenantId: TENANT_ID,
          containerNumber: { not: null },
        },
      }),
    );
  });

  it("does not expose an operational view for an object without a bound container number", async () => {
    const transaction = transactionMock();
    transaction.containerRecord.findFirst.mockResolvedValue(null);
    const repository = new PrismaContainerOperationalViewRepository(
      prismaMock(transaction) as never,
    );

    await expect(
      repository.findByContainer({
        tenantId: TENANT_ID,
        containerId: CONTAINER_ID,
      }),
    ).resolves.toBeNull();
    expect(transaction.flowInstance.findUnique).not.toHaveBeenCalled();
  });
});

function transactionMock() {
  return {
    containerRecord: { findFirst: vi.fn() },
    shipmentContainerLink: { findFirst: vi.fn() },
    flowInstance: { findUnique: vi.fn() },
    lifecycleDateFact: { findMany: vi.fn() },
    nodeTask: { findMany: vi.fn() },
    customsClearanceCase: { findFirst: vi.fn() },
    warehouseDeliveryInstruction: { findFirst: vi.fn() },
    containerUnloadingReport: { findFirst: vi.fn() },
    evidenceRecord: { findMany: vi.fn() },
    clientOperation: { findMany: vi.fn() },
    operationalExceptionCase: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function prismaMock(transaction: ReturnType<typeof transactionMock>) {
  return {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    ),
  };
}
