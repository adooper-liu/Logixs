import type {
  CanonicalEventCode,
  FlowInstanceState,
  LifecycleNodeCode,
  NodeApplicability,
} from "@logix/contracts";
import type { NodeEventApplicationState } from "./node-event-application";
import type { LifecycleLocationContext } from "./lifecycle-date-fact";

// 生命周期持久化端口（Port/Adapter）。
export const LIFECYCLE_REPOSITORY = Symbol("LifecycleRepository");

export interface CanonicalEventRecord {
  id: string;
  containerId: string;
  eventCode: CanonicalEventCode;
  domainFactId: string | null;
  nodeCode: LifecycleNodeCode | null;
  timeKind: "actual" | null;
  authorityPolicyRef: string | null;
  location: LifecycleLocationContext | null;
  occurredAt: Date;
  evidenceRefs: string[];
  idempotencyKey: string;
}

export interface CanonicalEventListItem {
  id: string;
  containerId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  recordedAt: Date;
  evidenceRefs: string[];
}

export interface CanonicalEventListQuery {
  containerId: string;
  atOrBefore?: Date;
  after?: { occurredAt: Date; id: string };
  take: number;
}

export interface SaveCanonicalEventInput extends Omit<
  CanonicalEventRecord,
  "domainFactId" | "nodeCode" | "timeKind" | "authorityPolicyRef"
> {
  domainFactId: string;
  nodeCode: LifecycleNodeCode;
  timeKind: "actual";
  authorityPolicyRef: string;
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
    blockedReasonRefs?: string[];
  }[];
}

export interface NodeEventApplicationRecord {
  eventId: string;
  targetNodeInstanceId: string;
  state: NodeEventApplicationState;
  evaluatedAt: Date;
  guardResults: string[];
  reasonCode: string | null;
}

export interface ActiveOceanRouteSegment {
  routePlanId: string;
  routeVersion: number;
  segmentId: string;
  sequence: number;
  isFinal: boolean;
  destinationLocationType: "port" | "terminal";
  destinationUnlocode: string;
  destinationLocationId: string | null;
  destinationPortCallId: string | null;
}

export interface LifecycleRepository {
  findFlowByContainer(containerId: string): Promise<FlowWithNodes | null>;
  listCurrentNodes(query: {
    tenantId: string;
    containerIds: string[];
  }): Promise<
    Array<{
      containerId: string;
      currentNodeCode: LifecycleNodeCode;
      flowState: FlowInstanceState;
    }>
  >;
  listFlowsWithNodes(query: {
    tenantId: string;
    containerIds: string[];
  }): Promise<FlowWithNodes[]>;
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
    orderNumber: string | null;
    containerNumber: string | null;
    currentStatus: string;
  } | null>;
  findActiveOceanRouteSegment(
    containerId: string,
    segmentId: string,
  ): Promise<ActiveOceanRouteSegment | null>;
  // 事件流水账：幂等 + R1 时间单调
  findEventByIdempotencyKey(key: string): Promise<CanonicalEventRecord | null>;
  listEvents(query: CanonicalEventListQuery): Promise<CanonicalEventListItem[]>;
  saveEvent(event: SaveCanonicalEventInput): Promise<{ id: string }>;
  findLatestEventTime(containerId: string): Promise<Date | null>;
  findNodeEventApplication(
    eventId: string,
    targetNodeInstanceId: string,
  ): Promise<NodeEventApplicationRecord | null>;
  recordNodeEventApplication(input: NodeEventApplicationRecord): Promise<void>;
  applyEventToNode(input: {
    tenantId: string;
    flowInstanceId: string;
    expectedFlowVersion: number;
    eventId: string;
    targetNodeInstanceId: string;
    targetNodeCode: LifecycleNodeCode;
    nextNodeCode: LifecycleNodeCode | null;
    occurredAt: Date;
    evaluatedAt: Date;
    guardResults: string[];
    routeSegmentGuard: ActiveOceanRouteSegment | null;
    traceId: string;
  }): Promise<{ applied: boolean; version: number }>;
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
