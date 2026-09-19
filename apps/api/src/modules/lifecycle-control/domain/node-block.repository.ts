export const NODE_BLOCK_REPOSITORY = Symbol("NodeBlockRepository");

export interface NodeBlockRecord {
  id: string;
  tenantId: string;
  flowInstanceId: string;
  containerId: string;
  nodeInstanceId: string;
  nodeCode: string;
  nodeState: string;
  blockType: string;
  sourceFactId: string;
  occurredAt: Date;
  actorId: string;
  idempotencyKey: string;
  traceId: string;
  projectionVersion: number;
  resolution: NodeBlockResolutionRecord | null;
  flowVersion: number;
}

export interface NodeBlockResolutionRecord {
  id: string;
  blockId: string;
  tenantId: string;
  resolvedAt: Date;
  reasonCode: string;
  actorId: string;
  idempotencyKey: string;
  traceId: string;
  projectionVersion: number;
}

export interface NodeBlockFlowContext {
  tenantId: string;
  containerId: string;
  flowInstanceId: string;
  flowState: string;
  currentNodeCode: string;
  version: number;
  nodeInstanceId: string;
  nodeCode: string;
  nodeState: string;
}

export interface NodeBlockRepository {
  findFlowContext(
    flowInstanceId: string,
    nodeInstanceId: string,
  ): Promise<NodeBlockFlowContext | null>;
  findBlockById(blockId: string): Promise<NodeBlockRecord | null>;
  findBlockByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NodeBlockRecord | null>;
  findResolutionByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NodeBlockRecord | null>;
  createBlock(input: {
    id: string;
    tenantId: string;
    flowInstanceId: string;
    containerId: string;
    nodeInstanceId: string;
    blockType: string;
    sourceFactId: string;
    occurredAt: Date;
    actorId: string;
    expectedVersion: number;
    idempotencyKey: string;
    traceId: string;
  }): Promise<{ version: number }>;
  resolveBlock(input: {
    resolutionId: string;
    tenantId: string;
    blockId: string;
    flowInstanceId: string;
    containerId: string;
    nodeInstanceId: string;
    resolvedAt: Date;
    reasonCode: string;
    actorId: string;
    expectedVersion: number;
    idempotencyKey: string;
    traceId: string;
  }): Promise<{ version: number; nodeUnblocked: boolean }>;
}
