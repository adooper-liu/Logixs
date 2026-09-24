import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  ShipmentHandoffCommandV1 as ShipmentHandoffCommandStrictV1,
  ShipmentHandoffCommandV2,
  ShipmentHandoffIssueV1,
  ShipmentHandoffObjectResultV1,
  ShipmentHandoffResultV1,
  StartPostDepartureLifecycleCommandV2,
} from "@logix/contracts";
import {
  hashPostDepartureLifecycleCommand,
  POST_DEPARTURE_FLOW_DEFINITION_CODE,
  POST_DEPARTURE_FLOW_DEFINITION_VERSION,
  POST_DEPARTURE_LIFECYCLE_EVENT_TYPE,
  POST_DEPARTURE_LIFECYCLE_EVENT_VERSION,
} from "@logix/contracts/post-departure-lifecycle";
import shipmentHandoffSchema from "@logix/contracts/schemas/v1/shipment-handoff.schema.json";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ShipmentHandoffAcceptanceConflictError,
  type CommitShipmentHandoffCommand,
  type ShipmentHandoffAcceptanceRepository,
} from "../domain/shipment-handoff-acceptance";

type Transaction = Prisma.TransactionClient;
type ShipmentHandoffCommandV1 =
  ShipmentHandoffCommandStrictV1 | ShipmentHandoffCommandV2;

type CargoGroup = {
  id: string;
  sourceLineId: string;
  productSkuId?: string;
  productNumber: string;
  quantity: string;
  quantityUnit: string;
  packageCount?: string;
  packageUnit?: string;
  grossWeight?: string;
  weightUnit?: string;
  volume?: string;
  volumeUnit?: string;
  replenishmentOrderLineId?: string;
};

type CargoAllocation = NonNullable<
  ShipmentHandoffCommandV1["containers"][number]["cargoAllocations"]
>[number];

type ResolvedContainer = {
  referenceId: string;
  containerRecordId: string;
  shipmentContainerLinkId: string;
};

type CorrectionContext = {
  predecessorHandoffId: string;
  shipmentId: string;
  relationshipVersion: number;
};

type ExistingShipmentAttachmentContext = {
  shipmentId: string;
  relationshipVersion: number;
};

const HANDOFF_ISSUE_CODES = new Set<ShipmentHandoffIssueV1["code"]>(
  shipmentHandoffSchema.$defs.ShipmentHandoffIssueV1.properties.code
    .enum as ShipmentHandoffIssueV1["code"][],
);

