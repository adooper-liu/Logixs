import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffCommandV2,
} from "@logix/contracts";
import commonSchema from "@logix/contracts/schemas/v1/common.schema.json";
import shipmentHandoffSchema from "@logix/contracts/schemas/v1/shipment-handoff.schema.json";
import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  strictTypes: false,
});
addFormats(ajv);
ajv.addSchema(commonSchema);
ajv.addSchema(shipmentHandoffSchema);

const commandValidator = requiredValidator<ShipmentHandoffCommandV1>(
  `${shipmentHandoffSchema.$id}#/$defs/ShipmentHandoffCommandV1`,
);
const commandV2Validator = requiredValidator<ShipmentHandoffCommandV2>(
  `${shipmentHandoffSchema.$id}#/$defs/ShipmentHandoffCommandV2`,
);

type ShipmentHandoffCommand =
  ShipmentHandoffCommandV1 | ShipmentHandoffCommandV2;

export class ShipmentHandoffContractValidationError extends Error {
  constructor(readonly validationErrors: string[]) {
    super("SHIPMENT_HANDOFF_CONTRACT_INVALID");
  }
}

export function validateShipmentHandoffCommand(
  input: unknown,
): ShipmentHandoffCommand {
  const validator =
    (input as { contractVersion?: unknown } | null)?.contractVersion ===
    "shipment-handoff.v2"
      ? commandV2Validator
      : commandValidator;
  if (!validator(input)) {
    throw new ShipmentHandoffContractValidationError(
      normalizeErrors(validator.errors),
    );
  }
  return input as ShipmentHandoffCommand;
}

function requiredValidator<T>(schemaRef: string): ValidateFunction<T> {
  const validator = ajv.getSchema<T>(schemaRef);
  if (!validator)
    throw new Error(`CONTRACT_SCHEMA_NOT_REGISTERED: ${schemaRef}`);
  return validator;
}

function normalizeErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? [])
    .map(
      (error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`,
    )
    .sort();
}
