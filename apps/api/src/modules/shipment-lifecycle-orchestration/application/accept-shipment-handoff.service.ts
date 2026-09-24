import { Inject, Injectable } from "@nestjs/common";
import type { ShipmentHandoffResultV1 } from "@logix/contracts";
import {
  ASSERT_EVIDENCE_AVAILABLE,
  type AssertEvidenceAvailablePort,
} from "../../document-records";
import {
  COMMIT_SHIPMENT_HANDOFF,
  type CommitShipmentHandoffPort,
} from "../../shipment-registry";
import type {
  AcceptShipmentHandoffPort,
  ShipmentHandoffRequestContext,
} from "../shipment-handoff.port";
import { PreflightShipmentHandoffService } from "./preflight-shipment-handoff.service";

@Injectable()
export class AcceptShipmentHandoffService implements AcceptShipmentHandoffPort {
  constructor(
    private readonly preflightService: PreflightShipmentHandoffService,
    @Inject(COMMIT_SHIPMENT_HANDOFF)
    private readonly commitHandoff: CommitShipmentHandoffPort,
    @Inject(ASSERT_EVIDENCE_AVAILABLE)
    private readonly assertEvidenceAvailable: AssertEvidenceAvailablePort,
  ) {}

  async accept(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<ShipmentHandoffResultV1> {
    const prepared = await this.preflightService.prepareWithDatabaseConflicts(
      input,
      context,
    );
    if (prepared.result.decision !== "rejected" && !prepared.result.duplicate) {
      const departureEvidence =
        prepared.command.shipment.departureProof?.evidenceRef;
      const evidenceIds = [
        ...new Set([
          ...prepared.command.evidenceReferences,
          ...(departureEvidence ? [departureEvidence] : []),
        ]),
      ].sort();
      if (evidenceIds.length > 0) {
        await this.assertEvidenceAvailable.execute({
          tenantId: context.tenantId,
          evidenceIds,
        });
      }
    }
    return this.commitHandoff.execute({
      actorId: context.actorId,
      command: prepared.command,
      preflight: prepared.result,
    });
  }
}
