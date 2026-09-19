import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  buildNodeBlockedOutbox,
  buildNodeBlockResolvedOutbox,
  type NodeBlockOutboxPending,
} from "../domain/node-block-outbox";
import type {
  NodeBlockFlowContext,
  NodeBlockRecord,
  NodeBlockRepository,
} from "../domain/node-block.repository";

@Injectable()
export class PrismaNodeBlockRepository implements NodeBlockRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findFlowContext(
    flowInstanceId: string,
    nodeInstanceId: string,
  ): Promise<NodeBlockFlowContext | null> {
    const flow = await this.prisma.flowInstance.findUnique({
      where: { id: flowInstanceId },
      include: { nodes: { where: { id: nodeInstanceId } } },
    });
    if (!flow || flow.nodes.length !== 1) return null;
    const container = await this.prisma.containerRecord.findUnique({
      where: { id: flow.containerId },
      select: { tenantId: true },
    });
    if (!container) return null;
    const node = flow.nodes[0]!;
    return {
      tenantId: container.tenantId,
      containerId: flow.containerId,
      flowInstanceId: flow.id,
      flowState: flow.state,
      currentNodeCode: flow.currentNodeCode,
      version: flow.version,
      nodeInstanceId: node.id,
      nodeCode: node.nodeCode,
      nodeState: node.state,
    };
  }

  async findBlockById(blockId: string): Promise<NodeBlockRecord | null> {
    const row = await this.prisma.nodeBlock.findUnique({
      where: { id: blockId },
      include: {
        flow: { select: { containerId: true, version: true } },
        node: { select: { nodeCode: true, state: true } },
        resolution: true,
      },
    });
    return row ? toRecord(row) : null;
  }

  async findBlockByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NodeBlockRecord | null> {
    const row = await this.prisma.nodeBlock.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
      include: {
        flow: { select: { containerId: true, version: true } },
        node: { select: { nodeCode: true, state: true } },
        resolution: true,
      },
    });
    return row ? toRecord(row) : null;
  }

  async findResolutionByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<NodeBlockRecord | null> {
    const resolution = await this.prisma.nodeBlockResolution.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
      include: {
        block: {
          include: {
            flow: { select: { containerId: true, version: true } },
            node: { select: { nodeCode: true, state: true } },
            resolution: true,
          },
        },
      },
    });
    return resolution ? toRecord(resolution.block) : null;
  }

  async createBlock(input: {
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
  }): Promise<{ version: number }> {
    return this.prisma.$transaction(async (tx) => {
      const flow = await tx.flowInstance.findUniqueOrThrow({
        where: { id: input.flowInstanceId },
      });
      const node = await tx.nodeInstance.findUniqueOrThrow({
        where: { id: input.nodeInstanceId },
      });
      const sourceFact = await tx.lifecycleDateFact.findUniqueOrThrow({
        where: { id: input.sourceFactId },
      });
      if (
        flow.containerId !== input.containerId ||
        flow.state !== "active" ||
        flow.currentNodeCode !== node.nodeCode ||
        node.flowInstanceId !== flow.id ||
        (node.state !== "active" && node.state !== "blocked") ||
        sourceFact.tenantId !== input.tenantId ||
        sourceFact.containerId !== input.containerId ||
        sourceFact.nodeCode !== node.nodeCode ||
        sourceFact.occurredAt.getTime() !== input.occurredAt.getTime() ||
        sourceFact.timeKind !== "actual" ||
        sourceFact.verificationState !== "verified" ||
        sourceFact.confidenceState !== "confirmed" ||
        sourceFact.validity !== "effective" ||
        !sourceFact.isCurrent ||
        !sourceFact.authorityPolicyRef
      ) {
        throw new Error("NODE_BLOCK_GUARD_NOT_SATISFIED");
      }

      const advanced = await tx.flowInstance.updateMany({
        where: {
          id: input.flowInstanceId,
          version: input.expectedVersion,
          state: "active",
          currentNodeCode: node.nodeCode,
        },
        data: { version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw new Error("LIFECYCLE_VERSION_CONFLICT");

      await tx.nodeBlock.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          flowInstanceId: input.flowInstanceId,
          nodeInstanceId: input.nodeInstanceId,
          blockType: input.blockType,
          sourceFactId: input.sourceFactId,
          occurredAt: input.occurredAt,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          traceId: input.traceId,
          projectionVersion: input.expectedVersion + 1,
        },
      });
      const blocked = await tx.nodeInstance.updateMany({
        where: {
          id: input.nodeInstanceId,
          flowInstanceId: input.flowInstanceId,
          state: { in: ["active", "blocked"] },
        },
        data: { state: "blocked" },
      });
      if (blocked.count !== 1)
        throw new Error("NODE_BLOCK_GUARD_NOT_SATISFIED");

      const version = input.expectedVersion + 1;
      await createOutbox(
        tx,
        buildNodeBlockedOutbox({
          ...input,
          blockId: input.id,
          projectionVersion: version,
        }),
      );
      return { version };
    });
  }

  async resolveBlock(input: {
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
  }): Promise<{ version: number; nodeUnblocked: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const block = await tx.nodeBlock.findUniqueOrThrow({
        where: { id: input.blockId },
        include: { resolution: true, node: true, flow: true },
      });
      if (block.resolution) throw new Error("NODE_BLOCK_ALREADY_RESOLVED");
      if (
        block.tenantId !== input.tenantId ||
        block.flowInstanceId !== input.flowInstanceId ||
        block.flow.containerId !== input.containerId ||
        block.nodeInstanceId !== input.nodeInstanceId ||
        block.node.state !== "blocked" ||
        block.flow.state !== "active" ||
        block.flow.currentNodeCode !== block.node.nodeCode ||
        input.resolvedAt.getTime() < block.occurredAt.getTime()
      ) {
        throw new Error("NODE_BLOCK_GUARD_NOT_SATISFIED");
      }

      const advanced = await tx.flowInstance.updateMany({
        where: {
          id: input.flowInstanceId,
          version: input.expectedVersion,
          state: "active",
          currentNodeCode: block.node.nodeCode,
        },
        data: { version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw new Error("LIFECYCLE_VERSION_CONFLICT");

      await tx.nodeBlockResolution.create({
        data: {
          id: input.resolutionId,
          tenantId: input.tenantId,
          blockId: input.blockId,
          resolvedAt: input.resolvedAt,
          reasonCode: input.reasonCode,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          traceId: input.traceId,
          projectionVersion: input.expectedVersion + 1,
        },
      });
      const unresolvedCount = await tx.nodeBlock.count({
        where: {
          nodeInstanceId: input.nodeInstanceId,
          resolution: { is: null },
        },
      });
      const nodeUnblocked = unresolvedCount === 0;
      if (nodeUnblocked) {
        const restored = await tx.nodeInstance.updateMany({
          where: { id: input.nodeInstanceId, state: "blocked" },
          data: { state: "active" },
        });
        if (restored.count !== 1) {
          throw new Error("NODE_BLOCK_GUARD_NOT_SATISFIED");
        }
      }

      const version = input.expectedVersion + 1;
      await createOutbox(
        tx,
        buildNodeBlockResolvedOutbox({
          ...input,
          projectionVersion: version,
        }),
      );
      return { version, nodeUnblocked };
    });
  }
}

