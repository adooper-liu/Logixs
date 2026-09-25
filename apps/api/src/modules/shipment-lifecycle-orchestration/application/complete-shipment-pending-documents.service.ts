import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ShipmentPendingDocumentCompletionCommandV1,
  ShipmentPendingDocumentCompletionResultV1,
} from "@logix/contracts";
import {
  SHIPMENT_PENDING_DOCUMENT_COMPLETION,
  GetShipmentService,
  ShipmentPendingDocumentCompletionConflictError,
  ShipmentPendingDocumentCompletionNotFoundError,
  type ShipmentPendingDocumentCompletionPort,
} from "../../shipment-registry";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES = new Set(["booking", "mbl", "hbl"]);
const SCAC_PATTERN = /^[A-Z0-9]{2,4}$/;

@Injectable()
export class CompleteShipmentPendingDocumentsService {
  constructor(
    private readonly getShipment: GetShipmentService,
    @Inject(SHIPMENT_PENDING_DOCUMENT_COMPLETION)
    private readonly completion: ShipmentPendingDocumentCompletionPort,
  ) {}

  async execute(
    shipmentId: string,
    input: unknown,
    context: { tenantId?: string; actorId?: string },
  ): Promise<ShipmentPendingDocumentCompletionResultV1> {
    if (!context.tenantId || !context.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!UUID_PATTERN.test(shipmentId)) {
      throw new BadRequestException("SHIPMENT_PENDING_DOCUMENT_INVALID");
    }
    const command = normalizeCommand(input);
    const current = await this.getShipment.execute({
      tenantId: context.tenantId,
      id: shipmentId,
    });
    if (
      current.shipment.relationshipVersion !==
      command.expectedRelationshipVersion
    ) {
      throw new ConflictException("TARGET_SHIPMENT_VERSION_CONFLICT");
    }
    const activeContainerIds = new Set(
      current.containers.map(({ containerRecordId }) => containerRecordId),
    );
    if (
      command.documents.some((document) =>
        document.containerRecordIds.some(
          (containerRecordId) => !activeContainerIds.has(containerRecordId),
        ),
      )
    ) {
      throw new ConflictException("SHIPMENT_CONTAINER_REFERENCE_INVALID");
    }
    const traceId = deterministicTraceId(
      context.tenantId,
      shipmentId,
      command.idempotencyKey,
    );
    try {
      const saved = await this.completion.complete({
        tenantId: context.tenantId,
        actorId: context.actorId,
        shipmentId,
        command,
        traceId,
      });
      return {
        contractVersion: "shipment-pending-document-completion-result.v1",
        status: saved.duplicate ? "duplicate" : "saved",
        shipmentId,
        relationshipVersion: saved.relationshipVersion,
        documentCount: saved.documentCount,
        traceId: saved.traceId,
      };
    } catch (error) {
      if (error instanceof ShipmentPendingDocumentCompletionNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ShipmentPendingDocumentCompletionConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}

function normalizeCommand(
  input: unknown,
): ShipmentPendingDocumentCompletionCommandV1 {
  if (
    !isRecord(input) ||
    input.contractVersion !== "shipment-pending-document-completion.v1" ||
    !Number.isInteger(input.expectedRelationshipVersion) ||
    Number(input.expectedRelationshipVersion) < 1 ||
    typeof input.occurredAt !== "string" ||
    !isDateTime(input.occurredAt) ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length < 1 ||
    input.idempotencyKey.length > 200 ||
    !Array.isArray(input.documents) ||
    input.documents.length < 1 ||
    input.documents.length > 50 ||
    Object.keys(input).some(
      (key) =>
        ![
          "contractVersion",
          "expectedRelationshipVersion",
          "occurredAt",
          "idempotencyKey",
          "documents",
        ].includes(key),
    )
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_DOCUMENT_INVALID");
  }
  const documents = input.documents.map(normalizeDocument);
  const identities = documents.map(
    ({ documentType, documentNumber }) =>
      `${documentType}\u0000${documentNumber}`,
  );
  if (new Set(identities).size !== identities.length) {
    throw new BadRequestException("SHIPMENT_PENDING_DOCUMENT_INVALID");
  }
  return {
    contractVersion: "shipment-pending-document-completion.v1",
    expectedRelationshipVersion: Number(input.expectedRelationshipVersion),
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    documents: [documents[0]!, ...documents.slice(1)],
  };
}

function normalizeDocument(
  value: unknown,
): ShipmentPendingDocumentCompletionCommandV1["documents"][number] {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "documentType",
          "documentNumber",
          "scac",
          "containerRecordIds",
        ].includes(key),
    ) ||
    typeof value.documentType !== "string" ||
    !DOCUMENT_TYPES.has(value.documentType) ||
    typeof value.documentNumber !== "string" ||
    !value.documentNumber.trim() ||
    value.documentNumber.trim().length > 200 ||
    !Array.isArray(value.containerRecordIds) ||
    value.containerRecordIds.length < 1 ||
    value.containerRecordIds.some(
      (containerRecordId) =>
        typeof containerRecordId !== "string" ||
        !UUID_PATTERN.test(containerRecordId),
    )
  ) {
    throw new BadRequestException("SHIPMENT_PENDING_DOCUMENT_INVALID");
  }
  const containerRecordIds = [
    ...new Set(
      (value.containerRecordIds as string[]).map((containerRecordId) =>
        containerRecordId.toLowerCase(),
      ),
    ),
  ];
  const scac =
    typeof value.scac === "string" && value.scac.trim()
      ? value.scac.trim().toUpperCase()
      : null;
  if (scac && !SCAC_PATTERN.test(scac)) {
    throw new BadRequestException("SHIPMENT_PENDING_DOCUMENT_INVALID");
  }
  return {
    documentType: value.documentType as "booking" | "mbl" | "hbl",
    documentNumber: value.documentNumber.trim(),
    scac,
    containerRecordIds: [
      containerRecordIds[0]!,
      ...containerRecordIds.slice(1),
    ],
  };
}

function deterministicTraceId(
  tenantId: string,
  shipmentId: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`${tenantId}:${shipmentId}:${idempotencyKey}`)
    .digest("hex");
  return `shipment-document-completion:${digest.slice(0, 32)}`;
}

function isDateTime(value: string): boolean {
  return (
    !Number.isNaN(Date.parse(value)) &&
    /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
