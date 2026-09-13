import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from "../domain/outbox.repository";
import {
  assertReplayCommand,
  buildReplayOutbox,
  buildReplayRequest,
  compareReplayIdempotency,
  decideReplayDeadLetter,
  hashReplayRequest,
  resolveReplayPayload,
} from "../domain/outbox-replay";

export interface ReplayDeadLetterInput {
  deadLetterId: string;
  tenantId: string;
  operatorId: string;
  reasonCode: string;
  targetConsumerVersion: string;
  idempotencyKey: string;
  payloadRef?: string;
  payloadHash?: string;
  traceId?: string;
}

export interface ReplayDeadLetterResult {
  deadLetterId: string;
  replayedOutboxId: string;
  replayedEventId: string;
  applied: boolean;
  corrected: boolean;
  targetConsumerVersion: string;
}

@Injectable()
export class ReplayDeadLetterService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outbox: OutboxRepository,
  ) {}

  async execute(input: ReplayDeadLetterInput): Promise<ReplayDeadLetterResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }

    let command: ReturnType<typeof assertReplayCommand>;
    try {
      command = assertReplayCommand({
        reasonCode: input.reasonCode,
        targetConsumerVersion: input.targetConsumerVersion,
        idempotencyKey: input.idempotencyKey,
        requestedBy: input.operatorId,
        payloadRef: input.payloadRef,
        payloadHash: input.payloadHash,
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const original = await this.outbox.findById(input.deadLetterId);
    if (!original) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const decision = decideReplayDeadLetter({
      state: original.state,
      tenantId: original.tenantId,
      commandTenantId: input.tenantId,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        decision.code === "AUTHORIZATION_SCOPE_DENIED"
          ? HttpStatus.FORBIDDEN
          : HttpStatus.CONFLICT,
      );
    }

    const payload = resolveReplayPayload({
      original,
      payloadRef: command.payloadRef,
      payloadHash: command.payloadHash,
    });
    const requestHash = hashReplayRequest({
      reasonCode: command.reasonCode,
      targetConsumerVersion: command.targetConsumerVersion,
      payloadRef: payload.payloadRef,
      payloadHash: payload.payloadHash,
    });

    const existing = await this.outbox.findReplayByIdempotency({
      tenantId: input.tenantId,
      deadLetterId: input.deadLetterId,
      idempotencyKey: command.idempotencyKey,
    });
    if (existing) {
      if (
        compareReplayIdempotency(existing.requestHash, requestHash) ===
        "conflict"
      ) {
        throw new HttpException(
          "IDEMPOTENCY_CONFLICT: 同键异载荷",
          HttpStatus.CONFLICT,
        );
      }
      return {
        deadLetterId: original.id,
        replayedOutboxId: existing.replayedOutboxId,
        replayedEventId: existing.replayedEventId,
        applied: false,
        corrected: payload.corrected,
        targetConsumerVersion: command.targetConsumerVersion,
      };
    }

    const requestedAt = new Date();
    const replay = buildReplayOutbox({
      original,
      replayEventId: randomUUID(),
      commandIdempotencyKey: command.idempotencyKey,
      requestedAt,
      traceId: input.traceId ?? randomUUID(),
      payloadRef: payload.payloadRef,
      payloadHash: payload.payloadHash,
    });
    const request = buildReplayRequest({
      originalId: original.id,
      replay,
      targetConsumerVersion: command.targetConsumerVersion,
      requestedBy: command.requestedBy,
      reasonCode: command.reasonCode,
      requestedAt,
      commandIdempotencyKey: command.idempotencyKey,
      requestHash,
    });
    await this.outbox.insertReplay({ replay, request });

    return {
      deadLetterId: original.id,
      replayedOutboxId: replay.id,
      replayedEventId: replay.eventId,
      applied: true,
      corrected: payload.corrected,
      targetConsumerVersion: command.targetConsumerVersion,
    };
  }
}
