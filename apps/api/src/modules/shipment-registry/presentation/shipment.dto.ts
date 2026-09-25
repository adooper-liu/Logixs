import { ApiProperty } from "@nestjs/swagger";
import type {
  ShipmentCargoLineViewV1,
  ShipmentContainerAllocationV1,
  ShipmentContainerViewV1,
  ShipmentDetailV1,
  ShipmentHandoffSummaryV1,
  ShipmentLifecycleInitializationV1,
  ShipmentLifecycleInitializationStateV1,
  ShipmentLifecycleStatusV1,
  ShipmentPendingActionV1,
  ShipmentPendingCompletionItemV1,
  ShipmentPendingCompletionPageV1,
  ShipmentPendingItemV1,
  ShipmentSummaryV1,
  ShipmentTransportDocumentViewV1,
  ShipmentUpstreamReferenceViewV1,
} from "@logix/contracts";

export class ShipmentSummaryDto implements ShipmentSummaryV1 {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) shipmentNumber!: string | null;
  @ApiProperty() transportMode!: string;
  @ApiProperty() carrierCode!: string;
  @ApiProperty() vesselName!: string;
  @ApiProperty() voyageNumber!: string;
  @ApiProperty() originCountryCode!: string;
  @ApiProperty() originUnlocode!: string;
  @ApiProperty() destinationCountryCode!: string;
  @ApiProperty() destinationUnlocode!: string;
  @ApiProperty({ nullable: true, type: String })
  salesCountryCode!: string | null;
  @ApiProperty({ nullable: true, type: String })
  cargoOwnerReferenceId!: string | null;
  @ApiProperty({ nullable: true, type: String })
  cargoOwnerName!: string | null;
  @ApiProperty({ nullable: true, type: String }) atdAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) etaAt!: string | null;
  @ApiProperty({
    enum: [
      "departed",
      "in_transit",
      "arrived",
      "customs_clearance",
      "released",
      "picked_up",
      "delivered_to_warehouse",
      "closed",
    ],
  })
  currentLifecycleStatus!: ShipmentLifecycleStatusV1;
  @ApiProperty() lifecycleVersion!: number;
  @ApiProperty() relationshipVersion!: number;
  @ApiProperty() activeContainerCount!: number;
  @ApiProperty() activeCargoLineCount!: number;
  @ApiProperty({ enum: ["pending", "ready", "manual_review"] })
  lifecycleInitializationState!: ShipmentLifecycleInitializationStateV1;
  @ApiProperty() updatedAt!: string;
}

export class ShipmentPageInfoDto {
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() pageSize!: number;
}

export class ShipmentPageDto {
  @ApiProperty({ type: [ShipmentSummaryDto] }) items!: ShipmentSummaryDto[];
  @ApiProperty({ type: ShipmentPageInfoDto }) pageInfo!: ShipmentPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ShipmentPendingActionDto implements ShipmentPendingActionV1 {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class ShipmentPendingResponsibilityDto {
  @ApiProperty() roleCode!: string;
  @ApiProperty() roleLabel!: string;
}

export class ShipmentPendingDeadlineDto {
  @ApiProperty({ nullable: true, type: String }) dueAt!: string | null;
  @ApiProperty({ enum: ["not_configured", "policy", "source"] })
  source!: ShipmentPendingItemV1["deadline"]["source"];
  @ApiProperty() label!: string;
}

export class ShipmentPendingItemDto implements ShipmentPendingItemV1 {
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ["shipment", "container", "cargo", "document"] })
  subjectType!: ShipmentPendingItemV1["subjectType"];
  @ApiProperty() subjectRef!: string;
  @ApiProperty({ nullable: true, type: String }) currentValue!: string | null;
  @ApiProperty({ nullable: true, type: String }) sourceSystem!: string | null;
  @ApiProperty({ nullable: true, type: String }) sourceValue!: string | null;
  @ApiProperty({ type: [String] }) candidateValues!: string[];
  @ApiProperty({ type: ShipmentPendingResponsibilityDto })
  responsibility!: ShipmentPendingItemV1["responsibility"];
  @ApiProperty({ type: ShipmentPendingDeadlineDto })
  deadline!: ShipmentPendingItemV1["deadline"];
  @ApiProperty({ type: [ShipmentPendingActionDto] })
  restrictedActions!: ShipmentPendingActionV1[];
  @ApiProperty({ type: ShipmentPendingActionDto })
  directAction!: ShipmentPendingActionV1;
}

export class ShipmentPendingCompletionItemDto implements ShipmentPendingCompletionItemV1 {
  @ApiProperty({ type: ShipmentSummaryDto }) shipment!: ShipmentSummaryDto;
  @ApiProperty({ type: [ShipmentPendingItemDto] })
  pendingItems!: ShipmentPendingItemDto[];
}

export class ShipmentPendingCompletionPageDto implements ShipmentPendingCompletionPageV1 {
  @ApiProperty({ type: [ShipmentPendingCompletionItemDto] })
  items!: ShipmentPendingCompletionItemDto[];
  @ApiProperty({ type: ShipmentPageInfoDto }) pageInfo!: ShipmentPageInfoDto;
  @ApiProperty() asOf!: string;
  @ApiProperty() projectionVersion!: number;
}

export class ShipmentContainerAllocationDto implements ShipmentContainerAllocationV1 {
  @ApiProperty() shipmentCargoLineId!: string;
  @ApiProperty() allocatedQuantity!: string;
  @ApiProperty() quantityUnit!: string;
  @ApiProperty({ nullable: true, type: String }) packageCount!: string | null;
  @ApiProperty({ nullable: true, type: String }) packageUnit!: string | null;
  @ApiProperty({ nullable: true, type: String }) grossWeight!: string | null;
  @ApiProperty({ nullable: true, type: String }) weightUnit!: string | null;
  @ApiProperty({ nullable: true, type: String }) volume!: string | null;
  @ApiProperty({ nullable: true, type: String }) volumeUnit!: string | null;
}

