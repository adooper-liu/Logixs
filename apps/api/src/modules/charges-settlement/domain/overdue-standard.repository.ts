import type { OverdueStandard } from "../engines/overdue-deadlines";
import type { RateTier } from "../engines/overdue-accrual";

export const OVERDUE_STANDARD_REPOSITORY = Symbol(
  "OVERDUE_STANDARD_REPOSITORY",
);

export type RateTierWrite = RateTier;

export type OverdueStandardWrite = Omit<OverdueStandard, "id"> & {
  id?: string;
  tiers?: RateTierWrite[];
};

export interface OverdueStandardRepository {
  replaceAll(
    tenantId: string,
    standards: OverdueStandardWrite[],
  ): Promise<void>;
  listByTenant(tenantId: string): Promise<OverdueStandard[]>;
  listRateTiers(
    tenantId: string,
  ): Promise<Array<RateTierWrite & { standardId: string }>>;
}
