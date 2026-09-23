import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ShipmentHandoffPreflightResultV1 } from "@logix/contracts";
import {
  INSPECT_SHIPMENT_HANDOFF_CONFLICTS,
  type InspectShipmentHandoffConflictsPort,
} from "../../shipment-registry";
import {
  isRejectingShipmentHandoffIssue,
  preflightShipmentHandoff,
} from "../domain/shipment-handoff-preflight";
import type { NormalizedShipmentHandoffPreflight } from "../domain/shipment-handoff-preflight";
import {
  ShipmentHandoffContractValidationError,
  validateShipmentHandoffCommand,
} from "../domain/shipment-handoff-contract";
import type {
  PreflightShipmentHandoffPort,
  ShipmentHandoffRequestContext,
} from "../shipment-handoff.port";

@Injectable()
export class PreflightShipmentHandoffService implements PreflightShipmentHandoffPort {
  constructor(
    @Inject(INSPECT_SHIPMENT_HANDOFF_CONFLICTS)
    private readonly conflictInspector: InspectShipmentHandoffConflictsPort,
  ) {}

  async preflight(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<ShipmentHandoffPreflightResultV1> {
    return (await this.prepareWithDatabaseConflicts(input, context)).result;
  }

  async prepareWithDatabaseConflicts(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<NormalizedShipmentHandoffPreflight> {
    const prepared = this.prepare(input, context);
    const database = await this.conflictInspector.inspect(
      prepared.command,
      prepared.result.payloadHash,
    );
    const issues = [...prepared.result.issues, ...database.issues];
    const decision = issues.some(({ code }) =>
      isRejectingShipmentHandoffIssue(code),
    )
      ? "rejected"
      : issues.length > 0
        ? "review_required"
        : "ready";
    return {
      command: prepared.command,
      result: {
        ...prepared.result,
        decision,
        duplicate: database.duplicate,
        issues,
      },
    };
  }

  prepare(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): NormalizedShipmentHandoffPreflight {
    let command;
    try {
      command = validateShipmentHandoffCommand(input);
    } catch (error) {
      if (error instanceof ShipmentHandoffContractValidationError) {
        throw new BadRequestException({
          code: error.message,
          details: error.validationErrors,
        });
      }
      throw error;
    }
    if (command.tenantId !== context.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (
      command.shipment.departureProof.kind ===
        "authorized_manual_confirmation" &&
      command.shipment.departureProof.confirmedBy !== context.actorId
    ) {
      throw new ForbiddenException(
        "MANUAL_DEPARTURE_CONFIRMATION_ACTOR_MISMATCH",
      );
    }
    return preflightShipmentHandoff(command);
  }
}
