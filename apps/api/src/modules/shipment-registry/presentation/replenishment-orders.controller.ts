import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ListReplenishmentOrdersService } from "../application/list-replenishment-orders.service";
import { ReplenishmentOrderPageDto } from "./replenishment-orders.dto";

@ApiTags("replenishment-orders")
@Controller("replenishment-orders")
export class ReplenishmentOrdersController {
  constructor(
    private readonly listReplenishmentOrders: ListReplenishmentOrdersService,
  ) {}

  @Get()
  @RequireCapabilities("container.read")
  @ApiOkResponse({ type: ReplenishmentOrderPageDto })
  async list(
    @Req() request: { identity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ReplenishmentOrderPageDto> {
    const page = await this.listReplenishmentOrders.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
    return { ...page, asOf: page.asOf.toISOString() };
  }
}
