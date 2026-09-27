import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductIdentityDraftCommandV1,
  ProductIdentityV1,
} from "@logix/contracts";
import { prepareProductIdentityDraft } from "../domain/product-identity";
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
 * 建档：从已发布的产品设计建立产品与 SKU 身份。
 *
 * **先判重放再判版本** —— 客户端重试时期望版本必然过期，先判版本会把一次成功的
 * 保存报成「版本冲突」，而幂等键正是为这一刻存在的。
 */
@Injectable()
export class DraftProductIdentityService {
  constructor(
    @Inject(PRODUCT_IDENTITY_REPOSITORY)
    private readonly repository: ProductIdentityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    releaseId: string;
    command: ProductIdentityDraftCommandV1;
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
      const queue = await this.repository.listQueue({
        tenantId: input.tenantId,
        take: 200,
      });
      const release = queue.find((row) => row.releaseId === input.releaseId);
      if (!release) {
        throw new ProductIdentityReleaseMissingError(
          "PRODUCT_IDENTITY_RELEASE_NOT_FOUND",
        );
      }
      const result = await this.repository.persistDraft({
        tenantId: input.tenantId,
        sourceHandoffId: input.releaseId,
        specification: release.specification,
        actorId: input.actorId,
        command: prepareProductIdentityDraft(
          {
            version: current?.version ?? 0,
            productNumber: current?.productNumber ?? null,
            skuCount: current?.skus.length ?? 0,
            attributes: current?.attributes ?? null,
          },
          input.releaseId,
          input.command,
        ),
      });
      return toProductIdentityV1(result.record);
    } catch (error) {
      throwProductIdentityHttpError(error);
    }
  }
}
