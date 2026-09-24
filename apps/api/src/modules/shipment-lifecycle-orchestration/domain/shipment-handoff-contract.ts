import type { ShipmentHandoffCommandV1 } from "@logix/contracts";
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

export class ShipmentHandoffContractValidationError extends Error {
  constructor(readonly validationErrors: string[]) {
    super("SHIPMENT_HANDOFF_CONTRACT_INVALID");
  }
}

export function validateShipmentHandoffCommand(
  input: unknown,
): ShipmentHandoffCommandV1 {
  if (!commandValidator(input)) {
    throw new ShipmentHandoffContractValidationError(
      normalizeErrors(commandValidator.errors),
    );
  }
  return input;
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
