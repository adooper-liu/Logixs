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
  EVENT_TO_COMPLETION_NODES,
  EVENT_TO_CONTAINER_STATUS,
} from "../domain/event-catalog";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import { CONTAINER_STATUS_ORDER, NODE_SEQUENCE } from "../domain/node-status";

export interface ApplyLifecycleEventInput {
  containerId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  idempotencyKey: string;
}

export interface ApplyLifecycleEventResult {
  containerId: string;
  eventCode: CanonicalEventCode;
  completedNodes: LifecycleNodeCode[];
  resultingStatus: string | null; // null = 本次事件不推进 8 态
  applied: boolean; // false = 幂等命中（已应用过）
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

    // 幂等：同 idempotencyKey 不重复应用
    const existing = await this.repository.findEventByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return {
        containerId: input.containerId,
        eventCode: input.eventCode,
        completedNodes: [],
        resultingStatus: null,
        applied: false,
      };
    }

    const container = await this.repository.findContainerBase(
      input.containerId,
    );
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");

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
      id: "", // DB 生成
      containerId: input.containerId,
      eventCode: input.eventCode,
      occurredAt: input.occurredAt,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      containerId: input.containerId,
      eventCode: input.eventCode,
      completedNodes,
      resultingStatus,
      applied: true,
    };
  }
}

function farthestNode(nodes: LifecycleNodeCode[]): LifecycleNodeCode | null {
  return (
    nodes
      .filter((node) => NODE_SEQUENCE[node] !== undefined)
      .sort((a, b) => NODE_SEQUENCE[b] - NODE_SEQUENCE[a])[0] ?? null
  );
}