@Injectable()
export class PrismaShipmentHandoffAcceptanceRepository implements ShipmentHandoffAcceptanceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  commit(
    input: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1> {
    return this.prisma.$transaction(async (tx) => {
      const { command, preflight } = input;
      await acquireAdvisoryLocks(tx, [
        `shipment-handoff:idempotency:${command.tenantId}:${command.source.idempotencyKey}`,
        `shipment-handoff:source:${command.tenantId}:${command.source.system}:${command.source.externalHandoffId}:${command.source.handoffVersion}`,
        ...(command.shipment.externalShipmentId
          ? [
              `shipment-handoff:shipment:${command.tenantId}:${command.source.system}:${command.shipment.externalShipmentId}`,
            ]
          : []),
        ...(targetShipment(command)
          ? [
              `shipment-handoff:target:${command.tenantId}:${targetShipment(command)!.shipmentId}`,
            ]
          : []),
        ...command.containers.map(
          (container) =>
            `shipment-handoff:container:${command.tenantId}:${command.source.system}:${container.externalContainerId ?? `${command.source.externalHandoffId}:${container.referenceId}`}`,
        ),
      ]);

      const replay = await this.findReplay(tx, input);
      if (replay) return replay;

      if (preflight.decision === "rejected") {
        return this.recordUnaccepted(tx, input);
      }

      const correction = await this.resolveCorrection(tx, input);
      const attachment = correction
        ? null
        : await this.resolveExistingShipmentAttachment(tx, command);
      if (!correction && !attachment) {
        const existingShipment = command.shipment.externalShipmentId
          ? await tx.shipment.findUnique({
              where: {
                tenantId_sourceSystem_sourceRecordId: {
                  tenantId: command.tenantId,
                  sourceSystem: command.source.system,
                  sourceRecordId: command.shipment.externalShipmentId,
                },
              },
              select: { id: true },
            })
          : null;
        if (existingShipment) {
          throw conflict("SHIPMENT_SOURCE_IDENTITY_CONFLICT");
        }
        if (command.shipment.shipmentNumber) {
          const numberOwner = await tx.shipment.findUnique({
            where: {
              tenantId_shipmentNumber: {
                tenantId: command.tenantId,
                shipmentNumber: command.shipment.shipmentNumber,
              },
            },
            select: { id: true },
          });
          if (numberOwner) throw conflict("SHIPMENT_NUMBER_CONFLICT");
        }
      }

      const shipmentId =
        correction?.shipmentId ?? attachment?.shipmentId ?? randomUUID();
      const handoffId = randomUUID();
      const cargoGroups = buildCargoGroups(command);
      await assertReferencedMasterData(tx, command.tenantId, cargoGroups);
      const cargoOwnerId = await resolveCargoOwnerReference(tx, command);

      if (!correction && !attachment) {
        await tx.shipment.create({
          data: {
            id: shipmentId,
            tenantId: command.tenantId,
            shipmentNumber: command.shipment.shipmentNumber,
            sourceSystem: command.source.system,
            sourceRecordId: command.shipment.externalShipmentId,
            sourceVersion: String(command.source.handoffVersion),
            importBatchId: command.source.sourceBatchId,
            transportMode: command.shipment.transportMode,
            carrierCode: command.shipment.carrierCode,
            vesselName: command.shipment.vesselName,
            voyageNumber: command.shipment.voyageNumber,
            originCountryCode: command.shipment.originPortCode?.slice(0, 2),
            originUnlocode: command.shipment.originPortCode,
            destinationCountryCode: command.shipment.destinationCountryCode,
            destinationUnlocode: command.shipment.destinationPortCode,
            cargoOwnerId,
            finalDestinationType: command.shipment.destinationWarehouseId
              ? "warehouse"
              : undefined,
            finalDestinationId: command.shipment.destinationWarehouseId,
            atdAt:
              command.shipment.departureProof?.kind === "actual_departure_time"
                ? new Date(command.shipment.departureProof.occurredAt)
                : undefined,
            etaAt: command.shipment.estimatedArrivalAt
              ? new Date(command.shipment.estimatedArrivalAt)
              : undefined,
            currentLifecycleStatus: "departed",
            createdBy: input.actorId,
            updatedBy: input.actorId,
          },
        });
      } else {
        const currentRelationshipVersion =
          correction?.relationshipVersion ?? attachment!.relationshipVersion;
        const updated = await tx.shipment.updateMany({
          where: {
            id: shipmentId,
            tenantId: command.tenantId,
            relationshipVersion: currentRelationshipVersion,
          },
          data: {
            sourceVersion: String(command.source.handoffVersion),
            relationshipVersion: { increment: 1 },
            updatedBy: input.actorId,
          },
        });
        if (updated.count !== 1) {
          throw conflict("SHIPMENT_RELATIONSHIP_VERSION_CONFLICT");
        }
      }

      await tx.shipmentHandoffRecord.create({
        data: {
          id: handoffId,
          tenantId: command.tenantId,
          sourceProfile: command.sourceProfile,
          ingestionChannel: command.source.channel,
          sourceSystem: command.source.system,
          externalHandoffId: command.source.externalHandoffId,
          handoffVersion: command.source.handoffVersion,
          supersedesHandoffId: correction?.predecessorHandoffId,
          occurredAt: new Date(command.source.occurredAt),
          idempotencyKey: command.source.idempotencyKey,
          payloadHash: preflight.payloadHash,
          payloadJson: command as unknown as Prisma.InputJsonValue,
          status: "accepted",
          shipmentId,
          actorId: input.actorId,
          traceId: command.source.traceId,
        },
      });

      const documents = await createTransportDocuments(
        tx,
        command,
        shipmentId,
        handoffId,
        Boolean(correction),
      );
      const containers = await this.resolveAndLinkContainers(
        tx,
        command,
        shipmentId,
        handoffId,
        Boolean(correction),
      );
      if (correction) {
        await supersedeRemovedContainerLinks(
          tx,
          command,
          shipmentId,
          new Set(
            [...containers.values()].map(
              ({ containerRecordId }) => containerRecordId,
            ),
          ),
        );
      }
      const relationshipVersion =
        (correction?.relationshipVersion ??
          attachment?.relationshipVersion ??
          0) + 1;
      const lifecycleContainerIds = attachment
        ? await listActiveShipmentContainerIds(tx, command.tenantId, shipmentId)
        : [...containers.values()].map(
            ({ containerRecordId }) => containerRecordId,
          );
      const lifecycleRequest = buildLifecycleRequest(
        command,
        shipmentId,
        lifecycleContainerIds,
        relationshipVersion,
      );
      await tx.shipmentHandoffRecord.update({
        where: { id: handoffId },
        data: {
          lifecycleRequestJson:
            lifecycleRequest as unknown as Prisma.InputJsonValue,
        },
      });
      await createCargoAndAllocations(
        tx,
        command,
        shipmentId,
        handoffId,
        cargoGroups,
        containers,
        preflight.payloadHash,
        Boolean(correction),
        Boolean(attachment),
      );
      await createContainerDocumentLinks(
        tx,
        command,
        shipmentId,
        handoffId,
        containers,
        documents,
      );
      await createUpstreamReferences(
        tx,
        command,
        shipmentId,
        handoffId,
        containers,
        cargoGroups,
        Boolean(correction),
      );

      const objectResults = buildAcceptedObjectResults(
        command,
        containers,
        cargoGroups,
        documents,
        preflight.issues,
      );
      await persistObjectResults(
        tx,
        command.tenantId,
        handoffId,
        objectResults,
      );
      await persistLifecycleOutbox(
        tx,
        command,
        handoffId,
        shipmentId,
        lifecycleRequest,
      );
      if (correction) {
        await tx.shipmentHandoffRecord.update({
          where: { id: correction.predecessorHandoffId },
          data: { status: "superseded", supersededAt: new Date() },
        });
      }

      return resultFrom(
        command,
        handoffId,
        shipmentId,
        false,
        "accepted",
        preflight.issues,
        objectResults,
      );
    });
  }

  private async resolveCorrection(
    tx: Transaction,
    input: CommitShipmentHandoffCommand,
  ): Promise<CorrectionContext | null> {
    const { command } = input;
    if (
      command.source.handoffVersion === 1 &&
      !command.source.supersedesExternalHandoffId
    ) {
      return null;
    }
    if (
      command.source.handoffVersion <= 1 ||
      !command.source.supersedesExternalHandoffId ||
      !command.shipment.expectedRelationshipVersion
    ) {
      throw conflict("SHIPMENT_HANDOFF_VERSION_CHAIN_INVALID");
    }
    const predecessor = await tx.shipmentHandoffRecord.findFirst({
      where: {
        tenantId: command.tenantId,
        sourceSystem: command.source.system,
        externalHandoffId: command.source.supersedesExternalHandoffId,
        handoffVersion: command.source.handoffVersion - 1,
      },
      include: {
        shipment: true,
        supersededBy: { select: { id: true } },
      },
    });
    if (!predecessor || !predecessor.shipment) {
      throw conflict("SUPERSEDED_HANDOFF_NOT_FOUND", [
        issue(
          "SUPERSEDED_HANDOFF_NOT_FOUND",
          "shipment_handoff_superseded_handoff_not_found",
          command.source.supersedesExternalHandoffId,
        ),
      ]);
    }
    if (predecessor.status !== "accepted" || predecessor.supersededBy) {
      throw conflict("SHIPMENT_HANDOFF_VERSION_CHAIN_CONFLICT");
    }
    if (
      predecessor.shipment.sourceRecordId !==
        command.shipment.externalShipmentId ||
      predecessor.shipment.relationshipVersion !==
        command.shipment.expectedRelationshipVersion
    ) {
      throw conflict("SHIPMENT_RELATIONSHIP_VERSION_CONFLICT");
    }
    if (
      predecessor.shipment.currentLifecycleStatus !== "departed" ||
      predecessor.shipment.lifecycleVersion !== 1
    ) {
      throw conflict("SHIPMENT_HANDOFF_CORRECTION_AFTER_LIFECYCLE_PROGRESS");
    }
    if (!sameShipmentDescriptor(predecessor.payloadJson, command)) {
      throw conflict("SHIPMENT_HANDOFF_CORRECTION_REQUIRES_VERSIONED_FACTS", [
        issue(
          "INVALID_SOURCE_VALUE",
          "shipment_handoff_descriptor_correction_not_supported",
          command.source.externalHandoffId,
        ),
      ]);
    }
    return {
      predecessorHandoffId: predecessor.id,
      shipmentId: predecessor.shipment.id,
      relationshipVersion: predecessor.shipment.relationshipVersion,
    };
  }

  private async resolveExistingShipmentAttachment(
    tx: Transaction,
    command: ShipmentHandoffCommandV1,
  ): Promise<ExistingShipmentAttachmentContext | null> {
    const target = targetShipment(command);
    if (!target) return null;
    const shipment = await tx.shipment.findFirst({
      where: { id: target.shipmentId, tenantId: command.tenantId },
      select: {
        id: true,
        relationshipVersion: true,
        currentLifecycleStatus: true,
        carrierCode: true,
        vesselName: true,
        voyageNumber: true,
        originUnlocode: true,
        destinationUnlocode: true,
        atdAt: true,
      },
    });
    if (!shipment) throw conflict("TARGET_SHIPMENT_NOT_FOUND");
    if (shipment.relationshipVersion !== target.expectedRelationshipVersion) {
      throw conflict("TARGET_SHIPMENT_VERSION_CONFLICT");
    }
    if (shipment.currentLifecycleStatus !== "departed") {
      throw conflict("TARGET_SHIPMENT_NOT_DEPARTED");
    }
    assertCompatibleShipment(shipment, command);
    return {
      shipmentId: shipment.id,
      relationshipVersion: shipment.relationshipVersion,
    };
  }

  private async findReplay(
    tx: Transaction,
    input: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1 | null> {
    const { command, preflight } = input;
    const existing = await tx.shipmentHandoffRecord.findFirst({
      where: {
        tenantId: command.tenantId,
        OR: [
          { idempotencyKey: command.source.idempotencyKey },
          {
            sourceSystem: command.source.system,
            externalHandoffId: command.source.externalHandoffId,
            handoffVersion: command.source.handoffVersion,
          },
        ],
      },
      include: { objectResults: true },
    });
    if (!existing) return null;
    if (existing.payloadHash !== preflight.payloadHash) {
      throw conflict("IDEMPOTENCY_PAYLOAD_CONFLICT", [
        issue(
          "IDEMPOTENCY_PAYLOAD_CONFLICT",
          "shipment_handoff_idempotency_payload_conflict",
          command.source.externalHandoffId,
        ),
      ]);
    }
    return resultFrom(
      command,
      existing.id,
      existing.shipmentId ?? undefined,
      true,
      existing.status,
      preflight.issues,
      existing.objectResults.map((row) => ({
        objectType: parseObjectType(row.objectType),
        sourceReferenceId: row.sourceRef,
        state: "duplicate" as const,
        ...(row.entityId ? { entityId: row.entityId } : {}),
        issueCodes: parseIssueCodes(row.issueCodes),
      })),
    );
  }

  private async recordUnaccepted(
    tx: Transaction,
    input: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1> {
    const { command, preflight } = input;
    const handoffId = randomUUID();
    const status = preflight.decision as "review_required" | "rejected";
    const objectResults = buildUnacceptedObjectResults(
      command,
      status,
      preflight.issues,
    );
    await tx.shipmentHandoffRecord.create({
      data: {
        id: handoffId,
        tenantId: command.tenantId,
        sourceProfile: command.sourceProfile,
        ingestionChannel: command.source.channel,
        sourceSystem: command.source.system,
        externalHandoffId: command.source.externalHandoffId,
        handoffVersion: command.source.handoffVersion,
        occurredAt: new Date(command.source.occurredAt),
        idempotencyKey: command.source.idempotencyKey,
        payloadHash: preflight.payloadHash,
        payloadJson: command as unknown as Prisma.InputJsonValue,
        status,
        actorId: input.actorId,
        traceId: command.source.traceId,
      },
    });
    await persistObjectResults(tx, command.tenantId, handoffId, objectResults);
    return resultFrom(
      command,
      handoffId,
      undefined,
      false,
      status,
      preflight.issues,
      objectResults,
    );
  }

  private async resolveAndLinkContainers(
    tx: Transaction,
    command: ShipmentHandoffCommandV1,
    shipmentId: string,
    handoffId: string,
    correction: boolean,
  ): Promise<Map<string, ResolvedContainer>> {
    const resolved = new Map<string, ResolvedContainer>();
    for (const container of command.containers) {
      const sourceRecordId =
        container.externalContainerId ??
        `${command.source.externalHandoffId}:${container.referenceId}`;
      const identity = await tx.containerSourceIdentity.findUnique({
        where: {
          tenantId_sourceSystem_sourceRecordId: {
            tenantId: command.tenantId,
            sourceSystem: command.source.system,
            sourceRecordId,
          },
        },
        include: { containerRecord: true },
      });
      const stuffing = container.stuffingSnapshotRef
        ? await tx.containerStuffingSnapshot.findFirst({
            where: {
              id: container.stuffingSnapshotRef,
              tenantId: command.tenantId,
              state: "active",
            },
            select: { containerRecordId: true },
          })
        : null;
      if (container.stuffingSnapshotRef && !stuffing) {
        throw conflict("STUFFING_SNAPSHOT_VERSION_STALE");
      }
      if (
        identity &&
        stuffing &&
        identity.containerRecordId !== stuffing.containerRecordId
      ) {
        throw conflict("STUFFING_SNAPSHOT_CONTAINER_CONFLICT");
      }

      let containerRecordId =
        identity?.containerRecordId ?? stuffing?.containerRecordId;
      if (!containerRecordId) {
        const created = await tx.containerRecord.create({
          data: {
            id: randomUUID(),
            tenantId: command.tenantId,
            orderNumber: null,
            containerNumber: container.containerNumber,
            containerTypeCode: container.containerTypeCode,
            sealNumber: container.sealNumber,
            currentStatus: "shipped",
          },
          select: { id: true },
        });
        containerRecordId = created.id;
      } else {
        const current =
          identity?.containerRecord ??
          (await tx.containerRecord.findUniqueOrThrow({
            where: {
              id_tenantId: {
                id: containerRecordId,
                tenantId: command.tenantId,
              },
            },
          }));
        assertCompatibleContainer(current, container);
        await tx.containerRecord.update({
          where: { id: containerRecordId },
          data: {
            containerNumber:
              current.containerNumber ?? container.containerNumber,
            containerTypeCode:
              current.containerTypeCode ?? container.containerTypeCode,
            sealNumber: current.sealNumber ?? container.sealNumber,
            ...(current.currentStatus === "not_shipped"
              ? { currentStatus: "shipped" as const }
              : {}),
          },
        });
      }
      if (!identity) {
        await tx.containerSourceIdentity.create({
          data: {
            id: randomUUID(),
            tenantId: command.tenantId,
            sourceSystem: command.source.system,
            sourceRecordId,
            containerRecordId,
          },
        });
      }

      const activeLink = await tx.shipmentContainerLink.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId,
          state: "active",
        },
        select: { id: true, shipmentId: true, version: true },
      });
      if (activeLink && activeLink.shipmentId !== shipmentId) {
        throw conflict("CONTAINER_ACTIVE_SHIPMENT_CONFLICT", [
          issue(
            "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
            "shipment_handoff_container_active_shipment_conflict",
            container.referenceId,
          ),
        ]);
      }
      if (activeLink && correction) {
        await tx.shipmentContainerLink.update({
          where: { id: activeLink.id },
          data: { state: "superseded", supersededAt: new Date() },
        });
      } else if (activeLink) {
        throw conflict("CONTAINER_ACTIVE_SHIPMENT_CONFLICT");
      }
      const shipmentContainerLinkId = randomUUID();
      await tx.shipmentContainerLink.create({
        data: {
          id: shipmentContainerLinkId,
          tenantId: command.tenantId,
          shipmentId,
          containerRecordId,
          version: (activeLink?.version ?? 0) + 1,
          state: "active",
          supersedesLinkId: activeLink?.id,
          sourceHandoffId: handoffId,
          evidenceRefs: command.evidenceReferences,
          idempotencyKey: `${command.source.idempotencyKey}:container:${container.referenceId}`,
          joinedAt: new Date(command.source.occurredAt),
        },
      });
      resolved.set(container.referenceId, {
        referenceId: container.referenceId,
        containerRecordId,
        shipmentContainerLinkId,
      });
    }
    return resolved;
  }
}

