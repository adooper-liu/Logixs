import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  isCalculationBasis,
  isFreeDaysBasis,
  isOverdueChargeType,
} from "../engines/overdue-deadlines";
import { validateRateTiers } from "../engines/overdue-accrual";
import {
  OVERDUE_STANDARD_REPOSITORY,
  type OverdueStandardRepository,
  type OverdueStandardWrite,
} from "../domain/overdue-standard.repository";

@Injectable()
export class ReplaceOverdueStandardsService {
  constructor(
    @Inject(OVERDUE_STANDARD_REPOSITORY)
    private readonly repository: OverdueStandardRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    standards: OverdueStandardWrite[];
  }): Promise<{ applied: true; count: number }> {
    if (!input.tenantId.trim() || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }
    const standards = input.standards.map((item) => ({
      ...item,
      id: item.id?.trim() || randomUUID(),
    }));
    for (const standard of standards) {
      if (
        !standard.portId.trim() ||
        !standard.shippingCompanyId.trim() ||
        !standard.freightForwarderId.trim()
      ) {
        throw new HttpException(
          "VALIDATION_REQUIRED: 缺少港口、船司或货代公司",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!Number.isInteger(standard.freeDays) || standard.freeDays < 0) {
        throw new HttpException(
          "BUSINESS_PRECONDITION_FAILED: 免费天数必须是大于等于 0 的整数",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (!isOverdueChargeType(standard.chargeType)) {
        throw new HttpException(
          `BUSINESS_PRECONDITION_FAILED: 费用类型 ${standard.chargeType} 未注册`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (!isFreeDaysBasis(standard.freeDaysBasis)) {
        throw new HttpException(
          `BUSINESS_PRECONDITION_FAILED: 免费期日历基准 ${standard.freeDaysBasis} 未注册`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (!isCalculationBasis(standard.calculationBasis)) {
        throw new HttpException(
          `BUSINESS_PRECONDITION_FAILED: 起算基准 ${standard.calculationBasis} 未注册`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (standard.tiers && standard.tiers.length > 0) {
        const tiers = validateRateTiers(standard.tiers);
        if (tiers.kind === "reject") {
          throw new HttpException(
            `${tiers.code}: ${tiers.message}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
    }
    await this.repository.replaceAll(input.tenantId.trim(), standards);
    return { applied: true, count: standards.length };
  }
}
