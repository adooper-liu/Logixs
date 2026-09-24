import type {
  ShipmentDetailV1,
  ShipmentLifecycleStatusV1,
  ShipmentSummaryV1,
} from "@logix/contracts";

export const SHIPMENT_READ_REPOSITORY = Symbol("ShipmentReadRepository");

export interface ShipmentListQuery {
  tenantId: string;
  status?: ShipmentLifecycleStatusV1;
  after?: { updatedAt: Date; id: string };
  take: number;
}

export interface ShipmentByIdQuery {
  tenantId: string;
  id: string;
}

export type ShipmentDetailProjection = Omit<ShipmentDetailV1, "asOf">;

export interface ShipmentReadRepository {
  list(query: ShipmentListQuery): Promise<ShipmentSummaryV1[]>;
  findById(query: ShipmentByIdQuery): Promise<ShipmentDetailProjection | null>;
}