export class ShipmentContainerDto implements ShipmentContainerViewV1 {
  @ApiProperty() linkId!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty({ nullable: true, type: String })
  containerNumber!: string | null;
  @ApiProperty({ nullable: true, type: String })
  containerTypeCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) sealNumber!: string | null;
  @ApiProperty({
    enum: [
      "not_shipped",
      "shipped",
      "in_transit",
      "at_port",
      "picked_up",
      "unloaded",
      "returned_empty",
      "cancelled",
    ],
  })
  currentStatus!: ShipmentContainerViewV1["currentStatus"];
  @ApiProperty() linkVersion!: number;
  @ApiProperty({ nullable: true, type: String })
  currentNodeCode!: ShipmentContainerViewV1["currentNodeCode"];
  @ApiProperty({ nullable: true, type: String }) flowState!: string | null;
  @ApiProperty({ type: [ShipmentContainerAllocationDto] })
  allocations!: ShipmentContainerAllocationDto[];
}

export class ShipmentCargoLineDto implements ShipmentCargoLineViewV1 {
  @ApiProperty() id!: string;
  @ApiProperty() lineNo!: number;
  @ApiProperty({ nullable: true, type: String }) productSkuId!: string | null;
  @ApiProperty() productNumber!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() quantityUnit!: string;
  @ApiProperty({ nullable: true, type: String }) packageCount!: string | null;
  @ApiProperty({ nullable: true, type: String }) packageUnit!: string | null;
  @ApiProperty({ nullable: true, type: String }) grossWeight!: string | null;
  @ApiProperty({ nullable: true, type: String }) weightUnit!: string | null;
  @ApiProperty({ nullable: true, type: String }) volume!: string | null;
  @ApiProperty({ nullable: true, type: String }) volumeUnit!: string | null;
  @ApiProperty({ nullable: true, type: String })
  replenishmentOrderLineId!: string | null;
  @ApiProperty() sourceLineId!: string;
  @ApiProperty() version!: number;
}

export class ShipmentTransportDocumentDto implements ShipmentTransportDocumentViewV1 {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ["booking", "mbl", "hbl", "ams"] })
  documentType!: ShipmentTransportDocumentViewV1["documentType"];
  @ApiProperty() documentNumber!: string;
  @ApiProperty({ nullable: true, type: String }) scac!: string | null;
  @ApiProperty({ nullable: true, type: String })
  parentDocumentId!: string | null;
  @ApiProperty({ type: [String] }) containerRecordIds!: string[];
  @ApiProperty() version!: number;
  @ApiProperty() effectiveFrom!: string;
}

export class ShipmentUpstreamReferenceDto implements ShipmentUpstreamReferenceViewV1 {
  @ApiProperty() id!: string;
  @ApiProperty() containerRecordId!: string;
  @ApiProperty({ nullable: true, type: String })
  shipmentCargoLineId!: string | null;
  @ApiProperty({
    enum: [
      "shipping_plan",
      "stocking_order",
      "packing_order",
      "purchase_order",
    ],
  })
  referenceType!: ShipmentUpstreamReferenceViewV1["referenceType"];
  @ApiProperty() sourceSystem!: string;
  @ApiProperty() sourceRecordId!: string;
  @ApiProperty({ nullable: true, type: String }) sourceVersion!: string | null;
  @ApiProperty({ nullable: true, type: String }) sourceLineId!: string | null;
  @ApiProperty() version!: number;
}

export class ShipmentHandoffSummaryDto implements ShipmentHandoffSummaryV1 {
  @ApiProperty() handoffId!: string;
  @ApiProperty() handoffVersion!: number;
  @ApiProperty() sourceSystem!: string;
  @ApiProperty() status!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() traceId!: string;
}

export class ShipmentLifecycleInitializationDto implements ShipmentLifecycleInitializationV1 {
  @ApiProperty({ enum: ["pending", "ready", "manual_review"] })
  state!: ShipmentLifecycleInitializationStateV1;
  @ApiProperty() activeContainerCount!: number;
  @ApiProperty() initializedContainerCount!: number;
  @ApiProperty() relationshipVersion!: number;
  @ApiProperty({ nullable: true, type: String }) lastErrorCode!: string | null;
}

export class ShipmentDetailDto implements ShipmentDetailV1 {
  @ApiProperty({ type: ShipmentSummaryDto }) shipment!: ShipmentSummaryDto;
  @ApiProperty({ type: ShipmentHandoffSummaryDto, nullable: true })
  handoff!: ShipmentDetailV1["handoff"];
  @ApiProperty({ type: [ShipmentContainerDto] })
  containers!: ShipmentContainerDto[];
  @ApiProperty({ type: [ShipmentCargoLineDto] })
  cargoLines!: ShipmentCargoLineDto[];
  @ApiProperty({ type: [ShipmentTransportDocumentDto] })
  transportDocuments!: ShipmentTransportDocumentDto[];
  @ApiProperty({ type: [ShipmentUpstreamReferenceDto] })
  upstreamReferences!: ShipmentUpstreamReferenceDto[];
  @ApiProperty({ type: [Object] })
  pendingItems!: ShipmentDetailV1["pendingItems"];
  @ApiProperty({ type: ShipmentLifecycleInitializationDto })
  lifecycleInitialization!: ShipmentLifecycleInitializationDto;
  @ApiProperty() projectionVersion!: number;
  @ApiProperty() asOf!: string;
}