function targetShipment(command: ShipmentHandoffCommandV1): {
  shipmentId: string;
  expectedRelationshipVersion: number;
} | null {
  if (
    command.contractVersion !== "shipment-handoff.v2" ||
    !command.shipment.targetShipmentId ||
    !command.shipment.expectedRelationshipVersion
  ) {
    return null;
  }
  return {
    shipmentId: command.shipment.targetShipmentId,
    expectedRelationshipVersion: command.shipment.expectedRelationshipVersion,
  };
}

function assertCompatibleShipment(
  shipment: {
    carrierCode: string | null;
    vesselName: string | null;
    voyageNumber: string | null;
    originUnlocode: string | null;
    destinationUnlocode: string | null;
    atdAt: Date | null;
  },
  command: ShipmentHandoffCommandV1,
): void {
  const incoming = command.shipment;
  const facts: Array<[unknown, unknown]> = [
    [shipment.carrierCode, incoming.carrierCode],
    [shipment.vesselName, incoming.vesselName],
    [shipment.voyageNumber, incoming.voyageNumber],
    [shipment.originUnlocode, incoming.originPortCode],
    [shipment.destinationUnlocode, incoming.destinationPortCode],
    [
      shipment.atdAt?.toISOString(),
      incoming.departureProof?.kind === "actual_departure_time"
        ? new Date(incoming.departureProof.occurredAt).toISOString()
        : undefined,
    ],
  ];
  if (
    facts.some(
      ([stored, proposed]) =>
        stored !== null &&
        stored !== undefined &&
        proposed !== null &&
        proposed !== undefined &&
        stored !== proposed,
    )
  ) {
    throw conflict("TARGET_SHIPMENT_FACT_CONFLICT");
  }
}

