import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { OceanRouteProjection } from "@logix/contracts";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import {
  OCEAN_ROUTE_REPOSITORY,
  type OceanRouteRepository,
} from "../domain/ocean-route.repository";

@Injectable()
export class GetCurrentOceanRouteService {
  constructor(
    @Inject(OCEAN_ROUTE_REPOSITORY)
    private readonly repository: OceanRouteRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: {
    tenantId: string;
    containerId: string;
  }): Promise<OceanRouteProjection> {
    await this.assertContainerTenant.execute(input);
    const route = await this.repository.findCurrent(input);
    if (!route) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return {
      routePlanId: route.routePlanId,
      version: route.version,
      activatedAt: route.activatedAt.toISOString(),
      ingestionChannel: route.ingestionChannel,
      sourceSystem: route.sourceSystem,
      evidenceRefs: route.evidenceRefs,
      ...(route.actorId ? { actorId: route.actorId } : {}),
      ...(route.reasonCode ? { reasonCode: route.reasonCode } : {}),
      segments: route.segments as OceanRouteProjection["segments"],
    };
  }
}
