import type { AssertContainerTenantService } from "./application/assert-container-tenant.service";

export const ASSERT_CONTAINER_TENANT = Symbol.for(
  "logix.AssertContainerTenant",
);

export type AssertContainerTenantPort = Pick<
  AssertContainerTenantService,
  "execute"
>;
