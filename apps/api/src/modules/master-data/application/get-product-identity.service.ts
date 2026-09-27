import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { ProductIdentityV1 } from "@logix/contracts";
import {
  PRODUCT_IDENTITY_REPOSITORY,
  type ProductIdentityRepository,
} from "../domain/product-identity.repository";
import { toProductIdentityV1 } from "./list-product-identity-queue.service";

/**
 * 读一票的产品身份。**还没建档时返回 `null`** —— 界面据此显示"还没建档"，
 * 而不是显示一条空身份（那会让人以为已经存过什么）。
 */
@Injectable()
export class GetProductIdentityService {
  constructor(
    @Inject(PRODUCT_IDENTITY_REPOSITORY)
    private readonly repository: ProductIdentityRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    releaseId: string;
  }): Promise<ProductIdentityV1 | null> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const record = await this.repository.findBySourceHandoffId(
      input.tenantId,
      input.releaseId,
    );
    return record ? toProductIdentityV1(record) : null;
  }
}
