import { Inject, Injectable } from "@nestjs/common";
import {
  applyFreePeriod,
  matchOverdueStandards,
  resolveOverdueStart,
} from "../engines/overdue-deadlines";
import { computeOverdueAccrual } from "../engines/overdue-accrual";
import {
  OVERDUE_STANDARD_REPOSITORY,
  type OverdueStandardRepository,
} from "../domain/overdue-standard.repository";
import type {
  ComputeOverdueAccrualInput,
  ComputeOverdueAccrualPort,
} from "../compute-overdue-accrual.port";
import type { AccrualDecision } from "../engines/overdue-accrual";

@Injectable()
export class ComputeOverdueAccrualService implements ComputeOverdueAccrualPort {
  constructor(
    @Inject(OVERDUE_STANDARD_REPOSITORY)
    private readonly repository: OverdueStandardRepository,
  ) {}

  async execute(input: ComputeOverdueAccrualInput): Promise<AccrualDecision> {
    const standards = await this.repository.listByTenant(input.tenantId);
    const matched = matchOverdueStandards(standards, input.query);
    if (matched.length === 0) {
      return {
        kind: "reject",
        code: "BUSINESS_PRECONDITION_FAILED",
        message: "没有匹配的超期费用标准",
      };
    }

    const tiers = await this.repository.listRateTiers(input.tenantId);
    const lines = [];
    for (const standard of matched) {
      const standardTiers = tiers.filter(
        (item) => item.standardId === standard.id,
      );
      if (standardTiers.length === 0) {
        return {
          kind: "reject",
          code: "BUSINESS_PRECONDITION_FAILED",
          message: `标准 ${standard.id} 缺少费率阶梯`,
        };
      }
      const start = resolveOverdueStart(standard, input.clocks, null);
      if (start.kind === "reject") return start;
      const lastFree = applyFreePeriod({
        startAt: start.at,
        freeDays: standard.freeDays,
        basis: standard.freeDaysBasis,
        includeStartDay: standard.includeStartDay,
      });
      if (lastFree.kind === "reject") return lastFree;
      lines.push({
        standardId: standard.id,
        chargeType: standard.chargeType,
        lastFreeDay: lastFree.lastFreeDay,
        asOf: input.asOf,
        tiers: standardTiers.map((item) => ({
          fromDay: item.fromDay,
          toDay: item.toDay,
          amount: item.amount,
          currency: item.currency,
        })),
      });
    }

    return computeOverdueAccrual({
      purpose: input.purpose,
      lines,
    });
  }
}