async function listActiveShipmentContainerIds(
  tx: Transaction,
  tenantId: string,
  shipmentId: string,
): Promise<string[]> {
  const links = await tx.shipmentContainerLink.findMany({
    where: { tenantId, shipmentId, state: "active", supersededAt: null },
    orderBy: { containerRecordId: "asc" },
    select: { containerRecordId: true },
  });
  return links.map(({ containerRecordId }) => containerRecordId);
}

async function resolveCargoOwnerReference(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
): Promise<string | undefined> {
  const { cargoOwnerReferenceId, cargoOwnerName, salesCountryCode } =
    command.shipment;
  if (!cargoOwnerReferenceId && !cargoOwnerName && !salesCountryCode) {
    return undefined;
  }
  if (!cargoOwnerReferenceId || !cargoOwnerName || !salesCountryCode) {
    throw conflict("CARGO_OWNER_REFERENCE_INCOMPLETE");
  }
  const cargoOwner = await tx.cargoOwnerReference.findFirst({
    where: {
      id: cargoOwnerReferenceId,
      legalName: cargoOwnerName,
      release: { status: "active" },
      salesCountry: { alpha2: salesCountryCode },
    },
    select: { id: true },
  });
  if (!cargoOwner) throw conflict("CARGO_OWNER_REFERENCE_INVALID");
  return cargoOwner.id;
}

