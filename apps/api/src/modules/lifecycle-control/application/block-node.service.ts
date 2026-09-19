import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import {
  decideNodeBlock,
  decideNodeBlockSourceFact,
} from "../domain/node-block";
import {
  NODE_BLOCK_REPOSITORY,
  type NodeBlockRecord,
  type NodeBlockRepository,
} from "../domain/node-block.repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STABLE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;

export interface BlockNodeInput {
  tenantId: string;
  actorId: string;
  flowInstanceId: string;
  blockId: string;
  blockType: string;
  sourceFactId: string;
  occurredAt: string;
  nodeInstanceId: string;
  expectedVersion: number;
  idempotencyKey: string;
  traceId: string;
}

export interface BlockNodeResult {
  blockId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  state: "active" | "resolved";
  applied: boolean;
  version: number;
}

@Injectable()
export class BlockNodeService {
  constructor(
    @Inject(NODE_BLOCK_REPOSITORY)
    private readonly repository: NodeBlockRepository,
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
  ) {}

  async execute(input: BlockNodeInput): Promise<BlockNodeResult> {
    const occurredAt = validate(input);
    const duplicateByKey = await this.repository.findBlockByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (duplicateByKey) {
      assertSameBlock(duplicateByKey, input, occurredAt);
      return result(duplicateByKey, false);
    }

    const duplicateById = await this.repository.findBlockById(input.blockId);
    if (duplicateById) {
      if (duplicateById.tenantId !== input.tenantId) {
        throw new NotFoundException("RESOURCE_NOT_FOUND");
      }
      assertSameBlock(duplicateById, input, occurredAt);
      return result(duplicateById, false);
    }

    const context = await this.repository.findFlowContext(
      input.flowInstanceId,
      input.nodeInstanceId,
    );
    if (!context) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (context.tenantId !== input.tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 租户不匹配",
        HttpStatus.FORBIDDEN,
      );
    }
    if (context.version !== input.expectedVersion) {
      throw new HttpException(
        "LIFECYCLE_VERSION_CONFLICT: expectedVersion 不匹配",
        HttpStatus.CONFLICT,
      );
    }
    assertDecision(
      decideNodeBlock({
        flowState: context.flowState,
        currentNodeCode: context.currentNodeCode,
        nodeCode: context.nodeCode,
        nodeState: context.nodeState,
      }),
    );

    const sourceFact = await this.dateFacts.findById(input.sourceFactId);
    const sourceEvent = sourceFact
      ? canonicalEvents.find(
          (event) => event.eventCode === sourceFact.eventCode,
        )
      : null;
    assertDecision(
      decideNodeBlockSourceFact({
        fact: sourceFact,
        tenantId: input.tenantId,
        containerId: context.containerId,
        nodeCode: context.nodeCode,
        blockType: input.blockType,
        occurredAt,
        eventRole: sourceEvent?.role ?? null,
      }),
    );

    try {
      const saved = await this.repository.createBlock({
        id: input.blockId,
        tenantId: input.tenantId,
        flowInstanceId: input.flowInstanceId,
        containerId: context.containerId,
        nodeInstanceId: input.nodeInstanceId,
        blockType: input.blockType,
        sourceFactId: input.sourceFactId,
        occurredAt,
        actorId: input.actorId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        traceId: input.traceId,
      });
      return {
        blockId: input.blockId,
        flowInstanceId: input.flowInstanceId,
        nodeInstanceId: input.nodeInstanceId,
        state: "active",
        applied: true,
        version: saved.version,
      };
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }
}

function validate(input: BlockNodeInput): Date {
  for (const [name, value] of [
    ["flowInstanceId", input.flowInstanceId],
    ["blockId", input.blockId],
    ["sourceFactId", input.sourceFactId],
    ["nodeInstanceId", input.nodeInstanceId],
  ]) {
    if (!UUID_PATTERN.test(value)) {
      throw new HttpException(
        `VALIDATION_FORMAT: ${name} 无效`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  if (!STABLE_CODE_PATTERN.test(input.blockType)) {
    throw new HttpException(
      "VALIDATION_FORMAT: blockType 无效",
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
  const occurredAt = new Date(input.occurredAt);
  if (
    !TIME_WITH_OFFSET.test(input.occurredAt) ||
    Number.isNaN(occurredAt.getTime())
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: occurredAt 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  return occurredAt;
}

function assertDecision(decision: ReturnType<typeof decideNodeBlock>): void {
  if (decision.kind === "apply") return;
  const status =
    decision.code === "AUTHORIZATION_SCOPE_DENIED"
      ? HttpStatus.FORBIDDEN
      : decision.code === "NODE_BLOCK_SOURCE_FACT_NOT_FOUND"
        ? HttpStatus.NOT_FOUND
        : HttpStatus.CONFLICT;
  throw new HttpException(`${decision.code}: ${decision.message}`, status);
}

function assertSameBlock(
  existing: NodeBlockRecord,
  input: BlockNodeInput,
  occurredAt: Date,
): void {
  if (
    existing.id !== input.blockId ||
    existing.flowInstanceId !== input.flowInstanceId ||
    existing.nodeInstanceId !== input.nodeInstanceId ||
    existing.blockType !== input.blockType ||
    existing.sourceFactId !== input.sourceFactId ||
    existing.occurredAt.getTime() !== occurredAt.getTime()
  ) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同键或同 blockId 异载荷",
      HttpStatus.CONFLICT,
    );
  }
}

function result(existing: NodeBlockRecord, applied: boolean): BlockNodeResult {
  return {
    blockId: existing.id,
    flowInstanceId: existing.flowInstanceId,
    nodeInstanceId: existing.nodeInstanceId,
    state: existing.resolution ? "resolved" : "active",
    applied,
    version: existing.flowVersion,
  };
}

function mapRepositoryError(error: unknown): HttpException {
  const code = error instanceof Error ? error.message : "NODE_BLOCK_FAILED";
  if (
    code === "LIFECYCLE_VERSION_CONFLICT" ||
    code === "NODE_BLOCK_GUARD_NOT_SATISFIED"
  ) {
    return new HttpException(code, HttpStatus.CONFLICT);
  }
  return new HttpException("NODE_BLOCK_FAILED", HttpStatus.CONFLICT);
}
