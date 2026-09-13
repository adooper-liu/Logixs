import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CompensationRecord } from "../domain/compensation";
import {
  COMPENSATION_REPOSITORY,
  type CompensationRepository,
} from "../domain/compensation.repository";

@Injectable()
export class GetCompensationService {
  constructor(
    @Inject(COMPENSATION_REPOSITORY)
    private readonly compensations: CompensationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    originalClientOperationId: string;
    compensationId: string;
  }): Promise<CompensationRecord> {
    const tenantId = input.tenantId.trim();
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const record = await this.compensations.findById(
      input.compensationId.trim(),
    );
    if (
      !record ||
      record.tenantId !== tenantId ||
      record.originalClientOperationId !== input.originalClientOperationId.trim()
    ) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    return record;
  }
}
