import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  OceanRouteRecord,
  OceanRouteRepository,
  ReplaceOceanRoutePersistenceInput,
} from "../domain/ocean-route.repository";

@Injectable()
export class PrismaOceanRouteRepository implements OceanRouteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerId: string;
  }): Promise<OceanRouteRecord | null> {
    const row = await this.prisma.oceanRoutePlan.findFirst({
      where: {
        containerId: input.containerId,
        status: "active",
        container: { tenantId: input.tenantId },
      },
      include: { segments: { orderBy: { sequence: "asc" } } },
    });
    return row ? toRecord(row) : null;
  }

  async replace(input: ReplaceOceanRoutePersistenceInput): Promise<{
    record: OceanRouteRecord;
    duplicate: boolean;
  }> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "container_record"
          WHERE "id" = ${input.containerId}
            AND "tenant_id" = ${input.tenantId}
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new Error("RESOURCE_NOT_FOUND");

        const duplicate = await transaction.oceanRoutePlan.findUnique({
          where: {
            containerId_idempotencyKey: {
              containerId: input.containerId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { segments: { orderBy: { sequence: "asc" } } },
        });
        if (duplicate) {
          if (duplicate.payloadHash !== input.payloadHash) {
            throw new Error("LIFECYCLE_IDEMPOTENCY_CONFLICT");
          }
          return { record: toRecord(duplicate), duplicate: true };
        }

        const current = await transaction.oceanRoutePlan.findFirst({
          where: { containerId: input.containerId, status: "active" },
          select: { id: true, version: true },
        });
        const currentVersion = current?.version ?? 0;
        if (input.expectedVersion !== currentVersion) {
          throw new Error("LIFECYCLE_VERSION_CONFLICT");
        }
        if (current) {
          const superseded = await transaction.oceanRoutePlan.updateMany({
            where: {
              id: current.id,
              status: "active",
              version: current.version,
            },
            data: { status: "superseded", supersededAt: input.activatedAt },
          });
          if (superseded.count !== 1) {
            throw new Error("LIFECYCLE_VERSION_CONFLICT");
          }
        }

        const created = await transaction.oceanRoutePlan.create({
          data: {
            id: input.routePlanId,
            containerId: input.containerId,
            version: currentVersion + 1,
            status: "active",
            supersedesRouteId: current?.id ?? null,
            activatedAt: input.activatedAt,
            supersededAt: null,
            ingestionChannel: input.ingestionChannel,
            sourceSystem: input.sourceSystem,
            evidenceRefs: input.evidenceRefs,
            actorId: input.actorId ?? null,
            reasonCode: input.reasonCode ?? null,
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
            traceId: input.traceId,
            segments: {
              create: input.segments.map((segment, index) => ({
                id: input.segmentIds[index],
                sequence: index + 1,
                transportMode: segment.transportMode,
                originUnlocode: segment.originUnlocode,
                originTimezone: segment.originTimezone,
                destinationLocationType: segment.destinationLocationType,
                destinationUnlocode: segment.destinationUnlocode,
                destinationLocationId: segment.destinationLocationId ?? null,
                destinationPortCallId: segment.destinationPortCallId ?? null,
                destinationTimezone: segment.destinationTimezone,
                isFinal: index === input.segments.length - 1,
              })),
            },
          },
          include: { segments: { orderBy: { sequence: "asc" } } },
        });
        return { record: toRecord(created), duplicate: false };
      });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new Error("LIFECYCLE_VERSION_CONFLICT", { cause: error });
      }
      throw error;
    }
  }
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function toRecord(row: {
  id: string;
  version: number;
  activatedAt: Date;
  ingestionChannel: string;
  sourceSystem: string;
  evidenceRefs: unknown;
  actorId: string | null;
  reasonCode: string | null;
  segments: Array<{
    id: string;
    sequence: number;
    isFinal: boolean;
    transportMode: string;
    originUnlocode: string;
    originTimezone: string;
    destinationLocationType: string;
    destinationUnlocode: string;
    destinationLocationId: string | null;
    destinationPortCallId: string | null;
    destinationTimezone: string;
  }>;
}): OceanRouteRecord {
  return {
    routePlanId: row.id,
    version: row.version,
    activatedAt: row.activatedAt,
    ingestionChannel:
      row.ingestionChannel as OceanRouteRecord["ingestionChannel"],
    sourceSystem: row.sourceSystem,
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter(
          (reference): reference is string => typeof reference === "string",
        )
      : [],
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    segments: row.segments.map((segment) => ({
      segmentId: segment.id,
      sequence: segment.sequence,
      isFinal: segment.isFinal,
      transportMode: segment.transportMode as "vessel" | "feeder" | "barge",
      originUnlocode: segment.originUnlocode,
      originTimezone: segment.originTimezone,
      destinationLocationType: segment.destinationLocationType as
        "port" | "terminal",
      destinationUnlocode: segment.destinationUnlocode,
      ...(segment.destinationLocationId
        ? { destinationLocationId: segment.destinationLocationId }
        : {}),
      ...(segment.destinationPortCallId
        ? { destinationPortCallId: segment.destinationPortCallId }
        : {}),
      destinationTimezone: segment.destinationTimezone,
    })),
  };
}