async function createTransportDocuments(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  handoffId: string,
  correction: boolean,
): Promise<Map<string, string>> {
  const activeDocuments = correction
    ? await tx.shipmentTransportDocument.findMany({
        where: { tenantId: command.tenantId, shipmentId, state: "active" },
        include: {
          parentDocument: {
            select: { documentType: true, documentNumber: true },
          },
        },
      })
    : [];
  const activeByIdentity = new Map(
    activeDocuments.map((document) => [documentIdentity(document), document]),
  );
  const commandDocuments = new Map(
    command.billsOfLading.map((document) => [document.referenceId, document]),
  );
  const ids = new Map<string, string>();
  const retainedIds = new Set<string>();
  const retainedByReference = new Map<
    string,
    (typeof activeDocuments)[number]
  >();
  const supersededIds = new Set<string>();
  const createReferences = new Set<string>();

  for (const document of command.billsOfLading) {
    const existing = activeByIdentity.get(documentIdentity(document));
    if (!existing) {
      ids.set(document.referenceId, randomUUID());
      createReferences.add(document.referenceId);
      continue;
    }
    if (document.version < existing.version) {
      throw conflict("SHIPMENT_TRANSPORT_DOCUMENT_VERSION_STALE");
    }
    if (document.version === existing.version) {
      if (!sameTransportDocument(existing, document, commandDocuments)) {
        throw conflict("SHIPMENT_TRANSPORT_DOCUMENT_VERSION_CONFLICT");
      }
      ids.set(document.referenceId, existing.id);
      retainedIds.add(existing.id);
      retainedByReference.set(document.referenceId, existing);
      continue;
    }
    ids.set(document.referenceId, randomUUID());
    createReferences.add(document.referenceId);
    supersededIds.add(existing.id);
  }
  for (const document of command.billsOfLading) {
    const retained = retainedByReference.get(document.referenceId);
    if (
      retained &&
      retained.parentDocumentId !==
        (document.parentReferenceId
          ? ids.get(document.parentReferenceId)
          : null)
    ) {
      throw conflict("SHIPMENT_TRANSPORT_DOCUMENT_VERSION_CONFLICT");
    }
  }

  const omittedIds = activeDocuments
    .map(({ id }) => id)
    .filter((id) => !retainedIds.has(id) && !supersededIds.has(id));
  const idsToSupersede = [...supersededIds, ...omittedIds];
  if (idsToSupersede.length > 0) {
    await tx.shipmentTransportDocument.updateMany({
      where: { id: { in: idsToSupersede }, state: "active" },
      data: { state: "superseded", supersededAt: new Date() },
    });
  }

  const toCreate = command.billsOfLading.filter((document) =>
    createReferences.has(document.referenceId),
  );
  if (toCreate.length > 0) {
    await tx.shipmentTransportDocument.createMany({
      data: toCreate.map((document) => ({
        id: ids.get(document.referenceId)!,
        tenantId: command.tenantId,
        shipmentId,
        documentType: document.documentType,
        documentNumber: document.documentNumber,
        scac: document.scac,
        parentDocumentId: document.parentReferenceId
          ? ids.get(document.parentReferenceId)
          : undefined,
        version: document.version,
        state: "active",
        sourceHandoffId: handoffId,
        effectiveFrom: new Date(command.source.occurredAt),
      })),
    });
  }
  return ids;
}

