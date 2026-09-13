import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";
import {
  assertCompensationCommand,
  buildPendingCompensation,
  decideRequestCompensation,
  hashCompensationRequest,
  type CompensationRecord,
} from "../domain/compensation";
import {
  COMPENSATION_REPOSITORY,
  type CompensationRepository,
} from "../domain/compensation.repository";
import { decideClientIdempotency } from "../domain/client-operation";

export interface RequestCompensationInput {
  originalClientOperationId: string;
  tenantId: string;
  operatorId: string;
  reasonCode: string;
  idempotencyKey: string;
  traceId?: string;
}

export interface RequestCompensationResult {
  compensationId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  state: string;
  applied: boolean;
  reasonCode: string;
}

@Injectable()
export class RequestCompensationService {
  constructor(
    @Inject(CLIENT_OPERATION_REPOSITORY)
    private readonly operations: ClientOperationRepository,
    @Inject(COMPENSATION_REPOSITORY)
    private readonly compensations: CompensationRepository,
  ) {}

  async execute(
    input: RequestCompensationInput,
  ): Promise<RequestCompensationResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }

    let command: ReturnType<typeof assertCompensationCommand>;
    try {
      command = assertCompensationCommand({
        reasonCode: input.reasonCode,
        idempotencyKey: input.idempotencyKey,
        requestedBy: input.operatorId,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const original = await this.operations.findById(
      input.originalClientOperationId,
    );
    if (!original) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const decision = decideRequestCompensation({
      tenantId: original.tenantId,
      commandTenantId: input.tenantId,
      commitState: original.commitState,
      actionCode: original.actionCode,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        decision.code === "AUTHORIZATION_SCOPE_DENIED"
          ? HttpStatus.FORBIDDEN
          : HttpStatus.CONFLICT,
      );
    }

    const requestHash = hashCompensationRequest({
      reasonCode: command.reasonCode,
      compensationActionCode: decision.actionCode,
    });
    const existing = await this.compensations.findByIdempotency({
      tenantId: input.tenantId,
      originalClientOperationId: original.id,
      idempotencyKey: command.idempotencyKey,
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
      return toResult(existing, false);
    }

    const now = new Date();
    let record: CompensationRecord;
    try {
      record = buildPendingCompensation({
        id: randomUUID(),
        tenantId: original.tenantId,
        originalClientOperationId: original.id,
        compensationActionCode: decision.actionCode,
        reasonCode: command.reasonCode,
        requestedBy: command.requestedBy,
        idempotencyKey: command.idempotencyKey,
        requestHash,
        traceId: input.traceId ?? randomUUID(),
        now,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.compensations.insert(record);
    return toResult(record, true);
  }
}

function toResult(
  record: CompensationRecord,
  applied: boolean,
): RequestCompensationResult {
  return {
    compensationId: record.id,
    originalClientOperationId: record.originalClientOperationId,
    compensationActionCode: record.compensationActionCode,
    state: record.state,
    applied,
    reasonCode: record.reasonCode,
  };
}
