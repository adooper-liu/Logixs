import { Controller, Get } from "@nestjs/common";
import { ListContainersService } from "../application/list-containers.service";
import type { ContainerSummary } from "../domain/container-summary";

@Controller("containers")
export class ContainersController {
  constructor(private readonly listContainers: ListContainersService) {}

  @Get()
  list(): Promise<ContainerSummary[]> {
    return this.listContainers.list();
  }
}
