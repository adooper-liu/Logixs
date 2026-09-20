import { createHash, randomUUID } from "node:crypto";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  CanonicalEventCode,
  LifecycleDateFactCommand,
  LifecycleDateFactResult,
  LifecycleNodeCode,
} from "@logix/contracts";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import {
  APPLY_LIFECYCLE_EVENT_ONCE,
  type ApplyLifecycleEventOncePort,
} from "../apply-lifecycle-event-once.port";
import {
  EVALUATE_LIFECYCLE_DATE_AUTHORITY,
  type EvaluateLifecycleDateAuthorityPort,
} from "../evaluate-lifecycle-date-authority.port";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";
import type { LifecycleDateApplicationState } from "../domain/lifecycle-date-fact";
import { classifyLifecycleApplicationFailure } from "./lifecycle-application-failure";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";

const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;
const OFFSET_PATTERN = /^(?:[+-](?:0[0-9]|1[0-3]):[0-5][0-9]|[+-]14:00)$/;
const INGESTION_CHANNELS = [
  "api",
  "webhook",
  "file_import",
  "manual_ui",
] as const;
const CAPTURE_SOURCES = [
  "external_evidence",
  "manual_backfill",
  "controlled_import",
  "internal_operation",
  "system_derived",
] as const;
const VERIFICATION_STATES = [
  "pending",
  "verified",
  "rejected",
  "revoked",
] as const;
const CONFIDENCE_STATES = [
  "confirmed",
  "provisional",
  "disputed",
  "unknown",
] as const;
const VALIDITIES = ["effective", "superseded", "corrected", "revoked"] as const;

export interface RecordLifecycleDateFactInput extends LifecycleDateFactCommand {
  actorCapabilities?: readonly string[];
  /** @deprecated 兼容旧内部调用；运行时裁决器会忽略该值。 */
  authorityPolicyValidated?: boolean;
  authorityContext?: {
    jurisdiction?: string;
    direction?: string;
    locationRole?: string;
    transportMode?: string;
  };
  completeInbox?: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

type NormalizedLifecycleDateFactCommand = Omit<
  LifecycleDateFactCommand,
  "occurredAt" | "supersedesFactId" | "authorityPolicyRef"
> & {
  occurredAt: Date;
  supersedesFactId?: string;
  authorityContext?: RecordLifecycleDateFactInput["authorityContext"];
};

@Injectable()
export class RecordLifecycleDateFactService {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly repository: LifecycleDateFactRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(APPLY_LIFECYCLE_EVENT_ONCE)
    private readonly applyLifecycleEvent: ApplyLifecycleEventOncePort,
    @Inject(EVALUATE_LIFECYCLE_DATE_AUTHORITY)
    private readonly evaluateAuthority: EvaluateLifecycleDateAuthorityPort,
    @Inject(ReplayPendingLifecycleDateFactsService)
    private readonly replayPending: ReplayPendingLifecycleDateFactsService,
  ) {}

