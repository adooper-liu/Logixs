import type {
  ContainerLifecycleState,
  LifecycleNodeCode,
} from "@logix/contracts";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ContainerSummary } from "../domain/container-summary";
import type { ContainerTaskFact } from "../list-container-task-facts.port";
import type {
  ContainerByIdQuery,
  ContainerByNumberQuery,
  ContainerListQuery,
  ContainerRepository,
} from "../domain/container.repository";

const EVENT_DEFAULT_NODE = new Map<string, LifecycleNodeCode>(
  canonicalEvents
    .filter((event) => event.defaultNodeCode !== null)
    .map((event) => [
      event.eventCode,
      event.defaultNodeCode as LifecycleNodeCode,
    ]),
);

@Injectable()
export class PrismaContainerRepository implements ContainerRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ContainerListQuery): Promise<ContainerSummary[]> {
    if (query.scope === "active_stuffing_snapshot") {
      const after = query.after
        ? Prisma.sql`AND (
            container.updated_at < ${query.after.updatedAt}
            OR (
              container.updated_at = ${query.after.updatedAt}
              AND container.id < ${query.after.id}
            )
          )`
        : Prisma.empty;
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          order_number: string | null;
          container_number: string | null;
          current_status: string;
          updated_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          container.id,
          container.order_number,
          container.container_number,
          container.current_status,
          container.updated_at
        FROM container_record AS container
        WHERE container.tenant_id = ${query.tenantId}
          ${after}
          AND EXISTS (
            SELECT 1
            FROM container_stuffing_snapshot AS snapshot
            JOIN container_cargo_allocation_set AS allocation
              ON allocation.id = snapshot.allocation_set_id
             AND allocation.tenant_id = snapshot.tenant_id
             AND allocation.container_record_id = snapshot.container_record_id
             AND allocation.version = snapshot.allocation_set_version
            WHERE snapshot.tenant_id = container.tenant_id
              AND snapshot.container_record_id = container.id
              AND snapshot.state = 'active'
              AND allocation.state = 'active'
          )
        ORDER BY container.updated_at DESC, container.id DESC
        LIMIT ${query.take}
      `);
      return rows.map((row) =>
        toSummary({
          id: row.id,
          orderNumber: row.order_number,
          containerNumber: row.container_number,
          currentStatus: row.current_status,
          updatedAt: row.updated_at,
        }),
      );
    }
    const rows = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.after
          ? {
              OR: [
                { updatedAt: { lt: query.after.updatedAt } },
                {
                  AND: [
                    { updatedAt: query.after.updatedAt },
                    { id: { lt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.map((row) => toSummary(row));
  }

  async findById(query: ContainerByIdQuery): Promise<ContainerSummary | null> {
    const row = await this.prisma.containerRecord.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
    });
    return row ? toSummary(row) : null;
  }

  async findTenantId(containerId: string): Promise<string | null> {
    const row = await this.prisma.containerRecord.findUnique({
      where: { id: containerId },
      select: { tenantId: true },
    });
    return row?.tenantId ?? null;
  }

  async findIdsByContainerNumber(
    query: ContainerByNumberQuery,
  ): Promise<string[]> {
    const rows = await this.prisma.containerRecord.findMany({
      where: {
        tenantId: query.tenantId,
        containerNumber: {
          equals: query.containerNumber,
          mode: "insensitive",
        },
      },
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.map((row) => row.id);
  }

  async listCurrentTaskFacts(
    query: ContainerByIdQuery,
  ): Promise<ContainerTaskFact[]> {
    const rows = await this.prisma.shipmentTimeFact.findMany({
      where: {
        containerRecordId: query.id,
        tenantId: query.tenantId,
        isCurrent: true,
      },
      select: {
        id: true,
        factCode: true,
        eventCode: true,
        timeKind: true,
        captureSource: true,
        evidenceRef: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows
      .filter(
        (row) => row.timeKind === "actual" || row.timeKind === "estimated",
      )
      .map((row) => ({
        id: row.id,
        factCode: row.factCode,
        eventCode: row.eventCode,
        nodeCode: row.eventCode
          ? (EVENT_DEFAULT_NODE.get(row.eventCode) ?? null)
          : null,
        timeKind: row.timeKind as "actual" | "estimated",
        captureSource: row.captureSource,
        evidenceRef: row.evidenceRef,
      }));
  }
}

function toSummary(row: {
  id: string;
  orderNumber: string | null;
  containerNumber: string | null;
  currentStatus: string;
  updatedAt: Date;
}): ContainerSummary {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    containerNumber: row.containerNumber,
    // DB enum 与契约枚举值一致（G7 parity 门禁校验），显式映射而非偶然同名。
    currentStatus: row.currentStatus as ContainerLifecycleState,
    updatedAt: row.updatedAt.toISOString(),
  };
}
