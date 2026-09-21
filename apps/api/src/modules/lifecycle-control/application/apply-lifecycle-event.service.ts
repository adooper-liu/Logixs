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
import {
  GET_CUSTOMS_CLEARANCE_READINESS,
  type GetCustomsClearanceReadinessPort,
} from "../../customs-compliance";
import {
  READ_EVIDENCE_AUTHORITY_CONTEXT,
  type ReadEvidenceAuthorityContextPort,
} from "../../document-records";
import {
  GET_WAREHOUSE_DELIVERY_READINESS,
  type GetWarehouseDeliveryReadinessPort,
} from "../../inland-fulfillment";
import {
  ApplyContainerRecordService,
  GET_CONTAINER_DISPATCH_READINESS,
  GET_CONTAINER_STUFFING_READINESS,
  type GetContainerDispatchReadinessPort,
  type GetContainerStuffingReadinessPort,
} from "../../shipment-registry";
import {
  EVALUATE_CARGO_READY_COMPLIANCE,
  type EvaluateCargoReadyCompliancePort,
} from "../../compliance-management";
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
  ASSERT_LIFECYCLE_STATE_EVIDENCE,
  type AssertLifecycleStateEvidencePort,
} from "../assert-lifecycle-state-evidence.port";
import {
  defaultApplicability,
  nextApplicableNode,
} from "../domain/node-applicability";
import { decideNodeEventApplication } from "../domain/node-event-application";
import { decideNodeSpecializedGuard } from "../domain/node-specialized-guard";
import { parseEvidenceRefs } from "../domain/evidence-refs";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
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
  domainFactId?: string;
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
  pendingNodes: LifecycleNodeCode[];
  pendingReasonCodes: Partial<Record<LifecycleNodeCode, string>>;
  resultingStatus: string | null; // null = 本次事件不推进 8 态
  applied: boolean; // false = 幂等命中（已应用过）
  activatedNodeCode: LifecycleNodeCode | null;
  activatedNodeTaskId: string | null;
  canonicalEventId: string;
}

