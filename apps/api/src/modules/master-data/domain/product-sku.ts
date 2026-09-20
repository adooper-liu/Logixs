import { createHash } from "node:crypto";

export interface RegisterProductSkuCommand {
  tenantId: string;
  productNumber: string;
  idempotencyKey: string;
}

export interface NormalizedRegisterProductSkuCommand extends RegisterProductSkuCommand {
  payloadHash: string;
}

export interface GetProductSkuQuery {
  tenantId: string;
  productSkuId: string;
}

export class ProductSkuCommandError extends Error {}

export function normalizeGetProductSkuQuery(
  input: GetProductSkuQuery,
): GetProductSkuQuery {
  const tenantId = validatedText(input.tenantId, "tenantId", 128);
  if (!UUID_PATTERN.test(input.productSkuId)) {
    throw new ProductSkuCommandError("VALIDATION_FORMAT: productSkuId");
  }
  return { tenantId, productSkuId: input.productSkuId.toLowerCase() };
}

export function normalizeRegisterProductSkuCommand(
  input: RegisterProductSkuCommand,
): NormalizedRegisterProductSkuCommand {
  const tenantId = validatedText(input.tenantId, "tenantId", 128);
  const productNumber = validatedText(
    input.productNumber,
    "productNumber",
    128,
  );
  const idempotencyKey = validatedText(
    input.idempotencyKey,
    "idempotencyKey",
    200,
  );
  return {
    tenantId,
    productNumber,
    idempotencyKey,
    payloadHash: createHash("sha256")
      .update(
        JSON.stringify({
          contractVersion: "product-sku-registration-v1",
          tenantId,
          productNumber,
        }),
        "utf8",
      )
      .digest("hex"),
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
    containsControlCharacter(value)
  ) {
    throw new ProductSkuCommandError(`VALIDATION_FORMAT: ${field}`);
  }
  return value;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
