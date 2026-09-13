import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListContainersService } from "../application/list-containers.service";
import { ContainerPageDto } from "./container-summary.dto";

@ApiTags("containers")
@Controller("containers")
export class ContainersController {
  constructor(private readonly listContainers: ListContainersService) {}

  @Get()
  @ApiOkResponse({ type: ContainerPageDto })
  async list(
    @Req() request: { devIdentity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ContainerPageDto> {
    const page = await this.listContainers.execute({
      tenantId: request.devIdentity.tenantId,
      pageSize,
      cursor,
    });
    return {
      items: page.items,
      pageInfo: page.pageInfo,
      asOf: page.asOf.toISOString(),
      projectionVersion: page.projectionVersion,
    };
  }
}
