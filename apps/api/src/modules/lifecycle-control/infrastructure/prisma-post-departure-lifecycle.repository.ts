import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  DepartureProofV1,
  ShipmentHandoffCommandV1,
} from "@logix/contracts";
import {
  hashPostDepartureLifecycleCommand,
  POST_DEPARTURE_FLOW_DEFINITION_CODE,
  POST_DEPARTURE_FLOW_DEFINITION_VERSION,
} from "@logix/contracts/post-departure-lifecycle";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { defaultApplicability } from "../domain/node-applicability";
import type {
  InitializePostDepartureLifecycleInput,
  InitializePostDepartureLifecycleResult,
  PostDepartureLifecycleRepository,
} from "../domain/post-departure-lifecycle.repository";

const POST_DEPARTURE_NODE_CODES = [
  "origin_departure",
  "ocean_transit",
  "transshipment",
  "customs_clearance",
  "destination_arrival",
  "rail_transfer",
  "container_pickup",
  "warehouse_delivery",
  "container_unloading",
  "container_unstuffing",
  "empty_return",
] as const;

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaPostDepartureLifecycleRepository implements PostDepartureLifecycleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  initialize(
    input: InitializePostDepartureLifecycleInput,
  ): Promise<InitializePostDepartureLifecycleResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertInboxLease(tx, input);

      const existing = await tx.canonicalEvent.findUnique({
        where: { id: input.command.departureEventId },
        include: {
          scopeMembers: true,
          shipmentApplication: true,
        },
      });
      if (existing) {
        assertIdempotentInitialization(existing, input);
        await completeInbox(tx, input);
        return {
          shipmentId: input.command.shipmentId,
          canonicalEventId: existing.id,
          relationshipVersion: input.command.relationshipVersion,
          lifecycleVersion:
            existing.shipmentApplication?.projectionVersion ?? 1,
          containerCount: existing.scopeMembers.length,
          initialized: false,
        };
      }

      const shipment = await tx.shipment.findUnique({
        where: {
          id_tenantId: {
            id: input.command.shipmentId,
            tenantId: input.tenantId,
          },
        },
        include: {
          containerLinks: { where: { state: "active" } },
          handoffs: {
            where: { status: "accepted" },
            orderBy: { handoffVersion: "desc" },
            take: 1,
          },
        },
      });
      if (!shipment) throw new Error("RESOURCE_NOT_FOUND: Shipment 不存在");
      if (shipment.relationshipVersion !== input.command.relationshipVersion) {
        throw new Error("POST_DEPARTURE_RELATIONSHIP_VERSION_CONFLICT");
      }
      if (
        shipment.currentLifecycleStatus !== "departed" ||
        shipment.lifecycleVersion !== 1
      ) {
        throw new Error("POST_DEPARTURE_LIFECYCLE_VERSION_CONFLICT");
      }

      const links = [...shipment.containerLinks].sort((left, right) =>
        left.containerRecordId.localeCompare(right.containerRecordId),
      );
      const requestedContainerIds = [...input.command.containerIds].sort();
      if (
        links.length !== requestedContainerIds.length ||
        links.some(
          (link, index) =>
            link.containerRecordId !== requestedContainerIds[index],
        )
      ) {
        throw new Error("POST_DEPARTURE_CONTAINER_SCOPE_CONFLICT");
      }

      const handoff = shipment.handoffs[0];
      if (
        !handoff?.lifecycleRequestJson ||
        hashPostDepartureLifecycleCommand(
          handoff.lifecycleRequestJson as unknown as typeof input.command,
        ) !== hashPostDepartureLifecycleCommand(input.command)
      ) {
        throw new Error("POST_DEPARTURE_HANDOFF_CONTEXT_INVALID");
      }
      const handoffCommand =
        handoff.payloadJson as unknown as ShipmentHandoffCommandV1;
      const departure = departureContext(handoffCommand, handoff.occurredAt);
      if (
        departure.proof.kind === "actual_departure_time" &&
        shipment.atdAt?.getTime() !== departure.occurredAt.getTime()
      ) {
        throw new Error("POST_DEPARTURE_HANDOFF_CONTEXT_INVALID");
      }

      const existingFlows = await tx.flowInstance.count({
        where: { containerId: { in: requestedContainerIds } },
      });
      if (existingFlows > 0) {
        throw new Error("POST_DEPARTURE_FLOW_ALREADY_EXISTS");
      }

      const appliedAt = input.completeInbox.processedAt;
      await tx.canonicalEvent.create({
        data: {
          id: input.command.departureEventId,
          tenantId: input.tenantId,
          containerId: null,
          subjectType: "shipment",
          subjectId: shipment.id,
          subjectVersion: shipment.lifecycleVersion,
          scopeVersion: shipment.relationshipVersion,
          eventCode: "departed",
          eventVersion: 2,
          domainFactId: handoff.id,
          domainFactType: "shipment_handoff",
          domain: "shipment_registry",
          role: "milestone",
          eventSequence: shipment.lifecycleVersion,
          nodeCode: "origin_departure",
          timeKind: "actual",
          authorityPolicyRef: departure.authorityPolicyRef,
          locationType: departure.sourceTimezone ? "port" : null,
          unlocode: departure.sourceTimezone
            ? handoffCommand.shipment.originPortCode
            : null,
          locationTimezone: departure.sourceTimezone,
          source: departure.source as Prisma.InputJsonValue,
          confidenceState: "confirmed",
          validity: "effective",
          data: departure.proof as Prisma.InputJsonValue,
          correlationId: handoffCommand.source.correlationId,
          causationId: handoff.id,
          traceId: input.command.traceId,
          occurredAt: departure.occurredAt,
          recordedAt: appliedAt,
          evidenceRefs: [departure.proof.evidenceRef],
          idempotencyKey: input.command.idempotencyKey,
        },
      });

      for (const link of links) {
        const flow = await tx.flowInstance.create({
          data: {
            containerId: link.containerRecordId,
            state: "active",
            currentNodeCode: "ocean_transit",
            version: 1,
            definitionCode: POST_DEPARTURE_FLOW_DEFINITION_CODE,
            definitionVersion: POST_DEPARTURE_FLOW_DEFINITION_VERSION,
            shipmentId: shipment.id,
            shipmentRelationshipVersion: shipment.relationshipVersion,
          },
        });
        const nodes = POST_DEPARTURE_NODE_CODES.map((nodeCode) => ({
          id: randomUUID(),
          flowInstanceId: flow.id,
          nodeCode,
          state:
            nodeCode === "origin_departure"
              ? "completed"
              : nodeCode === "ocean_transit"
                ? "active"
                : "pending",
          applicability: defaultApplicability(nodeCode),
          completedAt:
            nodeCode === "origin_departure" ? departure.occurredAt : null,
        }));
        await tx.nodeInstance.createMany({ data: nodes });
        const departureNode = nodes[0]!;
        await tx.nodeEventApplication.create({
          data: {
            eventId: input.command.departureEventId,
            targetNodeInstanceId: departureNode.id,
            state: "applied",
            evaluatedAt: appliedAt,
            guardResults: [
              "SHIPMENT_DEPARTED_FACT_ACCEPTED",
              "RELATIONSHIP_SCOPE_FROZEN",
              "POST_DEPARTURE_FLOW_CREATED",
            ],
            appliedAt,
          },
        });
        await tx.canonicalEventScopeMember.create({
          data: {
            tenantId: input.tenantId,
            eventId: input.command.departureEventId,
            containerRecordId: link.containerRecordId,
            shipmentContainerLinkId: link.id,
          },
        });
      }

      const nextLifecycleVersion = shipment.lifecycleVersion + 1;
      await tx.shipmentEventApplication.create({
        data: {
          tenantId: input.tenantId,
          shipmentId: shipment.id,
          eventId: input.command.departureEventId,
          state: "applied",
          previousStatus: shipment.currentLifecycleStatus,
          resultingStatus: "departed",
          aggregationRule: "shipment_departure_scope_all_active_containers_v1",
          ruleVersion: 1,
          guardResults: [
            "SHIPMENT_TENANT_MATCH",
            "RELATIONSHIP_VERSION_MATCH",
            "ACTIVE_CONTAINER_SCOPE_MATCH",
            "DEPARTURE_PROOF_ACCEPTED",
          ],
          projectionVersion: nextLifecycleVersion,
          appliedAt,
        },
      });
      const advanced = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          tenantId: input.tenantId,
          relationshipVersion: input.command.relationshipVersion,
          lifecycleVersion: shipment.lifecycleVersion,
          currentLifecycleStatus: "departed",
        },
        data: { lifecycleVersion: { increment: 1 } },
      });
      if (advanced.count !== 1) {
        throw new Error("POST_DEPARTURE_LIFECYCLE_VERSION_CONFLICT");
      }

      const envelope = {
        eventId: input.command.departureEventId,
        eventCode: "departed",
        eventVersion: 2,
        tenantId: input.tenantId,
        subject: {
          tenantId: input.tenantId,
          entityType: "shipment",
          entityId: shipment.id,
          ownerModule: "shipment-registry",
        },
        subjectVersion: shipment.lifecycleVersion,
        scopeVersion: shipment.relationshipVersion,
        nodeCode: "origin_departure",
        domainFactId: handoff.id,
        domainFactType: "shipment_handoff",
        authorityPolicyRef: departure.authorityPolicyRef,
        domain: "shipment_registry",
        role: "milestone",
        timeKind: "actual",
        occurredAt: departure.occurredAt.toISOString(),
        recordedAt: appliedAt.toISOString(),
        eventSequence: shipment.lifecycleVersion,
        idempotencyKey: input.command.idempotencyKey,
        source: departure.source,
        evidenceRefs: [departure.proof.evidenceRef],
        confidenceState: "confirmed",
        validity: "effective",
        data: departure.proof,
        correlationId: handoffCommand.source.correlationId,
        causationId: handoff.id,
        traceId: input.command.traceId,
      };
      await tx.outboxMessage.create({
        data: {
          id: input.command.departureEventId,
          tenantId: input.tenantId,
          ownerModule: "lifecycle-control",
          eventId: input.command.departureEventId,
          eventType: "departed",
          eventVersion: 2,
          aggregateType: "shipment",
          aggregateId: shipment.id,
          payloadRef: `canonical-event/${input.command.departureEventId}`,
          payloadHash: hashJson(envelope),
          causationId: handoff.id,
          state: "pending",
          attemptCount: 0,
          occurredAt: departure.occurredAt,
          idempotencyKey: `canonical-event:${input.command.idempotencyKey}`,
          traceId: input.command.traceId,
        },
      });
      await completeInbox(tx, input);

      return {
        shipmentId: shipment.id,
        canonicalEventId: input.command.departureEventId,
        relationshipVersion: shipment.relationshipVersion,
        lifecycleVersion: nextLifecycleVersion,
        containerCount: links.length,
        initialized: true,
      };
    });
  }
}

