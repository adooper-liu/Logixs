import { HttpException, Inject, Injectable } from "@nestjs/common";
import type {
  CaptureSource,
  CanonicalEventCode,
  LifecycleNodeCode,
} from "@logix/contracts";
import {
  RECONCILE_APPLIED_LIFECYCLE_FACT,
  type ReconcileAppliedLifecycleFactCommand,
  type ReconcileAppliedLifecycleFactPort,
  type ReconcileAppliedLifecycleFactResult,
} from "../../work-execution";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import { PrismaService } from "../../../prisma/prisma.service";
import type { OutboxDeliveryPort } from "../application/publish-outbox-batch.service";
import { OutboxDeliveryError } from "../domain/outbox-failure";
import type { ClaimedOutbox } from "../domain/outbox-publish";
import {
  hashWorkFactReconciliationPayload,
  WORK_FACT_RECONCILIATION_AGGREGATE_TYPE,
  WORK_FACT_RECONCILIATION_EVENT_TYPE,
  WORK_FACT_RECONCILIATION_EVENT_VERSION,
  workFactReconciliationPayloadRef,
  type WorkFactReconciliationIdentity,
} from "../domain/work-fact-reconciliation-outbox";
import { StubOutboxDelivery } from "./stub-outbox-delivery";

const RECONCILIATION_ACTOR = "lifecycle-control:outbox-reconciliation";
const CAPTURE_SOURCES = new Set<CaptureSource>([
  "external_evidence",
  "manual_backfill",
  "controlled_import",
  "internal_operation",
  "system_derived",
]);

@Injectable()
export class WorkExecutionOutboxDelivery implements OutboxDeliveryPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RECONCILE_APPLIED_LIFECYCLE_FACT)
    private readonly reconcile: ReconcileAppliedLifecycleFactPort,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    private readonly fallback: StubOutboxDelivery,
  ) {}

  async deliver(message: ClaimedOutbox): Promise<{ brokerReference: string }> {
    if (message.eventType !== WORK_FACT_RECONCILIATION_EVENT_TYPE) {
      return this.fallback.deliver(message);
    }
    if (message.eventVersion !== WORK_FACT_RECONCILIATION_EVENT_VERSION) {
      throw schemaFailure("RECONCILIATION_EVENT_VERSION_UNSUPPORTED");
    }

    const command = await this.loadCommand(message);
    let result: ReconcileAppliedLifecycleFactResult;
    try {
      result = await this.reconcile.execute(command);
    } catch (error) {
      throw classifyReconciliationFailure(error);
    }

    if (result.reasonCode === "TASK_NOT_INITIALIZED") {
      throw new OutboxDeliveryError("task_not_initialized", result.reasonCode);
    }
    if (result.decision === "rejected") {
      throw new OutboxDeliveryError(
        businessFailureCode(result.reasonCode),
        result.reasonCode ?? "business_rejected",
      );
    }

    return {
      brokerReference: `work-execution:${command.canonicalEventId}:${command.nodeInstanceId}:${result.decision}`,
    };
  }

  private async loadCommand(
    message: ClaimedOutbox,
  ): Promise<ReconcileAppliedLifecycleFactCommand> {
    const applicationId = parseApplicationId(message.payloadRef);
    const context = await this.prisma.$transaction(async (tx) => {
      const application = await tx.nodeEventApplication.findUnique({
        where: { id: applicationId },
        include: {
          event: { include: { domainFact: true } },
          targetNodeInstance: { include: { flow: true } },
        },
      });
      return application;
    });
    if (!context) throw schemaFailure("RECONCILIATION_CONTEXT_MISSING");

    const application = context;
    const event = application.event;
    const node = application.targetNodeInstance;
    const flow = node.flow;
    try {
      await this.assertContainerTenant.execute({
        containerId: event.containerId,
        tenantId: message.tenantId,
      });
    } catch (error) {
      throw classifyContainerScopeFailure(error);
    }
    const identity: WorkFactReconciliationIdentity = {
      nodeEventApplicationId: application.id,
      tenantId: message.tenantId,
      containerId: event.containerId,
      flowInstanceId: flow.id,
      nodeInstanceId: node.id,
      canonicalEventId: event.id,
    };
    if (
      application.state !== "applied" ||
      message.aggregateType !== WORK_FACT_RECONCILIATION_AGGREGATE_TYPE ||
      message.aggregateId !== application.id ||
      message.payloadRef !== workFactReconciliationPayloadRef(application.id) ||
      message.payloadHash !== hashWorkFactReconciliationPayload(identity) ||
      flow.containerId !== event.containerId
    ) {
      throw schemaFailure("RECONCILIATION_MESSAGE_MISMATCH");
    }

    const dateFact = event.domainFact;
    const captureSource = dateFact
      ? parseCaptureSource(dateFact.captureSource)
      : "internal_operation";
    const evidenceRefs = parseEvidenceRefs(event.evidenceRefs);
    const receivedAt =
      dateFact?.receivedAt ??
      new Date(Math.max(event.occurredAt.getTime(), event.appliedAt.getTime()));

    return {
      tenantId: message.tenantId,
      containerId: event.containerId,
      flowInstanceId: flow.id,
      nodeInstanceId: node.id,
      nodeCode: node.nodeCode as LifecycleNodeCode,
      canonicalEventId: event.id,
      eventCode: event.eventCode as CanonicalEventCode,
      businessFactType: dateFact
        ? "lifecycle_date_fact"
        : "canonical_lifecycle_event",
      domainFactId: dateFact?.id ?? event.id,
      captureSource,
      evidenceRefs,
      occurredAt: event.occurredAt,
      receivedAt,
      actorOrServiceId: dateFact?.actorId?.trim() || RECONCILIATION_ACTOR,
      traceId: message.traceId,
      idempotencyKey: message.idempotencyKey,
    };
  }
}

