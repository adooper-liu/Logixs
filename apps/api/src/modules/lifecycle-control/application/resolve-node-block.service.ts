import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { decideNodeBlockResolution } from "../domain/node-block";
import {
  NODE_BLOCK_REPOSITORY,
  type NodeBlockRecord,
  type NodeBlockRepository,
} from "../domain/node-block.repository";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;

export interface ResolveNodeBlockInput {
  tenantId: string;
  actorId: string;
  flowInstanceId: string;
  blockId: string;
  resolvedAt: string;
  reasonCode: string;
  expectedVersion: number;
  idempotencyKey: string;
  traceId: string;
}

export interface ResolveNodeBlockResult {
  blockId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  resolved: true;
  nodeUnblocked: boolean;
  applied: boolean;
  version: number;
}

@Injectable()
export class ResolveNodeBlockService {
  constructor(
    @Inject(NODE_BLOCK_REPOSITORY)
    private readonly repository: NodeBlockRepository,
    @Inject(ReplayPendingLifecycleDateFactsService)
    private readonly replayPending: ReplayPendingLifecycleDateFactsService,
  ) {}

  async execute(input: ResolveNodeBlockInput): Promise<ResolveNodeBlockResult> {
    const resolvedAt = validate(input);
    const duplicate = await this.repository.findResolutionByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (duplicate) {
      assertSameResolution(duplicate, input, resolvedAt);
      await this.replayIfUnblocked(duplicate);
      return resolvedResult(
        duplicate,
        false,
        duplicate.nodeState !== "blocked",
      );
    }

    const block = await this.repository.findBlockById(input.blockId);
    if (!block || block.flowInstanceId !== input.flowInstanceId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    if (block.tenantId !== input.tenantId) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    if (block.resolution) {
      assertSameResolution(block, input, resolvedAt);
      await this.replayIfUnblocked(block);
      return resolvedResult(block, false, block.nodeState !== "blocked");
    }
    if (block.flowVersion !== input.expectedVersion) {
      throw new HttpException(
        "LIFECYCLE_VERSION_CONFLICT: expectedVersion 不匹配",
        HttpStatus.CONFLICT,
      );
    }
    const decision = decideNodeBlockResolution({
      blockOccurredAt: block.occurredAt,
      resolvedAt,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        HttpStatus.CONFLICT,
      );
    }

    let saved: { version: number; nodeUnblocked: boolean };
    try {
      saved = await this.repository.resolveBlock({
        resolutionId: randomUUID(),
        tenantId: input.tenantId,
        blockId: input.blockId,
        flowInstanceId: input.flowInstanceId,
        containerId: block.containerId,
        nodeInstanceId: block.nodeInstanceId,
        resolvedAt,
        reasonCode: input.reasonCode,
        actorId: input.actorId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        traceId: input.traceId,
      });
    } catch (error) {
      throw mapRepositoryError(error);
    }

    if (saved.nodeUnblocked) {
      await this.replayPending.execute({
        tenantId: input.tenantId,
        containerId: block.containerId,
      });
    }
    return {
      blockId: input.blockId,
      flowInstanceId: input.flowInstanceId,
      nodeInstanceId: block.nodeInstanceId,
      resolved: true,
      nodeUnblocked: saved.nodeUnblocked,
      applied: true,
      version: saved.version,
    };
  }

  private async replayIfUnblocked(block: NodeBlockRecord): Promise<void> {
    if (!block.resolution || block.nodeState === "blocked") return;
    await this.replayPending.execute({
      tenantId: block.tenantId,
      containerId: block.containerId,
    });
  }
}

function mapRepositoryError(error: unknown): HttpException {
  const code = error instanceof Error ? error.message : "";
  const publicCode = [
    "LIFECYCLE_VERSION_CONFLICT",
    "NODE_BLOCK_GUARD_NOT_SATISFIED",
    "NODE_BLOCK_ALREADY_RESOLVED",
  ].includes(code)
    ? code
    : "NODE_BLOCK_RESOLVE_FAILED";
  return new HttpException(publicCode, HttpStatus.CONFLICT);
}

function validate(input: ResolveNodeBlockInput): Date {
  if (
    !UUID_PATTERN.test(input.flowInstanceId) ||
    !UUID_PATTERN.test(input.blockId)
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: UUID 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.reasonCode || input.reasonCode.length > 64) {
    throw new HttpException(
      "VALIDATION_FORMAT: reasonCode 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.actorId || input.actorId.length > 128) {
    throw new HttpException(
      "VALIDATION_FORMAT: actorId 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    throw new HttpException(
      "VALIDATION_FORMAT: idempotencyKey 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.traceId || input.traceId.length > 128) {
    throw new HttpException(
      "VALIDATION_FORMAT: traceId 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new HttpException(
      "VALIDATION_FORMAT: expectedVersion 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  const resolvedAt = new Date(input.resolvedAt);
  if (
    !TIME_WITH_OFFSET.test(input.resolvedAt) ||
    Number.isNaN(resolvedAt.getTime())
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: resolvedAt 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  return resolvedAt;
}

function assertSameResolution(
  block: NodeBlockRecord,
  input: ResolveNodeBlockInput,
  resolvedAt: Date,
): void {
  const resolution = block.resolution;
  if (
    block.id !== input.blockId ||
    block.flowInstanceId !== input.flowInstanceId ||
    !resolution ||
    resolution.resolvedAt.getTime() !== resolvedAt.getTime() ||
    resolution.reasonCode !== input.reasonCode
  ) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同键或同 blockId 异载荷",
      HttpStatus.CONFLICT,
    );
  }
}

function resolvedResult(
  block: NodeBlockRecord,
  applied: boolean,
  nodeUnblocked: boolean,
): ResolveNodeBlockResult {
  return {
    blockId: block.id,
    flowInstanceId: block.flowInstanceId,
    nodeInstanceId: block.nodeInstanceId,
    resolved: true,
    nodeUnblocked,
    applied,
    version: block.flowVersion,
  };
}
