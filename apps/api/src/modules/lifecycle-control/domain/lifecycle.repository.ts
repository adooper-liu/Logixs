import type {
  CanonicalEventCode,
  LifecycleNodeCode,
  NodeApplicability,
} from "@logix/contracts";

// 生命周期持久化端口（Port/Adapter）。
export const LIFECYCLE_REPOSITORY = Symbol("LifecycleRepository");

export interface CanonicalEventRecord {
  id: string;
  containerId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  evidenceRefs: string[];
  idempotencyKey: string;
}

export interface SaveCanonicalEventInput extends CanonicalEventRecord {
  tenantId: string;
  traceId: string;
  completeInbox?: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

export interface FlowWithNodes {
  flow: {
    id: string;
    containerId: string;
    state: string;
    currentNodeCode: string;
    version: number;
  };
  nodes: {
    id: string;
    nodeCode: LifecycleNodeCode;
    state: string;
    completedAt: Date | null;
    applicability: NodeApplicability;
  }[];
}

export interface LifecycleRepository {
  findFlowByContainer(containerId: string): Promise<FlowWithNodes | null>;
  ensureFlow(containerId: string): Promise<FlowWithNodes>;
  completeNodes(
    flowInstanceId: string,
    nodeCodes: LifecycleNodeCode[],
    occurredAt: Date,
  ): Promise<void>;
  updateCurrentNode(
    flowInstanceId: string,
    nodeCode: LifecycleNodeCode,
  ): Promise<void>;
  ensureNode(
    flowInstanceId: string,
    nodeCode: LifecycleNodeCode,
  ): Promise<{ id: string; nodeCode: LifecycleNodeCode }>;
  // 查 container 基本信息（经 shipment-registry 写端口更新 currentStatus 需要 tenantId/orderNumber）
  findContainerBase(containerId: string): Promise<{
    tenantId: string;
    orderNumber: string;
    containerNumber: string | null;
    currentStatus: string;
  } | null>;
  // 事件流水账：幂等 + R1 时间单调
  findEventByIdempotencyKey(key: string): Promise<CanonicalEventRecord | null>;
  saveEvent(event: SaveCanonicalEventInput): Promise<void>;
  findLatestEventTime(containerId: string): Promise<Date | null>;
  findApplicabilityDecision(idempotencyKey: string): Promise<{
    flowInstanceId: string;
    nodeCode: LifecycleNodeCode;
    applicability: NodeApplicability;
    version: number;
  } | null>;
  applyNodeApplicability(input: {
    flowInstanceId: string;
    nodeCode: LifecycleNodeCode;
    applicability: NodeApplicability;
    evidenceRefs: string[];
    reasonCode: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<{ version: number }>;
}
