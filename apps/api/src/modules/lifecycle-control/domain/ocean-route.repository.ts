import type { NormalizedOceanRouteWriteCommand } from "./ocean-route";

export const OCEAN_ROUTE_REPOSITORY = Symbol("OceanRouteRepository");

export interface OceanRouteSegmentRecord {
  segmentId: string;
  sequence: number;
  isFinal: boolean;
  transportMode: "vessel" | "feeder" | "barge";
  originUnlocode: string;
  originTimezone: string;
  destinationLocationType: "port" | "terminal";
  destinationUnlocode: string;
  destinationLocationId?: string;
  destinationPortCallId?: string;
  destinationTimezone: string;
}

export interface OceanRouteRecord {
  routePlanId: string;
  version: number;
  activatedAt: Date;
  ingestionChannel: "api" | "file_import" | "manual_ui";
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string | null;
  reasonCode: string | null;
  segments: OceanRouteSegmentRecord[];
}

export interface ReplaceOceanRoutePersistenceInput extends NormalizedOceanRouteWriteCommand {
  routePlanId: string;
  segmentIds: string[];
  payloadHash: string;
  activatedAt: Date;
}

export interface OceanRouteRepository {
  findCurrent(input: {
    tenantId: string;
    containerId: string;
  }): Promise<OceanRouteRecord | null>;
  replace(input: ReplaceOceanRoutePersistenceInput): Promise<{
    record: OceanRouteRecord;
    duplicate: boolean;
  }>;
}
