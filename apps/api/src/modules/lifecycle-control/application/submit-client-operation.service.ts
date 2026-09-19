import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  buildBoundaryRejectedClientOperation,
  buildRejectedClientOperation,
  decideClientIdempotency,
  parseClientActionCode,
  type ClientOperationRecord,
} from "../domain/client-operation";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  assertInboxPayloadHash,
  hashInboxApplyPayload,
  parseInboxApplyPayload,
} from "../domain/inbox-apply-payload";

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
      requestHash = hashInboxApplyPayload(payload);
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
      if (
        decideClientIdempotency(existing.requestHash, requestHash) ===
        "conflict"
      ) {
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

    const error = new HttpException(
      "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE: 客户端操作不能直接推进生命周期，请先提交日期事实",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    await this.operations.insert(classifyClientFailure(base, error.message));
    throw error;
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
      rejectionReasonCode:
        message.split(":")[0] ?? "AUTHORIZATION_SCOPE_DENIED",
    });
  }
  if (message.startsWith("VALIDATION_FORMAT")) {
    return buildBoundaryRejectedClientOperation({
      ...base,
      rejectionReasonCode: "VALIDATION_FORMAT",
    });
  }
  const reason = message.split(":")[0]?.trim() || "BUSINESS_REJECTED";
  return buildRejectedClientOperation({
    ...base,
    rejectionReasonCode: reason,
  });
}
