import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  normalizeReplaceProductComplianceProfileCommand,
  ProductComplianceProfileCommandError,
  type ReplaceProductComplianceProfileCommand,
} from "../domain/product-compliance-profile";
import {
  PRODUCT_COMPLIANCE_PROFILE_REPOSITORY,
  ProductCertificateIdentityConflictError,
  ProductComplianceProfileIdempotencyConflictError,
  ProductComplianceProfileNotFoundError,
  ProductComplianceProfileVersionConflictError,
  type ProductComplianceProfileRepository,
} from "../domain/product-compliance-profile.repository";
import type {
  ReplaceProductComplianceProfilePort,
  ReplaceProductComplianceProfileResult,
} from "../replace-product-compliance-profile.port";

@Injectable()
export class ReplaceProductComplianceProfileService implements ReplaceProductComplianceProfilePort {
  constructor(
    @Inject(PRODUCT_COMPLIANCE_PROFILE_REPOSITORY)
    private readonly repository: ProductComplianceProfileRepository,
  ) {}

  async execute(
    command: ReplaceProductComplianceProfileCommand,
  ): Promise<ReplaceProductComplianceProfileResult> {
    let normalized;
    try {
      normalized = normalizeReplaceProductComplianceProfileCommand(command);
    } catch (error) {
      if (error instanceof ProductComplianceProfileCommandError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    try {
      const saved = await this.repository.replace(normalized);
      return {
        ...saved.record,
        writeState: saved.duplicate ? "duplicate" : "recorded",
      };
    } catch (error) {
      if (error instanceof ProductComplianceProfileNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof ProductComplianceProfileVersionConflictError ||
        error instanceof ProductComplianceProfileIdempotencyConflictError ||
        error instanceof ProductCertificateIdentityConflictError
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