// 应用生命周期事件：事件 → 完成 eligible 节点 → 推进 currentStatus。
// 不变量：事件与目标节点分别幂等、节点实际时间单调、R3 密封、R2 状态单调。
@Injectable()
export class ApplyLifecycleEventService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
    @Inject(ASSERT_LIFECYCLE_STATE_EVIDENCE)
    private readonly assertStateEvidence: AssertLifecycleStateEvidencePort,
    @Inject(ApplyContainerRecordService)
    private readonly applyContainerRecord: ApplyContainerRecordService,
    @Inject(CREATE_NODE_TASK)
    private readonly createNodeTask: CreateNodeTaskPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(EVALUATE_CARGO_READY_COMPLIANCE)
    private readonly evaluateCargoReadyCompliance: EvaluateCargoReadyCompliancePort,
    @Inject(GET_CONTAINER_STUFFING_READINESS)
    private readonly getContainerStuffingReadiness: GetContainerStuffingReadinessPort,
    @Inject(GET_CONTAINER_DISPATCH_READINESS)
    private readonly getContainerDispatchReadiness: GetContainerDispatchReadinessPort,
    @Inject(GET_CUSTOMS_CLEARANCE_READINESS)
    private readonly getCustomsClearanceReadiness: GetCustomsClearanceReadinessPort,
    @Inject(GET_WAREHOUSE_DELIVERY_READINESS)
    private readonly getWarehouseDeliveryReadiness: GetWarehouseDeliveryReadinessPort,
    @Inject(READ_EVIDENCE_AUTHORITY_CONTEXT)
    private readonly readEvidenceAuthorityContext: ReadEvidenceAuthorityContextPort,
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly lifecycleDateFacts: LifecycleDateFactRepository,
  ) {}

  async execute(
    input: ApplyLifecycleEventInput,
  ): Promise<ApplyLifecycleEventResult> {
    const eligibleNodes = EVENT_TO_COMPLETION_NODES[input.eventCode];
    if (!eligibleNodes) {
      throw new HttpException(
        "LIFECYCLE_EVENT_TYPE_UNKNOWN: 未知事件码",
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

    if (!input.domainFactId?.trim()) {
      throw new HttpException(
        "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE: 缺少规范事实引用",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const stateEvidence = await this.assertStateEvidence.execute({
      domainFactId: input.domainFactId,
      tenantId: input.tenantId,
      containerId: input.containerId,
      eventCode: input.eventCode,
      occurredAt: input.occurredAt,
      evidenceRefs,
    });
    const routeSegment =
      ["arrived", "transit_arrived"].includes(input.eventCode) &&
      stateEvidence.location?.segmentId
        ? await this.repository.findActiveOceanRouteSegment(
            input.containerId,
            stateEvidence.location.segmentId,
          )
        : null;

    // 事件接收幂等与节点应用幂等分开：同一事件可在前序满足后继续应用后续目标。
    const existing = await this.repository.findEventByIdempotencyKey(
      input.idempotencyKey,
    );
    if (
      existing &&
      !sameEvent(existing, input, evidenceRefs, stateEvidence.location)
    ) {
      throw new HttpException(
        "LIFECYCLE_IDEMPOTENCY_CONFLICT: 同键异载荷",
        HttpStatus.CONFLICT,
      );
    }

    let canonicalEventId = existing?.id;
    if (!existing) {
      await this.assertEvidenceRefs.execute({
        tenantId: input.tenantId,
        subjectType: "container",
        subjectId: input.containerId,
        evidenceIds: evidenceRefs,
      });
      canonicalEventId = (
        await this.repository.saveEvent({
          id: "",
          containerId: input.containerId,
          tenantId: input.tenantId,
          eventCode: input.eventCode,
          domainFactId: stateEvidence.domainFactId,
          nodeCode: stateEvidence.nodeCode,
          timeKind: "actual",
          authorityPolicyRef: stateEvidence.authorityPolicyRef,
          location: stateEvidence.location,
          occurredAt: input.occurredAt,
          evidenceRefs,
          idempotencyKey: input.idempotencyKey,
          traceId: input.traceId ?? randomUUID(),
          completeInbox: input.completeInbox,
        })
      ).id;
    }
    if (!canonicalEventId) {
      throw new Error("CANONICAL_EVENT_ID_MISSING");
    }

    let flow = await this.repository.ensureFlow(input.containerId);
    const pickupAvailability =
      input.eventCode === "gate_out"
        ? ((
            await this.lifecycleDateFacts.listCurrent({
              tenantId: input.tenantId,
              containerId: input.containerId,
            })
          ).find(
            (fact) =>
              fact.nodeCode === "container_pickup" &&
              fact.eventCode === "available" &&
              fact.timeKind === "actual" &&
              fact.isCurrent,
          ) ?? null)
        : null;
    const isWarehouseDeliveryEvent = [
      "delivered",
      "warehouse_arrival",
    ].includes(input.eventCode);
    const deliveryReadiness = isWarehouseDeliveryEvent
      ? await this.getWarehouseDeliveryReadiness.execute({
          tenantId: input.tenantId,
          containerRecordId: input.containerId,
        })
      : null;
    const deliveryEvidenceContexts = isWarehouseDeliveryEvent
      ? await this.readEvidenceAuthorityContext.execute({
          tenantId: input.tenantId,
          subjectType: "container",
          subjectId: input.containerId,
          evidenceIds: evidenceRefs,
        })
      : [];

    const completedNodes: LifecycleNodeCode[] = [];
    const pendingNodes: LifecycleNodeCode[] = [];
    const pendingReasonCodes: Partial<Record<LifecycleNodeCode, string>> = {};
    for (const targetNodeCode of [...eligibleNodes].sort(
      (left, right) => NODE_SEQUENCE[left] - NODE_SEQUENCE[right],
    )) {
      const target = flow.nodes.find(
        (node) => node.nodeCode === targetNodeCode,
      );
      if (!target) {
        throw new HttpException(
          "LIFECYCLE_GUARD_NOT_SATISFIED: 目标节点不存在",
          HttpStatus.CONFLICT,
        );
      }
      const priorApplication = await this.repository.findNodeEventApplication(
        canonicalEventId,
        target.id,
      );
      if (priorApplication?.state === "applied") continue;
      if (priorApplication?.state === "rejected") {
        throw new HttpException(
          `${priorApplication.reasonCode ?? "BUSINESS_STATE_VIOLATION"}: 目标节点应用已拒绝`,
          HttpStatus.CONFLICT,
        );
      }

      const decision = decideNodeEventApplication({
        targetNodeCode,
        occurredAt: input.occurredAt,
        nodes: flow.nodes,
      });
      if (decision.kind !== "apply") {
        await this.repository.recordNodeEventApplication({
          eventId: canonicalEventId,
          targetNodeInstanceId: target.id,
          state: decision.kind,
          evaluatedAt: new Date(),
          guardResults: decision.guardResults,
          reasonCode: decision.reasonCode,
        });
        if (decision.kind === "pending_application") {
          pendingNodes.push(targetNodeCode);
          pendingReasonCodes[targetNodeCode] = decision.reasonCode;
          continue;
        }
        throw new HttpException(
          `${decision.reasonCode}: 目标节点守卫拒绝`,
          HttpStatus.CONFLICT,
        );
      }

      const specializedDecision = decideNodeSpecializedGuard({
        targetNodeCode,
        eventCode: input.eventCode,
        containerNumber: container.containerNumber,
        location: stateEvidence.location,
        routeSegment,
        cargoReadyComplianceApproved:
          targetNodeCode !== "cargo_ready" ||
          (
            await this.evaluateCargoReadyCompliance.execute({
              tenantId: input.tenantId,
              containerRecordId: input.containerId,
            })
          ).approved,
        stuffingReadiness:
          targetNodeCode === "container_stuffing" &&
          input.eventCode === "stuffed"
            ? await this.getContainerStuffingReadiness.execute({
                tenantId: input.tenantId,
                containerRecordId: input.containerId,
                evidenceRefs,
              })
            : null,
        dispatchReadiness:
          targetNodeCode === "shipment_dispatch" && input.eventCode === "loaded"
            ? await this.getContainerDispatchReadiness.execute({
                tenantId: input.tenantId,
                containerRecordId: input.containerId,
                evidenceRefs,
              })
            : null,
        customsReadiness:
          targetNodeCode === "customs_clearance" &&
          input.eventCode === "container_customs_completed"
            ? await this.getCustomsClearanceReadiness.execute({
                tenantId: input.tenantId,
                containerRecordId: input.containerId,
                evidenceRefs,
              })
            : null,
        pickupAvailability,
        deliveryInstruction: deliveryReadiness?.instruction
          ? {
              instructionId: deliveryReadiness.instruction.instructionId,
              warehouseLocationId:
                deliveryReadiness.instruction.warehouseLocationId,
              unlocode: deliveryReadiness.instruction.unlocode,
              timezone: deliveryReadiness.instruction.timezone,
            }
          : null,
        evidenceAuthorityContexts: deliveryEvidenceContexts,
        occurredAt: input.occurredAt,
      });
      const guardResults = [
        ...decision.guardResults,
        ...specializedDecision.guardResults,
      ];
      if (specializedDecision.kind !== "apply") {
        await this.repository.recordNodeEventApplication({
          eventId: canonicalEventId,
          targetNodeInstanceId: target.id,
          state: specializedDecision.kind,
          evaluatedAt: new Date(),
          guardResults,
          reasonCode: specializedDecision.reasonCode,
        });
        if (specializedDecision.kind === "pending_application") {
          pendingNodes.push(targetNodeCode);
          pendingReasonCodes[targetNodeCode] = specializedDecision.reasonCode;
          continue;
        }
        throw new HttpException(
          `${specializedDecision.reasonCode}: 目标节点专项守卫拒绝`,
          HttpStatus.CONFLICT,
        );
      }

      const nextNodeCode = nextApplicableNode(targetNodeCode, (nodeCode) => {
        const node = flow.nodes.find((item) => item.nodeCode === nodeCode);
        return node?.applicability ?? defaultApplicability(nodeCode);
      });
      try {
        const transition = await this.repository.applyEventToNode({
          flowInstanceId: flow.flow.id,
          expectedFlowVersion: flow.flow.version,
          eventId: canonicalEventId,
          targetNodeInstanceId: target.id,
          targetNodeCode,
          nextNodeCode,
          occurredAt: input.occurredAt,
          evaluatedAt: new Date(),
          guardResults,
          routeSegmentGuard: routeSegment,
        });
        if (transition.applied) completedNodes.push(targetNodeCode);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (
          code === "LIFECYCLE_VERSION_CONFLICT" ||
          code === "LIFECYCLE_HISTORY_SEALED" ||
          code === "LIFECYCLE_GUARD_NOT_SATISFIED" ||
          code === "LIFECYCLE_NODE_BLOCKED" ||
          code === "LIFECYCLE_EVENT_ROUTE_MISMATCH"
        ) {
          throw new HttpException(code, HttpStatus.CONFLICT);
        }
        throw error;
      }
      flow =
        (await this.repository.findFlowByContainer(input.containerId)) ?? flow;
    }

    // currentStatus 推进：只有转换表里的事件才推进 8 态；R2 状态单调（不回退）
    const targetStatus = EVENT_TO_CONTAINER_STATUS[input.eventCode] ?? null;
    let resultingStatus: ContainerLifecycleState | null = null;
    if (
      targetStatus &&
      ((eligibleNodes.length === 0 && !existing) || completedNodes.length > 0)
    ) {
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

    const activated = await this.activateFollowingTask(
      input.containerId,
      input.tenantId,
      completedNodes,
    );

    return {
      containerId: input.containerId,
      eventCode: input.eventCode,
      completedNodes,
      pendingNodes,
      pendingReasonCodes,
      resultingStatus,
      applied:
        completedNodes.length > 0 || (eligibleNodes.length === 0 && !existing),
      canonicalEventId,
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

function sameEvent(
  existing: {
    containerId: string;
    eventCode: CanonicalEventCode;
    domainFactId: string | null;
    occurredAt: Date;
    evidenceRefs: string[];
    location: Awaited<
      ReturnType<AssertLifecycleStateEvidencePort["execute"]>
    >["location"];
  },
  input: ApplyLifecycleEventInput,
  evidenceRefs: string[],
  location: Awaited<
    ReturnType<AssertLifecycleStateEvidencePort["execute"]>
  >["location"],
): boolean {
  return (
    existing.containerId === input.containerId &&
    existing.eventCode === input.eventCode &&
    existing.domainFactId === input.domainFactId &&
    existing.occurredAt.getTime() === input.occurredAt.getTime() &&
    sameLocation(existing.location, location) &&
    [...existing.evidenceRefs].sort().join("\u0000") ===
      [...evidenceRefs].sort().join("\u0000")
  );
}

function sameLocation(
  left: Awaited<
    ReturnType<AssertLifecycleStateEvidencePort["execute"]>
  >["location"],
  right: Awaited<
    ReturnType<AssertLifecycleStateEvidencePort["execute"]>
  >["location"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function farthestNode(nodes: LifecycleNodeCode[]): LifecycleNodeCode | null {
  return (
    nodes
      .filter((node) => NODE_SEQUENCE[node] !== undefined)
      .sort((a, b) => NODE_SEQUENCE[b] - NODE_SEQUENCE[a])[0] ?? null
  );
}
