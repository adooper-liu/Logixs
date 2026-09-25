import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from "@nestjs/common";
import type {
  PostDepartureSourceCandidateV1,
  PostDepartureSourcePackageAcceptCommandV1,
  PostDepartureSourcePackageAcceptItemV1,
  PostDepartureSourcePackageAcceptResultV1,
} from "@logix/contracts";
import type { ShipmentHandoffRequestContext } from "../../shipment-lifecycle-orchestration";
import {
  AcceptPostDepartureSourceCandidateService,
  postDepartureCandidateGroupingKey,
} from "./accept-post-departure-source-candidate.service";
import { PreflightPostDepartureSourcePackageService } from "./preflight-post-departure-source-package.service";

const PACKAGE_ID_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_KINDS = new Set([
  "container",
  "customs",
  "logistics",
  "warehouse",
]);

@Injectable()
export class AcceptPostDepartureSourcePackageService {
  constructor(
    private readonly preflightPackage: PreflightPostDepartureSourcePackageService,
    private readonly acceptCandidate: AcceptPostDepartureSourceCandidateService,
  ) {}

  async execute(
    packageId: string,
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<PostDepartureSourcePackageAcceptResultV1> {
    assertCommand(input);
    if (input.packageId !== packageId) {
      throw new BadRequestException("SOURCE_PACKAGE_ACCEPT_PATH_MISMATCH");
    }
    const preflight = await this.preflightPackage.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: input.sources,
      },
      context.tenantId,
    );
    if (preflight.packageId !== packageId) {
      throw new ConflictException("SOURCE_PACKAGE_CHANGED");
    }

    const groups = groupCandidates(preflight.candidates);
    const items: PostDepartureSourcePackageAcceptItemV1[] = [];
    for (const [groupKey, candidates] of groups) {
      const candidateRefs = candidates.map(
        ({ candidateRef }) => candidateRef,
      ) as [string, ...string[]];
      const rejected = candidates.some(
        ({ decision }) => decision === "rejected",
      );
      if (rejected) {
        items.push({
          candidateRefs,
          status: "rejected",
          shipmentId: null,
          errorCode: "SOURCE_CANDIDATE_REJECTED",
          traceId: groupTraceId(packageId, groupKey),
          recoveryAction: "review_candidate",
        });
        continue;
      }

      const representative = candidates[0]!;
      const groupCommand = {
        contractVersion: "post-departure-source-candidate-accept.v1" as const,
        packageId,
        sources: input.sources,
        candidateRef: representative.candidateRef,
        idempotencyKey: groupIdempotencyKey(input.idempotencyKey, groupKey),
      };
      try {
        const result = await this.acceptCandidate.acceptPrepared(
          packageId,
          representative.candidateRef,
          groupCommand,
          context,
          preflight,
        );
        items.push({
          candidateRefs: result.acceptedCandidateRefs,
          status: result.handoff.duplicate ? "duplicate" : "accepted",
          shipmentId: result.handoff.shipmentId ?? null,
          errorCode: null,
          traceId: result.handoff.traceId,
          recoveryAction: "open_shipment",
        });
      } catch (cause) {
        const status = failureStatus(cause);
        items.push({
          candidateRefs,
          status,
          shipmentId: null,
          errorCode: errorCode(cause),
          traceId: groupTraceId(packageId, groupKey),
          recoveryAction:
            status === "failed" ? "retry_package" : "review_candidate",
        });
      }
    }

    return {
      contractVersion: "post-departure-source-package-accept-result.v1",
      packageId,
      items,
      totals: {
        groups: items.length,
        accepted: countStatus(items, "accepted"),
        duplicate: countStatus(items, "duplicate"),
        conflict: countStatus(items, "conflict"),
        rejected: countStatus(items, "rejected"),
        failed: countStatus(items, "failed"),
      },
    };
  }
}

function groupCandidates(
  candidates: PostDepartureSourceCandidateV1[],
): Array<[string, PostDepartureSourceCandidateV1[]]> {
  const grouped = new Map<string, PostDepartureSourceCandidateV1[]>();
  for (const candidate of candidates) {
    const key =
      postDepartureCandidateGroupingKey(candidate) ??
      `candidate:${candidate.candidateRef}`;
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function groupIdempotencyKey(rootKey: string, groupKey: string): string {
  return `package-accept:${createHash("sha256")
    .update(`${rootKey}:${groupKey}`)
    .digest("hex")}`;
}

function groupTraceId(packageId: string, groupKey: string): string {
  return `post-departure:${packageId.slice(0, 16)}:${createHash("sha256")
    .update(groupKey)
    .digest("hex")
    .slice(0, 16)}`;
}

function countStatus(
  items: PostDepartureSourcePackageAcceptItemV1[],
  status: PostDepartureSourcePackageAcceptItemV1["status"],
): number {
  return items.filter((item) => item.status === status).length;
}

function failureStatus(
  cause: unknown,
): Extract<
  PostDepartureSourcePackageAcceptItemV1["status"],
  "conflict" | "rejected" | "failed"
> {
  if (!(cause instanceof HttpException)) return "failed";
  if (cause.getStatus() === 409) return "conflict";
  return cause.getStatus() >= 400 && cause.getStatus() < 500
    ? "rejected"
    : "failed";
}

function errorCode(cause: unknown): string {
  if (cause instanceof HttpException) {
    const response = cause.getResponse();
    if (typeof response === "string") return response.slice(0, 100);
    if (isRecord(response)) {
      if (typeof response.code === "string") return response.code.slice(0, 100);
      if (typeof response.message === "string") {
        return response.message.slice(0, 100);
      }
    }
  }
  return "SOURCE_PACKAGE_GROUP_ACCEPT_FAILED";
}

function assertCommand(
  value: unknown,
): asserts value is PostDepartureSourcePackageAcceptCommandV1 {
  if (
    !isRecord(value) ||
    value.contractVersion !== "post-departure-source-package-accept.v1" ||
    typeof value.packageId !== "string" ||
    !PACKAGE_ID_PATTERN.test(value.packageId) ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length < 1 ||
    value.idempotencyKey.length > 200 ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 4 ||
    !value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.kind === "string" &&
        SOURCE_KINDS.has(source.kind) &&
        typeof source.batchId === "string" &&
        UUID_PATTERN.test(source.batchId),
    ) ||
    new Set(
      value.sources.map((source) =>
        isRecord(source) ? source.kind : undefined,
      ),
    ).size !== value.sources.length
  ) {
    throw new BadRequestException("SOURCE_PACKAGE_ACCEPT_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
