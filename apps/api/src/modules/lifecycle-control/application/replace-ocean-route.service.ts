import { randomUUID } from "node:crypto";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  OceanRouteWriteCommand,
  OceanRouteWriteResult,
} from "@logix/contracts";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import {
  hashOceanRouteCommand,
  normalizeOceanRouteCommand,
  OceanRouteCommandError,
  type NormalizedOceanRouteWriteCommand,
  type OceanRouteWriteCommandInput,
} from "../domain/ocean-route";
import {
  OCEAN_ROUTE_REPOSITORY,
  type OceanRouteRepository,
} from "../domain/ocean-route.repository";
import { ReplayPendingLifecycleDateFactsService } from "./replay-pending-lifecycle-date-facts.service";

export interface ReplaceOceanRouteInput extends OceanRouteWriteCommandInput {
  actorCapabilities?: readonly string[];
}

@Injectable()
export class ReplaceOceanRouteService {
  constructor(
    @Inject(OCEAN_ROUTE_REPOSITORY)
    private readonly repository: OceanRouteRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(ReplayPendingLifecycleDateFactsService)
    private readonly replayPending: ReplayPendingLifecycleDateFactsService,
  ) {}

  async execute(input: ReplaceOceanRouteInput): Promise<OceanRouteWriteResult> {
    let normalized: NormalizedOceanRouteWriteCommand;
    try {
      normalized = normalizeOceanRouteCommand(input);
    } catch (error) {
      if (!(error instanceof OceanRouteCommandError)) throw error;
      const code = error.message.split(":", 1)[0];
      const status =
        code === "EVIDENCE_REQUIRED"
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(error.message, status);
    }
    assertManualAuthorization(
      normalized.ingestionChannel,
      input.actorCapabilities ?? [],
    );
    await this.assertContainerTenant.execute({
      tenantId: normalized.tenantId,
      containerId: normalized.containerId,
    });
    await this.assertEvidenceRefs.execute({
      tenantId: normalized.tenantId,
      subjectType: "container",
      subjectId: normalized.containerId,
      evidenceIds: normalized.evidenceRefs,
    });

    let saved;
    try {
      saved = await this.repository.replace({
        ...normalized,
        routePlanId: randomUUID(),
        segmentIds: normalized.segments.map(() => randomUUID()),
        payloadHash: hashOceanRouteCommand(normalized),
        activatedAt: new Date(),
      });
    } catch (error) {
      throw mapRepositoryError(error);
    }
    const replay = await this.replayPending.execute({
      tenantId: normalized.tenantId,
      containerId: normalized.containerId,
    });
    return {
      routePlanId: saved.record.routePlanId,
      recordState: saved.duplicate ? "duplicate" : "recorded",
      version: saved.record.version,
      segments: saved.record.segments as OceanRouteWriteResult["segments"],
      replay,
    };
  }
}

function assertManualAuthorization(
  ingestionChannel: OceanRouteWriteCommand["ingestionChannel"],
  capabilities: readonly string[],
): void {
  if (ingestionChannel !== "manual_ui") return;
  if (!capabilities.includes("lifecycle.operate")) {
    throw new ForbiddenException("CAPABILITY_DENIED");
  }
}

function mapRepositoryError(error: unknown): HttpException {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  if (code === "RESOURCE_NOT_FOUND") {
    return new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
  }
  if (
    code === "LIFECYCLE_VERSION_CONFLICT" ||
    code === "LIFECYCLE_IDEMPOTENCY_CONFLICT"
  ) {
    return new HttpException(code, HttpStatus.CONFLICT);
  }
  return new HttpException("INTERNAL_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
}
