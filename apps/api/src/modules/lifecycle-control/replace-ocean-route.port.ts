import type { ReplaceOceanRouteService } from "./application/replace-ocean-route.service";

export const REPLACE_OCEAN_ROUTE = Symbol.for("logix.ReplaceOceanRoute");

export type ReplaceOceanRoutePort = Pick<ReplaceOceanRouteService, "execute">;
