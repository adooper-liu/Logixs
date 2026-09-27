export type PostDepartureStandardImportFieldCode =
  | "source_record_id"
  | "shipment_number"
  | "container_number"
  | "container_type_code"
  | "seal_number"
  | "replenishment_order_number"
  | "booking_number"
  | "mbl_number"
  | "hbl_number"
  | "carrier_code"
  | "vessel_name"
  | "voyage_number"
  | "origin_port_code"
  | "destination_port_code"
  | "sales_country_code"
  | "cargo_owner_name"
  | "departure_at"
  | "departure_time_precision"
  | "departure_source_timezone"
  | "estimated_arrival_at"
  | "package_count"
  | "gross_weight_kg"
  | "volume_m3"
  | "source_line_id"
  | "product_number"
  | "quantity"
  | "quantity_unit";

export interface PostDepartureStandardImportFieldDefinition {
  code: PostDepartureStandardImportFieldCode;
  label: string;
  required: boolean;
  pendingWhenMissing: boolean;
  example: string;
}

export interface PostDepartureStandardImportSheetDefinition {
  code: "shipment_containers" | "cargo_lines";
  name: "已出运接管" | "SKU装载明细";
  recordType: "shipment_container" | "cargo_line";
  required: boolean;
  fields: PostDepartureStandardImportFieldDefinition[];
}

export interface PostDepartureStandardImportCatalog {
  version: "1.0.0";
  profile: "post_departure_standard_v1";
  templateFile: string;
  sheets: PostDepartureStandardImportSheetDefinition[];
  controlledValues: {
    departure_time_precision: readonly ["date_only", "date_time"];
    quantity_unit: readonly ["piece", "carton", "set", "pallet"];
    country_code: string;
    port_code: string;
  };
}

declare const catalog: PostDepartureStandardImportCatalog;
export default catalog;
