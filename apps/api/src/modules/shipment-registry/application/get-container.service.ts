import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { ContainerSummary } from "../domain/container-summary";
import {
  CONTAINER_REPOSITORY,
  type ContainerRepository,
} from "../domain/container.repository";

export interface GetContainerInput {
  tenantId?: string;
  id?: string;
}

@Injectable()
export class GetContainerService {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly repository: ContainerRepository,
  ) {}

  async execute(input: GetContainerInput): Promise<ContainerSummary> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED",
        HttpStatus.FORBIDDEN,
      );
    }
    const id = input.id?.trim() ?? "";
    if (!id) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const record = await this.repository.findById({ tenantId, id });
    if (!record) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return record;
  }
}
