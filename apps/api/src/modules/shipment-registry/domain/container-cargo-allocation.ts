import { createHash } from "node:crypto";
import rawImportFieldCatalog, {
  type ImportFieldCatalog,
  type QuantityUnitCode,
} from "@logix/contracts/import-fields.json";

export interface ContainerCargoAllocationInput {
  replenishmentOrderLineId: string;
  allocatedQuantity: string;
  quantityUnit: QuantityUnitCode;
}

export interface ReplaceContainerCargoAllocationsCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  ingestionChannel: "api" | "webhook" | "file_import" | "manual_ui";
  sourceSystem: string;
  evidenceRefs: string[];
  idempotencyKey: string;
  allocations: ContainerCargoAllocationInput[];
}

export interface NormalizedReplaceContainerCargoAllocationsCommand extends ReplaceContainerCargoAllocationsCommand {
  payloadHash: string;
}

export interface ContainerCargoAllocationResult {
  allocationSetId: string;
  containerRecordId: string;
  version: number;
  allocationCount: number;
  duplicate: boolean;
}

export class ContainerCargoAllocationValidationError extends Error {}
export class ContainerCargoAllocationConflictError extends Error {}
export class ContainerCargoAllocationNotFoundError extends Error {}

const importFieldCatalog: ImportFieldCatalog = rawImportFieldCatalog;
const quantityUnits = new Set(
  importFieldCatalog.quantityUnits.map(({ code }) => code),
);

export function normalizeReplaceContainerCargoAllocationsCommand(
  input: ReplaceContainerCargoAllocationsCommand,
): NormalizedReplaceContainerCargoAllocationsCommand {
  const tenantId = validatedText(input.tenantId, "tenantId", 128);
  const containerRecordId = validatedUuid(
    input.containerRecordId,
    "containerRecordId",
  );
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0
  ) {
    fail("expectedVersion");
  }
  if (!INGESTION_CHANNELS.has(input.ingestionChannel)) {
    fail("ingestionChannel");
  }
  const sourceSystem = validatedText(input.sourceSystem, "sourceSystem", 128);
  const idempotencyKey = validatedText(
    input.idempotencyKey,
    "idempotencyKey",
    200,
  );
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    fail("evidenceRefs");
  }
  const evidenceRefs = [
    ...new Set(
      input.evidenceRefs.map((value) => validatedUuid(value, "evidenceRefs")),
    ),
  ].sort();
  if (evidenceRefs.length !== input.evidenceRefs.length) {
    fail("evidenceRefs");
  }
  if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
    fail("allocations");
  }
  const seenLineIds = new Set<string>();
  const allocations = input.allocations
    .map((allocation) => {
      const replenishmentOrderLineId = validatedUuid(
        allocation.replenishmentOrderLineId,
        "replenishmentOrderLineId",
      );
      if (seenLineIds.has(replenishmentOrderLineId)) {
        fail("allocations.replenishmentOrderLineId");
      }
      seenLineIds.add(replenishmentOrderLineId);
      if (!quantityUnits.has(allocation.quantityUnit)) {
        fail("allocations.quantityUnit");
      }
      return {
        replenishmentOrderLineId,
        allocatedQuantity: normalizePositiveQuantity(
          allocation.allocatedQuantity,
        ),
        quantityUnit: allocation.quantityUnit,
      };
    })
    .sort((left, right) =>
      left.replenishmentOrderLineId.localeCompare(
        right.replenishmentOrderLineId,
      ),
    );
  const canonical = {
    contractVersion: "container-cargo-allocation-v1",
    tenantId,
    containerRecordId,
    expectedVersion: input.expectedVersion,
    ingestionChannel: input.ingestionChannel,
    sourceSystem,
    evidenceRefs,
    allocations,
  };
  return {
    ...canonical,
    idempotencyKey,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(canonical), "utf8")
      .digest("hex"),
  };
}

export function quantityToScaledInteger(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

function normalizePositiveQuantity(value: string): string {
  if (typeof value !== "string" || !QUANTITY_PATTERN.test(value)) {
    fail("allocations.allocatedQuantity");
  }
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
  if (quantityToScaledInteger(normalized) <= 0n) {
    fail("allocations.allocatedQuantity");
  }
  return normalized;
}

function validatedText(
  value: string,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim() ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  ) {
    fail(field);
  }
  return value;
}

function validatedUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function fail(field: string): never {
  throw new ContainerCargoAllocationValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
const INGESTION_CHANNELS = new Set([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
