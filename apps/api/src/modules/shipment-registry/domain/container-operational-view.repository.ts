import type { ContainerOperationalView } from "@logix/contracts";

export const CONTAINER_OPERATIONAL_VIEW_REPOSITORY = Symbol(
  "ContainerOperationalViewRepository",
);

export interface ContainerOperationalViewQuery {
  tenantId: string;
  containerId: string;
}

export type ContainerOperationalProjection = Omit<
  ContainerOperationalView,
  "allowedActions"
>;

export interface ContainerOperationalViewRepository {
  findByContainer(
    query: ContainerOperationalViewQuery,
  ): Promise<ContainerOperationalProjection | null>;
}
