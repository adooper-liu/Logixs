import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from "@nestjs/common";
import type {
  InternalShipmentHandoffBatchAcceptCommandV1,
  InternalShipmentHandoffBatchAcceptResultV1,
  PostDepartureSourcePackageAcceptItemV1,
} from "@logix/contracts";
import { AcceptInternalShipmentHandoffService } from "./accept-internal-shipment-handoff.service";

const CANDIDATE_REF_PATTERN = /^internal:[a-f0-9]{64}$/;

@Injectable()
export class AcceptInternalShipmentHandoffBatchService {
  constructor(
    private readonly acceptInternal: AcceptInternalShipmentHandoffService,
  ) {}

  async execute(
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<InternalShipmentHandoffBatchAcceptResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const command = validateCommand(input);
    const items: PostDepartureSourcePackageAcceptItemV1[] = [];

    for (const candidateRef of command.candidateRefs) {
      try {
        const result = await this.acceptInternal.execute(
          {
            contractVersion: "internal-shipment-handoff-accept.v1",
            candidateRef,
            idempotencyKey: itemIdempotencyKey(
              command.idempotencyKey,
              candidateRef,
            ),
          },
          context,
        );
        items.push({
          candidateRefs: [candidateRef],
          status: result.handoff.duplicate ? "duplicate" : "accepted",
          shipmentId: result.handoff.shipmentId ?? null,
          errorCode: null,
          traceId: result.handoff.traceId,
          recoveryAction: "open_shipment",
        });
      } catch (cause) {
        const status = failureStatus(cause);
        items.push({
          candidateRefs: [candidateRef],
          status,
          shipmentId: null,
          errorCode: errorCode(cause),
          traceId: itemTraceId(command.idempotencyKey, candidateRef),
          recoveryAction:
            status === "failed" ? "retry_package" : "review_candidate",
        });
      }
    }

    return {
      contractVersion: "internal-shipment-handoff-batch-accept-result.v1",
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

function validateCommand(
  value: unknown,
): InternalShipmentHandoffBatchAcceptCommandV1 {
  const command = value as Partial<InternalShipmentHandoffBatchAcceptCommandV1>;
  if (
    command?.contractVersion !== "internal-shipment-handoff-batch-accept.v1" ||
    !Array.isArray(command.candidateRefs) ||
    command.candidateRefs.length < 1 ||
    command.candidateRefs.length > 500 ||
    !command.candidateRefs.every(
      (candidateRef) =>
        typeof candidateRef === "string" &&
        CANDIDATE_REF_PATTERN.test(candidateRef),
    ) ||
    new Set(command.candidateRefs).size !== command.candidateRefs.length ||
    typeof command.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 200
  ) {
    throw new BadRequestException("VALIDATION_FORMAT");
  }
  return command as InternalShipmentHandoffBatchAcceptCommandV1;
}

function itemIdempotencyKey(rootKey: string, candidateRef: string): string {
  return `internal-batch-item:${hash(`${rootKey}:${candidateRef}`)}`;
}

function itemTraceId(rootKey: string, candidateRef: string): string {
  return `internal-batch:${hash(`${rootKey}:${candidateRef}`).slice(0, 32)}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
  return "INTERNAL_HANDOFF_BATCH_ITEM_FAILED";
}

function countStatus(
  items: PostDepartureSourcePackageAcceptItemV1[],
  status: PostDepartureSourcePackageAcceptItemV1["status"],
): number {
  return items.filter((item) => item.status === status).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
