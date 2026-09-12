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
export type EntityType = ("container" | "flow_instance" | "node_instance" | "node_task" | "work_order" | "domain_fact" | "evidence" | "canonical_event" | "client_operation" | "receipt" | "exception" | "audit_entry")
/**
 * This interface was referenced by `LogixContractsV1`'s JSON-Schema
 * via the `definition` "ErrorCategory".
 */
export type ErrorCategory = ("validation" | "authentication" | "authorization" | "not_found" | "conflict" | "precondition" | "rate_limit" | "dependency" | "internal")
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
 * via the `definition` "PublicErrorCode".
 */
export type PublicErrorCode = ("VALIDATION_REQUIRED" | "VALIDATION_FORMAT" | "VALIDATION_RANGE" | "VALIDATION_FIELD_CONFLICT" | "AUTHENTICATION_REQUIRED" | "AUTHENTICATION_EXPIRED" | "AUTHORIZATION_FORBIDDEN" | "AUTHORIZATION_SCOPE_DENIED" | "RESOURCE_NOT_FOUND" | "RATE_LIMIT_EXCEEDED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR" | "IDEMPOTENCY_KEY_CONFLICT" | "VERSION_CONFLICT" | "HISTORY_SEALED" | "MANUAL_LOCK_CONFLICT" | "REVIEW_REQUIRED" | "CURSOR_INVALID" | "CURSOR_EXPIRED" | "PROJECTION_VERSION_CONFLICT" | "PROJECTION_UNAVAILABLE" | "ACTION_UNKNOWN" | "ACTION_TARGET_MISMATCH" | "ACTION_CONFIRMATION_REQUIRED" | "ACTION_REVIEW_REQUIRED" | "BUSINESS_STATE_VIOLATION" | "BUSINESS_PRECONDITION_FAILED" | "EVIDENCE_REQUIRED" | "SOURCE_NOT_AUTHORIZED" | "UNKNOWN_EXTERNAL_MAPPING" | "LIFECYCLE_FLOW_NOT_FOUND" | "LIFECYCLE_FLOW_ALREADY_ACTIVE" | "LIFECYCLE_DEFINITION_VERSION_UNSUPPORTED" | "LIFECYCLE_NODE_NOT_CURRENT" | "LIFECYCLE_NODE_NOT_OPTIONAL" | "LIFECYCLE_NODE_APPLICABILITY_CONFLICT" | "LIFECYCLE_EVENT_TYPE_UNKNOWN" | "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE" | "LIFECYCLE_EVENT_PENDING_PREDECESSOR" | "LIFECYCLE_SOURCE_NOT_AUTHORIZED" | "LIFECYCLE_EVIDENCE_REQUIRED" | "LIFECYCLE_GUARD_NOT_SATISFIED" | "LIFECYCLE_ACTIVE_BLOCK_EXISTS" | "LIFECYCLE_TIME_ORDER_CONFLICT" | "LIFECYCLE_HISTORY_SEALED" | "LIFECYCLE_IDEMPOTENCY_CONFLICT" | "LIFECYCLE_VERSION_CONFLICT" | "LIFECYCLE_REENTRY_NOT_ALLOWED" | "LIFECYCLE_MANUAL_REVIEW_REQUIRED" | "TIMELINE_EVENT_INVALID" | "TIMELINE_TIMEZONE_UNKNOWN" | "TIMELINE_EVENT_DUPLICATE_CONFLICT" | "TIMELINE_EVENT_RELATION_INVALID" | "TIMELINE_PROJECTION_VERSION_CONFLICT" | "TIMELINE_MANUAL_REVIEW_REQUIRED" | "CUSTOMS_CASE_NOT_FOUND" | "CUSTOMS_WORK_ORDER_NOT_FOUND" | "CUSTOMS_EXTERNAL_PAYLOAD_INVALID" | "CUSTOMS_REQUIRED_CASE_MISSING" | "CUSTOMS_RELEASE_EVIDENCE_MISSING" | "CUSTOMS_EVIDENCE_SCOPE_MISMATCH" | "CUSTOMS_WORK_ORDER_EVIDENCE_MISMATCH" | "CUSTOMS_EXTERNAL_MAPPING_UNKNOWN" | "CUSTOMS_INVALID_TRANSITION" | "CUSTOMS_ACTIVE_BLOCK_EXISTS" | "CUSTOMS_IDEMPOTENCY_CONFLICT" | "CUSTOMS_VERSION_CONFLICT" | "CUSTOMS_MANUAL_REVIEW_REQUIRED" | "DEPENDENCY_UNAVAILABLE" | "DEPENDENCY_TIMEOUT" | "DEPENDENCY_RESPONSE_INVALID" | "SYNC_MESSAGE_CONFLICT" | "SYNC_DEAD_LETTERED" | "SYNC_COMMIT_FAILED")

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
export interface CanonicalEventEnvelopeLocation {
locationType: ("port" | "terminal" | "rail_yard" | "warehouse" | "depot" | "in_transit")
unlocode?: string
locationId?: Uuid
segmentId?: Uuid
portCallId?: string
timezone: string
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
requiredCapabilities: [StableCode, ...(StableCode)[]]
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
capabilities: StableCode[]
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
