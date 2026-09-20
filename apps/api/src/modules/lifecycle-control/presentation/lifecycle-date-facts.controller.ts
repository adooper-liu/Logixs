import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListLifecycleDateFactsService } from "../application/list-lifecycle-date-facts.service";
import { RecordLifecycleDateFactService } from "../application/record-lifecycle-date-fact.service";
import {
  LifecycleDateFactProjectionDto,
  RecordLifecycleDateFactRequestDto,
  RecordLifecycleDateFactResponseDto,
} from "./lifecycle-date-fact.dto";

interface DateFactRequestIdentity {
  actorId: string;
  tenantId: string;
  capabilities: string[];
}

@ApiTags("containers")
@Controller("containers/:containerId/date-facts")
export class LifecycleDateFactsController {
  constructor(
    private readonly recordDateFact: RecordLifecycleDateFactService,
    private readonly listDateFacts: ListLifecycleDateFactsService,
  ) {}

  @Post()
  @RequireCapabilities("lifecycle.operate")
  @ApiOkResponse({ type: RecordLifecycleDateFactResponseDto })
  async record(
    @Param("containerId") containerId: string,
    @Body() body: RecordLifecycleDateFactRequestDto,
    @Headers("x-trace-id") traceId: string | undefined,
    @Req() request: { identity: DateFactRequestIdentity },
  ): Promise<RecordLifecycleDateFactResponseDto> {
    const actual = body.timeKind === "actual";
    const result = await this.recordDateFact.execute({
      tenantId: request.identity.tenantId,
      containerId,
      nodeCode: body.nodeCode as LifecycleNodeCode,
      eventCode: body.eventCode as CanonicalEventCode,
      timeKind: body.timeKind,
      occurredAt: body.occurredAt,
      rawValue: body.rawValue,
      sourceUtcOffset: body.sourceUtcOffset,
      ingestionChannel: "manual_ui",
      captureSource: "manual_backfill",
      sourceSystem: "logix.manual",
      authoritySystem: body.authoritySystem,
      location: body.location,
      verificationState: actual ? "pending" : "verified",
      confidenceState: actual ? "unknown" : "provisional",
      validity: "effective",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      expectedVersion: body.expectedVersion,
      supersedesFactId: body.supersedesFactId,
      idempotencyKey: body.idempotencyKey,
      traceId: normalizedTraceId(traceId),
      actorCapabilities: request.identity.capabilities,
    });
    return {
      ...result,
      reasonCode: result.reasonCode ?? null,
      canonicalEventId: result.canonicalEventId ?? null,
    };
  }

  @Get()
  @RequireCapabilities("lifecycle.read")
  @ApiOkResponse({ type: LifecycleDateFactProjectionDto })
  async list(
    @Param("containerId") containerId: string,
    @Req() request: { identity: DateFactRequestIdentity },
  ): Promise<LifecycleDateFactProjectionDto> {
    const projection = await this.listDateFacts.execute({
      tenantId: request.identity.tenantId,
      containerId,
    });
    return {
      items: projection.items.map((item) => ({
        factId: item.id,
        nodeCode: item.nodeCode,
        eventCode: item.eventCode,
        timeKind: item.timeKind,
        occurredAt: item.occurredAt.toISOString(),
        rawValue: item.rawValue,
        sourceUtcOffset: item.sourceUtcOffset,
        ingestionChannel: item.ingestionChannel,
        captureSource: item.captureSource,
        sourceSystem: item.sourceSystem,
        authoritySystem: item.authoritySystem,
        verificationState: item.verificationState,
        confidenceState: item.confidenceState,
        validity: item.validity,
        authorityPolicyRef: item.authorityPolicyRef,
        location: item.location,
        evidenceRefs: item.evidenceRefs,
        applicationState: item.applicationState,
        applicationReasonCode: item.applicationReasonCode,
        canonicalEventId: item.canonicalEventId,
        projectionVersion: item.projectionVersion,
        recordedAt: item.recordedAt.toISOString(),
      })),
      projectionVersion: projection.projectionVersion,
      asOf: projection.asOf.toISOString(),
    };
  }
}

function normalizedTraceId(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 128 ? normalized : randomUUID();
}
