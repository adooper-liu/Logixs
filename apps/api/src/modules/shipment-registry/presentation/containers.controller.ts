import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { ContainerOperationalView } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetContainerService } from "../application/get-container.service";
import { GetContainerCargoComplianceScopeService } from "../application/get-container-cargo-compliance-scope.service";
import { GetContainerOperationalViewService } from "../application/get-container-operational-view.service";
import { ListContainersService } from "../application/list-containers.service";
import { ContainerCargoScopeDto } from "./container-cargo-scope.dto";
import { ContainerOperationalViewDto } from "./container-operational-view.dto";
import { ContainerPageDto, ContainerSummaryDto } from "./container-summary.dto";

@ApiTags("containers")
@Controller("containers")
export class ContainersController {
  constructor(
    private readonly listContainers: ListContainersService,
    private readonly getContainer: GetContainerService,
    private readonly getContainerCargo: GetContainerCargoComplianceScopeService,
    private readonly getContainerOperationalView: GetContainerOperationalViewService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ContainerPageDto })
  async list(
    @Req() request: { identity: { tenantId: string } },
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ContainerPageDto> {
    const page = await this.listContainers.execute({
      tenantId: request.identity.tenantId,
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

  @Get(":id/cargo")
  @ApiOkResponse({ type: ContainerCargoScopeDto })
  async getCargo(
    @Req() request: { identity: { tenantId: string } },
    @Param("id") id: string,
  ): Promise<ContainerCargoScopeDto> {
    const container = await this.getContainer.execute({
      tenantId: request.identity.tenantId,
      id,
    });
    const scope = await this.getContainerCargo.execute({
      tenantId: request.identity.tenantId,
      containerRecordId: container.id,
    });
    return scope
      ? {
          containerRecordId: scope.containerRecordId,
          allocationSetId: scope.allocationSetId,
          allocationSetVersion: scope.allocationSetVersion,
          items: scope.items,
        }
      : {
          containerRecordId: container.id,
          allocationSetId: null,
          allocationSetVersion: null,
          items: [],
        };
  }

  @Get(":id/operational-view")
  @RequireCapabilities("container.read", "lifecycle.read")
  @ApiOkResponse({ type: ContainerOperationalViewDto })
  getOperationalView(
    @Req()
    request: {
      identity: { tenantId: string; capabilities: string[] };
    },
    @Param("id") id: string,
  ): Promise<ContainerOperationalView> {
    return this.getContainerOperationalView.execute({
      tenantId: request.identity.tenantId,
      containerId: id,
      capabilities: request.identity.capabilities,
    });
  }

  @Get(":id")
  @ApiOkResponse({ type: ContainerSummaryDto })
  async get(
    @Req() request: { identity: { tenantId: string } },
    @Param("id") id: string,
  ): Promise<ContainerSummaryDto> {
    return this.getContainer.execute({
      tenantId: request.identity.tenantId,
      id,
    });
  }
}
