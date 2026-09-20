import type {
  CertificateVerificationState,
  ComplianceIngestionChannel,
  DangerousGoodsClassificationState,
  NormalizedBatteryProfile,
  NormalizedDangerousGoodsProfile,
  NormalizedInspectionRequirement,
  NormalizedRefrigerantProfile,
  NormalizedReplaceProductComplianceProfileCommand,
  ProductCertificateType,
} from "./product-compliance-profile";

export const PRODUCT_COMPLIANCE_PROFILE_REPOSITORY = Symbol(
  "ProductComplianceProfileRepository",
);

export class ProductComplianceProfileNotFoundError extends Error {
  constructor() {
    super("PRODUCT_COMPLIANCE_PROFILE_SKU_NOT_FOUND");
    this.name = "ProductComplianceProfileNotFoundError";
  }
}

export class ProductComplianceProfileVersionConflictError extends Error {
  constructor() {
    super("PRODUCT_COMPLIANCE_PROFILE_VERSION_CONFLICT");
    this.name = "ProductComplianceProfileVersionConflictError";
  }
}

export class ProductComplianceProfileIdempotencyConflictError extends Error {
  constructor() {
    super("PRODUCT_COMPLIANCE_PROFILE_IDEMPOTENCY_CONFLICT");
    this.name = "ProductComplianceProfileIdempotencyConflictError";
  }
}

export class ProductCertificateIdentityConflictError extends Error {
  constructor() {
    super("PRODUCT_CERTIFICATE_IDENTITY_CONFLICT");
    this.name = "ProductCertificateIdentityConflictError";
  }
}

export interface ProductCertificateVersionRecord {
  productCertificateId: string;
  certificateVersionId: string;
  version: number;
  certificateKey: string;
  certificateType: ProductCertificateType;
  certificateNumber: string;
  issuerName: string;
  coverageScope: "global" | "countries";
  coveredCountryCodes: string[];
  validFrom: string;
  validUntil: string | null;
  documentRecordId: string;
  verificationState: CertificateVerificationState;
}

export interface ProductComplianceProfileRecord {
  profileId: string;
  tenantId: string;
  productSkuId: string;
  version: number;
  battery: NormalizedBatteryProfile;
  refrigerant: NormalizedRefrigerantProfile;
  dangerousGoods: NormalizedDangerousGoodsProfile;
  inspectionRequirements: NormalizedInspectionRequirement[];
  certificates: ProductCertificateVersionRecord[];
  ingestionChannel: ComplianceIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  verificationState: CertificateVerificationState;
  actorId: string;
  reasonCode: string;
  createdAt: string;
}

export interface ProductComplianceProfileRepository {
  findCurrent(input: {
    tenantId: string;
    productSkuId: string;
  }): Promise<ProductComplianceProfileRecord | null>;
  replace(
    input: NormalizedReplaceProductComplianceProfileCommand,
  ): Promise<{ record: ProductComplianceProfileRecord; duplicate: boolean }>;
}

export type { DangerousGoodsClassificationState };
