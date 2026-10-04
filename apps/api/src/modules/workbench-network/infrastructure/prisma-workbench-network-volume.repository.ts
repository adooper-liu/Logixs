import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type { WorkbenchNetworkVolumeCounts } from "../domain/workbench-network-volume";

const CURRENT_INTAKE = Prisma.sql`
  i.version = (
    SELECT MAX(current_intake.version)
    FROM product_opportunity_intake AS current_intake
    WHERE current_intake.handoff_id = i.handoff_id
      AND current_intake.tenant_id = i.tenant_id
  )
`;

// `queued` 不是 intake 表能存的状态：还没有领取行时，领域把当前版本视为 queued。
const STILL_WITH_MARKET = Prisma.sql`
  NOT EXISTS (
    SELECT 1
    FROM product_opportunity_intake AS intake_row
    WHERE intake_row.handoff_id = handoff.id
      AND intake_row.tenant_id = handoff.tenant_id
  )
  OR EXISTS (
    SELECT 1
    FROM product_opportunity_intake AS i
    WHERE i.handoff_id = handoff.id
      AND i.tenant_id = handoff.tenant_id
      AND ${CURRENT_INTAKE}
      AND i.state = 'claimed'
  )
`;

@Injectable()
export class PrismaWorkbenchNetworkVolumeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async count(
    tenantId: string,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<WorkbenchNetworkVolumeCounts> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, number>>>(
      Prisma.sql`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM market_signal AS signal
            WHERE signal.tenant_id = ${tenantId}
              AND (
                signal.current_destination IN (
                  'needs_decision',
                  'watching',
                  'returned_from_selection'
                )
                OR (
                  signal.current_destination = 'handed_off'
                  AND EXISTS (
                    SELECT 1
                    FROM market_opportunity_handoff AS handoff
                    WHERE handoff.tenant_id = signal.tenant_id
                      AND handoff.signal_id = signal.id
                      AND handoff.is_current = true
                      AND (${STILL_WITH_MARKET})
                  )
                )
              )
          ) AS market_open,
          (
            SELECT COUNT(*)::int
            FROM market_opportunity_handoff AS handoff
            WHERE handoff.tenant_id = ${tenantId}
              AND handoff.is_current = true
              AND (${STILL_WITH_MARKET})
          ) AS market_pending,
          (
            SELECT COUNT(*)::int
            FROM product_opportunity_intake AS intake
            WHERE intake.tenant_id = ${tenantId}
              AND intake.state = 'accepted'
              AND intake.acted_at >= ${weekStart}
              AND intake.acted_at < ${weekEnd}
          ) AS market_weekly,
          (
            SELECT COUNT(*)::int
            FROM market_opportunity_handoff AS handoff
            JOIN product_opportunity_intake AS i
              ON i.handoff_id = handoff.id
             AND i.tenant_id = handoff.tenant_id
            LEFT JOIN product_initiative AS initiative
              ON initiative.handoff_id = handoff.id
             AND initiative.tenant_id = handoff.tenant_id
            WHERE handoff.tenant_id = ${tenantId}
              AND handoff.is_current = true
              AND ${CURRENT_INTAKE}
              AND i.state = 'accepted'
              AND (
                initiative.id IS NULL
                OR initiative.current_destination IN (
                  'needs_decision',
                  'deferred',
                  'return_requested'
                )
              )
          ) AS selection_open,
          (
            SELECT COUNT(DISTINCT (quotation.sku_release_id, quotation.sku_id))::int
            FROM supplier_quotation AS quotation
            WHERE quotation.tenant_id = ${tenantId}
          ) AS sourcing_open,
          (
            SELECT COUNT(DISTINCT (nomination.sku_release_id, nomination.sku_id))::int
            FROM supplier_nomination_release AS nomination
            WHERE nomination.tenant_id = ${tenantId}
          ) AS sourcing_pending
      `,
    );
    const row = rows[0];
    return {
      marketOpen: numberCount(row?.market_open),
      marketPendingAcceptance: numberCount(row?.market_pending),
      marketWeeklyAccepts: numberCount(row?.market_weekly),
      selectionOpen: numberCount(row?.selection_open),
      sourcingOpen: numberCount(row?.sourcing_open),
      sourcingPendingAcceptance: numberCount(row?.sourcing_pending),
    };
  }
}

function numberCount(value: number | undefined): number {
  return Number(value ?? 0);
}
