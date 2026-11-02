import { Inject, Injectable } from "@nestjs/common";
import {
  COMPUTE_STAGED_OVERDUE_DEADLINES,
  type ComputeStagedOverdueDeadlinesPort,
  type StagedOverdueResult,
} from "../../charges-settlement";
import {
  REFERENCE_INTERNAL_OCEAN_BASELINE,
  REFERENCE_PORT_DIRECTORY,
  REFERENCE_EXTERNAL_OCEAN_MAPPING,
  type ReferenceInternalOceanBaselinePort,
  type ReferencePortDirectoryPort,
  type ExternalOceanMappingDirectoryPort,
} from "../../master-data";
import {
  OCEAN_OPERATIONS_SOURCE_REVIEW_REPOSITORY,
  type ListSourceReviewsInput,
  type OceanOperationsSourceReviewRepository,
  type SaveSourceReviewInput,
} from "../domain/ocean-operations-source-review.repository";

interface StandardExplanation {
  rawCode: string | null;
  canonicalCode: string | null;
  name: string | null;
  status: "recognized" | "pending_review" | "unrecognized" | "unavailable";
  version: string | null;
}

@Injectable()
export class OceanOperationsSourceReviewService {
  constructor(
    @Inject(OCEAN_OPERATIONS_SOURCE_REVIEW_REPOSITORY)
    private readonly repository: OceanOperationsSourceReviewRepository,
    @Inject(REFERENCE_INTERNAL_OCEAN_BASELINE)
    private readonly baseline: ReferenceInternalOceanBaselinePort,
    @Inject(REFERENCE_PORT_DIRECTORY)
    private readonly ports: ReferencePortDirectoryPort,
    @Inject(REFERENCE_EXTERNAL_OCEAN_MAPPING)
    private readonly mappings: ExternalOceanMappingDirectoryPort,
    @Inject(COMPUTE_STAGED_OVERDUE_DEADLINES)
    private readonly deadlines: ComputeStagedOverdueDeadlinesPort,
  ) {}
  listQueue(input: ListSourceReviewsInput) {
    return this.repository.listQueue(input);
  }
  async getProjection(tenantId: string, containerId: string) {
    const projection = await this.repository.getProjection(
      tenantId,
      containerId,
    );
    const codes = [
      projection.shipment?.origin.code,
      projection.shipment?.destination.code,
    ].filter((value): value is string =>
      Boolean(value && /^[A-Z]{2}[A-Z0-9]{3}$/.test(value)),
    );
    const [baseline, ports] = await Promise.allSettled([
      this.baseline.readBaseline(),
      codes.length ? this.ports.findByUnlocodes(codes) : Promise.resolve([]),
    ]);
    const explain = (
      rawCode: string | null,
      unavailable: boolean,
    ): StandardExplanation => ({
      rawCode,
      canonicalCode: null,
      name: null,
      status: unavailable ? "unavailable" : "unrecognized",
      version: null,
    });
    const carrier = explain(
      projection.shipment?.carrier ?? null,
      baseline.status === "rejected",
    );
    const containerType = explain(
      projection.container.typeCode ?? null,
      baseline.status === "rejected",
    );
    if (baseline.status === "fulfilled") {
      carrier.version = containerType.version = baseline.value.release.version;
      const row = baseline.value.carriers.find(
        (item) => item.canonicalCode === carrier.rawCode,
      );
      if (row)
        Object.assign(carrier, {
          canonicalCode: row.canonicalCode,
          name: row.nameZh ?? row.nameEn,
          status: "recognized",
        });
      const type = baseline.value.containerTypes.find(
        (item) => item.canonicalCode === containerType.rawCode,
      );
      if (type)
        Object.assign(containerType, {
          canonicalCode: type.canonicalCode,
          name: type.canonicalCode,
          status: "recognized",
        });
      else if (containerType.rawCode) {
        try {
          const mapping = await this.mappings.resolve({
            provider: "logix_legacy",
            profileVersion: "container-type-2026-10-30-v1",
            dataset: "container_type",
            namespace: "legacy_container_type",
            sourceCode: containerType.rawCode,
          });
          if (mapping.status === "pending_review")
            containerType.status = "pending_review";
          if (mapping.status === "unavailable")
            containerType.status = "unavailable";
          // This is display enrichment only; the original business field is never rewritten.
          if (mapping.status === "resolved")
            Object.assign(containerType, {
              canonicalCode: mapping.canonicalCode,
              name: mapping.canonicalCode,
              status: "recognized",
            });
        } catch {
          containerType.status = "unavailable";
        }
      }
    }
    const port = (code: string | null): StandardExplanation => {
      const result = explain(code, ports.status === "rejected");
      if (ports.status === "fulfilled") {
        const row = ports.value.find((item) => item.unlocode === code);
        if (row)
          Object.assign(result, {
            canonicalCode: row.unlocode,
            name:
              row.nameChineseState === "confirmed"
                ? (row.nameChinese ?? row.officialName)
                : row.officialName,
            status: "recognized",
          });
      }
      return result;
    };
    const { deadlineContext, ...publicProjection } = projection;
    let deadlines: StagedOverdueResult;
    try {
      deadlines = await this.deadlines.execute({
        ...(deadlineContext ?? {
          query: null,
          calendarBasis: null,
          facts: {
            estimatedArrival: null,
            estimatedDischarge: null,
            estimatedPickup: null,
            actualArrival: null,
            actualDischarge: null,
            actualPickup: null,
          },
        }),
        tenantId,
      });
    } catch {
      const unavailable = () => ({
        state: "incomplete" as const,
        date: null,
        nature: null,
        limitingStandardIds: [],
        issues: ["DEADLINE_COMPUTATION_UNAVAILABLE"],
      });
      deadlines = {
        stage: deadlineContext?.facts.actualPickup
          ? "after_pickup"
          : deadlineContext?.facts.actualArrival ||
              deadlineContext?.facts.actualDischarge
            ? "after_arrival"
            : "before_arrival",
        items: [],
        pickup: unavailable(),
        return: unavailable(),
      };
    }
    return {
      ...publicProjection,
      deadlines: {
        ...deadlines,
        pickup: {
          ...deadlines.pickup,
          date: deadlines.pickup.date?.toISOString().slice(0, 10) ?? null,
        },
        return: {
          ...deadlines.return,
          date: deadlines.return.date?.toISOString().slice(0, 10) ?? null,
        },
        items: deadlines.items.map((item) => ({
          ...item,
          date: item.date?.toISOString().slice(0, 10) ?? null,
        })),
      },
      standards: {
        carrier,
        containerType,
        origin: port(projection.shipment?.origin.code ?? null),
        destination: port(projection.shipment?.destination.code ?? null),
      },
    };
  }
  save(input: SaveSourceReviewInput) {
    return this.repository.save(input);
  }
}
