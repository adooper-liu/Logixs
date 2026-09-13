import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { ClientOperationRecord } from "../domain/client-operation";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";

@Injectable()
export class GetClientOperationService {
  constructor(
    @Inject(CLIENT_OPERATION_REPOSITORY)
    private readonly operations: ClientOperationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    id: string;
  }): Promise<ClientOperationRecord> {
    const tenantId = input.tenantId.trim();
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const record = await this.operations.findById(input.id.trim());
    if (!record || record.tenantId !== tenantId) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return record;
  }
}
