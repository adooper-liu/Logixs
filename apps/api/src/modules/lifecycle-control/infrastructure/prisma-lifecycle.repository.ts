import { Inject, Injectable } from "@nestjs/common";
import type {
  FlowInstanceState,
  LifecycleNodeCode,
  NodeApplicability,
} from "@logix/contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import { defaultApplicability } from "../domain/node-applicability";
import { NODE_SEQUENCE } from "../domain/node-status";
import type {
  CanonicalEventListItem,
  CanonicalEventListQuery,
  CanonicalEventRecord,
  FlowWithNodes,
  LifecycleRepository,
  NodeEventApplicationRecord,
  SaveCanonicalEventInput,
} from "../domain/lifecycle.repository";
import { buildLifecycleOutboxPending } from "../domain/outbox-message";

@Injectable()
export class PrismaLifecycleRepository implements LifecycleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findFlowByContainer(
    containerId: string,
  ): Promise<FlowWithNodes | null> {
    const flow = await this.prisma.flowInstance.findUnique({
      where: { containerId },
      include: { nodes: true },
    });
    if (!flow) return null;
    return toFlowWithNodes(flow);
  }

  async listCurrentNodes(query: {
    tenantId: string;
    containerIds: string[];
  }): Promise<
    Array<{
      containerId: string;
      currentNodeCode: LifecycleNodeCode;
      flowState: FlowInstanceState;
    }>
  > {
    if (query.containerIds.length === 0) return [];
    const owned = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: query.tenantId,
        id: { in: query.containerIds },
      },
      select: { id: true },
    });
    const ownedIds = owned.map((row) => row.id);
    if (ownedIds.length === 0) return [];
    const flows = await this.prisma.flowInstance.findMany({
      where: { containerId: { in: ownedIds } },
      select: {
        containerId: true,
        currentNodeCode: true,
        state: true,
      },
    });
    return flows.map((flow) => ({
      containerId: flow.containerId,
      currentNodeCode: flow.currentNodeCode as LifecycleNodeCode,
      flowState: flow.state as FlowInstanceState,
    }));
  }

  async listFlowsWithNodes(query: {
    tenantId: string;
    containerIds: string[];
  }): Promise<FlowWithNodes[]> {
    if (query.containerIds.length === 0) return [];
    const owned = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: query.tenantId,
        id: { in: query.containerIds },
      },
      select: { id: true },
    });
    const ownedIds = owned.map((row) => row.id);
    if (ownedIds.length === 0) return [];
    const flows = await this.prisma.flowInstance.findMany({
      where: { containerId: { in: ownedIds } },
      include: { nodes: true },
    });
    return flows.map((flow) => toFlowWithNodes(flow));
  }

  async ensureFlow(containerId: string): Promise<FlowWithNodes> {
    return this.prisma.$transaction(async (transaction) => {
      const flow = await transaction.flowInstance.upsert({
        where: { containerId },
        create: {
          containerId,
          state: "active",
          currentNodeCode: "cargo_ready",
        },
        update: {},
      });
      await transaction.nodeInstance.createMany({
        data: lifecycleNodeCodes().map((nodeCode) => ({
          flowInstanceId: flow.id,
          nodeCode,
          state: nodeCode === flow.currentNodeCode ? "active" : "pending",
          applicability: defaultApplicability(nodeCode),
        })),
        skipDuplicates: true,
      });
      const persisted = await transaction.flowInstance.findUniqueOrThrow({
        where: { id: flow.id },
        include: { nodes: true },
      });
      return toFlowWithNodes(persisted);
    });
  }

  async completeNodes(
    flowInstanceId: string,
    nodeCodes: LifecycleNodeCode[],
    occurredAt: Date,
  ): Promise<void> {
    for (const nodeCode of nodeCodes) {
      // R3 密封：已完成的节点不重复完成、completedAt 不覆盖。
      const existing = await this.prisma.nodeInstance.findUnique({
        where: { flowInstanceId_nodeCode: { flowInstanceId, nodeCode } },
      });
      if (existing?.state === "completed") continue;

      await this.prisma.nodeInstance.upsert({
        where: { flowInstanceId_nodeCode: { flowInstanceId, nodeCode } },
        create: {
          flowInstanceId,
          nodeCode,
          state: "completed",
          completedAt: occurredAt,
          applicability: defaultApplicability(nodeCode),
        },
        update: { state: "completed", completedAt: occurredAt },
      });
    }
  }

  async updateCurrentNode(
    flowInstanceId: string,
    nodeCode: LifecycleNodeCode,
  ): Promise<void> {
    await this.prisma.flowInstance.update({
      where: { id: flowInstanceId },
      data: { currentNodeCode: nodeCode },
    });
  }

  async ensureNode(
    flowInstanceId: string,
    nodeCode: LifecycleNodeCode,
  ): Promise<{ id: string; nodeCode: LifecycleNodeCode }> {
    const node = await this.prisma.nodeInstance.upsert({
      where: { flowInstanceId_nodeCode: { flowInstanceId, nodeCode } },
      create: {
        flowInstanceId,
        nodeCode,
        state: "pending",
        applicability: defaultApplicability(nodeCode),
      },
      update: {},
    });
    return { id: node.id, nodeCode };
  }

  async findContainerBase(containerId: string): Promise<{
    tenantId: string;
    orderNumber: string;
    containerNumber: string | null;
    currentStatus: string;
  } | null> {
    const container = await this.prisma.containerRecord.findUnique({
      where: { id: containerId },
    });
    if (!container) return null;
    return {
      tenantId: container.tenantId,
      orderNumber: container.orderNumber,
      containerNumber: container.containerNumber,
      currentStatus: container.currentStatus,
    };
  }

  async listEvents(
    query: CanonicalEventListQuery,
  ): Promise<CanonicalEventListItem[]> {
    const rows = await this.prisma.canonicalEvent.findMany({
      where: {
        containerId: query.containerId,
        ...(query.atOrBefore ? { occurredAt: { lte: query.atOrBefore } } : {}),
        ...(query.after
          ? {
              OR: [
                { occurredAt: { lt: query.after.occurredAt } },
                {
                  AND: [
                    { occurredAt: query.after.occurredAt },
                    { id: { lt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.map((row) => ({
      id: row.id,
      containerId: row.containerId,
      eventCode: row.eventCode as CanonicalEventListItem["eventCode"],
      occurredAt: row.occurredAt,
      recordedAt: row.appliedAt,
      evidenceRefs: Array.isArray(row.evidenceRefs)
        ? (row.evidenceRefs as string[])
        : [],
    }));
  }

  async findEventByIdempotencyKey(
    key: string,
  ): Promise<CanonicalEventRecord | null> {
    const event = await this.prisma.canonicalEvent.findUnique({
      where: { idempotencyKey: key },
    });
    return event
      ? {
          id: event.id,
          containerId: event.containerId,
          eventCode: event.eventCode as CanonicalEventRecord["eventCode"],
          domainFactId: event.domainFactId,
          nodeCode: event.nodeCode as CanonicalEventRecord["nodeCode"],
          timeKind: event.timeKind as CanonicalEventRecord["timeKind"],
          authorityPolicyRef: event.authorityPolicyRef,
          occurredAt: event.occurredAt,
          evidenceRefs: Array.isArray(event.evidenceRefs)
            ? (event.evidenceRefs as string[])
            : [],
          idempotencyKey: event.idempotencyKey,
        }
      : null;
  }

  async saveEvent(event: SaveCanonicalEventInput): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.canonicalEvent.create({
        data: {
          containerId: event.containerId,
          eventCode: event.eventCode,
          domainFactId: event.domainFactId,
          nodeCode: event.nodeCode,
          timeKind: event.timeKind,
          authorityPolicyRef: event.authorityPolicyRef,
          occurredAt: event.occurredAt,
          evidenceRefs: event.evidenceRefs,
          idempotencyKey: event.idempotencyKey,
        },
      });
      const outbox = buildLifecycleOutboxPending({
        eventId: created.id,
        tenantId: event.tenantId,
        containerId: event.containerId,
        eventCode: event.eventCode,
        domainFactId: event.domainFactId,
        nodeCode: event.nodeCode,
        timeKind: event.timeKind,
        authorityPolicyRef: event.authorityPolicyRef,
        occurredAt: event.occurredAt,
        evidenceRefs: event.evidenceRefs,
        idempotencyKey: event.idempotencyKey,
        traceId: event.traceId,
      });
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
      if (event.completeInbox) {
        const completed = await tx.inboxMessage.updateMany({
          where: {
            id: event.completeInbox.id,
            state: "processing",
            leaseOwner: event.completeInbox.owner,
          },
          data: {
            state: "processed",
            processedAt: event.completeInbox.processedAt,
            leaseOwner: null,
            leaseLockedAt: null,
            leaseExpiresAt: null,
            nextAttemptAt: null,
          },
        });
        if (completed.count !== 1) {
          throw new Error("INBOX_LEASE_LOST");
        }
      }
      return { id: created.id };
    });
  }

  async findLatestEventTime(containerId: string): Promise<Date | null> {
    const latest = await this.prisma.canonicalEvent.findFirst({
      where: { containerId },
      orderBy: { occurredAt: "desc" },
    });
    return latest?.occurredAt ?? null;
  }

  async findNodeEventApplication(
    eventId: string,
    targetNodeInstanceId: string,
  ): Promise<NodeEventApplicationRecord | null> {
    const application = await this.prisma.nodeEventApplication.findUnique({
      where: {
        eventId_targetNodeInstanceId: { eventId, targetNodeInstanceId },
      },
    });
    if (!application) return null;
    return {
      eventId: application.eventId,
      targetNodeInstanceId: application.targetNodeInstanceId,
      state: application.state as NodeEventApplicationRecord["state"],
      evaluatedAt: application.evaluatedAt,
      guardResults: Array.isArray(application.guardResults)
        ? (application.guardResults as string[])
        : [],
      reasonCode: application.reasonCode,
    };
  }

  async recordNodeEventApplication(
    input: NodeEventApplicationRecord,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.nodeEventApplication.updateMany({
        where: {
          eventId: input.eventId,
          targetNodeInstanceId: input.targetNodeInstanceId,
          state: "pending_application",
        },
        data: {
          state: input.state,
          evaluatedAt: input.evaluatedAt,
          guardResults: input.guardResults,
          reasonCode: input.reasonCode,
          appliedAt: null,
        },
      });
      if (updated.count === 1) return;

      const existing = await tx.nodeEventApplication.findUnique({
        where: {
          eventId_targetNodeInstanceId: {
            eventId: input.eventId,
            targetNodeInstanceId: input.targetNodeInstanceId,
          },
        },
      });
      if (existing) return;
      await tx.nodeEventApplication.create({
        data: {
          eventId: input.eventId,
          targetNodeInstanceId: input.targetNodeInstanceId,
          state: input.state,
          evaluatedAt: input.evaluatedAt,
          guardResults: input.guardResults,
          reasonCode: input.reasonCode,
        },
      });
    });
  }

  async applyEventToNode(input: {
    flowInstanceId: string;
    expectedFlowVersion: number;
    eventId: string;
    targetNodeInstanceId: string;
    targetNodeCode: LifecycleNodeCode;
    nextNodeCode: LifecycleNodeCode | null;
    occurredAt: Date;
    evaluatedAt: Date;
    guardResults: string[];
  }): Promise<{ applied: boolean; version: number }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.nodeEventApplication.findUnique({
        where: {
          eventId_targetNodeInstanceId: {
            eventId: input.eventId,
            targetNodeInstanceId: input.targetNodeInstanceId,
          },
        },
      });
      if (existing?.state === "applied") {
        const flow = await tx.flowInstance.findUniqueOrThrow({
          where: { id: input.flowInstanceId },
          select: { version: true },
        });
        return { applied: false, version: flow.version };
      }

      const target = await tx.nodeInstance.findUniqueOrThrow({
        where: { id: input.targetNodeInstanceId },
      });
      if (
        target.flowInstanceId !== input.flowInstanceId ||
        target.nodeCode !== input.targetNodeCode
      ) {
        throw new Error("LIFECYCLE_GUARD_NOT_SATISFIED");
      }
      if (target.state === "completed") {
        throw new Error("LIFECYCLE_HISTORY_SEALED");
      }
      if (target.state === "blocked") {
        throw new Error("LIFECYCLE_NODE_BLOCKED");
      }

      const advanced = await tx.flowInstance.updateMany({
        where: {
          id: input.flowInstanceId,
          version: input.expectedFlowVersion,
          state: "active",
        },
        data: {
          version: { increment: 1 },
          currentNodeCode: input.nextNodeCode ?? input.targetNodeCode,
          state: input.nextNodeCode ? "active" : "completed",
        },
      });
      if (advanced.count !== 1) {
        throw new Error("LIFECYCLE_VERSION_CONFLICT");
      }

      await tx.nodeInstance.update({
        where: { id: input.targetNodeInstanceId },
        data: { state: "completed", completedAt: input.occurredAt },
      });
      if (input.nextNodeCode) {
        await tx.nodeInstance.updateMany({
          where: {
            flowInstanceId: input.flowInstanceId,
            nodeCode: input.nextNodeCode,
            state: { not: "completed" },
          },
          data: { state: "active" },
        });
      }
      await tx.nodeEventApplication.upsert({
        where: {
          eventId_targetNodeInstanceId: {
            eventId: input.eventId,
            targetNodeInstanceId: input.targetNodeInstanceId,
          },
        },
        create: {
          eventId: input.eventId,
          targetNodeInstanceId: input.targetNodeInstanceId,
          state: "applied",
          evaluatedAt: input.evaluatedAt,
          guardResults: input.guardResults,
          appliedAt: input.evaluatedAt,
        },
        update: {
          state: "applied",
          evaluatedAt: input.evaluatedAt,
          guardResults: input.guardResults,
          reasonCode: null,
          appliedAt: input.evaluatedAt,
        },
      });
      return { applied: true, version: input.expectedFlowVersion + 1 };
    });
  }

  async findApplicabilityDecision(idempotencyKey: string): Promise<{
    flowInstanceId: string;
    nodeCode: LifecycleNodeCode;
    applicability: NodeApplicability;
    version: number;
  } | null> {
    const decision = await this.prisma.nodeApplicabilityDecision.findUnique({
      where: { idempotencyKey },
    });
    if (!decision) return null;
    const flow = await this.prisma.flowInstance.findUnique({
      where: { id: decision.flowInstanceId },
    });
    return {
      flowInstanceId: decision.flowInstanceId,
      nodeCode: decision.nodeCode as LifecycleNodeCode,
      applicability: decision.applicability as NodeApplicability,
      version: flow?.version ?? 0,
    };
  }

  async applyNodeApplicability(input: {
    flowInstanceId: string;
    nodeCode: LifecycleNodeCode;
    applicability: NodeApplicability;
    evidenceRefs: string[];
    reasonCode: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<{ version: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.nodeInstance.upsert({
        where: {
          flowInstanceId_nodeCode: {
            flowInstanceId: input.flowInstanceId,
            nodeCode: input.nodeCode,
          },
        },
        create: {
          flowInstanceId: input.flowInstanceId,
          nodeCode: input.nodeCode,
          state: "pending",
          applicability: input.applicability,
        },
        update: { applicability: input.applicability },
      });
      await tx.nodeApplicabilityDecision.create({
        data: {
          flowInstanceId: input.flowInstanceId,
          nodeCode: input.nodeCode,
          applicability: input.applicability,
          evidenceRefs: input.evidenceRefs,
          reasonCode: input.reasonCode,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const flow = await tx.flowInstance.update({
        where: { id: input.flowInstanceId },
        data: { version: { increment: 1 } },
      });
      return { version: flow.version };
    });
  }
}

function lifecycleNodeCodes(): LifecycleNodeCode[] {
  return (Object.entries(NODE_SEQUENCE) as [LifecycleNodeCode, number][])
    .sort((left, right) => left[1] - right[1])
    .map(([nodeCode]) => nodeCode);
}

function toFlowWithNodes(flow: {
  id: string;
  containerId: string;
  state: string;
  currentNodeCode: string;
  version: number;
  nodes: {
    id: string;
    nodeCode: string;
    state: string;
    completedAt: Date | null;
    applicability: string;
  }[];
}): FlowWithNodes {
  return {
    flow: {
      id: flow.id,
      containerId: flow.containerId,
      state: flow.state,
      currentNodeCode: flow.currentNodeCode,
      version: flow.version,
    },
    nodes: flow.nodes.map((node) => ({
      id: node.id,
      nodeCode: node.nodeCode as LifecycleNodeCode,
      state: node.state,
      completedAt: node.completedAt,
      applicability: node.applicability as NodeApplicability,
    })),
  };
}