async function assertInboxLease(
  tx: Transaction,
  input: InitializePostDepartureLifecycleInput,
): Promise<void> {
  const inbox = await tx.inboxMessage.findFirst({
    where: {
      id: input.completeInbox.id,
      tenantId: input.tenantId,
      state: "processing",
      leaseOwner: input.completeInbox.owner,
    },
    select: { id: true },
  });
  if (!inbox) throw new Error("INBOX_LEASE_LOST");
}

async function completeInbox(
  tx: Transaction,
  input: InitializePostDepartureLifecycleInput,
): Promise<void> {
  const completed = await tx.inboxMessage.updateMany({
    where: {
      id: input.completeInbox.id,
      tenantId: input.tenantId,
      state: "processing",
      leaseOwner: input.completeInbox.owner,
    },
    data: {
      state: "processed",
      processedAt: input.completeInbox.processedAt,
      leaseOwner: null,
      leaseLockedAt: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
    },
  });
  if (completed.count !== 1) throw new Error("INBOX_LEASE_LOST");
}

function assertIdempotentInitialization(
  existing: {
    eventVersion: number;
    subjectType: string | null;
    subjectId: string | null;
    scopeVersion: number | null;
    idempotencyKey: string;
    scopeMembers: Array<{ containerRecordId: string }>;
    shipmentApplication: { state: string } | null;
  },
  input: InitializePostDepartureLifecycleInput,
): void {
  const persistedContainerIds = existing.scopeMembers
    .map((member) => member.containerRecordId)
    .sort();
  const requestedContainerIds = [...input.command.containerIds].sort();
  if (
    existing.eventVersion !== 2 ||
    existing.subjectType !== "shipment" ||
    existing.subjectId !== input.command.shipmentId ||
    existing.scopeVersion !== input.command.relationshipVersion ||
    existing.idempotencyKey !== input.command.idempotencyKey ||
    existing.shipmentApplication?.state !== "applied" ||
    persistedContainerIds.join("\u0000") !==
      requestedContainerIds.join("\u0000")
  ) {
    throw new Error("IDEMPOTENCY_CONFLICT: 同事件 ID 异载荷");
  }
}

