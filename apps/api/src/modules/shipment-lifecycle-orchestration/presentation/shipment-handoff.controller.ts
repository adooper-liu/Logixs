import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
  InternalShipmentHandoffAcceptResultV1,
  InternalShipmentHandoffCandidatePageV1,
} from "@logix/contracts";
import { AcceptInternalShipmentHandoffService } from "../application/accept-internal-shipment-handoff.service";
import { ListInternalShipmentHandoffCandidatesService } from "../application/list-internal-shipment-handoff-candidates.service";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { AcceptShipmentHandoffService } from "../application/accept-shipment-handoff.service";
import { PreflightShipmentHandoffService } from "../application/preflight-shipment-handoff.service";
import {
  ShipmentHandoffCommandRequestDto,
  ShipmentHandoffPreflightResponseDto,
  ShipmentHandoffResultResponseDto,
  InternalShipmentHandoffAcceptRequestDto,
} from "./shipment-handoff.dto";

type IdentityRequest = {
  identity: { tenantId: string; actorId: string };
};

@ApiTags("shipment-handoffs")
@Controller("shipment-handoffs")
export class ShipmentHandoffController {
  constructor(
    private readonly preflightHandoff: PreflightShipmentHandoffService,
    private readonly acceptHandoff: AcceptShipmentHandoffService,
    private readonly listInternalCandidates: ListInternalShipmentHandoffCandidatesService,
    private readonly acceptInternalCandidate: AcceptInternalShipmentHandoffService,
  ) {}

  @Get("internal-candidates")
  @RequireCapabilities("container.read", "lifecycle.read")
  listInternal(
    @Req() request: IdentityRequest,
  ): Promise<InternalShipmentHandoffCandidatePageV1> {
    return this.listInternalCandidates.execute(request.identity);
  }

  @Post("internal-candidates/accept")
  @RequireCapabilities("import.execute")
  acceptInternal(
    @Body() body: InternalShipmentHandoffAcceptRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<InternalShipmentHandoffAcceptResultV1> {
    return this.acceptInternalCandidate.execute(body, request.identity);
  }

  @Post("preflight")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ type: ShipmentHandoffPreflightResponseDto })
  preflight(
    @Body() body: ShipmentHandoffCommandRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentHandoffPreflightResultV1> {
    return this.preflightHandoff.preflight(body, request.identity);
  }

  @Post("accept")
  @RequireCapabilities("import.execute")
  @ApiOkResponse({ type: ShipmentHandoffResultResponseDto })
  accept(
    @Body() body: ShipmentHandoffCommandRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentHandoffResultV1> {
    return this.acceptHandoff.accept(body, request.identity);
  }
}
