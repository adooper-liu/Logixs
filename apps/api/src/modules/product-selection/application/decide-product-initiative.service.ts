import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import { prepareProductInitiativeDecision } from "../domain/product-initiative";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRecord,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

@Injectable()
export class DecideProductInitiativeService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ProductInitiativeDecisionCommandV1;
  }): Promise<ProductInitiativeV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const currentVersion = await this.repository.currentVersion(
        input.tenantId,
        input.handoffId,
      );
      const result = await this.repository.persistDecision({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        command: prepareProductInitiativeDecision(
          { version: currentVersion },
          input.actorId,
          input.command,
        ),
      });
      return toProductInitiativeV1(result.record);
    } catch (error) {
      throwProductInitiativeHttpError(error);
    }
  }
}

export function toProductInitiativeV1(
  record: ProductInitiativeRecord,
): ProductInitiativeV1 {
  return {
    initiativeId: record.initiativeId,
    outcome: record.outcome,
    completion: record.completion,
    currentDestination: record.currentDestination,
    responsibleActorId: record.responsibleActorId,
    objective: record.objective,
    reviewPoints: record.reviewPoints,
    reason: record.reason,
    pendingFieldCodes: record.pendingFieldCodes,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
