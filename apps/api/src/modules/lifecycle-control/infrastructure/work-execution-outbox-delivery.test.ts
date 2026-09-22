import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ReconcileAppliedLifecycleFactPort } from "../../work-execution";
import { OutboxDeliveryError } from "../domain/outbox-failure";
import type { ClaimedOutbox } from "../domain/outbox-publish";
import { buildWorkFactReconciliationOutboxPending } from "../domain/work-fact-reconciliation-outbox";
import { StubOutboxDelivery } from "./stub-outbox-delivery";
import { WorkExecutionOutboxDelivery } from "./work-execution-outbox-delivery";

const OCCURRED_AT = new Date("2026-09-21T08:00:00.000Z");
const RECEIVED_AT = new Date("2026-09-21T08:01:00.000Z");
const identity = {
  nodeEventApplicationId: "application-1",
  tenantId: "tenant-1",
  containerId: "container-1",
  flowInstanceId: "flow-1",
  nodeInstanceId: "node-1",
  canonicalEventId: "event-1",
};

function claimed(overrides: Partial<ClaimedOutbox> = {}): ClaimedOutbox {
  const pending = buildWorkFactReconciliationOutboxPending({
    ...identity,
    occurredAt: OCCURRED_AT,
    traceId: "trace-1",
  });
  return {
    id: pending.id,
    tenantId: pending.tenantId,
    ownerModule: pending.ownerModule,
    eventId: pending.eventId,
    eventType: pending.eventType,
    eventVersion: pending.eventVersion,
    aggregateType: pending.aggregateType,
    aggregateId: pending.aggregateId,
    payloadRef: pending.payloadRef,
    payloadHash: pending.payloadHash,
    state: "publishing",
    attemptCount: 1,
    lease: {
      owner: "publisher-1",
      lockedAt: RECEIVED_AT,
      expiresAt: new Date("2026-09-21T08:01:30.000Z"),
    },
    occurredAt: pending.occurredAt,
    createdAt: RECEIVED_AT,
    idempotencyKey: pending.idempotencyKey,
    traceId: pending.traceId,
    ...overrides,
  };
}

