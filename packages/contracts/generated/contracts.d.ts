/* eslint-disable */
/* prettier-ignore */
// 由 scripts/generate-contracts.mjs 生成，禁止手工修改。
// 权威源：packages/contracts/schemas/v1/*.schema.json
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "Uuid".
 */
export type Uuid = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TenantId".
 */
export type TenantId = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DateTime".
 */
export type DateTime = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "StableCode".
 */
export type StableCode = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CapabilityCode".
 */
export type CapabilityCode = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BoundedContextCode".
 */
export type BoundedContextCode = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleNodeCode".
 */
export type LifecycleNodeCode = ("cargo_ready" | "container_stuffing" | "shipment_dispatch" | "origin_departure" | "ocean_transit" | "transshipment" | "customs_clearance" | "destination_arrival" | "rail_transfer" | "container_pickup" | "warehouse_delivery" | "container_unloading" | "container_unstuffing" | "empty_return")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CanonicalEventCode".
 */
export type CanonicalEventCode = ("cargo_ready" | "empty_picked_up" | "stuffed" | "loaded" | "departed" | "sailing" | "gate_in" | "transit_arrived" | "transit_departed" | "arrived" | "berthed" | "discharged" | "available" | "release" | "hold" | "hold_released" | "customs_filed" | "inspection" | "container_customs_completed" | "rail_handover" | "gate_out" | "delivered" | "warehouse_arrival" | "unloaded" | "unstuffed" | "returned_empty" | "dumped" | "rolled" | "cancelled" | "changed" | "delay" | "overdue")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TimeKind".
 */
export type TimeKind = ("planned" | "estimated" | "actual")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EventRole".
 */
export type EventRole = ("milestone" | "evidence" | "exception" | "prerequisite")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeApplicability".
 */
export type NodeApplicability = ("required" | "optional_applicable" | "optional_not_applicable")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CompletionMode".
 */
export type CompletionMode = ("fact_driven" | "needs_manual_fact")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "FlowInstanceState".
 */
export type FlowInstanceState = ("draft" | "active" | "completed" | "cancelled")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleNodeState".
 */
export type LifecycleNodeState = ("pending" | "active" | "blocked" | "completed" | "skipped" | "cancelled")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerLifecycleState".
 */
export type ContainerLifecycleState = ("not_shipped" | "shipped" | "in_transit" | "at_port" | "picked_up" | "unloaded" | "returned_empty" | "cancelled")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskState".
 */
export type NodeTaskState = ("pending" | "in_progress" | "blocked" | "completed" | "reopened" | "cancelled")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TaskReadinessState".
 */
export type TaskReadinessState = ("waiting_conditions" | "ready")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TaskCompletionEligibility".
 */
export type TaskCompletionEligibility = ("awaiting_evidence" | "eligible")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderState".
 */
export type WorkOrderState = ("draft" | "ready" | "in_progress" | "blocked" | "completed" | "failed" | "reopened" | "cancelled")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderApplicability".
 */
export type WorkOrderApplicability = ("required" | "optional" | "conditional_required" | "not_applicable")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderRequirement".
 */
export type WorkOrderRequirement = ("required" | "optional" | "conditional")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ExecutionMode".
 */
export type ExecutionMode = ("human" | "system" | "external" | "hybrid")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssignmentPolicy".
 */
export type AssignmentPolicy = ("named" | "team" | "pool" | "automatic")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssignmentState".
 */
export type AssignmentState = ("unassigned" | "assigned" | "pool" | "automatic")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "FactApplicationDecision".
 */
export type FactApplicationDecision = ("applied" | "rejected" | "no_op")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CaptureSource".
 */
export type CaptureSource = ("external_evidence" | "manual_backfill" | "controlled_import" | "internal_operation" | "system_derived")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AuthorityLevel".
 */
export type AuthorityLevel = ("authoritative" | "corroborating" | "operational" | "contextual")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "VerificationState".
 */
export type VerificationState = ("pending" | "verified" | "rejected" | "revoked")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ConfidenceState".
 */
export type ConfidenceState = ("confirmed" | "provisional" | "disputed" | "unknown")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EvidenceValidity".
 */
export type EvidenceValidity = ("effective" | "superseded" | "corrected" | "revoked")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EvidenceRelationType".
 */
export type EvidenceRelationType = ("supports" | "contradicts" | "corrects" | "revokes" | "supersedes")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EventRelationType".
 */
export type EventRelationType = ("corrects" | "revokes" | "supersedes_estimate")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ReceptionState".
 */
export type ReceptionState = ("pending" | "received" | "duplicate" | "boundary_rejected")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BusinessDecisionState".
 */
export type BusinessDecisionState = ("pending" | "accepted" | "rejected")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CommitState".
 */
export type CommitState = ("pending" | "committed" | "commit_failed")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InboxState".
 */
export type InboxState = ("received" | "processing" | "processed" | "retry_wait" | "dead_letter")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OutboxState".
 */
export type OutboxState = ("pending" | "publishing" | "published" | "retry_wait" | "dead_letter")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CompensationState".
 */
export type CompensationState = ("not_required" | "pending" | "in_progress" | "compensated" | "failed" | "manual_review")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ActorType".
 */
export type ActorType = ("user" | "service" | "integration" | "scheduled_job")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "RiskLevel".
 */
export type RiskLevel = ("low" | "medium" | "high" | "critical")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ConfirmationPolicy".
 */
export type ConfirmationPolicy = ("none" | "explicit" | "reason_required")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ReviewPolicy".
 */
export type ReviewPolicy = ("none" | "four_eyes" | "designated_reviewer")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DenialCategory".
 */
export type DenialCategory = ("authentication" | "scope" | "capability" | "state" | "precondition" | "evidence" | "lock" | "review" | "concurrency")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EntityType".
 */
export type EntityType = ("container" | "shipment" | "shipment_cargo_line" | "shipment_transport_document" | "flow_instance" | "node_instance" | "node_task" | "work_order" | "domain_fact" | "evidence" | "canonical_event" | "client_operation" | "receipt" | "exception" | "audit_entry")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ErrorCategory".
 */
export type ErrorCategory = ("validation" | "authentication" | "authorization" | "not_found" | "conflict" | "precondition" | "rate_limit" | "dependency" | "internal")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DecimalString".
 */
export type DecimalString = string
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DepartureProofV1".
 */
export type DepartureProofV1 = ({
kind: "actual_departure_time"
occurredAt: DateTime
sourceTimezone: string
evidenceRef: Uuid
} | {
kind: "authoritative_departed_status"
sourceStatus: string
authorityPolicyRef: string
evidenceRef: Uuid
} | {
kind: "authorized_manual_confirmation"
confirmedBy: Uuid
reasonCode: StableCode
evidenceRef: Uuid
})
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CargoAllocationV1".
 */
export type CargoAllocationV1 = (PackagePairRule & WeightPairRule & VolumePairRule & {
sourceLineId: string
productSkuId?: Uuid
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
packageCount?: DecimalString
packageUnit?: string
grossWeight?: DecimalString
weightUnit?: "kg"
volume?: DecimalString
volumeUnit?: "m3"
replenishmentOrderLineId?: Uuid
})
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceKindV1".
 */
export type PostDepartureSourceKindV1 = ("container" | "customs" | "logistics" | "warehouse")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureShipmentGroupingV1".
 */
export type PostDepartureShipmentGroupingV1 = ({
kind: "authorized_new_shipment"
shipmentNumber: string
} | {
kind: "existing_shipment"
shipmentId: Uuid
expectedRelationshipVersion: number
} | {
kind: "new_independent_shipment"
})
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OceanRouteSegmentInput".
 */
