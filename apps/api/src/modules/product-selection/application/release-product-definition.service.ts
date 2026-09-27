import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionV1,
} from "@logix/contracts";
import { prepareProductDefinitionRelease } from "../domain/product-definition";
import {
  PRODUCT_DEFINITION_REPOSITORY,
  type ProductDefinitionRepository,
} from "../domain/product-definition.repository";
import {
  currentStateOf,
  toProductDefinitionV1,
} from "./advance-product-definition.service";
import {
  ProductDefinitionNotFoundError,
  throwProductDefinitionHttpError,
} from "./product-definition-errors";

/**
 * 发布决定：发布 / 暂缓 / 终止。
 *
 * **发布**会在同一事务内写一份不可变交接快照交到主数据侧；暂缓与终止只改当前态。
 * 发布是终态 —— 已关闭的产品定义不再接受推进（仓储层拦）。
 */
@Injectable()
export class ReleaseProductDefinitionService {
  constructor(
    @Inject(PRODUCT_DEFINITION_REPOSITORY)
    private readonly definitions: ProductDefinitionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    initiativeHandoffId: string;
    command: ProductDefinitionReleaseCommandV1;
  }): Promise<ProductDefinitionV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const current = await this.definitions.findByInitiativeHandoffId(
        input.tenantId,
        input.initiativeHandoffId,
      );
      if (!current) {
        throw new ProductDefinitionNotFoundError(
          "PRODUCT_DEFINITION_NOT_FOUND",
        );
      }
      // 只有领取人本人能决定这票的去向。
      if (current.productOwnerActorId !== input.actorId) {
        throw new ForbiddenException("PRODUCT_DEFINITION_NOT_YOURS");
      }
      const result = await this.definitions.persistRelease({
        tenantId: input.tenantId,
        definitionId: current.definitionId,
        actorId: input.actorId,
        command: prepareProductDefinitionRelease(
          currentStateOf(current),
          input.actorId,
          input.command,
        ),
      });
      return toProductDefinitionV1(result.record);
    } catch (error) {
      throwProductDefinitionHttpError(error);
    }
  }
}
