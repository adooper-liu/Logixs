import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { InternalShipmentHandoffCandidatePageV1 } from "@logix/contracts";
import {
  INTERNAL_SHIPMENT_HANDOFF_SOURCE,
  type InternalShipmentHandoffSourcePort,
} from "../../shipment-registry";

@Injectable()
export class ListInternalShipmentHandoffCandidatesService {
  constructor(
    @Inject(INTERNAL_SHIPMENT_HANDOFF_SOURCE)
    private readonly source: InternalShipmentHandoffSourcePort,
  ) {}

  async execute(input: {
    tenantId?: string;
  }): Promise<InternalShipmentHandoffCandidatePageV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    return {
      items: await this.source.listCandidates({ tenantId: input.tenantId }),
      asOf: new Date().toISOString(),
      projectionVersion: 1,
    };
  }
}