function parseApplicationId(payloadRef: string): string {
  const prefix = "node-event-application/";
  if (!payloadRef.startsWith(prefix)) {
    throw schemaFailure("RECONCILIATION_PAYLOAD_REF_INVALID");
  }
  const id = payloadRef.slice(prefix.length).trim();
  if (!id || id.includes("/")) {
    throw schemaFailure("RECONCILIATION_PAYLOAD_REF_INVALID");
  }
  return id;
}

function parseCaptureSource(value: string): CaptureSource {
  if (!CAPTURE_SOURCES.has(value as CaptureSource)) {
    throw schemaFailure("RECONCILIATION_CAPTURE_SOURCE_INVALID");
  }
  return value as CaptureSource;
}

function parseEvidenceRefs(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw schemaFailure("RECONCILIATION_EVIDENCE_INVALID");
  }
  return [...new Set(value)].sort();
}

function classifyReconciliationFailure(error: unknown): OutboxDeliveryError {
  if (error instanceof OutboxDeliveryError) return error;
  if (!(error instanceof HttpException)) {
    return new OutboxDeliveryError(
      "dependency_unavailable",
      "work-execution reconciliation unavailable",
    );
  }
  const status = error.getStatus();
  const reason = extractReasonCode(error.message);
  if (status >= 500) {
    return new OutboxDeliveryError("dependency_unavailable", reason);
  }
  if (reason === "IDEMPOTENCY_CONFLICT") {
    return new OutboxDeliveryError("idempotency_conflict", reason);
  }
  if (reason === "CONCURRENCY_VERSION_CONFLICT") {
    return new OutboxDeliveryError("concurrency_conflict", reason);
  }
  if (status === 401 || status === 403) {
    return new OutboxDeliveryError("authorization_denied", reason);
  }
  if (status === 400) {
    return new OutboxDeliveryError("schema_invalid", reason);
  }
  return new OutboxDeliveryError("business_rejected", reason);
}

function classifyContainerScopeFailure(error: unknown): OutboxDeliveryError {
  if (!(error instanceof HttpException)) {
    return new OutboxDeliveryError(
      "dependency_unavailable",
      "container tenant verification unavailable",
    );
  }
  const status = error.getStatus();
  if (status >= 500) {
    return new OutboxDeliveryError("dependency_unavailable", error.message);
  }
  if (status === 401 || status === 403) {
    return new OutboxDeliveryError("authorization_denied", error.message);
  }
  return new OutboxDeliveryError("schema_invalid", error.message);
}

function extractReasonCode(message: string): string {
  return message.split(":", 1)[0]?.trim() || "BUSINESS_REJECTED";
}

function businessFailureCode(reasonCode: string | null): string {
  switch (reasonCode) {
    case "NODE_TASK_CANCELLED":
      return "node_task_cancelled";
    case "WORK_ORDER_DEFINITION_UNRESOLVED":
      return "work_order_definition_unresolved";
    case "WORK_ORDER_STATE_NOT_COMPLETABLE":
      return "work_order_state_not_completable";
    default:
      return "business_rejected";
  }
}

function schemaFailure(message: string): OutboxDeliveryError {
  return new OutboxDeliveryError("schema_invalid", message);
}
