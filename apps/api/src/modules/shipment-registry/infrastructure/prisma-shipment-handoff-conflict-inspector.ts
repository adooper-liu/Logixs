import { Inject, Injectable } from "@nestjs/common";
import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
} from "@logix/contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  InspectShipmentHandoffConflictsPort,
  ShipmentHandoffConflictInspection,
} from "../inspect-shipment-handoff-conflicts.port";

@Injectable()
export class PrismaShipmentHandoffConflictInspector implements InspectShipmentHandoffConflictsPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async inspect(
    command: ShipmentHandoffCommandV1,
    payloadHash: string,
  ): Promise<ShipmentHandoffConflictInspection> {
    const existingHandoffs = await this.prisma.shipmentHandoffRecord.findMany({
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
      orderBy: { id: "asc" },
      take: 2,
      select: { id: true, payloadHash: true },
    });
    if (existingHandoffs.length > 0) {
      return existingHandoffs.length === 1 &&
        existingHandoffs[0]?.payloadHash === payloadHash
        ? { duplicate: true, issues: [] }
        : {
            duplicate: false,
            issues: [
              issue(
                "IDEMPOTENCY_PAYLOAD_CONFLICT",
                "shipment_handoff_idempotency_payload_conflict",
                command.source.externalHandoffId,
              ),
            ],
          };
    }

    const issues: ShipmentHandoffIssueV1[] = [];
    const { cargoOwnerReferenceId, cargoOwnerName, salesCountryCode } =
      command.shipment;
    if (cargoOwnerReferenceId && cargoOwnerName && salesCountryCode) {
      const cargoOwner = await this.prisma.cargoOwnerReference.findFirst({
        where: {
          id: cargoOwnerReferenceId,
          legalName: cargoOwnerName,
          release: { status: "active" },
          salesCountry: { alpha2: salesCountryCode },
        },
        select: { id: true },
      });
      if (!cargoOwner) {
        issues.push({
          code: "UNKNOWN_REFERENCE_CODE",
          messageKey: "shipment_handoff_cargo_owner_mapping_required",
          subjectRef: cargoOwnerName,
          fieldCodes: ["cargo_owner_reference_id", "sales_country_code"],
        });
      }
    }
    const correction = command.source.handoffVersion > 1;
    const predecessor = correction
      ? await this.prisma.shipmentHandoffRecord.findFirst({
          where: {
            tenantId: command.tenantId,
            sourceSystem: command.source.system,
            externalHandoffId: command.source.supersedesExternalHandoffId ?? "",
            handoffVersion: command.source.handoffVersion - 1,
          },
          select: {
            shipmentId: true,
            status: true,
            supersededBy: { select: { id: true } },
          },
        })
      : null;
    if (
      correction &&
      (!predecessor ||
        !predecessor.shipmentId ||
        predecessor.status !== "accepted" ||
        predecessor.supersededBy)
    ) {
      issues.push(
        issue(
          "SUPERSEDED_HANDOFF_NOT_FOUND",
          "shipment_handoff_superseded_handoff_not_found",
          command.source.supersedesExternalHandoffId,
        ),
      );
    }
    const targetShipment = command.shipment.externalShipmentId
      ? await this.prisma.shipment.findUnique({
          where: {
            tenantId_sourceSystem_sourceRecordId: {
              tenantId: command.tenantId,
              sourceSystem: command.source.system,
              sourceRecordId: command.shipment.externalShipmentId,
            },
          },
          select: { id: true, relationshipVersion: true },
        })
      : null;
    if (targetShipment && !correction) {
      issues.push(
        issue(
          "SHIPMENT_SOURCE_IDENTITY_CONFLICT",
          "shipment_handoff_source_identity_conflict",
          command.shipment.externalShipmentId,
        ),
      );
    }
    if (command.shipment.shipmentNumber) {
      const numberOwner = await this.prisma.shipment.findUnique({
        where: {
          tenantId_shipmentNumber: {
            tenantId: command.tenantId,
            shipmentNumber: command.shipment.shipmentNumber,
          },
        },
        select: { id: true },
      });
      if (numberOwner && numberOwner.id !== targetShipment?.id) {
        issues.push(
          issue(
            "SHIPMENT_NUMBER_CONFLICT",
            "shipment_handoff_number_conflict",
            command.shipment.shipmentNumber,
          ),
        );
      }
    }
    if (
      correction &&
      targetShipment &&
      targetShipment.relationshipVersion !==
        command.shipment.expectedRelationshipVersion
    ) {
      issues.push(
        issue(
          "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT",
          "shipment_handoff_relationship_version_conflict",
          command.shipment.externalShipmentId,
        ),
      );
    }
    if (
      correction &&
      predecessor?.shipmentId &&
      targetShipment &&
      predecessor.shipmentId !== targetShipment.id
    ) {
      issues.push(
        issue(
          "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT",
          "shipment_handoff_relationship_version_conflict",
          command.shipment.externalShipmentId,
        ),
      );
    }

    for (const container of command.containers) {
      const sourceRecordId =
        container.externalContainerId ??
        `${command.source.externalHandoffId}:${container.referenceId}`;
      const identity = await this.prisma.containerSourceIdentity.findUnique({
        where: {
          tenantId_sourceSystem_sourceRecordId: {
            tenantId: command.tenantId,
            sourceSystem: command.source.system,
            sourceRecordId,
          },
        },
        select: { containerRecordId: true },
      });
      const stuffing = container.stuffingSnapshotRef
        ? await this.prisma.containerStuffingSnapshot.findFirst({
            where: {
              id: container.stuffingSnapshotRef,
              tenantId: command.tenantId,
              state: "active",
            },
            select: { containerRecordId: true },
          })
        : null;
      if (container.stuffingSnapshotRef && !stuffing) {
        issues.push(
          issue(
            "STUFFING_SNAPSHOT_VERSION_STALE",
            "shipment_handoff_stuffing_snapshot_stale",
            container.referenceId,
          ),
        );
        continue;
      }
      if (
        identity &&
        stuffing &&
        identity.containerRecordId !== stuffing.containerRecordId
      ) {
        issues.push(
          issue(
            "CONTAINER_SOURCE_IDENTITY_CONFLICT",
            "shipment_handoff_container_source_identity_conflict",
            container.referenceId,
          ),
        );
        continue;
      }
      const containerRecordId =
        identity?.containerRecordId ?? stuffing?.containerRecordId;
      if (!containerRecordId) continue;
      const activeLink = await this.prisma.shipmentContainerLink.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId,
          state: "active",
        },
        select: { shipmentId: true },
      });
      if (
        activeLink &&
        (!targetShipment || activeLink.shipmentId !== targetShipment.id)
      ) {
        issues.push(
          issue(
            "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
            "shipment_handoff_container_active_shipment_conflict",
            container.referenceId,
          ),
        );
      }
    }
    return { duplicate: false, issues };
  }
}

function issue(
  code: ShipmentHandoffIssueV1["code"],
  messageKey: string,
  subjectRef?: string,
): ShipmentHandoffIssueV1 {
  return { code, messageKey, ...(subjectRef ? { subjectRef } : {}) };
}
