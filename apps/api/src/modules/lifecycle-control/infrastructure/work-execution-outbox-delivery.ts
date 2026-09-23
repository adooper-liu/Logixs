import { HttpException, Inject, Injectable } from "@nestjs/common";
import type {
  CaptureSource,
  CanonicalEventCode,
  LifecycleNodeCode,
} from "@logix/contracts";
import type { StartPostDepartureLifecycleCommandV2 } from "@logix/contracts";
import {
  hashPostDepartureLifecycleCommand,
  POST_DEPARTURE_LIFECYCLE_EVENT_TYPE,
  POST_DEPARTURE_LIFECYCLE_EVENT_VERSION,
} from "@logix/contracts/post-departure-lifecycle";
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
import { ReceiveInboxMessageService } from "../application/receive-inbox-message.service";
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
    private readonly receiveInboxMessage: ReceiveInboxMessageService,
    private readonly fallback: StubOutboxDelivery,
  ) {}

  async deliver(message: ClaimedOutbox): Promise<{ brokerReference: string }> {
    if (message.eventType === POST_DEPARTURE_LIFECYCLE_EVENT_TYPE) {
      return this.deliverPostDepartureLifecycle(message);
    }
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

  private async deliverPostDepartureLifecycle(
    message: ClaimedOutbox,
  ): Promise<{ brokerReference: string }> {
    if (message.eventVersion !== POST_DEPARTURE_LIFECYCLE_EVENT_VERSION) {
      throw schemaFailure("POST_DEPARTURE_EVENT_VERSION_UNSUPPORTED");
    }
    const handoffId = parseShipmentHandoffId(message.payloadRef);
    const handoff = await this.prisma.shipmentHandoffRecord.findFirst({
      where: {
        id: handoffId,
        tenantId: message.tenantId,
        shipmentId: message.aggregateId,
      },
      select: { lifecycleRequestJson: true },
    });
    if (!handoff?.lifecycleRequestJson) {
      throw schemaFailure("POST_DEPARTURE_CONTEXT_MISSING");
    }
    const command =
      handoff.lifecycleRequestJson as unknown as StartPostDepartureLifecycleCommandV2;
    if (
      typeof command.shipmentId !== "string" ||
      typeof command.departureEventId !== "string" ||
      command.shipmentId !== message.aggregateId ||
      command.departureEventId.length === 0 ||
      hashPostDepartureLifecycleCommand(command) !== message.payloadHash
    ) {
      throw schemaFailure("POST_DEPARTURE_MESSAGE_MISMATCH");
    }
    let received;
    try {
      received = await this.receiveInboxMessage.execute({
        actorType: "service",
        actorId: "service:logix-outbox-publisher",
        tenantId: message.tenantId,
        consumerName: "lifecycle-control-inbox",
        messageId: message.eventId,
        payloadHash: message.payloadHash,
        payload: command,
        traceId: message.traceId,
      });
    } catch (error) {
      throw classifyPostDepartureDeliveryFailure(error);
    }
    return { brokerReference: `inbox:${received.inboxRecordId}` };
  }

  private async loadCommand(
    message: ClaimedOutbox,
  ): Promise<ReconcileAppliedLifecycleFactCommand> {
    const applicationId = parseApplicationId(message.payloadRef);
    const context = await this.prisma.$transaction(async (tx) => {
      const application = await tx.nodeEventApplication.findUnique({
        where: { id: applicationId },
        include: {
          event: true,
          targetNodeInstance: { include: { flow: true } },
        },
      });
      if (!application) return null;
      const dateFact =
        application.event.domainFactType === "lifecycle_date_fact" &&
        application.event.domainFactId
          ? await tx.lifecycleDateFact.findUnique({
              where: { id: application.event.domainFactId },
            })
          : null;
      return { application, dateFact };
    });
    if (!context) throw schemaFailure("RECONCILIATION_CONTEXT_MISSING");

    const { application, dateFact } = context;
    const event = application.event;
    const node = application.targetNodeInstance;
    const flow = node.flow;
    if (!event.containerId) {
      throw schemaFailure("RECONCILIATION_CONTAINER_SUBJECT_REQUIRED");
    }
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

function parseShipmentHandoffId(payloadRef: string): string {
  const prefix = "shipment-handoff-lifecycle/";
  if (!payloadRef.startsWith(prefix)) {
    throw schemaFailure("POST_DEPARTURE_PAYLOAD_REF_INVALID");
  }
  const handoffId = payloadRef.slice(prefix.length).trim();
  if (!handoffId || handoffId.includes("/")) {
    throw schemaFailure("POST_DEPARTURE_PAYLOAD_REF_INVALID");
  }
  return handoffId;
}

function classifyPostDepartureDeliveryFailure(
  error: unknown,
): OutboxDeliveryError {
  if (!(error instanceof HttpException)) {
    return new OutboxDeliveryError(
      "dependency_unavailable",
      "lifecycle inbox unavailable",
    );
  }
  const reason = extractReasonCode(error.message);
  if (error.getStatus() >= 500) {
    return new OutboxDeliveryError("dependency_unavailable", reason);
  }
  if (reason === "IDEMPOTENCY_CONFLICT") {
    return new OutboxDeliveryError("idempotency_conflict", reason);
  }
  if (error.getStatus() === 401 || error.getStatus() === 403) {
    return new OutboxDeliveryError("authorization_denied", reason);
  }
  return new OutboxDeliveryError("schema_invalid", reason);
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