function departureContext(
  command: ShipmentHandoffCommandV1,
  handoffOccurredAt: Date,
): {
  proof: DepartureProofV1;
  occurredAt: Date;
  sourceTimezone: string | null;
  authorityPolicyRef: string;
  source: Record<string, string>;
} {
  const proof = command.shipment?.departureProof;
  const source = command.source;
  if (!proof || !source?.system || !source.correlationId) {
    throw new Error("POST_DEPARTURE_HANDOFF_CONTEXT_INVALID");
  }
  const occurredAt =
    proof.kind === "actual_departure_time"
      ? new Date(proof.occurredAt)
      : handoffOccurredAt;
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("POST_DEPARTURE_HANDOFF_CONTEXT_INVALID");
  }
  const captureSource =
    source.channel === "manual"
      ? "manual_backfill"
      : source.channel === "file_import"
        ? "controlled_import"
        : "external_evidence";
  const authorityPolicyRef =
    proof.kind === "authoritative_departed_status"
      ? proof.authorityPolicyRef
      : proof.kind === "authorized_manual_confirmation"
        ? "shipment-handoff-authorized-manual-confirmation-v1"
        : "shipment-handoff-actual-departure-time-v1";
  return {
    proof,
    occurredAt,
    sourceTimezone:
      proof.kind === "actual_departure_time" ? proof.sourceTimezone : null,
    authorityPolicyRef,
    source: {
      sourceSystem: source.system,
      authoritySystem: source.system,
      captureSource,
      authorityLevel: "authoritative",
      verificationState: "verified",
      confidenceState: "confirmed",
      sourceEventId: source.externalHandoffId,
      ...(source.mappingVersion
        ? { mappingVersion: source.mappingVersion }
        : {}),
    },
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sortJson(value)), "utf8")
    .digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
