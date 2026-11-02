import { Inject, Injectable } from "@nestjs/common";
import {
  OVERDUE_STANDARD_REPOSITORY,
  type OverdueStandardRepository,
} from "../domain/overdue-standard.repository";
import type {
  ComputeStagedOverdueInput,
  ComputeStagedOverdueDeadlinesPort,
} from "../compute-staged-overdue-deadlines.port";
import {
  computeStagedOverdueDeadlines,
  type StagedOverdueResult,
} from "../engines/overdue-deadlines";

@Injectable()
export class ComputeStagedOverdueDeadlinesService implements ComputeStagedOverdueDeadlinesPort {
  constructor(
    @Inject(OVERDUE_STANDARD_REPOSITORY)
    private readonly repository: OverdueStandardRepository,
  ) {}
  async execute(
    input: ComputeStagedOverdueInput,
  ): Promise<StagedOverdueResult> {
    const standards = await this.repository.listByTenant(input.tenantId);
    const issues = [
      ...(!standards.length ? ["NO_MATCHING_STANDARD"] : []),
      ...(!input.query ? ["MISSING_MATCH_BINDING"] : []),
      ...(!input.calendarBasis
        ? ["MISSING_CALENDAR_BINDING"]
        : input.calendarBasis !== "UTC/calendar_days"
          ? ["UNSUPPORTED_CALENDAR"]
          : []),
    ];
    const result = computeStagedOverdueDeadlines({
      ...input,
      standards,
      query: input.query ?? {
        portId: "",
        shippingCompanyId: "",
        freightForwarderId: "",
        referenceAt: new Date(NaN),
      },
      calendarBasis: input.calendarBasis as "UTC/calendar_days",
    });
    if (!issues.length) return result;
    for (const deadline of [result.pickup, result.return]) {
      if (deadline.state !== "historical") {
        deadline.state = "incomplete";
        deadline.date = null;
        deadline.nature = null;
        deadline.issues = [...new Set([...issues, ...deadline.issues])];
      }
    }
    return result;
  }
}
