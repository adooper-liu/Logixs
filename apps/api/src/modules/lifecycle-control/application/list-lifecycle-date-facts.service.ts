import { Inject, Injectable } from "@nestjs/common";
import {
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
} from "../../shipment-registry";
import type { LifecycleDateFactRecord } from "../domain/lifecycle-date-fact";
import {
  LIFECYCLE_DATE_FACT_REPOSITORY,
  type LifecycleDateFactRepository,
} from "../domain/lifecycle-date-fact.repository";

export interface LifecycleDateFactProjection {
  items: LifecycleDateFactRecord[];
  projectionVersion: number;
  asOf: Date;
}

@Injectable()
export class ListLifecycleDateFactsService {
  constructor(
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly repository: LifecycleDateFactRepository,
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
  ) {}

  async execute(input: {
    tenantId: string;
    containerId: string;
  }): Promise<LifecycleDateFactProjection> {
    await this.assertContainerTenant.execute(input);
    const items = await this.repository.listCurrent(input);
    return {
      items,
      projectionVersion: items.reduce(
        (maximum, item) => Math.max(maximum, item.projectionVersion),
        0,
      ),
      asOf: new Date(),
    };
  }
}
