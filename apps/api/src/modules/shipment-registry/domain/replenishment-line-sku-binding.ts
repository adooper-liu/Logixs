export interface BindReplenishmentLineProductSkuCommand {
  tenantId: string;
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  expectedVersion: number;
}

export type NormalizedBindReplenishmentLineProductSkuCommand =
  BindReplenishmentLineProductSkuCommand;

export interface BoundReplenishmentLineProductSku {
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  version: number;
  duplicate: boolean;
}

export class ReplenishmentLineSkuBindingValidationError extends Error {}
export class ReplenishmentLineSkuBindingConflictError extends Error {}
export class ReplenishmentLineNotFoundError extends Error {}

export function normalizeBindReplenishmentLineProductSkuCommand(
  input: BindReplenishmentLineProductSkuCommand,
): NormalizedBindReplenishmentLineProductSkuCommand {
  return {
    tenantId: validatedText(input.tenantId, "tenantId", 128),
    replenishmentOrderLineId: validatedUuid(
      input.replenishmentOrderLineId,
      "replenishmentOrderLineId",
    ),
    productSkuId: validatedUuid(input.productSkuId, "productSkuId"),
    productNumber: validatedText(input.productNumber, "productNumber", 128),
    expectedVersion: validatedVersion(input.expectedVersion),
  };
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
    throw new ReplenishmentLineSkuBindingValidationError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value;
}

function validatedUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new ReplenishmentLineSkuBindingValidationError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value.toLowerCase();
}

function validatedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ReplenishmentLineSkuBindingValidationError(
      "VALIDATION_FORMAT: expectedVersion",
    );
  }
  return value;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
