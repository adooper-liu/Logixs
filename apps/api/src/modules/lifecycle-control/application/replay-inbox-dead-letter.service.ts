import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  INBOX_REPOSITORY,
  type InboxRepository,
} from "../domain/inbox.repository";
import {
  buildInboxReplayRequest,
  buildReplayInbox,
  decideReplayInboxDeadLetter,
  parseInboxPayloadRef,
  resolveInboxReplayPayload,
} from "../domain/inbox-replay";
import {
  assertReplayCommand,
  compareReplayIdempotency,
  hashReplayRequest,
} from "../domain/outbox-replay";

export interface ReplayInboxDeadLetterInput {
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

export interface ReplayInboxDeadLetterResult {
  deadLetterId: string;
  replayedInboxId: string;
  replayedMessageId: string;
  applied: boolean;
  corrected: boolean;
  targetConsumerVersion: string;
}

@Injectable()
export class ReplayInboxDeadLetterService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
  ) {}

  async execute(
    input: ReplayInboxDeadLetterInput,
  ): Promise<ReplayInboxDeadLetterResult> {
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

    const original = await this.inbox.findById(input.deadLetterId);
    if (!original) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const decision = decideReplayInboxDeadLetter({
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

    let payload;
    try {
      const source =
        command.payloadRef === undefined
          ? undefined
          : await this.inbox.findById(parseInboxPayloadRef(command.payloadRef));
      if (command.payloadRef !== undefined && !source) {
        throw new NotFoundException("RESOURCE_NOT_FOUND");
      }
      if (source && source.tenantId !== input.tenantId) {
        throw new HttpException(
          "AUTHORIZATION_SCOPE_DENIED: 租户不匹配",
          HttpStatus.FORBIDDEN,
        );
      }
      payload = resolveInboxReplayPayload({
        original,
        payloadRef: command.payloadRef,
        payloadHash: command.payloadHash,
        source: source ?? undefined,
      });
    } catch (error) {
      if (
        error instanceof HttpException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const requestHash = hashReplayRequest({
      reasonCode: command.reasonCode,
      targetConsumerVersion: command.targetConsumerVersion,
      payloadRef: payload.payloadRef,
      payloadHash: payload.payloadHash,
    });

    const existing = await this.inbox.findReplayByIdempotency({
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
        replayedInboxId: existing.replayedInboxId,
        replayedMessageId: existing.replayedMessageId,
        applied: false,
        corrected: payload.corrected,
        targetConsumerVersion: command.targetConsumerVersion,
      };
    }

    const requestedAt = new Date();
    let replay;
    try {
      replay = buildReplayInbox({
        original,
        replayId: randomUUID(),
        replayMessageId: randomUUID(),
        requestedAt,
        traceId: input.traceId ?? randomUUID(),
        payloadHash: payload.payloadHash,
        payloadJson: payload.payloadJson,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "VALIDATION_FORMAT";
      throw new HttpException(
        message,
        message.startsWith("BUSINESS_STATE_VIOLATION")
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST,
      );
    }
    const request = buildInboxReplayRequest({
      originalId: original.id,
      replay,
      targetConsumerVersion: command.targetConsumerVersion,
      requestedBy: command.requestedBy,
      reasonCode: command.reasonCode,
      requestedAt,
      commandIdempotencyKey: command.idempotencyKey,
      requestHash,
    });
    await this.inbox.insertReplay({ replay, request });

    return {
      deadLetterId: original.id,
      replayedInboxId: replay.id,
      replayedMessageId: replay.messageId,
      applied: true,
      corrected: payload.corrected,
      targetConsumerVersion: command.targetConsumerVersion,
    };
  }
}
