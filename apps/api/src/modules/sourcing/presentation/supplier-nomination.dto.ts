import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AdmitSupplierCommandV1,
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  RegisterSupplierCommandV1,
} from "@logix/contracts";

const ADMISSION_STATES = ["pending", "admitted", "suspended"] as const;

export class SupplierResponseDto {
  @ApiProperty({ enum: ["supplier.v1"] }) contractVersion!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() countryCode!: string;
  @ApiPropertyOptional({ nullable: true }) contactName!: string | null;
  @ApiPropertyOptional({ nullable: true }) contactEmail!: string | null;
  @ApiProperty({ enum: ADMISSION_STATES }) admissionState!: string;
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/**
 * 报价的响应形状。**不逐字段声明 OpenAPI** —— 契约才是权威，
 * 这里摊成二十个装饰器只会多出一份会漂移的副本。
 */
export class SupplierQuotationResponseDto {
  @ApiProperty({ enum: ["supplier-quotation.v1"] }) contractVersion!: string;
  @ApiProperty() quotationId!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty() skuReleaseId!: string;
  @ApiProperty() skuId!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ type: [Object] }) priceTiers!: object[];
  @ApiProperty() incoterms!: string;
  @ApiPropertyOptional({ nullable: true }) leadTimeDays!: number | null;
  @ApiProperty({ type: [Object] }) keyMaterials!: object[];
  @ApiPropertyOptional({ nullable: true }) exclusions!: string | null;
  @ApiProperty() quotedBy!: string;
  @ApiProperty() quotedAt!: string;
}

export class SupplierNominationResponseDto {
  @ApiProperty({ enum: ["supplier_nomination.v1"] }) contractVersion!: string;
  @ApiProperty() handoffId!: string;
  @ApiProperty() version!: number;
  @ApiProperty() supplierId!: string;
  @ApiProperty() supplierName!: string;
  @ApiProperty() skuId!: string;
  @ApiProperty() quotationId!: string;
  @ApiProperty() sampleConclusion!: string;
  @ApiProperty() capacityConstraint!: string;
  @ApiProperty() nominatedBy!: string;
  @ApiProperty() nominatedAt!: string;
}

export class SourcingQueueResponseDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  suppliers!: SupplierResponseDto[];
  @ApiProperty({ type: [Object] }) entries!: object[];
}

export class RegisterSupplierRequestDto implements RegisterSupplierCommandV1 {
  @ApiProperty({ enum: ["supplier-register.v1"] })
  contractVersion!: "supplier-register.v1";
  @ApiProperty() name!: string;
  @ApiProperty() countryCode!: string;
  @ApiPropertyOptional({ nullable: true }) contactName?: string | null;
  @ApiPropertyOptional({ nullable: true }) contactEmail?: string | null;
  @ApiProperty({ enum: ["pending"] })
  admissionState!: "pending";
  @ApiProperty() idempotencyKey!: string;
}

export class AdmitSupplierRequestDto implements AdmitSupplierCommandV1 {
  @ApiProperty({ enum: ["supplier-admit.v1"] })
  contractVersion!: "supplier-admit.v1";
  @ApiProperty() expectedSupplierVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

export class RecordQuotationRequestDto implements RecordQuotationCommandV1 {
  @ApiProperty({ enum: ["supplier-quotation-record.v1"] })
  contractVersion!: "supplier-quotation-record.v1";
  @ApiProperty() expectedQuotationVersion!: number;
  @ApiProperty({ type: [Object] })
  priceTiers!: RecordQuotationCommandV1["priceTiers"];
  @ApiProperty() incoterms!: string;
  @ApiPropertyOptional({ type: Object, nullable: true })
  minimumOrderQuantity?: RecordQuotationCommandV1["minimumOrderQuantity"];
  @ApiPropertyOptional({ type: Object, nullable: true })
  toolingCost?: RecordQuotationCommandV1["toolingCost"];
  @ApiPropertyOptional({ type: Object, nullable: true })
  sampleCost?: RecordQuotationCommandV1["sampleCost"];
  @ApiPropertyOptional({ nullable: true }) sampleRefundable?: boolean | null;
  @ApiPropertyOptional({ nullable: true }) leadTimeDays?: number | null;
  @ApiPropertyOptional({ nullable: true }) packagingSpec?: string | null;
  @ApiPropertyOptional({ nullable: true }) paymentTerms?: string | null;
  @ApiPropertyOptional({ nullable: true }) qualityTerms?: string | null;
  @ApiPropertyOptional({ nullable: true }) validUntil?: string | null;
  @ApiPropertyOptional({ type: [Object] })
  keyMaterials?: RecordQuotationCommandV1["keyMaterials"];
  @ApiProperty({ nullable: true }) exclusions!: string | null;
  @ApiProperty() idempotencyKey!: string;
}

export class NominateSupplierRequestDto implements NominateSupplierCommandV1 {
  @ApiProperty({ enum: ["supplier-nominate.v1"] })
  contractVersion!: "supplier-nominate.v1";
  @ApiProperty() quotationId!: string;
  @ApiProperty() expectedQuotationVersion!: number;
  @ApiProperty() sampleConclusion!: string;
  @ApiProperty() capacityConstraint!: string;
  @ApiProperty() idempotencyKey!: string;
}
