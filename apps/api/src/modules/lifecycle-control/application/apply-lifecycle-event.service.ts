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
}

export interface ApplyLifecycleEventResult {
  containerId: string;
  eventCode: CanonicalEventCode;
  completedNodes: LifecycleNodeCode[];
  resultingStatus: string | null; // null = 本次事件不推进 8 态
}

// 应用生命周期事件（第一刀）：事件 → 完成 eligible 节点 → 推进 currentStatus。
// 时间单调/密封/来源权威延后。
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

    const container = await this.repository.findContainerBase(
      input.containerId,
    );
    if (!container) throw new NotFoundException("RESOURCE_NOT_FOUND");

    const flow = await this.repository.ensureFlow(input.containerId);

    const completedNodes: LifecycleNodeCode[] = [];
    if (eligibleNodes.length > 0) {
      await this.repository.completeNodes(
        flow.flow.id,
        eligibleNodes,
        input.occurredAt,
      );
      completedNodes.push(...eligibleNodes);
      // 更新当前节点为「最远的已完成节点」
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

    return {
      containerId: input.containerId,
      eventCode: input.eventCode,
      completedNodes,
      resultingStatus,
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
