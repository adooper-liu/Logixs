export const RESOLVE_CONTAINER_BY_NUMBER = Symbol.for(
  "logix.ResolveContainerByNumber",
);

export interface ResolveContainerByNumberInput {
  tenantId: string;
  containerNumber: string;
}

export type ResolveContainerByNumberResult =
  | { state: "resolved"; containerId: string }
  | { state: "not_found"; containerId: null }
  | { state: "ambiguous"; containerId: null };

export interface ResolveContainerByNumberPort {
  execute(
    input: ResolveContainerByNumberInput,
  ): Promise<ResolveContainerByNumberResult>;
}
