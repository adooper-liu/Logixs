import { Inject, Injectable } from "@nestjs/common";
import {
  computeOverdueDeadlines,
  type OverdueDecision,
} from "../engines/overdue-deadlines";
import {
  OVERDUE_STANDARD_REPOSITORY,
  type OverdueStandardRepository,
} from "../domain/overdue-standard.repository";
import type {
  ComputeOverdueDeadlinesInput,
  ComputeOverdueDeadlinesPort,
} from "../compute-overdue-deadlines.port";

@Injectable()
export class ComputeOverdueDeadlinesService implements ComputeOverdueDeadlinesPort {
  constructor(
    @Inject(OVERDUE_STANDARD_REPOSITORY)
    private readonly repository: OverdueStandardRepository,
  ) {}

  async execute(input: ComputeOverdueDeadlinesInput): Promise<OverdueDecision> {
    const standards = await this.repository.listByTenant(input.tenantId);
    return computeOverdueDeadlines({
      standards,
      query: input.query,
      clocks: input.clocks,
    });
  }
}