export type OceanRouteSegmentInput = {
transportMode: ("vessel" | "feeder" | "barge")
originUnlocode: string
originTimezone: string
destinationLocationType: ("port" | "terminal")
destinationUnlocode: string
destinationLocationId?: Uuid
destinationPortCallId?: string
destinationTimezone: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactCommand".
 */
export type LifecycleDateFactCommand = {
tenantId: Uuid
containerId: Uuid
nodeCode: LifecycleNodeCode
eventCode: CanonicalEventCode
timeKind: TimeKind
occurredAt: DateTime
rawValue: string
sourceUtcOffset: string
ingestionChannel: ("api" | "webhook" | "file_import" | "manual_ui")
captureSource: CaptureSource
sourceSystem: string
authoritySystem: string
provider?: string
interfaceCode?: string
sourceEventId?: string
mappingVersion?: string
verificationState: VerificationState
confidenceState: ConfidenceState
validity: EvidenceValidity
/**
 * 上游可携带声明引用用于审计，但不得授予权威；运行时只保存服务端唯一策略裁决返回的 policyId:version。
 */
authorityPolicyRef?: string
location?: CanonicalEventEnvelopeLocation
evidenceRefs: Uuid[]
actorId?: Uuid
reasonCode?: string
expectedVersion?: number
supersedesFactId?: Uuid
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskResultPolicy".
 */
export type NodeTaskResultPolicy = {
mode: ("none" | "emit_canonical_event" | "reference_existing_event")
eventCode?: CanonicalEventCode
eventVersion?: 1
requiredDomainFactTypes: string[]
eventBusinessKeyAlgorithm?: string
}
export type SourceAuthorityPolicy = {
[k: string]: unknown
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OwnedEntityRef".
 */
export type OwnedEntityRef = EntityRef
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentLifecycleStatusV1".
 */
export type ShipmentLifecycleStatusV1 = ("departed" | "in_transit" | "arrived" | "customs_clearance" | "released" | "picked_up" | "delivered_to_warehouse" | "closed")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CustomsFilingState".
 */
export type CustomsFilingState = ("not_filed" | "filed" | "accepted")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CustomsDecisionState".
 */
export type CustomsDecisionState = ("pending" | "held" | "released")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerUnloadingOperationState".
 */
export type ContainerUnloadingOperationState = ("started" | "partial" | "completed")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerUnloadingSealCheck".
 */
export type ContainerUnloadingSealCheck = ("matched" | "mismatch")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentLifecycleInitializationStateV1".
 */
export type ShipmentLifecycleInitializationStateV1 = ("pending" | "ready" | "manual_review")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PublicErrorCode".
 */
export type PublicErrorCode = ("VALIDATION_REQUIRED" | "VALIDATION_FORMAT" | "VALIDATION_RANGE" | "VALIDATION_FIELD_CONFLICT" | "AUTHENTICATION_REQUIRED" | "AUTHENTICATION_EXPIRED" | "AUTHORIZATION_FORBIDDEN" | "AUTHORIZATION_SCOPE_DENIED" | "RESOURCE_NOT_FOUND" | "RATE_LIMIT_EXCEEDED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR" | "IDEMPOTENCY_KEY_CONFLICT" | "VERSION_CONFLICT" | "HISTORY_SEALED" | "MANUAL_LOCK_CONFLICT" | "REVIEW_REQUIRED" | "CURSOR_INVALID" | "CURSOR_EXPIRED" | "PROJECTION_VERSION_CONFLICT" | "PROJECTION_UNAVAILABLE" | "ACTION_UNKNOWN" | "ACTION_TARGET_MISMATCH" | "ACTION_CONFIRMATION_REQUIRED" | "ACTION_REVIEW_REQUIRED" | "BUSINESS_STATE_VIOLATION" | "BUSINESS_PRECONDITION_FAILED" | "EVIDENCE_REQUIRED" | "SOURCE_NOT_AUTHORIZED" | "UNKNOWN_EXTERNAL_MAPPING" | "LIFECYCLE_FLOW_NOT_FOUND" | "LIFECYCLE_FLOW_ALREADY_ACTIVE" | "LIFECYCLE_DEFINITION_VERSION_UNSUPPORTED" | "LIFECYCLE_NODE_NOT_CURRENT" | "LIFECYCLE_NODE_NOT_OPTIONAL" | "LIFECYCLE_NODE_APPLICABILITY_CONFLICT" | "LIFECYCLE_EVENT_TYPE_UNKNOWN" | "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE" | "LIFECYCLE_EVENT_PENDING_PREDECESSOR" | "LIFECYCLE_EVENT_PENDING_COMPLIANCE" | "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY" | "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT" | "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT_STALE" | "LIFECYCLE_EVENT_PENDING_STUFFING_EVIDENCE" | "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT" | "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT_STALE" | "LIFECYCLE_EVENT_PENDING_DISPATCH_EVIDENCE" | "LIFECYCLE_EVENT_PENDING_LOCATION_CONTEXT" | "LIFECYCLE_EVENT_PENDING_ROUTE_CONTEXT" | "LIFECYCLE_EVENT_ROUTE_MISMATCH" | "LIFECYCLE_EVENT_PENDING_TERMINAL_AVAILABILITY" | "LIFECYCLE_EVENT_PENDING_PICKUP_LOCATION_CONTEXT" | "LIFECYCLE_EVENT_PICKUP_LOCATION_MISMATCH" | "LIFECYCLE_EVENT_PICKUP_BEFORE_AVAILABLE" | "LIFECYCLE_SOURCE_NOT_AUTHORIZED" | "LIFECYCLE_EVIDENCE_REQUIRED" | "LIFECYCLE_GUARD_NOT_SATISFIED" | "LIFECYCLE_ACTIVE_BLOCK_EXISTS" | "LIFECYCLE_TIME_ORDER_CONFLICT" | "LIFECYCLE_HISTORY_SEALED" | "LIFECYCLE_IDEMPOTENCY_CONFLICT" | "LIFECYCLE_VERSION_CONFLICT" | "LIFECYCLE_REENTRY_NOT_ALLOWED" | "LIFECYCLE_MANUAL_REVIEW_REQUIRED" | "TIMELINE_EVENT_INVALID" | "TIMELINE_TIMEZONE_UNKNOWN" | "TIMELINE_EVENT_DUPLICATE_CONFLICT" | "TIMELINE_EVENT_RELATION_INVALID" | "TIMELINE_PROJECTION_VERSION_CONFLICT" | "TIMELINE_MANUAL_REVIEW_REQUIRED" | "CUSTOMS_CASE_NOT_FOUND" | "CUSTOMS_WORK_ORDER_NOT_FOUND" | "CUSTOMS_EXTERNAL_PAYLOAD_INVALID" | "CUSTOMS_REQUIRED_CASE_MISSING" | "CUSTOMS_RELEASE_EVIDENCE_MISSING" | "CUSTOMS_EVIDENCE_SCOPE_MISMATCH" | "CUSTOMS_WORK_ORDER_EVIDENCE_MISMATCH" | "CUSTOMS_EXTERNAL_MAPPING_UNKNOWN" | "CUSTOMS_INVALID_TRANSITION" | "CUSTOMS_ACTIVE_BLOCK_EXISTS" | "CUSTOMS_IDEMPOTENCY_CONFLICT" | "CUSTOMS_VERSION_CONFLICT" | "CUSTOMS_MANUAL_REVIEW_REQUIRED" | "DEPENDENCY_UNAVAILABLE" | "DEPENDENCY_TIMEOUT" | "DEPENDENCY_RESPONSE_INVALID" | "SYNC_MESSAGE_CONFLICT" | "SYNC_DEAD_LETTERED" | "SYNC_COMMIT_FAILED")

export interface LogixContractsV1 {
[k: string]: unknown
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EntityRef".
 */
export interface EntityRef {
tenantId: Uuid
entityType: EntityType
entityId: Uuid
ownerModule: BoundedContextCode
}
export interface CargoReadinessFact {
cargoReadinessFactId: Uuid
tenantId: Uuid
preparationOrderId: Uuid
occurredAt: DateTime
captureSource: CaptureSource
sourceReference: string
actorId?: Uuid
evidenceRefs: Uuid[]
idempotencyKey: string
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "RailHandoverData".
 */
export interface RailHandoverData {
railSegmentId: Uuid
receivingRailPartyId: Uuid
receivingRailYardId?: Uuid
handoverReference: string
receiptType: "physical_container_acceptance"
}
export interface FlowInstance {
flowInstanceId: Uuid
tenantId: Uuid
containerId: Uuid
definitionVersion: 1
state: FlowInstanceState
currentNodeCode?: LifecycleNodeCode
currentNodeInstanceId?: Uuid
version: number
startedAt?: DateTime
completedAt?: DateTime
cancelledAt?: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleNodeInstance".
 */
export interface LifecycleNodeInstance {
nodeInstanceId: Uuid
flowInstanceId: Uuid
nodeCode: LifecycleNodeCode
activationNo: number
state: LifecycleNodeState
applicability: NodeApplicability
activatedAt?: DateTime
completedAt?: DateTime
completionEventId?: Uuid
blockedReasonRefs: Uuid[]
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "StartLifecycleCommand".
 */
export interface StartLifecycleCommand {
tenantId: Uuid
containerId: Uuid
definitionVersion: 1
initialFacts: Uuid[]
cargoReadinessFactId?: Uuid
preparationOrderId: Uuid
idempotencyKey: string
expectedContainerVersion: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ApplyLifecycleEventCommand".
 */
export interface ApplyLifecycleEventCommand {
tenantId: Uuid
flowInstanceId: Uuid
eventId: Uuid
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "SetNodeApplicabilityCommand".
 */
export interface SetNodeApplicabilityCommand {
tenantId: Uuid
flowInstanceId: Uuid
nodeCode: LifecycleNodeCode
applicability: ("optional_applicable" | "optional_not_applicable")
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
reasonCode: string
actorId: Uuid
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeBlock".
 */
export interface NodeBlock {
blockId: Uuid
blockType: StableCode
sourceFactId: Uuid
occurredAt: DateTime
nodeInstanceId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BlockNodeCommand".
 */
export interface BlockNodeCommand {
tenantId: Uuid
flowInstanceId: Uuid
block: NodeBlock
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ResolveNodeBlockCommand".
 */
export interface ResolveNodeBlockCommand {
tenantId: Uuid
flowInstanceId: Uuid
blockId: Uuid
resolvedAt: DateTime
reasonCode: string
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CancelLifecycleCommand".
 */
export interface CancelLifecycleCommand {
tenantId: Uuid
flowInstanceId: Uuid
actorId: Uuid
reasonCode: string
reason: string
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleNodeBlocked".
 */
export interface LifecycleNodeBlocked {
eventId: Uuid
eventType: "lifecycle.node_blocked"
eventVersion: 1
tenantId: Uuid
flowInstanceId: Uuid
containerId: Uuid
nodeInstanceId: Uuid
blockId: Uuid
blockType: StableCode
sourceFactId: Uuid
occurredAt: DateTime
projectionVersion: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleNodeBlockResolved".
 */
export interface LifecycleNodeBlockResolved {
eventId: Uuid
eventType: "lifecycle.node_block_resolved"
eventVersion: 1
tenantId: Uuid
flowInstanceId: Uuid
containerId: Uuid
nodeInstanceId: Uuid
blockId: Uuid
resolvedAt: DateTime
reasonCode: string
projectionVersion: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleTransitioned".
 */
export interface LifecycleTransitioned {
flowInstanceId: Uuid
containerId: Uuid
definitionVersion: 1
fromNodeCode: LifecycleNodeCode
fromNodeInstanceId: Uuid
fromNodeState: LifecycleNodeState
toNodeCode?: LifecycleNodeCode
toNodeInstanceId?: Uuid
toNodeState?: LifecycleNodeState
previousContainerState: ContainerLifecycleState
resultingContainerState: ContainerLifecycleState
triggerEventId: Uuid
triggerDomainFactId: Uuid
transitionedAt: DateTime
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleReconciliationCase".
 */
export interface LifecycleReconciliationCase {
reconciliationCaseId: Uuid
tenantId: Uuid
flowInstanceId: Uuid
triggerEventId: Uuid
/**
 * @minItems 1
 */
affectedNodeInstanceIds: [Uuid, ...(Uuid)[]]
suggestedProjection: {
[k: string]: unknown
}
downstreamImpactRefs: EntityRef[]
state: ("pending_review" | "approved" | "rejected" | "applied")
createdAt: DateTime
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleStateView".
 */
export interface LifecycleStateView {
flowInstanceId: Uuid
containerId: Uuid
definitionVersion: 1
flowState: FlowInstanceState
currentNodeCode?: LifecycleNodeCode
currentNodeInstanceId?: Uuid
containerState: ContainerLifecycleState
nodes: LifecycleNodeInstance[]
pendingEventCount: number
disputedEventCount: number
allowedActions: AllowedAction[]
projectionVersion: number
asOf: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AllowedAction".
 */
export interface AllowedAction {
actionCode: StableCode
actionVersion: number
target: EntityRef
executable: boolean
denialCategory?: DenialCategory
confirmationPolicy: ConfirmationPolicy
reviewPolicy: ReviewPolicy
requiredEvidenceTypes: StableCode[]
expectedVersion: number
expiresAt?: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EmptyEventData".
 */
export interface EmptyEventData {

}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSubject".
 */
export interface PostDepartureSubject {
tenantId: Uuid
entityType: ("shipment" | "container")
entityId: string
ownerModule: "shipment-registry"
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "SourceReferenceV1".
 */
export interface SourceReferenceV1 {
channel: ("file_import" | "api" | "webhook" | "manual")
system: string
externalHandoffId: string
handoffVersion: number
supersedesExternalHandoffId?: string
occurredAt: DateTime
idempotencyKey: string
sourceBatchId?: Uuid
mappingVersion?: string
correlationId: Uuid
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentDescriptorV1".
 */
export interface ShipmentDescriptorV1 {
externalShipmentId?: string
shipmentNumber?: string
expectedRelationshipVersion?: number
transportMode: "ocean"
carrierCode: string
vesselName: string
voyageNumber: string
bookingNumber?: string
originPortCode: string
destinationPortCode: string
destinationCountryCode: string
salesCountryCode?: string
cargoOwnerReferenceId?: Uuid
cargoOwnerName?: string
destinationWarehouseId?: Uuid
tradeTerm?: string
estimatedArrivalAt?: DateTime
actualLoadedAt?: DateTime
departureProof: DepartureProofV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BillOfLadingV1".
 */
export interface BillOfLadingV1 {
referenceId: string
documentType: ("booking" | "mbl" | "hbl" | "ams")
documentNumber: string
scac?: string
parentReferenceId?: string
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PackagePairRule".
 */
export interface PackagePairRule {
[k: string]: unknown
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WeightPairRule".
 */
export interface WeightPairRule {
[k: string]: unknown
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "VolumePairRule".
 */
export interface VolumePairRule {
[k: string]: unknown
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "UpstreamReferenceV1".
 */
export interface UpstreamReferenceV1 {
referenceType: ("shipping_plan" | "stocking_order" | "packing_order" | "purchase_order")
sourceSystem: string
sourceRecordId: string
sourceVersion?: string
sourceLineId?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerHandoffV1".
 */
export interface ContainerHandoffV1 {
referenceId: string
externalContainerId?: string
containerNumber: string
containerTypeCode: string
sealNumber?: string
stuffingSnapshotRef?: Uuid
/**
 * @minItems 1
 */
billReferences: [string, ...(string)[]]
upstreamReferences: UpstreamReferenceV1[]
/**
 * @minItems 1
 */
cargoAllocations?: [CargoAllocationV1, ...(CargoAllocationV1)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffCommandV1".
 */
export interface ShipmentHandoffCommandV1 {
contractVersion: "shipment-handoff.v1"
tenantId: TenantId
sourceProfile: ("legacy_departed_file_v1" | "packing_platform_v1" | "internal_fulfillment_v1" | "api_v1")
source: SourceReferenceV1
shipment: ShipmentDescriptorV1
/**
 * @minItems 1
 */
billsOfLading: [BillOfLadingV1, ...(BillOfLadingV1)[]]
/**
 * @minItems 1
 */
containers: [ContainerHandoffV1, ...(ContainerHandoffV1)[]]
documentReferences?: Uuid[]
/**
 * @minItems 1
 */
evidenceReferences: [Uuid, ...(Uuid)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentDescriptorV2".
 */
export interface ShipmentDescriptorV2 {
targetShipmentId?: Uuid
externalShipmentId?: string
shipmentNumber?: string
expectedRelationshipVersion?: number
transportMode: "ocean"
carrierCode?: string
vesselName?: string
voyageNumber?: string
bookingNumber?: string
originPortCode?: string
destinationPortCode?: string
destinationCountryCode?: string
salesCountryCode?: string
cargoOwnerReferenceId?: Uuid
cargoOwnerName?: string
destinationWarehouseId?: Uuid
tradeTerm?: string
estimatedArrivalAt?: DateTime
actualLoadedAt?: DateTime
departureProof?: DepartureProofV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerHandoffV2".
 */
export interface ContainerHandoffV2 {
referenceId: string
externalContainerId?: string
containerNumber?: string
containerTypeCode?: string
sealNumber?: string
stuffingSnapshotRef?: Uuid
billReferences: string[]
upstreamReferences: UpstreamReferenceV1[]
/**
 * @minItems 1
 */
cargoAllocations?: [CargoAllocationV1, ...(CargoAllocationV1)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffCommandV2".
 */
export interface ShipmentHandoffCommandV2 {
contractVersion: "shipment-handoff.v2"
tenantId: TenantId
sourceProfile: ("legacy_departed_file_v1" | "packing_platform_v1" | "internal_fulfillment_v1" | "api_v1")
source: SourceReferenceV1
shipment: ShipmentDescriptorV2
billsOfLading: BillOfLadingV1[]
/**
 * @minItems 1
 */
containers: [ContainerHandoffV2, ...(ContainerHandoffV2)[]]
documentReferences?: Uuid[]
evidenceReferences: Uuid[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffIssueV1".
 */
export interface ShipmentHandoffIssueV1 {
code: ("SOURCE_RANGE_METADATA_INVALID" | "SOURCE_DATA_INCOMPLETE" | "FIELD_SEMANTIC_MISMATCH" | "INVALID_SOURCE_VALUE" | "DEPARTURE_PROOF_REQUIRED" | "EXTERNAL_SHIPMENT_MATCH_REQUIRED" | "UNKNOWN_REFERENCE_CODE" | "CARGO_DETAIL_INCOMPLETE" | "CONTAINER_ACTIVE_SHIPMENT_CONFLICT" | "CONTAINER_SOURCE_IDENTITY_CONFLICT" | "IDEMPOTENCY_PAYLOAD_CONFLICT" | "SHIPMENT_SOURCE_IDENTITY_CONFLICT" | "SHIPMENT_NUMBER_CONFLICT" | "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT" | "SUPERSEDED_HANDOFF_NOT_FOUND" | "SOURCE_BATCH_REQUIRED" | "MAPPING_VERSION_REQUIRED" | "STUFFING_SNAPSHOT_REQUIRED" | "STUFFING_SNAPSHOT_VERSION_STALE" | "CARGO_ALLOCATION_REQUIRED" | "BILL_REFERENCE_NOT_FOUND" | "DUPLICATE_REFERENCE")
subjectRef?: string
sourceRows?: string[]
fieldCodes?: StableCode[]
messageKey: StableCode
blocking?: boolean
resolutionState?: ("system_handled" | "operator_action_required" | "upstream_action_required")
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffResultV1".
 */
export interface ShipmentHandoffResultV1 {
receptionState: ReceptionState
businessDecisionState: BusinessDecisionState
commitState: CommitState
handoffId: Uuid
handoffVersion: number
duplicate: boolean
shipmentId?: Uuid
containerResults: ShipmentHandoffObjectResultV1[]
cargoResults: ShipmentHandoffObjectResultV1[]
documentResults: ShipmentHandoffObjectResultV1[]
lifecycleInitializationState: ("pending" | "ready" | "review_required" | "rejected")
customsAssimilationState: ("not_applicable" | "pending" | "ready" | "review_required" | "rejected")
inlandAssimilationState: ("not_applicable" | "pending" | "ready" | "review_required" | "rejected")
warehouseAssimilationState: ("not_applicable" | "pending" | "ready" | "review_required" | "rejected")
issues: ShipmentHandoffIssueV1[]
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffObjectResultV1".
 */
export interface ShipmentHandoffObjectResultV1 {
objectType: ("container" | "cargo_line" | "transport_document")
sourceReferenceId: string
state: ("accepted" | "duplicate" | "review_required" | "rejected")
entityId?: Uuid
issueCodes: ("SOURCE_RANGE_METADATA_INVALID" | "SOURCE_DATA_INCOMPLETE" | "FIELD_SEMANTIC_MISMATCH" | "INVALID_SOURCE_VALUE" | "DEPARTURE_PROOF_REQUIRED" | "EXTERNAL_SHIPMENT_MATCH_REQUIRED" | "UNKNOWN_REFERENCE_CODE" | "CARGO_DETAIL_INCOMPLETE" | "CONTAINER_ACTIVE_SHIPMENT_CONFLICT" | "CONTAINER_SOURCE_IDENTITY_CONFLICT" | "IDEMPOTENCY_PAYLOAD_CONFLICT" | "SHIPMENT_SOURCE_IDENTITY_CONFLICT" | "SHIPMENT_NUMBER_CONFLICT" | "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT" | "SUPERSEDED_HANDOFF_NOT_FOUND" | "SOURCE_BATCH_REQUIRED" | "MAPPING_VERSION_REQUIRED" | "STUFFING_SNAPSHOT_REQUIRED" | "STUFFING_SNAPSHOT_VERSION_STALE" | "CARGO_ALLOCATION_REQUIRED" | "BILL_REFERENCE_NOT_FOUND" | "DUPLICATE_REFERENCE")[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffPreflightResultV1".
 */
export interface ShipmentHandoffPreflightResultV1 {
decision: ("ready" | "review_required" | "rejected")
duplicate?: boolean
payloadHash: string
issues: ShipmentHandoffIssueV1[]
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceBatchV1".
 */
export interface PostDepartureSourceBatchV1 {
kind: PostDepartureSourceKindV1
batchId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackagePreflightCommandV1".
 */
export interface PostDepartureSourcePackagePreflightCommandV1 {
contractVersion: "post-departure-source-package-preflight.v1"
/**
 * @minItems 1
 * @maxItems 4
 */
sources: [PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceFileSummaryV1".
 */
export interface PostDepartureSourceFileSummaryV1 {
kind: PostDepartureSourceKindV1
batchId: Uuid
fileName: string
rowCount: number
columnCount: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureReferencePortV1".
 */
export interface PostDepartureReferencePortV1 {
portId: Uuid
unlocode: string
officialName: string
areaCode: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureReferencePortSearchResultV1".
 */
export interface PostDepartureReferencePortSearchResultV1 {
items: PostDepartureReferencePortV1[]
pageSize: number
nextCursor: (string | null)
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureActualDepartureProofV1".
 */
export interface PostDepartureActualDepartureProofV1 {
kind: "actual_departure_time"
occurredAt: DateTime
sourceTimezone: string
evidenceRef: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateCorrectionV1".
 */
export interface PostDepartureSourceCandidateCorrectionV1 {
correctionId: Uuid
version: number
shipmentGrouping?: PostDepartureShipmentGroupingV1
originPort?: PostDepartureReferencePortV1
destinationPort?: PostDepartureReferencePortV1
departureProof?: PostDepartureActualDepartureProofV1
departureLocal?: string
departureSourceTimezone?: string
departureEvidenceRef?: Uuid
/**
 * @minItems 1
 */
cargoAllocations?: [PostDepartureCandidateCargoAllocationV1, ...(PostDepartureCandidateCargoAllocationV1)[]]
reasonCode: StableCode
correctedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureCandidateCargoAllocationV1".
 */
export interface PostDepartureCandidateCargoAllocationV1 {
sourceLineId: string
replenishmentOrderNumber: string
productSkuId: Uuid
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
replenishmentOrderLineId?: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateV1".
 */
export interface PostDepartureSourceCandidateV1 {
candidateRef: string
decision: ("ready" | "review_required" | "rejected")
containerNumber: string
replenishmentOrderNumbers: string[]
billNumbers: string[]
carrierCode?: string
vesselName?: string
voyageNumber?: string
originPortRaw?: string
destinationPortRaw?: string
cargoOwnerName?: string
departureRaw?: string
estimatedArrivalRaw?: string
containerTypeCode?: string
packageCount?: DecimalString
grossWeightKg?: DecimalString
volumeM3?: DecimalString
correction?: PostDepartureSourceCandidateCorrectionV1
issues: ShipmentHandoffIssueV1[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageTotalsV1".
 */
export interface PostDepartureSourcePackageTotalsV1 {
containers: number
bills: number
replenishmentOrders: number
ready: number
reviewRequired: number
rejected: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackagePreflightResultV1".
 */
export interface PostDepartureSourcePackagePreflightResultV1 {
packageId: string
/**
 * @minItems 1
 * @maxItems 4
 */
sources: [PostDepartureSourceFileSummaryV1]|[PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1]|[PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1]|[PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1, PostDepartureSourceFileSummaryV1]
candidates: PostDepartureSourceCandidateV1[]
totals: PostDepartureSourcePackageTotalsV1
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageReviewCommandV1".
 */
export interface PostDepartureSourcePackageReviewCommandV1 {
contractVersion: "post-departure-source-package-review.v1"
packageId: string
/**
 * @minItems 1
 * @maxItems 4
 */
sources: [PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageReviewResultV1".
 */
export interface PostDepartureSourcePackageReviewResultV1 {
contractVersion: "post-departure-source-package-review-result.v1"
reviewId: Uuid
packageId: string
decision: "review_required"
status: ("saved" | "duplicate")
candidateCount: number
savedAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateCorrectionCommandV1".
 */
export interface PostDepartureSourceCandidateCorrectionCommandV1 {
contractVersion: "post-departure-source-candidate-correction.v1"
packageId: string
reviewId: Uuid
candidateRef: string
expectedVersion: number
shipmentGrouping?: (PostDepartureShipmentGroupingV1 | null)
originPortCode?: (string | null)
destinationPortCode?: (string | null)
departureProof?: PostDepartureActualDepartureProofV1
departureLocal?: (string | null)
departureSourceTimezone?: (string | null)
departureEvidenceRef?: (Uuid | null)
reasonCode: StableCode
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateCorrectionResultV1".
 */
export interface PostDepartureSourceCandidateCorrectionResultV1 {
contractVersion: "post-departure-source-candidate-correction-result.v1"
status: ("saved" | "duplicate")
correctionId: Uuid
version: number
candidate: PostDepartureSourceCandidateV1
remainingIssues: ShipmentHandoffIssueV1[]
decision: ("ready" | "review_required" | "rejected")
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateCargoCommandV1".
 */
export interface PostDepartureSourceCandidateCargoCommandV1 {
contractVersion: "post-departure-source-candidate-cargo.v1"
packageId: string
reviewId: Uuid
candidateRef: string
expectedVersion: number
/**
 * @minItems 1
 * @maxItems 1000
 */
cargoLines: [{
sourceLineRef?: string
replenishmentOrderNumber: string
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
}, ...({
sourceLineRef?: string
replenishmentOrderNumber: string
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
})[]]
reasonCode: StableCode
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateAcceptCommandV1".
 */
export interface PostDepartureSourceCandidateAcceptCommandV1 {
contractVersion: "post-departure-source-candidate-accept.v1"
packageId: string
/**
 * @minItems 1
 * @maxItems 4
 */
sources: [PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]
candidateRef: string
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourceCandidateAcceptResultV1".
 */
export interface PostDepartureSourceCandidateAcceptResultV1 {
contractVersion: "post-departure-source-candidate-accept-result.v1"
/**
 * @minItems 1
 */
acceptedCandidateRefs: [string, ...(string)[]]
handoff: ShipmentHandoffResultV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageAcceptCommandV1".
 */
export interface PostDepartureSourcePackageAcceptCommandV1 {
contractVersion: "post-departure-source-package-accept.v1"
packageId: string
/**
 * @minItems 1
 * @maxItems 4
 */
sources: [PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]|[PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1, PostDepartureSourceBatchV1]
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageAcceptItemV1".
 */
export interface PostDepartureSourcePackageAcceptItemV1 {
/**
 * @minItems 1
 */
candidateRefs: [string, ...(string)[]]
status: ("accepted" | "duplicate" | "conflict" | "rejected" | "failed")
shipmentId: (Uuid | null)
errorCode: (string | null)
traceId: string
recoveryAction: ("open_shipment" | "review_candidate" | "retry_package")
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PostDepartureSourcePackageAcceptResultV1".
 */
export interface PostDepartureSourcePackageAcceptResultV1 {
contractVersion: "post-departure-source-package-accept-result.v1"
packageId: string
items: PostDepartureSourcePackageAcceptItemV1[]
totals: {
groups: number
accepted: number
duplicate: number
conflict: number
rejected: number
failed: number
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingFactCompletionCommandV1".
 */
export interface ShipmentPendingFactCompletionCommandV1 {
contractVersion: "shipment-pending-fact-completion.v1"
expectedRelationshipVersion: number
occurredAt: DateTime
idempotencyKey: string
facts: {
carrierCode?: (string | null)
vesselName?: (string | null)
voyageNumber?: (string | null)
originPortCode?: (string | null)
destinationPortCode?: (string | null)
departureProof?: (DepartureProofV1 | null)
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingFactCompletionResultV1".
 */
export interface ShipmentPendingFactCompletionResultV1 {
contractVersion: "shipment-pending-fact-completion-result.v1"
status: ("saved" | "no_change")
shipmentId: Uuid
relationshipVersion: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingCargoCompletionLineV1".
 */
export interface ShipmentPendingCargoCompletionLineV1 {
containerRecordId: Uuid
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingCargoCompletionCommandV1".
 */
export interface ShipmentPendingCargoCompletionCommandV1 {
contractVersion: "shipment-pending-cargo-completion.v1"
expectedRelationshipVersion: number
occurredAt: DateTime
idempotencyKey: string
/**
 * @minItems 1
 * @maxItems 500
 */
lines: [ShipmentPendingCargoCompletionLineV1, ...(ShipmentPendingCargoCompletionLineV1)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingCargoCompletionResultV1".
 */
export interface ShipmentPendingCargoCompletionResultV1 {
contractVersion: "shipment-pending-cargo-completion-result.v1"
status: ("saved" | "duplicate")
shipmentId: Uuid
relationshipVersion: number
cargoLineCount: number
unmatchedSkuCount: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingSkuBindingCommandV1".
 */
export interface ShipmentPendingSkuBindingCommandV1 {
contractVersion: "shipment-pending-sku-binding.v1"
expectedRelationshipVersion: number
expectedCargoLineVersion: number
occurredAt: DateTime
idempotencyKey: string
cargoLineId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingSkuBindingResultV1".
 */
export interface ShipmentPendingSkuBindingResultV1 {
contractVersion: "shipment-pending-sku-binding-result.v1"
status: ("saved" | "duplicate")
shipmentId: Uuid
relationshipVersion: number
cargoLineId: Uuid
cargoLineVersion: number
productSkuId: Uuid
productNumber: string
skuResolution: ("matched_existing" | "registered")
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingDocumentCompletionItemV1".
 */
export interface ShipmentPendingDocumentCompletionItemV1 {
documentType: ("booking" | "mbl" | "hbl")
documentNumber: string
scac: (string | null)
/**
 * @minItems 1
 */
containerRecordIds: [Uuid, ...(Uuid)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingDocumentCompletionCommandV1".
 */
export interface ShipmentPendingDocumentCompletionCommandV1 {
contractVersion: "shipment-pending-document-completion.v1"
expectedRelationshipVersion: number
occurredAt: DateTime
idempotencyKey: string
/**
 * @minItems 1
 * @maxItems 50
 */
documents: [ShipmentPendingDocumentCompletionItemV1, ...(ShipmentPendingDocumentCompletionItemV1)[]]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingDocumentCompletionResultV1".
 */
export interface ShipmentPendingDocumentCompletionResultV1 {
contractVersion: "shipment-pending-document-completion-result.v1"
status: ("saved" | "duplicate")
shipmentId: Uuid
relationshipVersion: number
documentCount: number
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffPendingItemV1".
 */
export interface InternalShipmentHandoffPendingItemV1 {
code: StableCode
label: string
subjectType: ("shipment" | "container" | "cargo" | "document")
subjectRef: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffCargoLineV1".
 */
export interface InternalShipmentHandoffCargoLineV1 {
replenishmentOrderId: Uuid
replenishmentOrderNumber: string
replenishmentOrderLineId: Uuid
productSkuId?: (string | null)
productNumber: string
quantity: DecimalString
quantityUnit: ("piece" | "carton" | "set" | "pallet")
packageCount?: (DecimalString | null)
packageUnit?: (string | null)
grossWeight?: (DecimalString | null)
weightUnit?: (string | null)
volume?: (DecimalString | null)
volumeUnit?: (string | null)
containerRecordId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffContainerV1".
 */
export interface InternalShipmentHandoffContainerV1 {
containerRecordId: Uuid
containerNumber: string
containerTypeCode: string
stuffingSnapshotRef: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffCandidateV1".
 */
export interface InternalShipmentHandoffCandidateV1 {
candidateRef: string
bookingNumber: string
carrierCode: string
vesselName: string
voyageNumber: string
originPortCode: (string | null)
destinationPortCode: (string | null)
departedAt: DateTime
departureSourceTimezone: string
departureEvidenceRef: (string | null)
/**
 * @minItems 1
 */
containers: [InternalShipmentHandoffContainerV1, ...(InternalShipmentHandoffContainerV1)[]]
replenishmentOrders: {
id: Uuid
orderNumber: string
}[]
cargoLines: InternalShipmentHandoffCargoLineV1[]
transportDocuments: {
referenceId: string
documentType: ("booking" | "mbl" | "hbl")
documentNumber: string
/**
 * @minItems 1
 */
containerRecordIds: [Uuid, ...(Uuid)[]]
}[]
pendingItems: InternalShipmentHandoffPendingItemV1[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffCandidatePageV1".
 */
export interface InternalShipmentHandoffCandidatePageV1 {
items: InternalShipmentHandoffCandidateV1[]
asOf: DateTime
projectionVersion: 1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffAcceptCommandV1".
 */
export interface InternalShipmentHandoffAcceptCommandV1 {
contractVersion: "internal-shipment-handoff-accept.v1"
candidateRef: string
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffAcceptResultV1".
 */
export interface InternalShipmentHandoffAcceptResultV1 {
contractVersion: "internal-shipment-handoff-accept-result.v1"
candidateRef: string
handoff: ShipmentHandoffResultV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffBatchAcceptCommandV1".
 */
export interface InternalShipmentHandoffBatchAcceptCommandV1 {
contractVersion: "internal-shipment-handoff-batch-accept.v1"
/**
 * @minItems 1
 * @maxItems 500
 */
candidateRefs: [string, ...(string)[]]
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "InternalShipmentHandoffBatchAcceptResultV1".
 */
export interface InternalShipmentHandoffBatchAcceptResultV1 {
contractVersion: "internal-shipment-handoff-batch-accept-result.v1"
items: PostDepartureSourcePackageAcceptItemV1[]
totals: {
groups: number
accepted: number
duplicate: number
conflict: number
rejected: number
failed: number
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "StartPostDepartureLifecycleCommandV2".
 */
export interface StartPostDepartureLifecycleCommandV2 {
shipmentId: Uuid
/**
 * @minItems 1
 */
containerIds: [string, ...(string)[]]
flowDefinitionCode: "post_departure_ocean"
definitionVersion: number
departureEventId: Uuid
relationshipVersion: number
idempotencyKey: string
traceId: string
}
export interface OceanRouteWriteCommand {
tenantId: Uuid
containerId: Uuid
/**
 * @minItems 1
 * @maxItems 20
 */
segments: [OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]|[OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput, OceanRouteSegmentInput]
ingestionChannel: ("api" | "file_import" | "manual_ui")
sourceSystem: string
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
actorId?: Uuid
reasonCode?: string
expectedVersion: number
idempotencyKey: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OceanRouteWriteResult".
 */
export interface OceanRouteWriteResult {
routePlanId: Uuid
recordState: ("recorded" | "duplicate")
version: number
/**
 * @minItems 1
 */
segments: [{
segmentId: Uuid
sequence: number
isFinal: boolean
transportMode: ("vessel" | "feeder" | "barge")
originUnlocode: string
originTimezone: string
destinationLocationType: ("port" | "terminal")
destinationUnlocode: string
destinationLocationId?: Uuid
destinationPortCallId?: string
destinationTimezone: string
}, ...({
segmentId: Uuid
sequence: number
isFinal: boolean
transportMode: ("vessel" | "feeder" | "barge")
originUnlocode: string
originTimezone: string
destinationLocationType: ("port" | "terminal")
destinationUnlocode: string
destinationLocationId?: Uuid
destinationPortCallId?: string
destinationTimezone: string
})[]]
replay: {
claimed: number
applied: number
pending: number
rejected: number
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OceanRouteProjection".
 */
export interface OceanRouteProjection {
routePlanId: Uuid
version: number
activatedAt: DateTime
ingestionChannel: ("api" | "file_import" | "manual_ui")
sourceSystem: string
evidenceRefs: Uuid[]
actorId?: Uuid
reasonCode?: string
/**
 * @minItems 1
 */
segments: [{
segmentId: Uuid
sequence: number
isFinal: boolean
transportMode: ("vessel" | "feeder" | "barge")
originUnlocode: string
originTimezone: string
destinationLocationType: ("port" | "terminal")
destinationUnlocode: string
destinationLocationId?: Uuid
destinationPortCallId?: string
destinationTimezone: string
}, ...({
segmentId: Uuid
sequence: number
isFinal: boolean
transportMode: ("vessel" | "feeder" | "barge")
originUnlocode: string
originTimezone: string
destinationLocationType: ("port" | "terminal")
destinationUnlocode: string
destinationLocationId?: Uuid
destinationPortCallId?: string
destinationTimezone: string
})[]]
}
export interface CanonicalEventEnvelopeLocation {
locationType: ("port" | "terminal" | "rail_yard" | "warehouse" | "depot" | "in_transit")
unlocode?: string
locationId?: Uuid
segmentId?: Uuid
portCallId?: string
timezone: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactInboxPayload".
 */
export interface LifecycleDateFactInboxPayload {
kind: "lifecycle_date_fact.record_requested.v1"
command: LifecycleDateFactCommand
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactResult".
 */
export interface LifecycleDateFactResult {
factId: Uuid
recordState: ("recorded" | "duplicate")
applicationState: ("not_applicable" | "review_required" | "pending_application" | "applied" | "rejected")
reasonCode?: (string | null)
canonicalEventId?: (Uuid | null)
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactReviewEvidence".
 */
export interface LifecycleDateFactReviewEvidence {
evidenceId: Uuid
evidenceType: string
verificationState: VerificationState
validity: EvidenceValidity
qualified: boolean
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactReviewItem".
 */
export interface LifecycleDateFactReviewItem {
factId: Uuid
containerId: Uuid
orderNumber: (string | null)
containerNumber: (string | null)
nodeCode: LifecycleNodeCode
eventCode: CanonicalEventCode
occurredAt: DateTime
rawValue: string
sourceUtcOffset: string
captureSource: CaptureSource
sourceSystem: string
authoritySystem: string
location: (CanonicalEventEnvelopeLocation | null)
submittedBy: (Uuid | null)
recordedAt: DateTime
projectionVersion: number
evidence: LifecycleDateFactReviewEvidence[]
blockingReasons: string[]
allowedActions: ("approve")[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "LifecycleDateFactReviewPage".
 */
export interface LifecycleDateFactReviewPage {
items: LifecycleDateFactReviewItem[]
pageInfo: {
nextCursor: (string | null)
hasNextPage: boolean
pageSize: number
}
asOf: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ApproveLifecycleDateFactReviewCommand".
 */
export interface ApproveLifecycleDateFactReviewCommand {
reasonCode: string
expectedVersion: number
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerTimelineItem".
 */
export interface ContainerTimelineItem {
eventId: Uuid
eventCode: CanonicalEventCode
eventVersion: 1
containerId: Uuid
flowInstanceId: Uuid
nodeCode: LifecycleNodeCode
nodeInstanceId: Uuid
role: EventRole
timeKind: TimeKind
occurredAt: DateTime
recordedAt: DateTime
receivedAt?: DateTime
validity: EvidenceValidity
confidenceState: ConfidenceState
sourceSummary: CanonicalEventEnvelopeSource
location?: CanonicalEventEnvelopeLocation
evidenceRefs: Uuid[]
relation?: CanonicalEventEnvelopeRelation
domain: string
domainFactId: Uuid
eventSequence: number
projectionVersion: number
}
export interface CanonicalEventEnvelopeSource {
sourceSystem: string
authoritySystem: string
provider?: string
providerVersion?: string
interfaceCode?: string
sourceEventId?: string
mappingVersion?: string
captureSource: CaptureSource
authorityLevel: AuthorityLevel
verificationState: VerificationState
confidenceState: ConfidenceState
actorId?: Uuid
}
export interface CanonicalEventEnvelopeRelation {
relationType: EventRelationType
relatedEventId: Uuid
reasonCode: string
reason: string
authorizedBy?: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTime".
 */
export interface NodeTime {
nodeCode: LifecycleNodeCode
segmentId?: Uuid
plannedAt?: DateTime
estimatedAt?: DateTime
actualAt?: DateTime
confidenceState: ConfidenceState
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ActiveException".
 */
export interface ActiveException {
eventId: Uuid
eventCode: CanonicalEventCode
nodeCode: LifecycleNodeCode
severity: StableCode
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "Dispute".
 */
export interface Dispute {
/**
 * @minItems 2
 */
eventIds: [Uuid, Uuid, ...(Uuid)[]]
reasonCode: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerTimeProjection".
 */
export interface ContainerTimeProjection {
containerId: Uuid
flowInstanceId: Uuid
currentNodeCode: LifecycleNodeCode
currentContainerState: ContainerLifecycleState
nodeTimes: NodeTime[]
activeExceptions: ActiveException[]
disputes: Dispute[]
projectionVersion: number
asOf: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeEventApplication".
 */
export interface NodeEventApplication {
eventId: Uuid
targetNodeInstanceId: Uuid
state: ("pending_application" | "applied" | "rejected")
evaluatedAt: DateTime
guardResults: StableCode[]
reasonCode?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TimelineReplayRequest".
 */
export interface TimelineReplayRequest {
tenantId: Uuid
flowInstanceId: Uuid
projectionName: StableCode
fromEventSequence: number
expectedProjectionVersion: number
reasonCode: string
actorId: Uuid
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskCompletionPolicy".
 */
export interface NodeTaskCompletionPolicy {
policyCode: StableCode
policyVersion: number
taskPredicateCodes: StableCode[]
dynamicRequirementRuleCodes: StableCode[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskDefinition".
 */
export interface NodeTaskDefinition {
taskDefinitionKey: string
taskDefinitionVersion: number
nodeCode: LifecycleNodeCode
ownerDomain: BoundedContextCode
/**
 * @minItems 1
 */
workOrderDefinitions: [WorkOrderDefinitionRef, ...(WorkOrderDefinitionRef)[]]
completionPolicy: NodeTaskCompletionPolicy
resultPolicy: NodeTaskResultPolicy
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderDefinitionRef".
 */
export interface WorkOrderDefinitionRef {
workOrderDefinitionKey: string
workOrderDefinitionVersion: number
}
export interface WorkOrderDefinition {
workOrderDefinitionKey: string
workOrderDefinitionVersion: number
ownerDomain: BoundedContextCode
requirement: WorkOrderRequirement
conditionCode?: StableCode
executionMode: ExecutionMode
assignmentPolicy: AssignmentPolicy
/**
 * @minItems 1
 */
completionPredicates: [StableCode, ...(StableCode)[]]
/**
 * @minItems 1
 */
acceptedFactTypes: [string, ...(string)[]]
/**
 * @minItems 1
 */
allowedActionCodes: [StableCode, ...(StableCode)[]]
duePolicyRef?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskView".
 */
export interface NodeTaskView {
tenantId: Uuid
containerId: Uuid
flowInstanceId: Uuid
nodeInstanceId: Uuid
nodeTaskId: Uuid
nodeCode: LifecycleNodeCode
taskDefinitionKey: string
taskDefinitionVersion: number
policySnapshotHash: string
state: NodeTaskState
applicability: NodeApplicability
readinessState: TaskReadinessState
completionEligibility: TaskCompletionEligibility
conditionFactRefs: Uuid[]
ownerRef?: EntityRef
dueAt?: DateTime
activeBlockRefs?: Uuid[]
factApplicationRefs?: Uuid[]
version: number
updatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderView".
 */
export interface WorkOrderView {
tenantId: Uuid
containerId: Uuid
flowInstanceId: Uuid
nodeInstanceId: Uuid
nodeTaskId: Uuid
workOrderId: Uuid
workOrderDefinitionKey: string
workOrderDefinitionVersion: number
policySnapshotHash: string
state: WorkOrderState
applicability: WorkOrderApplicability
assignmentState: AssignmentState
assigneeRef?: EntityRef
dueAt?: DateTime
activeBlockRefs?: Uuid[]
evidenceRefs: Uuid[]
version: number
updatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeTaskAggregationSnapshot".
 */
export interface NodeTaskAggregationSnapshot {
nodeTaskId: Uuid
aggregationVersion: number
policySnapshotHash: string
requiredWorkOrderIds: Uuid[]
completedWorkOrderIds: Uuid[]
blockingRefs: Uuid[]
evaluatedFactRefs: Uuid[]
previousState: NodeTaskState
nextState: NodeTaskState
evaluatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderFactApplication".
 */
export interface WorkOrderFactApplication {
factApplicationId: Uuid
tenantId: Uuid
workOrderId: Uuid
businessFactType: string
businessFactKey: string
domainFactId: Uuid
captureSource: CaptureSource
evidenceRefs: Uuid[]
occurredAt: DateTime
receivedAt: DateTime
recordedAt: DateTime
requestHash: string
decision: FactApplicationDecision
decisionReason?: string
previousState: WorkOrderState
resultingState: WorkOrderState
appliedAt: DateTime
actorOrServiceId: Uuid
traceId: string
}
export interface WorkExecutionCommand {
commandCode: ("create_node_task" | "assign_work_order" | "start_work_order" | "apply_fact_to_work_order" | "block_work_order" | "resolve_work_order_block" | "fail_work_order_attempt" | "cancel_work_order" | "reopen_work_order" | "cancel_node_task" | "reopen_node_task")
tenantId: Uuid
nodeInstanceId?: Uuid
nodeTaskId?: Uuid
workOrderId?: Uuid
idempotencyKey: string
expectedVersion: number
actorOrServiceId: Uuid
traceId: string
payload: {
[k: string]: unknown
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EvidenceSource".
 */
export interface EvidenceRecordSource {
sourceId: Uuid
sourceType: ("organization" | "authority" | "system" | "person" | "device")
originatorSystem: string
authoritySystem: string
provider?: string
providerVersion?: string
interfaceCode?: string
sourceReference?: string
sourceEventId?: string
mappingVersion?: string
ingestionChannel: ("api" | "webhook" | "file_import" | "manual_ui" | "system_internal")
captureSource: CaptureSource
actorId?: Uuid
receivedAt?: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EvidenceRelation".
 */
export interface EvidenceRelation {
relationType: EvidenceRelationType
relatedEvidenceId: Uuid
reasonCode: string
reason?: string
authorizedBy?: Uuid
createdAt: DateTime
}
export interface SourceAuthorityPolicy1 {
policyId: Uuid
policyVersion: number
effectiveFrom: DateTime
effectiveTo?: DateTime
tenantScope?: Uuid
factType?: string
eventCode?: CanonicalEventCode
fieldCode?: StableCode
subjectType: EntityType
jurisdiction?: string
direction?: StableCode
locationRole?: StableCode
transportMode?: StableCode
timeKind?: TimeKind
/**
 * @minItems 1
 */
allowedAuthoritySystems: [string, ...(string)[]]
/**
 * @minItems 1
 */
allowedSourceTypes: [("organization" | "authority" | "system" | "person" | "device"), ...(("organization" | "authority" | "system" | "person" | "device"))[]]
minimumAuthorityLevel: AuthorityLevel
requiredEvidenceTypes: StableCode[]
/**
 * @minItems 1
 */
verificationRequirements: [StableCode, ...(StableCode)[]]
corroborationRule?: StableCode
conflictAction: ("accept" | "reject" | "review")
manualCorrectionPolicyRef: string
sealingPolicyRef: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EvidenceVerificationDecision".
 */
export interface EvidenceVerificationDecision {
verificationDecisionId: Uuid
evidenceId: Uuid
verificationSequence: number
decision: ("verified" | "rejected" | "revoked")
/**
 * @minItems 1
 */
checks: [StableCode, ...(StableCode)[]]
policyId: Uuid
policyVersion: number
decidedAt: DateTime
actorOrServiceId: Uuid
reasonCode: string
reason?: string
previousDecisionId?: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ManualAuthorityLock".
 */
export interface ManualAuthorityLock {
lockId: Uuid
tenantId: Uuid
scopeType: ("evidence" | "fact" | "field" | "event" | "projection")
scopeId: Uuid
fieldCode?: StableCode
effect: ("review_before_replace" | "freeze_projection")
reasonCode: string
reason: string
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
createdBy: Uuid
createdAt: DateTime
expiresAt?: DateTime
expectedVersion: number
releasedBy?: Uuid
releasedAt?: DateTime
releaseReason?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "MainReferenceChain".
 */
export interface MainReferenceChain {
tenantId: Uuid
containerId: Uuid
flowInstanceId: Uuid
nodeInstanceId: Uuid
nodeTaskId: Uuid
workOrderId: Uuid
clientOperationId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DomainFactEvidenceLinks".
 */
export interface DomainFactEvidenceLinks {
tenantId: Uuid
domainFactId: Uuid
evidenceIds: Uuid[]
eventId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ClientOperationReceiptLinks".
 */
export interface ClientOperationReceiptLinks {
tenantId: Uuid
clientOperationId: Uuid
receiptIds: Uuid[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "EventNodeApplicationLink".
 */
export interface EventNodeApplicationLink {
tenantId: Uuid
flowInstanceId: Uuid
eventId: Uuid
targetNodeInstanceId: Uuid
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TraceContext".
 */
export interface TraceContext {
correlationId: Uuid
causationId?: Uuid
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BusinessKeyReference".
 */
export interface BusinessKeyReference {
tenantId: Uuid
entityType: EntityType
businessKey: string
validFrom: DateTime
validTo?: DateTime
entityId: Uuid
}
export interface ActionDefinition {
actionCode: StableCode
actionVersion: number
ownerModule: BoundedContextCode
/**
 * @minItems 1
 */
targetEntityTypes: [EntityType, ...(EntityType)[]]
/**
 * @minItems 1
 */
requiredCapabilities: [CapabilityCode, ...(CapabilityCode)[]]
riskLevel: RiskLevel
confirmationPolicy: ConfirmationPolicy
reviewPolicy: ReviewPolicy
evidencePolicyRef?: string
allowedStatePredicates: StableCode[]
businessPreconditionCodes: StableCode[]
idempotencyScope: string
resultPolicy: StableCode
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AuthorizationContext".
 */
export interface AuthorizationContext {
tenantId: Uuid
actorType: ActorType
actorId: Uuid
authenticatedAt: DateTime
authenticationMethod: StableCode
roles: StableCode[]
capabilities: CapabilityCode[]
organizationScope: Uuid[]
locationScope: Uuid[]
delegatedBy?: Uuid
delegationExpiresAt?: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ApprovalRecord".
 */
export interface ApprovalRecord {
approvalId: Uuid
tenantId: Uuid
clientOperationId: Uuid
actionCode: StableCode
actionVersion: number
target: EntityRef
commandHash: string
reviewPolicy: ReviewPolicy
requestedBy: Uuid
approvedBy: Uuid
approvedAt: DateTime
expiresAt: DateTime
}
export interface AuthorizationDecision {
clientOperationId: Uuid
decision: ("authorized" | "denied" | "review_required")
denialCategory?: DenialCategory
/**
 * @minItems 1
 */
checks: [StableCode, ...(StableCode)[]]
policyVersion: number
approvalId?: Uuid
decidedAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ProcessingLease".
 */
export interface ProcessingLease {
owner: string
lockedAt: DateTime
expiresAt: DateTime
}
export interface InboxRecord {
inboxRecordId: Uuid
tenantId: Uuid
consumerName: string
messageId: Uuid
payloadHash: string
state: InboxState
lease?: ProcessingLease
attemptCount: number
nextAttemptAt?: DateTime
processedAt?: DateTime
receivedAt: DateTime
updatedAt: DateTime
traceId: string
}
export interface OutboxRecord {
outboxRecordId: Uuid
tenantId: Uuid
eventId: Uuid
eventType: StableCode
eventVersion: number
payloadRef: string
payloadHash: string
state: OutboxState
lease?: ProcessingLease
attemptCount: number
nextAttemptAt?: DateTime
brokerReference?: string
publishedAt?: DateTime
createdAt: DateTime
updatedAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "RetryPolicy".
 */
export interface RetryPolicy {
policyCode: StableCode
policyVersion: number
/**
 * @minItems 1
 */
retryableFailureCodes: [StableCode, ...(StableCode)[]]
initialDelaySeconds: number
backoffMultiplier: number
jitterRatio: number
maximumAttempts: number
totalTimeoutSeconds: number
providerRateLimitPolicyRef?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "DeadLetterRecord".
 */
export interface DeadLetterRecord {
deadLetterId: Uuid
tenantId: Uuid
messageId: Uuid
messageRef: string
payloadHash: string
failureCategory: StableCode
lastErrorCode: string
attemptCount: number
objectRefs: EntityRef[]
traceId: string
deadLetteredAt: DateTime
ownerQueue: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ReplayRequest".
 */
export interface ReplayRequest {
deadLetterId: Uuid
targetConsumerVersion: string
requestedBy: Uuid
reasonCode: string
requestedAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CompensationRecord".
 */
export interface CompensationRecord {
compensationId: Uuid
tenantId: Uuid
originalClientOperationId: Uuid
compensationActionCode: StableCode
state: CompensationState
reasonCode: string
requestedBy: Uuid
resultRefs?: EntityRef[]
createdAt: DateTime
updatedAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "NodeSummary".
 */
export interface NodeSummary {
nodeInstanceId: Uuid
nodeCode: LifecycleNodeCode
sequence: number
activationNo: number
applicability: NodeApplicability
state: LifecycleNodeState
plannedAt?: DateTime
estimatedAt?: DateTime
actualAt?: DateTime
activeBlockCount: number
taskProgress: {
required: number
completed: number
blocked: number
[k: string]: unknown
}
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TaskSummary".
 */
export interface TaskSummary {
nodeTaskId: Uuid
nodeInstanceId: Uuid
taskDefinitionKey: string
taskDefinitionVersion: number
state: NodeTaskState
applicability: NodeApplicability
readinessState: TaskReadinessState
completionEligibility: TaskCompletionEligibility
conditionFactRefs: Uuid[]
ownerRef?: EntityRef
dueAt?: DateTime
requiredWorkOrderCount: number
completedWorkOrderCount: number
activeBlockRefs: Uuid[]
factApplicationRefs: Uuid[]
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WorkOrderSummary".
 */
export interface WorkOrderSummary {
workOrderId: Uuid
nodeTaskId: Uuid
workOrderDefinitionKey: string
workOrderDefinitionVersion: number
state: WorkOrderState
applicability: WorkOrderApplicability
assignmentState: AssignmentState
assigneeRef?: EntityRef
dueAt?: DateTime
completionPredicateCount: number
satisfiedPredicateCount: number
activeBlockRefs: Uuid[]
factApplicationRefs: Uuid[]
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ProfessionalFactSummary".
 */
export interface ProfessionalFactSummary {
domainFactId: Uuid
factType: StableCode
occurredAt: DateTime
validity: EvidenceValidity
confidenceState: ConfidenceState
evidenceRefs: Uuid[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "SyncOperationSummary".
 */
export interface SyncOperationSummary {
clientOperationId: Uuid
receptionState: ReceptionState
businessDecisionState: BusinessDecisionState
commitState: CommitState
attemptCount: number
lastAttemptAt?: DateTime
nextAttemptAt?: DateTime
failureCode?: string
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TimeSlot".
 */
export interface TimeSlot {
nodeCode: LifecycleNodeCode
segmentId?: Uuid
plannedAt?: DateTime
estimatedAt?: DateTime
actualAt?: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CurrentTimeSummary".
 */
export interface CurrentTimeSummary {
nodeTimes: TimeSlot[]
segmentTimes: TimeSlot[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "BlockSummary".
 */
export interface BlockSummary {
blockId: Uuid
target: EntityRef
blockType: StableCode
reasonCode: string
occurredAt: DateTime
ownerRef?: EntityRef
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ExceptionSummary".
 */
export interface ExceptionSummary {
exceptionId: Uuid
target: EntityRef
exceptionCode: StableCode
severity: StableCode
occurredAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "PageInfo".
 */
export interface PageInfo {
nextCursor: (string | null)
hasNextPage: boolean
pageSize: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerOperationalPage".
 */
export interface ContainerOperationalPage {
items: LogixContractsV1[]
pageInfo: PageInfo
asOf: DateTime
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerShipmentContextV1".
 */
export interface ContainerShipmentContextV1 {
shipmentId: Uuid
shipmentNumber: (string | null)
linkId: Uuid
linkVersion: number
currentLifecycleStatus: ShipmentLifecycleStatusV1
relationshipVersion: number
carrierCode: (string | null)
vesselName: (string | null)
voyageNumber: (string | null)
originCountryCode: (string | null)
originUnlocode: (string | null)
destinationCountryCode: (string | null)
salesCountryCode: (string | null)
cargoOwnerReferenceId: (Uuid | null)
cargoOwnerName: (string | null)
destinationUnlocode: (string | null)
atdAt: (DateTime | null)
etaAt: (DateTime | null)
transportDocuments: ShipmentTransportDocumentViewV1[]
upstreamReferences: ShipmentUpstreamReferenceViewV1[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentTransportDocumentViewV1".
 */
export interface ShipmentTransportDocumentViewV1 {
id: Uuid
documentType: StableCode
documentNumber: string
scac: (string | null)
parentDocumentId: (Uuid | null)
containerRecordIds: Uuid[]
version: number
effectiveFrom: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentUpstreamReferenceViewV1".
 */
export interface ShipmentUpstreamReferenceViewV1 {
id: Uuid
containerRecordId: Uuid
shipmentCargoLineId: (Uuid | null)
referenceType: StableCode
sourceSystem: string
sourceRecordId: string
sourceVersion: (string | null)
sourceLineId: (string | null)
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "TimelinePage".
 */
export interface TimelinePage {
items: ContainerTimelineItem[]
pageInfo: PageInfo
asOf: DateTime
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "CustomsClearanceCase".
 */
export interface CustomsClearanceCase {
caseId: Uuid
containerRecordId: Uuid
version: number
jurisdictionCountryCode: string
customsBrokerPartyId: (Uuid | null)
declarationNumber: (string | null)
filingState: CustomsFilingState
decisionState: CustomsDecisionState
activeHoldCodes: StableCode[]
evidenceRefs: Uuid[]
actorId: string
reasonCode: StableCode
createdAt: DateTime
duplicate: boolean
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ReplaceCustomsClearanceCaseCommand".
 */
export interface ReplaceCustomsClearanceCaseCommand {
expectedVersion: number
jurisdictionCountryCode: string
customsBrokerPartyId: (Uuid | null)
declarationNumber: (string | null)
filingState: CustomsFilingState
decisionState: CustomsDecisionState
activeHoldCodes: StableCode[]
evidenceRefs: Uuid[]
reasonCode: StableCode
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "WarehouseDeliveryInstruction".
 */
export interface WarehouseDeliveryInstruction {
instructionId: Uuid
containerRecordId: Uuid
version: number
warehouseLocationId: Uuid
warehouseCode: (string | null)
warehouseName: string
unlocode: (string | null)
timezone: string
appointmentStartAt: (DateTime | null)
appointmentEndAt: (DateTime | null)
appointmentReference: (string | null)
evidenceRefs: Uuid[]
actorId: string
reasonCode: StableCode
createdAt: DateTime
duplicate: boolean
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ReplaceWarehouseDeliveryInstructionCommand".
 */
export interface ReplaceWarehouseDeliveryInstructionCommand {
expectedVersion: number
warehouseLocationId: Uuid
warehouseCode: (string | null)
warehouseName: string
unlocode: (string | null)
timezone: string
appointmentStartAt: (DateTime | null)
appointmentEndAt: (DateTime | null)
appointmentReference: (string | null)
evidenceRefs: Uuid[]
reasonCode: StableCode
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerUnloadingReport".
 */
export interface ContainerUnloadingReport {
reportId: Uuid
containerRecordId: Uuid
version: number
warehouseLocationId: Uuid
operationState: ContainerUnloadingOperationState
startedAt: DateTime
completedAt: (DateTime | null)
expectedQuantity: string
unloadedQuantity: string
remainingQuantity: string
damagedQuantity: string
shortageQuantity: string
quantityUnit: ("piece" | "carton" | "set" | "pallet")
sealCheck: ContainerUnloadingSealCheck
exceptionResolved: boolean
exceptionNotes: (string | null)
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
actorId: string
reasonCode: StableCode
createdAt: DateTime
duplicate: boolean
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AppendContainerUnloadingReportCommand".
 */
export interface AppendContainerUnloadingReportCommand {
expectedVersion: number
warehouseLocationId: Uuid
operationState: ContainerUnloadingOperationState
startedAt: DateTime
completedAt: (DateTime | null)
expectedQuantity: string
unloadedQuantity: string
remainingQuantity: string
damagedQuantity: string
shortageQuantity: string
quantityUnit: ("piece" | "carton" | "set" | "pallet")
sealCheck: ContainerUnloadingSealCheck
exceptionResolved: boolean
exceptionNotes: (string | null)
/**
 * @minItems 1
 */
evidenceRefs: [Uuid, ...(Uuid)[]]
reasonCode: StableCode
idempotencyKey: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentSummaryV1".
 */
export interface ShipmentSummaryV1 {
id: Uuid
shipmentNumber: (string | null)
transportMode: StableCode
carrierCode: (string | null)
vesselName: (string | null)
voyageNumber: (string | null)
originCountryCode: (string | null)
originUnlocode: (string | null)
destinationCountryCode: (string | null)
salesCountryCode: (string | null)
cargoOwnerReferenceId: (Uuid | null)
cargoOwnerName: (string | null)
destinationUnlocode: (string | null)
atdAt: (DateTime | null)
etaAt: (DateTime | null)
currentLifecycleStatus: ShipmentLifecycleStatusV1
lifecycleVersion: number
relationshipVersion: number
activeContainerCount: number
activeCargoLineCount: number
lifecycleInitializationState: ShipmentLifecycleInitializationStateV1
updatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentContainerAllocationV1".
 */
export interface ShipmentContainerAllocationV1 {
shipmentCargoLineId: Uuid
allocatedQuantity: string
quantityUnit: StableCode
packageCount: (string | null)
packageUnit: (string | null)
grossWeight: (string | null)
weightUnit: (string | null)
volume: (string | null)
volumeUnit: (string | null)
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentContainerViewV1".
 */
export interface ShipmentContainerViewV1 {
linkId: Uuid
containerRecordId: Uuid
containerNumber: (string | null)
containerTypeCode: (string | null)
sealNumber: (string | null)
currentStatus: ContainerLifecycleState
linkVersion: number
currentNodeCode: (LifecycleNodeCode | null)
flowState: (string | null)
allocations: ShipmentContainerAllocationV1[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentCargoLineViewV1".
 */
export interface ShipmentCargoLineViewV1 {
id: Uuid
lineNo: number
productSkuId: (Uuid | null)
productNumber: string
quantity: string
quantityUnit: StableCode
packageCount: (string | null)
packageUnit: (string | null)
grossWeight: (string | null)
weightUnit: (string | null)
volume: (string | null)
volumeUnit: (string | null)
replenishmentOrderLineId: (string | null)
sourceLineId: string
version: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentHandoffSummaryV1".
 */
export interface ShipmentHandoffSummaryV1 {
handoffId: Uuid
handoffVersion: number
sourceSystem: string
status: StableCode
occurredAt: DateTime
traceId: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentLifecycleInitializationV1".
 */
export interface ShipmentLifecycleInitializationV1 {
state: ShipmentLifecycleInitializationStateV1
activeContainerCount: number
initializedContainerCount: number
relationshipVersion: number
lastErrorCode: (string | null)
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentDetailV1".
 */
export interface ShipmentDetailV1 {
shipment: ShipmentSummaryV1
handoff: (ShipmentHandoffSummaryV1 | null)
containers: ShipmentContainerViewV1[]
cargoLines: ShipmentCargoLineViewV1[]
transportDocuments: ShipmentTransportDocumentViewV1[]
upstreamReferences: ShipmentUpstreamReferenceViewV1[]
pendingItems: ShipmentPendingItemV1[]
lifecycleInitialization: ShipmentLifecycleInitializationV1
projectionVersion: number
asOf: DateTime
}
export interface ShipmentPendingItemV1 {
code: StableCode
label: string
subjectType: ("shipment" | "container" | "cargo" | "document")
subjectRef: string
currentValue: (string | null)
sourceSystem: (string | null)
sourceValue: (string | null)
candidateValues: string[]
responsibility: {
roleCode: StableCode
roleLabel: string
}
deadline: {
dueAt: (DateTime | null)
source: ("not_configured" | "policy" | "source")
label: string
}
restrictedActions: ShipmentPendingActionV1[]
directAction: ShipmentPendingActionV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingActionV1".
 */
export interface ShipmentPendingActionV1 {
code: StableCode
label: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingItemV1".
 */
export interface ShipmentPendingItemV11 {
code: StableCode
label: string
subjectType: ("shipment" | "container" | "cargo" | "document")
subjectRef: string
currentValue: (string | null)
sourceSystem: (string | null)
sourceValue: (string | null)
candidateValues: string[]
responsibility: {
roleCode: StableCode
roleLabel: string
}
deadline: {
dueAt: (DateTime | null)
source: ("not_configured" | "policy" | "source")
label: string
}
restrictedActions: ShipmentPendingActionV1[]
directAction: ShipmentPendingActionV1
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingCompletionItemV1".
 */
export interface ShipmentPendingCompletionItemV1 {
shipment: ShipmentSummaryV1
pendingItems: ShipmentPendingItemV11[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPendingCompletionPageV1".
 */
export interface ShipmentPendingCompletionPageV1 {
items: ShipmentPendingCompletionItemV1[]
pageInfo: PageInfo
asOf: DateTime
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ShipmentPageV1".
 */
export interface ShipmentPageV1 {
items: ShipmentSummaryV1[]
pageInfo: PageInfo
asOf: DateTime
projectionVersion: number
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "Freshness".
 */
export interface Freshness {
state: ("current" | "catching_up" | "stale" | "rebuilding" | "unavailable")
projectedAt: DateTime
sourceHighWatermark?: string
lagSeconds?: number
reasonCode?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OpenAssistantSessionRequest".
 */
export interface OpenAssistantSessionRequest {
notificationId?: string
containerId?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantMessage".
 */
export interface AssistantMessage {
id: string
role: ("system" | "user" | "assistant")
body: string
createdAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantObjectSummary".
 */
export interface AssistantObjectSummary {
containerId: string
orderNumber: (string | null)
containerNumber: (string | null)
currentStatus: ContainerLifecycleState
currentNodeCode: (LifecycleNodeCode | null)
flowState: (FlowInstanceState | null)
updatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantAllowedAction".
 */
export interface AssistantAllowedAction {
actionCode: ("work_execution.claim_work_order" | "work_execution.complete_work_order")
explanation: string
containerId: string
taskId: string
workOrderId: string
nodeCode: LifecycleNodeCode
assigneeId: (string | null)
dueAt: (DateTime | null)
actorCanExecute: boolean
targetPath: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantReadOnlyPolicy".
 */
export interface AssistantReadOnlyPolicy {
assistantCanExecute: false
actorCanExecuteActions: boolean
explanation: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantObjectContext".
 */
export interface AssistantObjectContext {
summary: AssistantObjectSummary
allowedActions: AssistantAllowedAction[]
actionSummary: string
readOnlyPolicy: AssistantReadOnlyPolicy
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "AssistantSessionResponse".
 */
export interface AssistantSessionResponse {
sessionId: string
notificationId: (string | null)
containerId: (string | null)
objectContext: (AssistantObjectContext | null)
messages: AssistantMessage[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OpsQuestionHistoryMessage".
 */
export interface OpsQuestionHistoryMessage {
role: ("system" | "user" | "assistant")
body: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "OpsQuestionInput".
 */
export interface OpsQuestionInput {
question: string
notificationContext: (string | null)
objectContext: (AssistantObjectContext | null)
/**
 * @maxItems 100
 */
history: OpsQuestionHistoryMessage[]
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ErrorDetail".
 */
export interface ErrorDetail {
field?: string
reasonCode: string
message: string
rejectedValueSummary?: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ConflictDescriptor".
 */
export interface ConflictDescriptor {
type: ("idempotency" | "optimistic_concurrency" | "sealed_history" | "manual_lock" | "manual_review" | "snapshot_expired" | "projection_version" | "message_payload")
expectedVersion?: number
actualVersion?: number
existingResourceRef?: EntityRef
resolution: ("refresh" | "use_existing" | "submit_new_key" | "request_review" | "correct_source" | "wait_and_retry")
}
export interface CanonicalEventEnvelope {
eventId: Uuid
eventCode: CanonicalEventCode
eventVersion: 1
tenantId: Uuid
containerId: Uuid
flowInstanceId: Uuid
nodeCode: LifecycleNodeCode
nodeInstanceId: Uuid
nodeTaskId?: Uuid
workOrderId?: Uuid
domainFactId: Uuid
domainFactType: string
authorityPolicyRef: string
domain: string
role: EventRole
timeKind: TimeKind
occurredAt: DateTime
recordedAt: DateTime
receivedAt?: DateTime
providerUpdatedAt?: DateTime
eventSequence: number
idempotencyKey: string
source: CanonicalEventEnvelopeSource
location?: CanonicalEventEnvelopeLocation
evidenceRefs: Uuid[]
confidenceState: ConfidenceState
validity: EvidenceValidity
relation?: CanonicalEventEnvelopeRelation
data: {
[k: string]: unknown
}
correlationId: Uuid
causationId?: Uuid
traceId: string
}
export interface CanonicalEventEnvelopeV2 {
eventId: Uuid
eventCode: CanonicalEventCode
eventVersion: 2
tenantId: Uuid
subject: PostDepartureSubject
subjectVersion: number
scopeVersion?: number
flowInstanceId?: Uuid
nodeCode?: LifecycleNodeCode
nodeInstanceId?: Uuid
domainFactId: Uuid
domainFactType: string
authorityPolicyRef: string
domain: string
role: EventRole
timeKind: TimeKind
occurredAt: DateTime
recordedAt: DateTime
eventSequence: number
idempotencyKey: string
source: CanonicalEventEnvelopeSource
location?: CanonicalEventEnvelopeLocation
evidenceRefs: Uuid[]
confidenceState: ConfidenceState
validity: EvidenceValidity
relation?: CanonicalEventEnvelopeRelation
data: {
[k: string]: unknown
}
correlationId: Uuid
causationId?: Uuid
traceId: string
}
export interface EvidenceRecord {
evidenceId: Uuid
tenantId: Uuid
evidenceType: ("document" | "api_response" | "receipt" | "message" | "photo" | "scan" | "device_record" | "system_record" | "attestation")
subjectType: EntityType
subjectId: Uuid
source: EvidenceRecordSource
authorityLevel: AuthorityLevel
contentRef: string
contentHash: string
originalFileName?: string
mediaType?: string
occurredAt?: DateTime
issuedAt?: DateTime
receivedAt: DateTime
recordedAt: DateTime
verificationState: VerificationState
confidenceState: ConfidenceState
validity: EvidenceValidity
relation?: EvidenceRelation
sensitivityClass: StableCode
retentionPolicyRef: string
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ActionCommand".
 */
export interface ActionCommand {
clientOperationId: Uuid
tenantId: Uuid
actionCode: StableCode
actionVersion: number
target: EntityRef
containerId: Uuid
flowInstanceId?: Uuid
nodeInstanceId?: Uuid
nodeTaskId?: Uuid
workOrderId?: Uuid
occurredAt: DateTime
submittedAt: DateTime
idempotencyKey: string
expectedVersion: number
correlationId: Uuid
causationId?: Uuid
traceId: string
reasonCode?: StableCode
reason?: string
evidenceRefs: Uuid[]
confirmationToken?: string
payload: {
[k: string]: unknown
}
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ClientOperation".
 */
export interface ClientOperation {
clientOperationId: Uuid
tenantId: Uuid
actionCode: StableCode
actionVersion: number
target: EntityRef
correlationId: Uuid
causationId?: Uuid
traceId: string
idempotencyKey: string
requestHash: string
receptionState: ReceptionState
businessDecisionState: BusinessDecisionState
commitState: CommitState
resultRefs: EntityRef[]
rejectionReasonCode?: string
attemptCount: number
lastAttemptAt?: DateTime
nextAttemptAt?: DateTime
receivedAt?: DateTime
decidedAt?: DateTime
committedAt?: DateTime
createdAt: DateTime
updatedAt: DateTime
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ContainerOperationalView".
 */
export interface ContainerOperationalView {
tenantId: Uuid
containerId: Uuid
containerNumber: string
shipment?: (ContainerShipmentContextV1 | null)
flow: ({
flowInstanceId: Uuid
state: FlowInstanceState
definitionVersion: number
version: number
} | null)
currentNode: (NodeSummary | null)
nodes: NodeSummary[]
currentTimes: CurrentTimeSummary
tasks: TaskSummary[]
workOrders: WorkOrderSummary[]
professionalFacts: ProfessionalFactSummary[]
evidenceSummary: {
total: number
effective: number
pending: number
disputed: number
evidenceRefs: Uuid[]
restrictedEvidencePresent: boolean
}
syncSummary: {
operations: SyncOperationSummary[]
[k: string]: unknown
}
activeBlocks: BlockSummary[]
activeExceptions: ExceptionSummary[]
allowedActions: AllowedAction[]
projectionVersion: number
sourceVersions: {
source: StableCode
version: number
}[]
asOf: DateTime
freshness: Freshness
}
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ErrorResponse".
 */
export interface ErrorResponse {
success: false
error: {
code: PublicErrorCode
message: string
category: ErrorCategory
retryable: boolean
details: ErrorDetail[]
conflict?: ConflictDescriptor
}
traceId: string
clientOperationId?: Uuid
timestamp: DateTime
}
