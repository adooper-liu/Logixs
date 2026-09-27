import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductIdentityV1,
  SellableSkuReleaseCommandV1,
} from "@logix/contracts";
import { prepareSellableSkuRelease } from "../domain/product-identity";
import {
  PRODUCT_IDENTITY_REPOSITORY,
  type ProductIdentityRepository,
} from "../domain/product-identity.repository";
import {
  ProductIdentityReleaseMissingError,
  throwProductIdentityHttpError,
} from "./product-identity-errors";
import { toProductIdentityV1 } from "./list-product-identity-queue.service";

/**
 * 发布：把身份与属性冻结成不可变交接，交给寻源侧。
 *
 * 发布前会逐项检查差什么（产品号、SKU、品类、功能名、原产国、HS 编码、目标国家）——
 * 发布是交给下游当依据的那一刻，这里不能含糊。BOM 与 Listing 记为待补，不阻断。
 */
@Injectable()
export class ReleaseSellableSkuService {
  constructor(
    @Inject(PRODUCT_IDENTITY_REPOSITORY)
    private readonly repository: ProductIdentityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    releaseId: string;
    command: SellableSkuReleaseCommandV1;
  }): Promise<ProductIdentityV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const replay = await this.repository.findByIdempotencyKey(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replay) return toProductIdentityV1(replay);

      const current = await this.repository.findBySourceHandoffId(
        input.tenantId,
        input.releaseId,
      );
      if (!current) {
        throw new ProductIdentityReleaseMissingError(
          "PRODUCT_IDENTITY_NOT_FOUND",
        );
      }
      const result = await this.repository.persistRelease({
        tenantId: input.tenantId,
        productId: current.productId,
        actorId: input.actorId,
        command: prepareSellableSkuRelease(
          {
            version: current.version,
            productNumber: current.productNumber,
            skuCount: current.skus.length,
            attributes: current.attributes,
          },
          input.command,
        ),
      });
      return toProductIdentityV1(result.record);
    } catch (error) {
      throwProductIdentityHttpError(error);
    }
  }
}
