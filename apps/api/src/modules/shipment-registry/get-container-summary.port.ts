import type { ContainerSummary } from "./domain/container-summary";

export const GET_CONTAINER_SUMMARY = Symbol.for("logix.GetContainerSummary");

export interface GetContainerSummaryPort {
  execute(input: { tenantId?: string; id?: string }): Promise<ContainerSummary>;
}
