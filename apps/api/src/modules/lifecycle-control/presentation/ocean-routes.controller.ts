import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Put,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ReplaceOceanRouteService } from "../application/replace-ocean-route.service";
import { GetCurrentOceanRouteService } from "../application/get-current-ocean-route.service";
import {
  OceanRouteProjectionDto,
  ReplaceOceanRouteRequestDto,
  ReplaceOceanRouteResponseDto,
} from "./ocean-route.dto";

interface OceanRouteRequestIdentity {
  actorId: string;
  tenantId: string;
  capabilities: string[];
}

@ApiTags("containers")
@Controller("containers/:containerId/ocean-route")
export class OceanRoutesController {
  constructor(
    private readonly replaceOceanRoute: ReplaceOceanRouteService,
    private readonly getCurrentOceanRoute: GetCurrentOceanRouteService,
  ) {}

  @Get()
  @RequireCapabilities("lifecycle.read")
  @ApiOkResponse({ type: OceanRouteProjectionDto })
  getCurrent(
    @Param("containerId") containerId: string,
    @Req() request: { identity: OceanRouteRequestIdentity },
  ): Promise<OceanRouteProjectionDto> {
    return this.getCurrentOceanRoute.execute({
      tenantId: request.identity.tenantId,
      containerId,
    });
  }

  @Put()
  @RequireCapabilities("lifecycle.operate")
  @ApiOkResponse({ type: ReplaceOceanRouteResponseDto })
  replace(
    @Param("containerId") containerId: string,
    @Body() body: ReplaceOceanRouteRequestDto,
    @Headers("x-trace-id") traceId: string | undefined,
    @Req() request: { identity: OceanRouteRequestIdentity },
  ): Promise<ReplaceOceanRouteResponseDto> {
    return this.replaceOceanRoute.execute({
      tenantId: request.identity.tenantId,
      containerId,
      segments: body.segments,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.manual",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      traceId: normalizedTraceId(traceId),
      actorCapabilities: request.identity.capabilities,
    });
  }
}

function normalizedTraceId(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 128 ? normalized : randomUUID();
}
