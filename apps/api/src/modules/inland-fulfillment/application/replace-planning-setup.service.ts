import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  INLAND_PLAN_REPOSITORY,
  type InlandPlanRepository,
  type PlanningSetup,
} from "../domain/inland-plan.repository";
import { resolvePlanningConfig } from "../engines/inland-plan";

@Injectable()
export class ReplacePlanningSetupService {
  constructor(
    @Inject(INLAND_PLAN_REPOSITORY)
    private readonly repository: InlandPlanRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    setup: PlanningSetup;
  }): Promise<{ applied: true }> {
    if (!input.tenantId.trim() || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }
    const resolved = resolvePlanningConfig({
      parameters: input.setup.parameters,
      strategies: input.setup.strategies,
    });
    if (resolved.kind === "reject") {
      throw new HttpException(
        `${resolved.code}: ${resolved.message}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (input.setup.warehouse.dailyLimit < 0) {
      throw new HttpException(
        "BUSINESS_PRECONDITION_FAILED: 卸柜日限额不能为负",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.repository.replaceSetup(input.tenantId.trim(), input.setup);
    return { applied: true };
  }
}