  async execute(
    input: RecordLifecycleDateFactInput,
  ): Promise<LifecycleDateFactResult> {
    const normalized = normalizeCommand(input);
    const completeInbox = input.completeInbox;
    await this.assertContainerTenant.execute({
      tenantId: normalized.tenantId,
      containerId: normalized.containerId,
    });
    assertManualAuthorization(normalized, input.actorCapabilities ?? []);

    const application = await this.decideInitialApplication(normalized);
    if (application.state === "pending_application") {
      await this.assertEvidenceRefs.execute({
        tenantId: normalized.tenantId,
        subjectType: "container",
        subjectId: normalized.containerId,
        evidenceIds: normalized.evidenceRefs,
      });
    }

    const { authorityContext: _authorityContext, ...fact } = normalized;
    void _authorityContext;
    const appended = await this.repository.append({
      ...fact,
      id: randomUUID(),
      provider: normalized.provider ?? null,
      interfaceCode: normalized.interfaceCode ?? null,
      sourceEventId: normalized.sourceEventId ?? null,
      mappingVersion: normalized.mappingVersion ?? null,
      authorityPolicyRef: application.policyRef,
      actorId: normalized.actorId ?? null,
      reasonCode: normalized.reasonCode ?? null,
      payloadHash: hashCommand(normalized),
      supersedesFactId: normalized.supersedesFactId ?? null,
      applicationState: application.state,
      applicationReasonCode: application.reasonCode,
      canonicalEventId: null,
      receivedAt: new Date(),
      completeInbox,
    });
    if (appended.duplicate) {
      if (appended.record.applicationState === "pending_application") {
        await this.replayPending.execute({
          tenantId: appended.record.tenantId,
          containerId: appended.record.containerId,
        });
      }
      return toResult(appended.record, "duplicate");
    }
    if (application.state !== "pending_application") {
      return toResult(appended.record, "recorded");
    }

    try {
      const lifecycle = await this.applyLifecycleEvent.execute({
        containerId: normalized.containerId,
        tenantId: normalized.tenantId,
        eventCode: normalized.eventCode,
        occurredAt: normalized.occurredAt,
        idempotencyKey: `date-fact:${appended.record.id}`,
        evidenceRefs: normalized.evidenceRefs,
        domainFactId: appended.record.id,
        traceId: normalized.traceId,
      });
      if ((lifecycle.pendingNodes?.length ?? 0) > 0) {
        const pendingNode = lifecycle.pendingNodes[0];
        const pending = await this.repository.updateApplication({
          factId: appended.record.id,
          state: "pending_application",
          reasonCode:
            (pendingNode && lifecycle.pendingReasonCodes[pendingNode]) ??
            "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
          canonicalEventId: null,
        });
        return toResult(pending, "recorded");
      }
      const applied = await this.repository.updateApplication({
        factId: appended.record.id,
        state: "applied",
        reasonCode: null,
        canonicalEventId: lifecycle.canonicalEventId,
      });
      await this.replayPending.execute({
        tenantId: normalized.tenantId,
        containerId: normalized.containerId,
      });
      return toResult(applied, "recorded");
    } catch (error) {
      const failure = classifyLifecycleApplicationFailure(error);
      const updated = await this.repository.updateApplication({
        factId: appended.record.id,
        state: failure.state,
        reasonCode: failure.reasonCode,
        canonicalEventId: null,
      });
      return toResult(updated, "recorded");
    }
  }

  private async decideInitialApplication(
    input: NormalizedLifecycleDateFactCommand,
  ): Promise<{
    state: LifecycleDateApplicationState;
    reasonCode: string | null;
    policyRef: string | null;
  }> {
    if (input.timeKind !== "actual") {
      return { state: "not_applicable", reasonCode: null, policyRef: null };
    }
    if (
      input.verificationState !== "verified" ||
      input.confidenceState !== "confirmed" ||
      input.validity !== "effective"
    ) {
      return {
        state: "review_required",
        reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
        policyRef: null,
      };
    }
    try {
      const authority = await this.evaluateAuthority.execute({
        tenantId: input.tenantId,
        containerId: input.containerId,
        eventCode: input.eventCode,
        timeKind: input.timeKind,
        occurredAt: input.occurredAt,
        captureSource: input.captureSource,
        authoritySystem: input.authoritySystem,
        evidenceRefs: input.evidenceRefs,
        ...input.authorityContext,
      });
      if (authority.state !== "accepted") {
        return {
          state: "review_required",
          reasonCode:
            authority.reasonCode ?? "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          policyRef: authority.policyRef,
        };
      }
      return {
        state: "pending_application",
        reasonCode: null,
        policyRef: authority.policyRef,
      };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith(
          "SOURCE_AUTHORITY_POLICY_CONFIGURATION_INVALID",
        )
      ) {
        throw error;
      }
      return {
        state: "review_required",
        reasonCode: "SOURCE_AUTHORITY_CONFIGURATION_ERROR",
        policyRef: null,
      };
    }
  }
}

