import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";

export interface AssertContainerTenantInput {
  containerId: string;
  tenantId: string;
}

@Injectable()
export class AssertContainerTenantService {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  async execute(input: AssertContainerTenantInput): Promise<void> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const tenantId = await this.repository.findTenantId(input.containerId);
    if (tenantId === null) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (tenantId !== input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
  }
}
