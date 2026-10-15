import type { FullChainLandingGraph } from "./landing-graph";

export const FULL_CHAIN_WORKBENCH_PROJECTOR = Symbol(
  "FULL_CHAIN_WORKBENCH_PROJECTOR",
);

export interface FullChainWorkbenchProjector {
  project(input: {
    tenantId: string;
    runId: string;
    graph: FullChainLandingGraph;
  }): Promise<void>;
}