function normalizeCommand(
  input: RecordLifecycleDateFactInput,
): NormalizedLifecycleDateFactCommand {
  const {
    actorCapabilities: _actorCapabilities,
    authorityPolicyValidated: _authorityPolicyValidated,
    authorityContext: rawAuthorityContext,
    completeInbox: _completeInbox,
    authorityPolicyRef: _claimedAuthorityPolicyRef,
    ...command
  } = input;
  void _actorCapabilities;
  void _authorityPolicyValidated;
  void _completeInbox;
  void _claimedAuthorityPolicyRef;
  const event = canonicalEvents.find(
    (candidate) => candidate.eventCode === command.eventCode,
  );
  if (!event || !event.allowedTimeKinds.includes(command.timeKind)) {
    throw new HttpException(
      "VALIDATION_FORMAT: 事件不允许该时间种类",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (event.defaultNodeCode !== command.nodeCode) {
    throw new HttpException(
      "VALIDATION_FORMAT: 事件与节点不匹配",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    typeof command.occurredAt !== "string" ||
    !TIME_WITH_OFFSET.test(command.occurredAt)
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: 日期必须包含时区",
      HttpStatus.BAD_REQUEST,
    );
  }
  const occurredAt = new Date(command.occurredAt);
  if (
    Number.isNaN(occurredAt.getTime()) ||
    typeof command.sourceUtcOffset !== "string" ||
    !OFFSET_PATTERN.test(command.sourceUtcOffset)
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: 日期或来源时区无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  assertEnum(command.ingestionChannel, INGESTION_CHANNELS, "ingestionChannel");
  assertEnum(command.captureSource, CAPTURE_SOURCES, "captureSource");
  assertEnum(
    command.verificationState,
    VERIFICATION_STATES,
    "verificationState",
  );
  assertEnum(command.confidenceState, CONFIDENCE_STATES, "confidenceState");
  assertEnum(command.validity, VALIDITIES, "validity");
  const strings = [
    command.tenantId,
    command.containerId,
    command.rawValue,
    command.sourceSystem,
    command.authoritySystem,
    command.idempotencyKey,
    command.traceId,
  ];
  if (strings.some((value) => typeof value !== "string" || !value.trim())) {
    throw new HttpException(
      "VALIDATION_FORMAT: 日期事实字段不能为空",
      HttpStatus.BAD_REQUEST,
    );
  }
  assertMaxLength(command.rawValue, 200, "rawValue");
  assertMaxLength(command.sourceSystem, 64, "sourceSystem");
  assertMaxLength(command.authoritySystem, 64, "authoritySystem");
  assertMaxLength(command.idempotencyKey, 200, "idempotencyKey");
  assertMaxLength(command.traceId, 128, "traceId");
  if (
    !Array.isArray(command.evidenceRefs) ||
    command.evidenceRefs.some(
      (reference) => typeof reference !== "string" || !reference.trim(),
    )
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: evidenceRefs 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (command.timeKind === "actual" && command.evidenceRefs.length === 0) {
    throw new HttpException(
      "EVIDENCE_REQUIRED: 实际日期缺少证据",
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (
    command.expectedVersion !== undefined &&
    (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0)
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: expectedVersion 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  const provider = normalizeOptional(command.provider, 64, "provider");
  const interfaceCode = normalizeOptional(
    command.interfaceCode,
    100,
    "interfaceCode",
  );
  const sourceEventId = normalizeOptional(
    command.sourceEventId,
    200,
    "sourceEventId",
  );
  const mappingVersion = normalizeOptional(
    command.mappingVersion,
    100,
    "mappingVersion",
  );
  const actorId = normalizeOptional(command.actorId, 100, "actorId");
  const reasonCode = normalizeOptional(command.reasonCode, 64, "reasonCode");
  const supersedesFactId = normalizeOptional(
    command.supersedesFactId,
    100,
    "supersedesFactId",
  );
  const authorityContext = normalizeAuthorityContext(rawAuthorityContext);
  return {
    ...command,
    tenantId: command.tenantId.trim(),
    containerId: command.containerId.trim(),
    nodeCode: command.nodeCode as LifecycleNodeCode,
    eventCode: command.eventCode as CanonicalEventCode,
    occurredAt,
    rawValue: command.rawValue.trim(),
    sourceSystem: command.sourceSystem.trim(),
    authoritySystem: command.authoritySystem.trim(),
    provider,
    interfaceCode,
    sourceEventId,
    mappingVersion,
    evidenceRefs: [...new Set(command.evidenceRefs.map((item) => item.trim()))],
    actorId,
    reasonCode,
    idempotencyKey: command.idempotencyKey.trim(),
    traceId: command.traceId.trim(),
    supersedesFactId,
    authorityContext,
  };
}

function normalizeAuthorityContext(
  value: RecordLifecycleDateFactInput["authorityContext"],
): RecordLifecycleDateFactInput["authorityContext"] {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpException(
      "VALIDATION_FORMAT: authorityContext 无效",
      HttpStatus.BAD_REQUEST,
    );
  }
  const normalized = {
    jurisdiction: normalizeOptional(value.jurisdiction, 32, "jurisdiction"),
    direction: normalizeOptional(value.direction, 64, "direction"),
    locationRole: normalizeOptional(value.locationRole, 64, "locationRole"),
    transportMode: normalizeOptional(value.transportMode, 64, "transportMode"),
  };
  return Object.values(normalized).some((item) => item !== undefined)
    ? normalized
    : undefined;
}

function assertManualAuthorization(
  input: ReturnType<typeof normalizeCommand>,
  capabilities: readonly string[],
): void {
  if (input.ingestionChannel !== "manual_ui") return;
  if (
    input.captureSource !== "manual_backfill" ||
    !input.actorId ||
    !input.reasonCode ||
    input.expectedVersion === undefined
  ) {
    throw new HttpException(
      "VALIDATION_FORMAT: 人工录入缺少操作者、原因或版本",
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!capabilities.includes("lifecycle.operate")) {
    throw new ForbiddenException("CAPABILITY_DENIED");
  }
  if (
    input.timeKind === "actual" &&
    input.confidenceState === "confirmed" &&
    !capabilities.includes("evidence.review")
  ) {
    throw new ForbiddenException("CAPABILITY_DENIED");
  }
}

function hashCommand(input: NormalizedLifecycleDateFactCommand): string {
  const payload = {
    ...input,
    occurredAt: input.occurredAt.toISOString(),
    evidenceRefs: [...input.evidenceRefs].sort(),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function assertEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new HttpException(
      `VALIDATION_FORMAT: 未知 ${field}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertMaxLength(value: string, maximum: number, field: string): void {
  if (value.length > maximum) {
    throw new HttpException(
      `VALIDATION_FORMAT: ${field} 超出长度限制`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

function normalizeOptional(
  value: unknown,
  maximum: number,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new HttpException(
      `VALIDATION_FORMAT: ${field} 无效`,
      HttpStatus.BAD_REQUEST,
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new HttpException(
      `VALIDATION_FORMAT: ${field} 无效`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return normalized;
}

function toResult(
  record: Awaited<ReturnType<LifecycleDateFactRepository["updateApplication"]>>,
  recordState: LifecycleDateFactResult["recordState"],
): LifecycleDateFactResult {
  return {
    factId: record.id,
    recordState,
    applicationState: record.applicationState,
    reasonCode: record.applicationReasonCode,
    canonicalEventId: record.canonicalEventId,
    projectionVersion: record.projectionVersion,
  };
}