async function createCargoAndAllocations(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  handoffId: string,
  cargoGroups: Map<string, CargoGroup>,
  containers: Map<string, ResolvedContainer>,
  payloadHash: string,
  correction: boolean,
  append: boolean,
): Promise<void> {
  const groups = [...cargoGroups.values()].sort((left, right) =>
    left.sourceLineId.localeCompare(right.sourceLineId),
  );
  const activeCargoLines = correction
    ? await tx.shipmentCargoLine.findMany({
        where: { tenantId: command.tenantId, shipmentId, state: "active" },
        select: { id: true, sourceLineId: true },
      })
    : [];
  const activeCargoBySourceLine = new Map(
    activeCargoLines.map((line) => [line.sourceLineId, line]),
  );
  if (activeCargoLines.length > 0) {
    await tx.shipmentCargoLine.updateMany({
      where: { id: { in: activeCargoLines.map(({ id }) => id) } },
      data: { state: "superseded", supersededAt: new Date() },
    });
  }
  const lineNumberOffset = append
    ? ((
        await tx.shipmentCargoLine.aggregate({
          where: {
            tenantId: command.tenantId,
            shipmentId,
            version: command.source.handoffVersion,
          },
          _max: { lineNo: true },
        })
      )._max.lineNo ?? 0)
    : 0;
  if (groups.length > 0) {
    await tx.shipmentCargoLine.createMany({
      data: groups.map((group, index) => ({
        id: group.id,
        tenantId: command.tenantId,
        shipmentId,
        lineNo: lineNumberOffset + index + 1,
        productSkuId: group.productSkuId,
        productNumberSnapshot: group.productNumber,
        quantity: group.quantity,
        quantityUnit: group.quantityUnit,
        packageCount: group.packageCount,
        packageUnit: group.packageUnit,
        grossWeight: group.grossWeight,
        weightUnit: group.weightUnit,
        volume: group.volume,
        volumeUnit: group.volumeUnit,
        replenishmentOrderLineId: group.replenishmentOrderLineId,
        sourceHandoffId: handoffId,
        sourceLineId: group.sourceLineId,
        version: command.source.handoffVersion,
        state: "active",
        supersedesCargoLineId: activeCargoBySourceLine.get(group.sourceLineId)
          ?.id,
      })),
    });
  }

  for (const container of command.containers) {
    const resolved = containers.get(container.referenceId)!;
    const current = await tx.containerCargoAllocationSet.findFirst({
      where: {
        tenantId: command.tenantId,
        containerRecordId: resolved.containerRecordId,
        state: "active",
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    const allocations = container.cargoAllocations ?? [];
    if (command.sourceProfile === "internal_fulfillment_v1") {
      if (!current || !container.stuffingSnapshotRef) {
        throw new ShipmentHandoffAcceptanceConflictError(
          "STUFFING_SNAPSHOT_VERSION_STALE",
        );
      }
      const existingAllocations = await tx.containerCargoAllocation.findMany({
        where: { tenantId: command.tenantId, allocationSetId: current.id },
        select: { id: true, replenishmentOrderLineId: true },
      });
      const cargoByReplenishmentLine = new Map(
        allocations.flatMap((allocation) =>
          allocation.replenishmentOrderLineId
            ? [
                [
                  allocation.replenishmentOrderLineId,
                  cargoGroups.get(allocation.sourceLineId)!.id,
                ] as const,
              ]
            : [],
        ),
      );
      if (
        existingAllocations.some(
          ({ replenishmentOrderLineId }) =>
            !replenishmentOrderLineId ||
            !cargoByReplenishmentLine.has(replenishmentOrderLineId),
        )
      ) {
        throw new ShipmentHandoffAcceptanceConflictError(
          "CARGO_ALLOCATION_REQUIRED",
        );
      }
      for (const allocation of existingAllocations) {
        await tx.containerCargoAllocation.update({
          where: { id: allocation.id },
          data: {
            shipmentCargoLineId: cargoByReplenishmentLine.get(
              allocation.replenishmentOrderLineId!,
            ),
          },
        });
      }
      continue;
    }
    if (current) {
      await tx.containerCargoAllocationSet.update({
        where: { id: current.id },
        data: { state: "superseded", supersededAt: new Date() },
      });
    }
    if (allocations.length === 0) continue;
    const allocationSetId = randomUUID();
    await tx.containerCargoAllocationSet.create({
      data: {
        id: allocationSetId,
        tenantId: command.tenantId,
        containerRecordId: resolved.containerRecordId,
        version: (current?.version ?? 0) + 1,
        state: "active",
        supersedesSetId: current?.id,
        ingestionChannel: command.source.channel,
        sourceSystem: command.source.system,
        evidenceRefs: command.evidenceReferences,
        idempotencyKey: `${command.source.idempotencyKey}:cargo:${container.referenceId}`,
        payloadHash,
      },
    });
    await tx.containerCargoAllocation.createMany({
      data: allocations.map((allocation) => ({
        id: randomUUID(),
        tenantId: command.tenantId,
        allocationSetId,
        shipmentCargoLineId: cargoGroups.get(allocation.sourceLineId)!.id,
        allocatedQuantity: allocation.quantity,
        quantityUnit: allocation.quantityUnit,
        packageCount: allocation.packageCount,
        packageUnit: allocation.packageUnit,
        grossWeight: allocation.grossWeight,
        weightUnit: allocation.weightUnit,
        volume: allocation.volume,
        volumeUnit: allocation.volumeUnit,
      })),
    });
  }
}

async function createContainerDocumentLinks(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  handoffId: string,
  containers: Map<string, ResolvedContainer>,
  documents: Map<string, string>,
): Promise<void> {
  await tx.shipmentContainerDocumentLink.createMany({
    data: command.containers.flatMap((container) => {
      const resolved = containers.get(container.referenceId)!;
      return container.billReferences.map((reference) => ({
        id: randomUUID(),
        tenantId: command.tenantId,
        shipmentId,
        containerRecordId: resolved.containerRecordId,
        shipmentContainerLinkId: resolved.shipmentContainerLinkId,
        transportDocumentId: documents.get(reference)!,
        sourceHandoffId: handoffId,
      }));
    }),
  });
}

async function createUpstreamReferences(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  handoffId: string,
  containers: Map<string, ResolvedContainer>,
  cargoGroups: Map<string, CargoGroup>,
  correction: boolean,
): Promise<void> {
  const activeReferences = correction
    ? await tx.shipmentUpstreamReference.findMany({
        where: { tenantId: command.tenantId, shipmentId, state: "active" },
        select: {
          id: true,
          containerRecordId: true,
          referenceType: true,
          sourceSystem: true,
          sourceRecordId: true,
          sourceLineId: true,
        },
      })
    : [];
  const activeByIdentity = new Map(
    activeReferences.map((reference) => [
      upstreamReferenceIdentity(reference),
      reference,
    ]),
  );
  if (activeReferences.length > 0) {
    await tx.shipmentUpstreamReference.updateMany({
      where: { id: { in: activeReferences.map(({ id }) => id) } },
      data: { state: "superseded", supersededAt: new Date() },
    });
  }
  const references = command.containers.flatMap((container) => {
    const resolved = containers.get(container.referenceId)!;
    return container.upstreamReferences.map((reference) => {
      const identity = upstreamReferenceIdentity({
        containerRecordId: resolved.containerRecordId,
        referenceType: reference.referenceType,
        sourceSystem: reference.sourceSystem,
        sourceRecordId: reference.sourceRecordId,
        sourceLineId: reference.sourceLineId ?? null,
      });
      return {
        id: randomUUID(),
        tenantId: command.tenantId,
        shipmentId,
        containerRecordId: resolved.containerRecordId,
        shipmentCargoLineId: reference.sourceLineId
          ? cargoGroups.get(reference.sourceLineId)?.id
          : undefined,
        referenceType: reference.referenceType,
        sourceSystem: reference.sourceSystem,
        sourceRecordId: reference.sourceRecordId,
        sourceVersion: reference.sourceVersion,
        sourceLineId: reference.sourceLineId,
        sourceHandoffId: handoffId,
        version: command.source.handoffVersion,
        state: "active",
        supersedesReferenceId: activeByIdentity.get(identity)?.id,
      };
    });
  });
  if (references.length > 0) {
    await tx.shipmentUpstreamReference.createMany({ data: references });
  }
}

async function supersedeRemovedContainerLinks(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  retainedContainerIds: Set<string>,
): Promise<void> {
  const removedLinks = await tx.shipmentContainerLink.findMany({
    where: {
      tenantId: command.tenantId,
      shipmentId,
      state: "active",
      containerRecordId: { notIn: [...retainedContainerIds] },
    },
    select: { id: true, containerRecordId: true },
  });
  if (removedLinks.length === 0) return;
  await tx.shipmentContainerLink.updateMany({
    where: { id: { in: removedLinks.map(({ id }) => id) } },
    data: { state: "superseded", supersededAt: new Date() },
  });
  await tx.containerCargoAllocationSet.updateMany({
    where: {
      tenantId: command.tenantId,
      containerRecordId: {
        in: removedLinks.map(({ containerRecordId }) => containerRecordId),
      },
      state: "active",
    },
    data: { state: "superseded", supersededAt: new Date() },
  });
}

function documentIdentity(input: {
  documentType: string;
  documentNumber: string;
}): string {
  return `${input.documentType}\u0000${input.documentNumber}`;
}

function sameTransportDocument(
  existing: {
    scac: string | null;
    parentDocumentId: string | null;
    parentDocument: {
      documentType: string;
      documentNumber: string;
    } | null;
  },
  incoming: ShipmentHandoffCommandV1["billsOfLading"][number],
  commandDocuments: Map<
    string,
    ShipmentHandoffCommandV1["billsOfLading"][number]
  >,
): boolean {
  const incomingParent = incoming.parentReferenceId
    ? commandDocuments.get(incoming.parentReferenceId)
    : undefined;
  return (
    (existing.scac ?? undefined) === incoming.scac &&
    (existing.parentDocument
      ? documentIdentity(existing.parentDocument)
      : undefined) ===
      (incomingParent ? documentIdentity(incomingParent) : undefined)
  );
}

function upstreamReferenceIdentity(input: {
  containerRecordId: string;
  referenceType: string;
  sourceSystem: string;
  sourceRecordId: string;
  sourceLineId: string | null;
}): string {
  return [
    input.containerRecordId,
    input.referenceType,
    input.sourceSystem,
    input.sourceRecordId,
    input.sourceLineId ?? "",
  ].join("\u0000");
}

function sameShipmentDescriptor(
  storedPayload: Prisma.JsonValue,
  incoming: ShipmentHandoffCommandV1,
): boolean {
  if (
    typeof storedPayload !== "object" ||
    storedPayload === null ||
    Array.isArray(storedPayload) ||
    typeof storedPayload.shipment !== "object" ||
    storedPayload.shipment === null ||
    Array.isArray(storedPayload.shipment)
  ) {
    return false;
  }
  const storedShipment = {
    ...(storedPayload.shipment as Record<string, Prisma.JsonValue>),
  };
  const incomingShipment = { ...incoming.shipment } as Record<
    string,
    Prisma.JsonValue | undefined
  >;
  delete storedShipment.expectedRelationshipVersion;
  delete incomingShipment.expectedRelationshipVersion;
  return (
    stableJson(storedShipment) ===
    stableJson(incomingShipment as unknown as Prisma.JsonValue)
  );
}

function stableJson(value: Prisma.JsonValue): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, Prisma.JsonValue] => entry[1] !== undefined,
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  ) as Prisma.JsonObject;
}

