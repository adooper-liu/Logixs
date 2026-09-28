import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  ShipmentWorkHandoffQueuePageV1,
  ShipmentWorkHandoffV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import {
  ClaimWorkHandoffService,
  CloseWorkHandoffService,
  ListShipmentWorkHandoffsService,
  ListWorkHandoffQueueService,
  RaiseWorkHandoffService,
} from "../application/shipment-work-handoff.services";
import {
  ShipmentWorkHandoffClaimRequestDto,
  ShipmentWorkHandoffCloseRequestDto,
  ShipmentWorkHandoffQueuePageResponseDto,
  ShipmentWorkHandoffRaiseRequestDto,
  ShipmentWorkHandoffResponseDto,
} from "./shipment-work-handoff.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

/**
 * 事项交接：出运运营把票级事项交给**专业岗位队列**，该岗位领取、了结。
 *
 * **权限码这里有个讲究**：交出去用 `planning.draft`（那是出运运营的活），
 * 而**领取与了结用 `task.execute`** —— 现场作业人员的角色包里没有 `planning.draft`，
 * 用错码会把真正干活的人挡在门外。
 */
@ApiTags("shipment-work-handoffs")
@Controller("work-handoffs")
export class ShipmentWorkHandoffsController {
  constructor(
    private readonly listQueue: ListWorkHandoffQueueService,
    private readonly listByShipment: ListShipmentWorkHandoffsService,
    private readonly raiseHandoff: RaiseWorkHandoffService,
    private readonly claimHandoff: ClaimWorkHandoffService,
    private readonly closeHandoff: CloseWorkHandoffService,
  ) {}

  @Get("queue")
  @RequireCapabilities("container.read")
  @ApiQuery({
    name: "recipient",
    required: true,
    enum: ["customs", "pickup", "delivery", "unloading"],
  })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ShipmentWorkHandoffQueuePageResponseDto })
  queue(
    @Req() request: IdentityRequest,
    @Query("recipient") recipient?: string,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ShipmentWorkHandoffQueuePageV1> {
    return this.listQueue.execute({
      tenantId: request.identity.tenantId,
      recipientQueueCode: recipient,
      pageSize,
      cursor,
    });
  }

  @Get("by-shipment/:shipmentId")
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: [ShipmentWorkHandoffResponseDto] })
  byShipment(
    @Req() request: IdentityRequest,
    @Param("shipmentId") shipmentId: string,
  ): Promise<ShipmentWorkHandoffV1[]> {
    return this.listByShipment.execute({
      tenantId: request.identity.tenantId,
      shipmentId,
    });
  }

  @Post()
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ShipmentWorkHandoffResponseDto })
  raise(
    @Req() request: IdentityRequest,
    @Body() body: ShipmentWorkHandoffRaiseRequestDto,
  ): Promise<ShipmentWorkHandoffV1> {
    return this.raiseHandoff.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      command: body,
    });
  }

  @Post(":handoffId/claims")
  @RequireCapabilities("task.execute")
  @ApiOkResponse({ type: ShipmentWorkHandoffResponseDto })
  claim(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
    @Body() body: ShipmentWorkHandoffClaimRequestDto,
  ): Promise<ShipmentWorkHandoffV1> {
    return this.claimHandoff.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      handoffId,
      command: body,
    });
  }

  @Post(":handoffId/closures")
  @RequireCapabilities("task.execute")
  @ApiOkResponse({ type: ShipmentWorkHandoffResponseDto })
  close(
    @Req() request: IdentityRequest,
    @Param("handoffId") handoffId: string,
    @Body() body: ShipmentWorkHandoffCloseRequestDto,
  ): Promise<ShipmentWorkHandoffV1> {
    return this.closeHandoff.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      handoffId,
      command: body,
    });
  }
}
