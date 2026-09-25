import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  ShipmentDetailV1,
  ShipmentPageV1,
  ShipmentPendingCompletionPageV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetShipmentService } from "../application/get-shipment.service";
import { ListShipmentPendingCompletionService } from "../application/list-shipment-pending-completion.service";
import { ListShipmentsService } from "../application/list-shipments.service";
import {
  ShipmentDetailDto,
  ShipmentPageDto,
  ShipmentPendingCompletionPageDto,
} from "./shipment.dto";

type IdentityRequest = { identity: { tenantId: string } };

@ApiTags("shipments")
@Controller("shipments")
export class ShipmentsController {
  constructor(
    private readonly listShipments: ListShipmentsService,
    private readonly getShipment: GetShipmentService,
    private readonly listPendingCompletion: ListShipmentPendingCompletionService,
  ) {}

  @Get()
  @RequireCapabilities("container.read", "lifecycle.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "departed",
      "in_transit",
      "arrived",
      "customs_clearance",
      "released",
      "picked_up",
      "delivered_to_warehouse",
      "closed",
    ],
  })
  @ApiOkResponse({ type: ShipmentPageDto })
  list(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
    @Query("status") status?: string,
  ): Promise<ShipmentPageV1> {
    return this.listShipments.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
      status,
    });
  }

  @Get("pending-completion")
  @RequireCapabilities("container.read", "lifecycle.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ShipmentPendingCompletionPageDto })
  listPending(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ShipmentPendingCompletionPageV1> {
    return this.listPendingCompletion.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Get(":id")
  @RequireCapabilities("container.read", "lifecycle.read")
  @ApiOkResponse({ type: ShipmentDetailDto })
  get(
    @Req() request: IdentityRequest,
    @Param("id") id: string,
  ): Promise<ShipmentDetailV1> {
    return this.getShipment.execute({
      tenantId: request.identity.tenantId,
      id,
    });
  }
}