async function assertReferencedMasterData(
  tx: Transaction,
  tenantId: string,
  cargoGroups: Map<string, CargoGroup>,
): Promise<void> {
  const groups = [...cargoGroups.values()];
  const skuIds = [
    ...new Set(groups.flatMap((group) => group.productSkuId ?? [])),
  ];
  if (skuIds.length > 0) {
    const skus = await tx.productSku.findMany({
      where: { tenantId, id: { in: skuIds } },
      select: { id: true, productNumber: true },
    });
    const byId = new Map(skus.map((sku) => [sku.id, sku.productNumber]));
    for (const group of groups) {
      if (
        group.productSkuId &&
        byId.get(group.productSkuId) !== group.productNumber
      ) {
        throw conflict("PRODUCT_SKU_REFERENCE_INVALID");
      }
    }
  }
  const replenishmentLineIds = [
    ...new Set(groups.flatMap((group) => group.replenishmentOrderLineId ?? [])),
  ];
  if (replenishmentLineIds.length > 0) {
    const count = await tx.replenishmentOrderLine.count({
      where: { tenantId, id: { in: replenishmentLineIds } },
    });
    if (count !== replenishmentLineIds.length) {
      throw conflict("REPLENISHMENT_ORDER_LINE_REFERENCE_INVALID");
    }
  }
}

function buildCargoGroups(
  command: ShipmentHandoffCommandV1,
): Map<string, CargoGroup> {
  const inputs = command.containers.flatMap(
    (container) => container.cargoAllocations ?? [],
  );
  const grouped = new Map<string, typeof inputs>();
  for (const allocation of inputs) {
    const current = grouped.get(allocation.sourceLineId) ?? [];
    current.push(allocation);
    grouped.set(allocation.sourceLineId, current);
  }
  const result = new Map<string, CargoGroup>();
  for (const [sourceLineId, allocations] of grouped) {
    const first = allocations[0]!;
    for (const allocation of allocations.slice(1)) {
      if (
        allocation.productSkuId !== first.productSkuId ||
        allocation.productNumber !== first.productNumber ||
        allocation.quantityUnit !== first.quantityUnit ||
        allocation.packageUnit !== first.packageUnit ||
        allocation.weightUnit !== first.weightUnit ||
        allocation.volumeUnit !== first.volumeUnit ||
        allocation.replenishmentOrderLineId !== first.replenishmentOrderLineId
      ) {
        throw conflict("CARGO_SOURCE_LINE_INCONSISTENT");
      }
    }
    result.set(sourceLineId, {
      id: randomUUID(),
      sourceLineId,
      productSkuId: first.productSkuId,
      productNumber: first.productNumber,
      quantity: sumDecimal(allocations.map(({ quantity }) => quantity)),
      quantityUnit: first.quantityUnit,
      ...aggregateOptional(allocations, "packageCount", "packageUnit"),
      ...aggregateOptional(allocations, "grossWeight", "weightUnit"),
      ...aggregateOptional(allocations, "volume", "volumeUnit"),
      replenishmentOrderLineId: first.replenishmentOrderLineId,
    });
  }
  return result;
}

function aggregateOptional<
  T extends "packageCount" | "grossWeight" | "volume",
  U extends "packageUnit" | "weightUnit" | "volumeUnit",
>(
  allocations: CargoAllocation[],
  valueKey: T,
  unitKey: U,
): Partial<Record<T | U, string>> {
  if (allocations.some((allocation) => !allocation[valueKey])) return {};
  return {
    [valueKey]: sumDecimal(
      allocations.map((allocation) => allocation[valueKey]!),
    ),
    [unitKey]: allocations[0]![unitKey]!,
  } as Partial<Record<T | U, string>>;
}

