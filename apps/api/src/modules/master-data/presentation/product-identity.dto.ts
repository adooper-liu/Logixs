import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ProductIdentityDraftCommandV1,
  ProductSkuAttributesV1,
  SellableSkuReleaseCommandV1,
} from "@logix/contracts";

export class ProductIdentityQueueEntryResponseDto {
  @ApiProperty() releaseId!: string;
  @ApiProperty() definitionId!: string;
  @ApiProperty() specification!: string;
  @ApiProperty() npiStage!: string;
  @ApiProperty() releasedBy!: string;
  @ApiProperty() releasedAt!: string;
  @ApiPropertyOptional({ nullable: true }) productId!: string | null;
  @ApiPropertyOptional({ nullable: true }) productNumber!: string | null;
}

export class ProductIdentityQueuePageResponseDto {
  @ApiProperty({ enum: ["product-identity-queue.v1"] })
  contractVersion!: string;
  @ApiProperty({ type: [ProductIdentityQueueEntryResponseDto] })
  items!: ProductIdentityQueueEntryResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}

export class ProductIdentitySkuResponseDto {
  @ApiProperty() skuId!: string;
  @ApiProperty() skuCode!: string;
  @ApiProperty({ type: Object }) attributes!: ProductSkuAttributesV1;
}

/**
 * 商品属性的响应形状。**不逐字段声明 OpenAPI** —— 契约才是权威，
 * 这里摊成三十个装饰器只会多出一份会漂移的副本。前端类型直接取契约。
 */
export class ProductIdentityResponseDto {
  @ApiProperty({ enum: ["product-identity.v1"] })
  contractVersion!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productNumber!: string;
  @ApiProperty() sourceHandoffId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() specification!: string;
  @ApiProperty({ type: Object }) attributes!: Record<string, unknown>;
  @ApiProperty({ type: [ProductIdentitySkuResponseDto] })
  skus!: ProductIdentitySkuResponseDto[];
  @ApiProperty({ type: [String] }) pendingFieldCodes!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ProductIdentityDraftRequestDto implements ProductIdentityDraftCommandV1 {
  @ApiProperty({ enum: ["product-identity-draft.v1"] })
  contractVersion!: "product-identity-draft.v1";
  @ApiProperty() expectedVersion!: number;
  @ApiPropertyOptional() productNumber?: string;
  @ApiProperty({ type: Object })
  attributes!: ProductIdentityDraftCommandV1["attributes"];
  @ApiProperty({ type: [Object] })
  skus!: ProductIdentityDraftCommandV1["skus"];
  @ApiProperty() idempotencyKey!: string;
}

export class SellableSkuReleaseRequestDto implements SellableSkuReleaseCommandV1 {
  @ApiProperty({ enum: ["sellable-sku-release.v1"] })
  contractVersion!: "sellable-sku-release.v1";
  @ApiProperty() expectedVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}
