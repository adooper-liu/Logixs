import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductOpportunityIntakeCommandV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import {
  ProductOpportunityNotFoundError,
  prepareOpportunityIntake,
} from "../domain/product-opportunity";
import {
  PRODUCT_OPPORTUNITY_REPOSITORY,
  type ProductOpportunityRepository,
} from "../domain/product-opportunity.repository";
import { throwProductOpportunityHttpError } from "./product-opportunity-errors";

@Injectable()
export class IntakeProductOpportunityService {
  constructor(
    @Inject(PRODUCT_OPPORTUNITY_REPOSITORY)
    private readonly repository: ProductOpportunityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ProductOpportunityIntakeCommandV1;
  }): Promise<ProductOpportunityV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const current = await this.repository.findByHandoffId(
        input.tenantId,
        input.handoffId,
      );
      if (!current) {
        throw new ProductOpportunityNotFoundError(
          "PRODUCT_OPPORTUNITY_NOT_FOUND",
        );
      }
      const result = await this.repository.appendIntake({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        command: prepareOpportunityIntake(
          {
            version: current.intakeVersion,
            state: current.intakeState,
            assignedActorId: current.assignedActorId,
          },
          input.actorId,
          input.command,
        ),
      });
      return result.record;
    } catch (error) {
      throwProductOpportunityHttpError(error);
    }
  }
}
