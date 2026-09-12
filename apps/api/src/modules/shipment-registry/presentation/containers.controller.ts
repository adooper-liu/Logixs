import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListContainersService } from "../application/list-containers.service";
import type { ContainerSummary } from "../domain/container-summary";
import { ContainerSummaryDto } from "./container-summary.dto";

@ApiTags("containers")
@Controller("containers")
export class ContainersController {
  constructor(private readonly listContainers: ListContainersService) {}

  @Get()
  @ApiOkResponse({ type: ContainerSummaryDto, isArray: true })
  list(): Promise<ContainerSummary[]> {
    return this.listContainers.list();
  }
}