function sumDecimal(values: string[]): string {
  const total = values.reduce((sum, value) => sum + scaled(value), 0n);
  const whole = total / 10_000n;
  const fraction = (total % 10_000n)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function scaled(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
}

function buildLifecycleRequest(
  command: ShipmentHandoffCommandV1,
  shipmentId: string,
  containerIds: string[],
  relationshipVersion: number,
): StartPostDepartureLifecycleCommandV2 {
  return {
    shipmentId,
    containerIds:
      containerIds as StartPostDepartureLifecycleCommandV2["containerIds"],
    flowDefinitionCode: POST_DEPARTURE_FLOW_DEFINITION_CODE,
    definitionVersion: POST_DEPARTURE_FLOW_DEFINITION_VERSION,
    departureEventId: randomUUID(),
    relationshipVersion,
    idempotencyKey: `${command.source.idempotencyKey}:post-departure`,
    traceId: command.source.traceId,
  };
}

async function persistLifecycleOutbox(
  tx: Transaction,
  command: ShipmentHandoffCommandV1,
  handoffId: string,
  shipmentId: string,
  request: StartPostDepartureLifecycleCommandV2,
): Promise<void> {
  await tx.outboxMessage.create({
    data: {
      id: randomUUID(),
      tenantId: command.tenantId,
      ownerModule: "shipment-registry",
      eventId: randomUUID(),
      eventType: POST_DEPARTURE_LIFECYCLE_EVENT_TYPE,
      eventVersion: POST_DEPARTURE_LIFECYCLE_EVENT_VERSION,
      aggregateType: "shipment",
      aggregateId: shipmentId,
      payloadRef: `shipment-handoff-lifecycle/${handoffId}`,
      payloadHash: hashPostDepartureLifecycleCommand(request),
      state: "pending",
      occurredAt: new Date(command.source.occurredAt),
      idempotencyKey: request.idempotencyKey,
      traceId: command.source.traceId,
    },
  });
}

function buildAcceptedObjectResults(
  command: ShipmentHandoffCommandV1,
  containers: Map<string, ResolvedContainer>,
  cargoGroups: Map<string, CargoGroup>,
  documents: Map<string, string>,
  issues: ShipmentHandoffIssueV1[],
): ShipmentHandoffObjectResultV1[] {
  const issueCodesFor = (subjectRef: string) =>
    [
      ...new Set(
        issues
          .filter((current) =>
            current.subjectRef ? current.subjectRef === subjectRef : true,
          )
          .map(({ code }) => code),
      ),
    ].sort();
  return [
    ...command.containers.map((container) => ({
      objectType: "container" as const,
      sourceReferenceId: container.referenceId,
      state: "accepted" as const,
      entityId: containers.get(container.referenceId)!.containerRecordId,
      issueCodes: issueCodesFor(container.referenceId),
    })),
    ...[...cargoGroups.values()].map((group) => ({
      objectType: "cargo_line" as const,
      sourceReferenceId: group.sourceLineId,
      state: "accepted" as const,
      entityId: group.id,
      issueCodes: issueCodesFor(group.sourceLineId),
    })),
    ...command.billsOfLading.map((document) => ({
      objectType: "transport_document" as const,
      sourceReferenceId: document.referenceId,
      state: "accepted" as const,
      entityId: documents.get(document.referenceId)!,
      issueCodes: issueCodesFor(document.referenceId),
    })),
  ];
}

function buildUnacceptedObjectResults(
  command: ShipmentHandoffCommandV1,
  state: "review_required" | "rejected",
  issues: ShipmentHandoffIssueV1[],
): ShipmentHandoffObjectResultV1[] {
  const issueCodes = [...new Set(issues.map(({ code }) => code))].sort();
  return [
    ...command.containers.map((container) => ({
      objectType: "container" as const,
      sourceReferenceId: container.referenceId,
      state,
      issueCodes,
    })),
    ...[
      ...new Set(
        command.containers.flatMap((container) =>
          (container.cargoAllocations ?? []).map(
            ({ sourceLineId }) => sourceLineId,
          ),
        ),
      ),
    ].map((sourceLineId) => ({
      objectType: "cargo_line" as const,
      sourceReferenceId: sourceLineId,
      state,
      issueCodes,
    })),
    ...command.billsOfLading.map((document) => ({
      objectType: "transport_document" as const,
      sourceReferenceId: document.referenceId,
      state,
      issueCodes,
    })),
  ];
}

async function persistObjectResults(
  tx: Transaction,
  tenantId: string,
  handoffId: string,
  results: ShipmentHandoffObjectResultV1[],
): Promise<void> {
  if (results.length === 0) return;
  await tx.shipmentHandoffObjectResult.createMany({
    data: results.map((result) => ({
      id: randomUUID(),
      tenantId,
      handoffId,
      objectType: result.objectType,
      sourceRef: result.sourceReferenceId,
      resultState: result.state,
      entityId: result.entityId,
      issueCodes: result.issueCodes,
    })),
  });
}

function resultFrom(
  command: ShipmentHandoffCommandV1,
  handoffId: string,
  shipmentId: string | undefined,
  duplicate: boolean,
  status: string,
  issues: ShipmentHandoffIssueV1[],
  objectResults: ShipmentHandoffObjectResultV1[],
): ShipmentHandoffResultV1 {
  const accepted = status === "accepted" || status === "superseded";
  const lifecycleInitializationState = accepted
    ? "pending"
    : status === "review_required"
      ? "review_required"
      : "rejected";
  return {
    receptionState: duplicate ? "duplicate" : "received",
    businessDecisionState: accepted ? "accepted" : "rejected",
    commitState: "committed",
    handoffId,
    handoffVersion: command.source.handoffVersion,
    duplicate,
    ...(shipmentId ? { shipmentId } : {}),
    containerResults: filterResults(objectResults, "container"),
    cargoResults: filterResults(objectResults, "cargo_line"),
    documentResults: filterResults(objectResults, "transport_document"),
    lifecycleInitializationState,
    customsAssimilationState: "not_applicable",
    inlandAssimilationState: "not_applicable",
    warehouseAssimilationState: "not_applicable",
    issues,
    traceId: command.source.traceId,
  };
}

function filterResults(
  results: ShipmentHandoffObjectResultV1[],
  objectType: ShipmentHandoffObjectResultV1["objectType"],
): ShipmentHandoffObjectResultV1[] {
  return results.filter((result) => result.objectType === objectType);
}

function assertCompatibleContainer(
  current: {
    containerNumber: string | null;
    containerTypeCode: string | null;
    sealNumber: string | null;
  },
  incoming: ShipmentHandoffCommandV1["containers"][number],
): void {
  if (
    (current.containerNumber &&
      incoming.containerNumber &&
      current.containerNumber !== incoming.containerNumber) ||
    (current.containerTypeCode &&
      incoming.containerTypeCode &&
      current.containerTypeCode !== incoming.containerTypeCode) ||
    (current.sealNumber &&
      incoming.sealNumber &&
      current.sealNumber !== incoming.sealNumber)
  ) {
    throw conflict("CONTAINER_SOURCE_IDENTITY_CONFLICT");
  }
}

async function acquireAdvisoryLocks(
  tx: Transaction,
  lockKeys: string[],
): Promise<void> {
  for (const lockKey of [...new Set(lockKeys)].sort()) {
    await tx.$queryRaw`
      SELECT 1 AS "lockAcquired"
      FROM (
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      ) AS acquired
    `;
  }
}

function issue(
  code: ShipmentHandoffIssueV1["code"],
  messageKey: string,
  subjectRef?: string,
): ShipmentHandoffIssueV1 {
  return { code, messageKey, ...(subjectRef ? { subjectRef } : {}) };
}

function conflict(
  code: string,
  issues: ShipmentHandoffIssueV1[] = [],
): ShipmentHandoffAcceptanceConflictError {
  return new ShipmentHandoffAcceptanceConflictError(code, issues);
}

function parseObjectType(
  value: string,
): ShipmentHandoffObjectResultV1["objectType"] {
  if (
    value !== "container" &&
    value !== "cargo_line" &&
    value !== "transport_document"
  ) {
    throw new Error("SHIPMENT_HANDOFF_OBJECT_RESULT_INVALID");
  }
  return value;
}

function parseIssueCodes(value: unknown): ShipmentHandoffIssueV1["code"][] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !HANDOFF_ISSUE_CODES.has(item as ShipmentHandoffIssueV1["code"]),
    )
  ) {
    throw new Error("SHIPMENT_HANDOFF_OBJECT_RESULT_INVALID");
  }
  return value as ShipmentHandoffIssueV1["code"][];
}
