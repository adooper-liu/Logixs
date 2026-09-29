import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductInitiativeNpiReturnCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import { ProductInitiativeNotFoundError } from "../domain/product-initiative";
import { prepareProductInitiativeNpiReturn } from "../domain/product-initiative-npi-return";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { toProductInitiativeV1 } from "./decide-product-initiative.service";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

/**
 * NPI 退回选品：理由必填才关闭；旧快照与领取事实保留可审计。
 */
@Injectable()
export class ReturnProductInitiativeFromNpiService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    initiativeHandoffId: string;
    command: ProductInitiativeNpiReturnCommandV1;
  }): Promise<ProductInitiativeV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const entry = await this.repository.findNpiEntry(
        input.tenantId,
        input.initiativeHandoffId,
      );
      if (!entry) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
        );
      }
      const initiative = await this.repository.findById(
        input.tenantId,
        entry.handoff.initiativeId,
      );
      if (!initiative) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_NOT_FOUND",
        );
      }

      const result = await this.repository.persistNpiReturn({
        tenantId: input.tenantId,
        initiativeHandoffId: input.initiativeHandoffId,
        actorId: input.actorId,
        command: prepareProductInitiativeNpiReturn(
          {
            version: initiative.version,
            currentDestination: initiative.currentDestination,
            productOwnerActorId: entry.claim?.productOwnerActorId ?? null,
          },
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
