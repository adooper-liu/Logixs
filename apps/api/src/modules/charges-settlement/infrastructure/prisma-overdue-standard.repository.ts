import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { OverdueStandard } from "../engines/overdue-deadlines";
import type {
  OverdueStandardRepository,
  OverdueStandardWrite,
  RateTierWrite,
} from "../domain/overdue-standard.repository";

@Injectable()
export class PrismaOverdueStandardRepository implements OverdueStandardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceAll(
    tenantId: string,
    standards: OverdueStandardWrite[],
  ): Promise<void> {
    const prepared = standards.map((item) => ({
      ...item,
      id: item.id?.trim() || randomUUID(),
    }));
    const tiers = prepared.flatMap((item) =>
      (item.tiers ?? []).map((tier) => ({
        tenantId,
        standardId: item.id,
        fromDay: tier.fromDay,
        toDay: tier.toDay,
        amount: tier.amount,
        currency: tier.currency,
      })),
    );
    await this.prisma.$transaction([
      this.prisma.overdueChargeStandard.deleteMany({ where: { tenantId } }),
      this.prisma.overdueChargeStandard.createMany({
        data: prepared.map((item) => ({
          id: item.id,
          tenantId,
          portId: item.portId,
          shippingCompanyId: item.shippingCompanyId,
          freightForwarderId: item.freightForwarderId,
          chargeType: item.chargeType,
          freeDays: item.freeDays,
          freeDaysBasis: item.freeDaysBasis,
          calculationBasis: item.calculationBasis,
          includeStartDay: item.includeStartDay,
          effectiveFrom: item.effectiveFrom,
          effectiveTo: item.effectiveTo,
          transportMode: item.transportMode,
          terminalId: item.terminalId,
        })),
      }),
      ...(tiers.length > 0
        ? [
            this.prisma.overdueChargeRateTier.createMany({
              data: tiers,
            }),
          ]
        : []),
    ]);
  }

  async listByTenant(tenantId: string): Promise<OverdueStandard[]> {
    const rows = await this.prisma.overdueChargeStandard.findMany({
      where: { tenantId },
    });
    return rows.map((row) => ({
      id: row.id,
      portId: row.portId,
      shippingCompanyId: row.shippingCompanyId,
      freightForwarderId: row.freightForwarderId,
      chargeType: row.chargeType,
      freeDays: row.freeDays,
      freeDaysBasis: row.freeDaysBasis,
      calculationBasis: row.calculationBasis,
      includeStartDay: row.includeStartDay,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      transportMode: row.transportMode,
      terminalId: row.terminalId,
    }));
  }

  async listRateTiers(
    tenantId: string,
  ): Promise<Array<RateTierWrite & { standardId: string }>> {
    const rows = await this.prisma.overdueChargeRateTier.findMany({
      where: { tenantId },
    });
    return rows.map((row) => ({
      standardId: row.standardId,
      fromDay: row.fromDay,
      toDay: row.toDay,
      amount: decimalText(row.amount),
      currency: row.currency,
    }));
  }
}

function decimalText(
  value: { toFixed(digits: number): string } | string,
): string {
  return typeof value === "string" ? value : value.toFixed(2);
}
