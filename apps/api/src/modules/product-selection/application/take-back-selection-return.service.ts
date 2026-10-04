import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  MarketSelectionReturnTakebackCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { toProductInitiativeV1 } from "./decide-product-initiative.service";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

@Injectable()
export class TakeBackSelectionReturnService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    signalId: string;
    command: MarketSelectionReturnTakebackCommandV1;
  }): Promise<ProductInitiativeV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const result = await this.repository.takeBackSelectionReturn(input);
      return toProductInitiativeV1(result.record);
    } catch (error) {
      throwProductInitiativeHttpError(error);
    }
  }
}
