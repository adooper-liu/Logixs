import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CanonicalEventCode,
  ContainerLifecycleState,
  LifecycleNodeCode,
} from "@logix/contracts";
import { ApplyContainerRecordService } from "../../shipment-registry";
import {
  CREATE_NODE_TASK,
  type CreateNodeTaskPort,
} from "../../work-execution";
import {
  EVENT_TO_COMPLETION_NODES,
  EVENT_TO_CONTAINER_STATUS,
} from "../domain/event-catalog";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import {
  defaultApplicability,
  nextApplicableNode,
} from "../domain/node-applicability";
import { parseEvidenceRefs } from "../domain/evidence-refs";
import { CONTAINER_STATUS_ORDER, NODE_SEQUENCE } from "../domain/node-status";

const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

interface AssertEvidenceRefsPort {
  execute(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    evidenceIds: string[];
  }): Promise<void>;
}

export interface ApplyLifecycleEventInput {
  containerId: string;
  tenantId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  idempotencyKey: string;
  evidenceRefs: string[];
  traceId?: string;
  completeInbox?: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

export interface ApplyLifecycleEventResult {
  containerId: string;
  eventCode: CanonicalEventCode;
  completedNodes: LifecycleNodeCode[];
  resultingStatus: string | null; // null = 本次事件不推进 8 态
  applied: boolean; // false = 幂等命中（已应用过）
  activatedNodeCode: LifecycleNodeCode | null;
  activatedNodeTaskId: string | null;
}

// 应用生命周期事件：事件 → 完成 eligible 节点 → 推进 currentStatus。
// 不变量：幂等（idempotencyKey）、R1 时间单调、R3 密封、R2 状态单调。
@Injectable()
export class ApplyLifecycleEventService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
    @Inject(ApplyContainerRecordService)
    private readonly applyContainerRecord: ApplyContainerRecordService,
    @Inject(CREATE_NODE_TASK)
    private readonly createNodeTask: CreateNodeTaskPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
  ) {}

  async execute(
    input: ApplyLifecycleEventInput,
  ): Promise<ApplyLifecycleEventResult> {
    const eligibleNodes = EVENT_TO_COMPLETION_NODES[input.eventCode];
    if (!eligibleNodes) {
      throw new HttpException(
        "VALIDATION_FORMAT: 未知事件码",
        HttpStatus.BAD_REQUEST,
      );
    }

    const container = await this.repository.findContainerBase(
      input.containerId,
    );
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (container.tenantId !== input.tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 租户不匹配",
        HttpStatus.FORBIDDEN,
      );
    }

    let evidenceRefs: string[];
    try {
      evidenceRefs = parseEvidenceRefs(input.evidenceRefs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "EVIDENCE_REQUIRED";
      throw new HttpException(
        message,
        message.startsWith("EVIDENCE_REQUIRED")
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.BAD_REQUEST,
      );
    }

    // 幂等：同 idempotencyKey 不重复应用
    const existing = await this.repository.findEventByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      const flow = await this.repository.findFlowByContainer(input.containerId);
      const completed =
        flow?.nodes
          .filter((node) => node.state === "completed")
          .map((node) => node.nodeCode) ?? [];
      const activated = await this.activateFollowingTask(
        input.containerId,
        input.tenantId,
        completed,
      );
      return {
        containerId: input.containerId,
        eventCode: input.eventCode,
        completedNodes: [],
        resultingStatus: null,
        applied: false,
        ...activated,
      };
    }

    // R1 时间单调：occurredAt ≥ 已应用事件的最晚时间
    const latestTime = await this.repository.findLatestEventTime(
      input.containerId,
    );
    if (latestTime && input.occurredAt < latestTime) {
      throw new HttpException(
        "TIME_ORDER_CONFLICT: 事件时间早于已应用事件",
        HttpStatus.CONFLICT,
      );
    }

    await this.assertEvidenceRefs.execute({
      tenantId: input.tenantId,
      subjectType: "container",
      subjectId: input.containerId,
      evidenceIds: evidenceRefs,
    });

    const flow = await this.repository.ensureFlow(input.containerId);

    const completedNodes: LifecycleNodeCode[] = [];
    if (eligibleNodes.length > 0) {
      await this.repository.completeNodes(
        flow.flow.id,
        eligibleNodes,
        input.occurredAt,
      );
      completedNodes.push(...eligibleNodes);
      const farthest = farthestNode(completedNodes);
      if (farthest) {
        await this.repository.updateCurrentNode(flow.flow.id, farthest);
      }
    }

    // currentStatus 推进：只有转换表里的事件才推进 8 态；R2 状态单调（不回退）
    const targetStatus = EVENT_TO_CONTAINER_STATUS[input.eventCode] ?? null;
    let resultingStatus: ContainerLifecycleState | null = null;
    if (targetStatus) {
      const currentOrder =
        CONTAINER_STATUS_ORDER[
          container.currentStatus as ContainerLifecycleState
        ] ?? -1;
      const targetOrder = CONTAINER_STATUS_ORDER[targetStatus] ?? -1;
      if (targetOrder >= currentOrder) {
        await this.applyContainerRecord.execute({
          tenantId: container.tenantId,
          orderNumber: container.orderNumber,
          containerNumber: container.containerNumber,
          currentStatus: targetStatus,
        });
        resultingStatus = targetStatus;
      }
    }

    // 事件流水账（不可变留痕）
    await this.repository.saveEvent({
      id: "", // DB 生成；Outbox eventId 使用落账后的规范事件 id
      containerId: input.containerId,
      tenantId: input.tenantId,
      eventCode: input.eventCode,
      occurredAt: input.occurredAt,
      evidenceRefs,
      idempotencyKey: input.idempotencyKey,
      traceId: input.traceId ?? randomUUID(),
      completeInbox: input.completeInbox,
    });

    const activated = await this.activateFollowingTask(
      input.containerId,
      input.tenantId,
      completedNodes,
    );

    return {
      containerId: input.containerId,
      eventCode: input.eventCode,
      completedNodes,
      resultingStatus,
      applied: true,
      ...activated,
    };
  }

  private async activateFollowingTask(
    containerId: string,
    tenantId: string,
    completedThisTime: LifecycleNodeCode[],
  ): Promise<{
    activatedNodeCode: LifecycleNodeCode | null;
    activatedNodeTaskId: string | null;
  }> {
    if (completedThisTime.length === 0) {
      return { activatedNodeCode: null, activatedNodeTaskId: null };
    }

    const farthest = farthestNode(completedThisTime);
    if (!farthest) {
      return { activatedNodeCode: null, activatedNodeTaskId: null };
    }

    const flow = await this.repository.ensureFlow(containerId);
    const nextNode = nextApplicableNode(farthest, (nodeCode) => {
      const existing = flow.nodes.find((node) => node.nodeCode === nodeCode);
      return existing?.applicability ?? defaultApplicability(nodeCode);
    });
    if (!nextNode) {
      return { activatedNodeCode: null, activatedNodeTaskId: null };
    }

    const node = await this.repository.ensureNode(flow.flow.id, nextNode);
    const applicability =
      flow.nodes.find((candidate) => candidate.nodeCode === nextNode)
        ?.applicability ?? defaultApplicability(nextNode);

    try {
      const created = await this.createNodeTask.execute({
        flowInstanceId: flow.flow.id,
        nodeInstanceId: node.id,
        nodeCode: nextNode,
        containerId,
        tenantId,
        applicability,
      });
      return {
        activatedNodeCode: nextNode,
        activatedNodeTaskId: created.task.id,
      };
    } catch {
      return { activatedNodeCode: nextNode, activatedNodeTaskId: null };
    }
  }
}

function farthestNode(nodes: LifecycleNodeCode[]): LifecycleNodeCode | null {
  return (
    nodes
      .filter((node) => NODE_SEQUENCE[node] !== undefined)
      .sort((a, b) => NODE_SEQUENCE[b] - NODE_SEQUENCE[a])[0] ?? null
  );
}
