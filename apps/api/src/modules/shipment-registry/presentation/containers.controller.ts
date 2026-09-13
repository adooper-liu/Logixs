import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { GetContainerService } from "../application/get-container.service";
import { ListContainersService } from "../application/list-containers.service";
import { ContainerPageDto, ContainerSummaryDto } from "./container-summary.dto";

@ApiTags("containers")
@Controller("containers")
export class ContainersController {
  constructor(
    private readonly listContainers: ListContainersService,
    private readonly getContainer: GetContainerService,
  ) {}

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

  @Get(":id")
  @ApiOkResponse({ type: ContainerSummaryDto })
  async get(
    @Req() request: { devIdentity: { tenantId: string } },
    @Param("id") id: string,
  ): Promise<ContainerSummaryDto> {
    return this.getContainer.execute({
      tenantId: request.devIdentity.tenantId,
      id,
    });
  }
}