async function createOutbox(
  tx: {
    outboxMessage: {
      create(input: { data: Record<string, unknown> }): Promise<unknown>;
    };
  },
  outbox: NodeBlockOutboxPending,
): Promise<void> {
  await tx.outboxMessage.create({
    data: {
      id: outbox.id,
      tenantId: outbox.tenantId,
      ownerModule: outbox.ownerModule,
      eventId: outbox.eventId,
      eventType: outbox.eventType,
      eventVersion: outbox.eventVersion,
      aggregateType: outbox.aggregateType,
      aggregateId: outbox.aggregateId,
      payloadRef: outbox.payloadRef,
      payloadHash: outbox.payloadHash,
      state: outbox.state,
      attemptCount: outbox.attemptCount,
      occurredAt: outbox.occurredAt,
      idempotencyKey: outbox.idempotencyKey,
      traceId: outbox.traceId,
    },
  });
}

function toRecord(row: {
  id: string;
  tenantId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  blockType: string;
  sourceFactId: string;
  occurredAt: Date;
  actorId: string;
  idempotencyKey: string;
  traceId: string;
  projectionVersion: number;
  flow: { containerId: string; version: number };
  node: { nodeCode: string; state: string };
  resolution: null | {
    id: string;
    blockId: string;
    tenantId: string;
    resolvedAt: Date;
    reasonCode: string;
    actorId: string;
    idempotencyKey: string;
    traceId: string;
    projectionVersion: number;
  };
}): NodeBlockRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    flowInstanceId: row.flowInstanceId,
    containerId: row.flow.containerId,
    nodeInstanceId: row.nodeInstanceId,
    nodeCode: row.node.nodeCode,
    nodeState: row.node.state,
    blockType: row.blockType,
    sourceFactId: row.sourceFactId,
    occurredAt: row.occurredAt,
    actorId: row.actorId,
    idempotencyKey: row.idempotencyKey,
    traceId: row.traceId,
    projectionVersion: row.projectionVersion,
    resolution: row.resolution,
    flowVersion: row.flow.version,
  };
}
