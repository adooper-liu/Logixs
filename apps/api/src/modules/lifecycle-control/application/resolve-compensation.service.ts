import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  applyCompensationResolve,
  decideResolveCompensation,
  parseCompensationResolveState,
  parseCompensationResultRefs,
  type CompensationRecord,
} from "../domain/compensation";
import {
  COMPENSATION_REPOSITORY,
  type CompensationRepository,
} from "../domain/compensation.repository";

export interface ResolveCompensationInput {
  originalClientOperationId: string;
  compensationId: string;
  tenantId: string;
  state: string;
  resultRefs?: unknown;
}

export interface ResolveCompensationResult {
  compensationId: string;
  originalClientOperationId: string;
  compensationActionCode: string;
  state: string;
  applied: boolean;
  reasonCode: string;
}

@Injectable()
export class ResolveCompensationService {
  constructor(
    @Inject(COMPENSATION_REPOSITORY)
    private readonly compensations: CompensationRepository,
  ) {}

  async execute(
    input: ResolveCompensationInput,
  ): Promise<ResolveCompensationResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }

    let next;
    let resultRefs;
    try {
      next = parseCompensationResolveState(input.state);
      resultRefs = parseCompensationResultRefs(input.resultRefs);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const record = await this.compensations.findById(input.compensationId);
    if (!record) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    const decision = decideResolveCompensation({
      tenantId: record.tenantId,
      commandTenantId: input.tenantId,
      originalClientOperationId: record.originalClientOperationId,
      pathOperationId: input.originalClientOperationId,
      current: record.state,
      next,
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        decision.code === "AUTHORIZATION_SCOPE_DENIED"
          ? HttpStatus.FORBIDDEN
          : decision.code === "RESOURCE_NOT_FOUND"
            ? HttpStatus.NOT_FOUND
            : HttpStatus.CONFLICT,
      );
    }
    if (decision.kind === "replay") {
      return toResult(record, false);
    }

    const updated = applyCompensationResolve({
      record,
      next,
      resultRefs,
      now: new Date(),
    });
    await this.compensations.updateState(updated);
    return toResult(updated, true);
  }
}

function toResult(
  record: CompensationRecord,
  applied: boolean,
): ResolveCompensationResult {
  return {
    compensationId: record.id,
    originalClientOperationId: record.originalClientOperationId,
    compensationActionCode: record.compensationActionCode,
    state: record.state,
    applied,
    reasonCode: record.reasonCode,
  };
}
