import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ProductDefinitionV1 } from "@logix/contracts";
import {
  PRODUCT_DEFINITION_REPOSITORY,
  type ProductDefinitionRepository,
} from "../domain/product-definition.repository";
import { toProductDefinitionV1 } from "./advance-product-definition.service";

/**
 * 读一票的产品定义。还没开始推进时返回 `null` —— 界面据此显示"还没登记规格"，
 * 而不是显示一条空定义（那会让人以为已经存过什么）。
 */
@Injectable()
export class GetProductDefinitionService {
  constructor(
    @Inject(PRODUCT_DEFINITION_REPOSITORY)
    private readonly definitions: ProductDefinitionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    initiativeHandoffId: string;
  }): Promise<ProductDefinitionV1 | null> {
    if (!input.tenantId)
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    const record = await this.definitions.findByInitiativeHandoffId(
      input.tenantId,
      input.initiativeHandoffId,
    );
    if (!record) return null;
    if (record.initiativeHandoffId !== input.initiativeHandoffId) {
      throw new HttpException(
        "PRODUCT_DEFINITION_NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }
    return toProductDefinitionV1(record);
  }
}
