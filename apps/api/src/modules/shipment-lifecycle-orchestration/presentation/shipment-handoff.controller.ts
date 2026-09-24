import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { AcceptShipmentHandoffService } from "../application/accept-shipment-handoff.service";
import { PreflightShipmentHandoffService } from "../application/preflight-shipment-handoff.service";
import {
  ShipmentHandoffCommandRequestDto,
  ShipmentHandoffPreflightResponseDto,
  ShipmentHandoffResultResponseDto,
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
  ) {}

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