function buildDelivery(options?: {
  execute?: ReturnType<typeof vi.fn>;
  context?: ReturnType<typeof authorityContext> | null;
  fallback?: ReturnType<typeof vi.fn>;
}) {
  const context =
    options && "context" in options ? options.context : authorityContext();
  const tx = {
    nodeEventApplication: {
      findUnique: vi.fn().mockResolvedValue(context?.application ?? null),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  const reconcile = {
    execute:
      options?.execute ??
      vi.fn().mockResolvedValue({
        nodeTaskId: "task-1",
        factApplicationIds: ["fact-application-1"],
        decision: "applied",
        taskState: "completed",
        outcomeId: "outcome-1",
        reasonCode: null,
      }),
  };
  const fallback = new StubOutboxDelivery();
  if (options?.fallback) fallback.deliver = options.fallback;
  const assertContainerTenant = {
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    delivery: new WorkExecutionOutboxDelivery(
      prisma as never,
      reconcile as ReconcileAppliedLifecycleFactPort,
      assertContainerTenant,
      fallback,
    ),
    prisma,
    reconcile,
    assertContainerTenant,
    tx,
  };
}

describe("WorkExecutionOutboxDelivery", () => {
  it("loads lifecycle-owned records and sends the complete causal command", async () => {
    const { delivery, reconcile, assertContainerTenant } = buildDelivery();

    await expect(delivery.deliver(claimed())).resolves.toEqual({
      brokerReference: "work-execution:event-1:node-1:applied",
    });
    expect(reconcile.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerId: "container-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "container_unloading",
      canonicalEventId: "event-1",
      eventCode: "unloaded",
      businessFactType: "lifecycle_date_fact",
      domainFactId: "date-fact-1",
      captureSource: "external_evidence",
      evidenceRefs: ["evidence-1", "evidence-2"],
      occurredAt: OCCURRED_AT,
      receivedAt: RECEIVED_AT,
      actorOrServiceId: "reviewer-1",
      traceId: "trace-1",
      idempotencyKey: "reconcile-applied-lifecycle-fact/event-1/node-1",
    });
    expect(assertContainerTenant.execute).toHaveBeenCalledWith({
      containerId: "container-1",
      tenantId: "tenant-1",
    });
  });

  it("keeps ordinary canonical event delivery on the existing path", async () => {
    const fallback = vi
      .fn()
      .mockResolvedValue({ brokerReference: "stub:event-1" });
    const { delivery, reconcile, prisma } = buildDelivery({ fallback });

    await expect(
      delivery.deliver(
        claimed({ eventType: "unloaded", payloadRef: "canonical-event/e1" }),
      ),
    ).resolves.toEqual({ brokerReference: "stub:event-1" });
    expect(fallback).toHaveBeenCalledOnce();
    expect(reconcile.execute).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unsupported reconciliation event version before loading context", async () => {
    const { delivery, reconcile, prisma } = buildDelivery();

    await expect(
      delivery.deliver(claimed({ eventVersion: 2 })),
    ).rejects.toMatchObject({
      errorCode: "schema_invalid",
      message: "RECONCILIATION_EVENT_VERSION_UNSUPPORTED",
    });
    expect(reconcile.execute).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("treats TASK_NOT_INITIALIZED as retryable", async () => {
    const { delivery } = buildDelivery({
      execute: vi.fn().mockResolvedValue({
        nodeTaskId: null,
        factApplicationIds: [],
        decision: "no_op",
        taskState: null,
        outcomeId: null,
        reasonCode: "TASK_NOT_INITIALIZED",
      }),
    });

    await expect(delivery.deliver(claimed())).rejects.toMatchObject({
      errorCode: "task_not_initialized",
    });
  });

  it("turns stable business rejection into a non-retry delivery error", async () => {
    const { delivery } = buildDelivery({
      execute: vi.fn().mockResolvedValue({
        nodeTaskId: "task-1",
        factApplicationIds: ["application-1"],
        decision: "rejected",
        taskState: "cancelled",
        outcomeId: null,
        reasonCode: "NODE_TASK_CANCELLED",
      }),
    });

    await expect(delivery.deliver(claimed())).rejects.toMatchObject({
      errorCode: "node_task_cancelled",
    });
  });

  it("maps idempotency conflicts to a stable non-retry code", async () => {
    const { delivery } = buildDelivery({
      execute: vi
        .fn()
        .mockRejectedValue(
          new HttpException("IDEMPOTENCY_CONFLICT", HttpStatus.CONFLICT),
        ),
    });

    await expect(delivery.deliver(claimed())).rejects.toMatchObject({
      errorCode: "idempotency_conflict",
    });
  });

  it("treats exhausted optimistic concurrency as retryable", async () => {
    const { delivery } = buildDelivery({
      execute: vi
        .fn()
        .mockRejectedValue(
          new HttpException(
            "CONCURRENCY_VERSION_CONFLICT",
            HttpStatus.CONFLICT,
          ),
        ),
    });

    await expect(delivery.deliver(claimed())).rejects.toMatchObject({
      errorCode: "concurrency_conflict",
    });
  });

  it("rejects a changed reference or hash before calling work-execution", async () => {
    const { delivery, reconcile } = buildDelivery();

    await expect(
      delivery.deliver(claimed({ payloadHash: "f".repeat(64) })),
    ).rejects.toBeInstanceOf(OutboxDeliveryError);
    expect(reconcile.execute).not.toHaveBeenCalled();
  });

  it("allows same fact replay to complete without another lifecycle apply", async () => {
    const execute = vi.fn().mockResolvedValue({
      nodeTaskId: "task-1",
      factApplicationIds: ["fact-application-1"],
      decision: "applied",
      taskState: "completed",
      outcomeId: "outcome-1",
      reasonCode: null,
    });
    const { delivery } = buildDelivery({ execute });

    await delivery.deliver(claimed());
    await delivery.deliver(claimed({ eventId: "replay-event-1" }));

    expect(execute).toHaveBeenCalledTimes(2);
  });
});

function authorityContext() {
  return {
    application: {
      id: "application-1",
      state: "applied",
      event: {
        id: "event-1",
        containerId: "container-1",
        eventCode: "unloaded",
        occurredAt: OCCURRED_AT,
        appliedAt: RECEIVED_AT,
        evidenceRefs: ["evidence-2", "evidence-1"],
        domainFact: {
          id: "date-fact-1",
          captureSource: "external_evidence",
          receivedAt: RECEIVED_AT,
          actorId: "reviewer-1",
        },
      },
      targetNodeInstance: {
        id: "node-1",
        nodeCode: "container_unloading",
        flow: { id: "flow-1", containerId: "container-1" },
      },
    },
  };
}
