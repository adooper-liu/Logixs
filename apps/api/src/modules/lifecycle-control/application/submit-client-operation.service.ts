import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CanonicalEventCode } from "@logix/contracts";
import {
  APPLY_LIFECYCLE_EVENT,
  type ApplyLifecycleEventPort,
} from "../apply-lifecycle-event.port";
import {
  buildBoundaryRejectedClientOperation,
  buildCommittedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  hashClientRequest,
  parseClientActionCode,
  type ClientOperationRecord,
} from "../domain/client-operation";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  assertInboxPayloadHash,
  parseInboxApplyPayload,
} from "../domain/inbox-apply-payload";
import { canonicalizeLifecycleOutboxPayload } from "../domain/outbox-message";

export interface SubmitClientOperationInput {
  tenantId: string;
  actorId: string;
  actionCode: string;
  containerId: string;
  eventCode: string;
  occurredAt: string;
  evidenceRefs: string[];
  idempotencyKey: string;
  payloadHash?: string;
  traceId?: string;
}

@Injectable()
export class SubmitClientOperationService {
  constructor(
    @Inject(CLIENT_OPERATION_REPOSITORY)
    private readonly operations: ClientOperationRepository,
    @Inject(APPLY_LIFECYCLE_EVENT)
    private readonly applyLifecycleEvent: ApplyLifecycleEventPort,
  ) {}

  async execute(
    input: SubmitClientOperationInput,
  ): Promise<ClientOperationRecord> {
    const tenantId = input.tenantId.trim();
    const actorId = input.actorId.trim();
    if (!tenantId || !actorId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }

    let actionCode: string;
    let payload;
    let requestHash: string;
    try {
      actionCode = parseClientActionCode(input.actionCode);
      payload = parseInboxApplyPayload({
        containerId: input.containerId,
        eventCode: input.eventCode,
        occurredAt: input.occurredAt,
        evidenceRefs: input.evidenceRefs,
        idempotencyKey: input.idempotencyKey,
      });
      requestHash = hashClientRequest(
        canonicalizeLifecycleOutboxPayload(payload),
      );
      if (input.payloadHash) {
        assertInboxPayloadHash(payload, input.payloadHash);
      }
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.operations.findByIdempotency({
      tenantId,
      actorId,
      actionCode,
      idempotencyKey: payload.idempotencyKey,
    });
    if (existing) {
      if (decideClientIdempotency(existing.requestHash, requestHash) === "conflict") {
        throw new HttpException(
          "IDEMPOTENCY_CONFLICT: 同键异载荷",
          HttpStatus.CONFLICT,
        );
      }
      return existing;
    }

    const now = new Date();
    const base = {
      id: randomUUID(),
      tenantId,
      actorType: "user",
      actorId,
      targetId: payload.containerId,
      correlationId: randomUUID(),
      traceId: input.traceId?.trim() || randomUUID(),
      idempotencyKey: payload.idempotencyKey,
      requestHash,
      now,
    };

    try {
      const applied = await this.applyLifecycleEvent.execute({
        containerId: payload.containerId,
        tenantId,
        eventCode: payload.eventCode as CanonicalEventCode,
        occurredAt: payload.occurredAt,
        idempotencyKey: payload.idempotencyKey,
        evidenceRefs: payload.evidenceRefs,
        traceId: base.traceId,
      });
      const record = buildCommittedClientOperation({
        ...base,
        resultRefs: [
          { entityType: "container", entityId: payload.containerId },
          ...(applied.applied
            ? [{ entityType: "canonical_event", entityId: payload.idempotencyKey }]
            : []),
        ],
      });
      await this.operations.insert(record);
      return record;
    } catch (error) {
      const message = error instanceof HttpException ? error.message : "";
      const record = classifyClientFailure(base, message);
      await this.operations.insert(record);
      if (error instanceof HttpException) throw error;
      throw new HttpException("INTERNAL_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

function classifyClientFailure(
  base: Omit<
    Parameters<typeof buildRejectedClientOperation>[0],
    "rejectionReasonCode"
  >,
  message: string,
): ClientOperationRecord {
  if (
    message.startsWith("AUTHORIZATION_SCOPE_DENIED") ||
    message.startsWith("AUTHENTICATION_REQUIRED")
  ) {
    return buildBoundaryRejectedClientOperation({
      ...base,
      rejectionReasonCode: message.split(":")[0] ?? "AUTHORIZATION_SCOPE_DENIED",
    });
  }
  if (message.startsWith("VALIDATION_FORMAT")) {
    return buildBoundaryRejectedClientOperation({
      ...base,
      rejectionReasonCode: "VALIDATION_FORMAT",
    });
  }
  const reason =
    message.split(":")[0]?.trim() || "BUSINESS_REJECTED";
  return buildRejectedClientOperation({
    ...base,
    rejectionReasonCode: reason,
  });
}
