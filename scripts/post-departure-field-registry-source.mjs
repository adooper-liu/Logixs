const DEFAULTS = Object.freeze({
  storageNullable: true,
  profileRequired: [],
  sensitivity: "internal",
  currentPhysicalSupport: "partial",
  currentContractSupport: "missing",
  dataQualityRule: "preserve_raw_and_report_invalid",
  deprecationPolicy: "active",
});

const entries = [];

const define = (rawHeaders, definition) => {
  for (const rawHeader of Array.isArray(rawHeaders)
    ? rawHeaders
    : [rawHeaders]) {
    entries.push({ rawHeader, ...DEFAULTS, ...definition });
  }
};

const audit = (rawHeaders, canonicalFieldCode, dataType) =>
  define(rawHeaders, {
    canonicalFieldCode,
    correctedMeaning: "来源系统审计元数据，不作为当前系统操作人事实",
    ownerDomain: "source-governance",
    targetObject: "source_audit_record",
    dataType,
    validationRule:
      dataType === "date_time"
        ? "parse_source_datetime_with_timezone"
        : "non_blank_text",
    targetDisposition: "source_audit_metadata",
    currentPhysicalSupport: "full",
    currentContractSupport: "full",
  });

const timeFact = (
  rawHeaders,
  canonicalFieldCode,
  correctedMeaning,
  profileRequired,
  ownerDomain = "lifecycle-control",
) =>
  define(rawHeaders, {
    canonicalFieldCode,
    correctedMeaning,
    ownerDomain,
    targetObject: "lifecycle_time_fact",
    dataType: "date_time",
    profileRequired: profileRequired ? [profileRequired] : [],
    validationRule: "parse_source_datetime_with_timezone",
    targetDisposition: "versioned_time_fact",
    currentPhysicalSupport: "full",
    currentContractSupport: "partial",
  });

const documentField = (
  rawHeaders,
  canonicalFieldCode,
  correctedMeaning,
  dataType,
  validationRule,
) =>
  define(rawHeaders, {
    canonicalFieldCode,
    correctedMeaning,
    ownerDomain: "document-records",
    targetObject: "document_record",
    dataType,
    validationRule,
    targetDisposition: "versioned_document_record",
    currentPhysicalSupport: "full",
    currentContractSupport: "partial",
  });

define("序号", {
  canonicalFieldCode: "source.row.sequence",
  correctedMeaning: "来源工作表内的展示序号，不作为业务身份",
  ownerDomain: "source-governance",
  targetObject: "source_row",
  dataType: "integer",
  validationRule: "positive_integer",
  targetDisposition: "source_trace_only",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
  deprecationPolicy: "source_only",
});
define("单据编号", {
  canonicalFieldCode: "source.record.id",
  correctedMeaning: "来源维护记录的稳定身份，不等同于 Shipment 号",
  ownerDomain: "source-governance",
  targetObject: "source_record",
  dataType: "identifier",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_blank_stable_source_identifier",
  targetDisposition: "external_identity",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("销往国家", {
  canonicalFieldCode: "shipment.cargo_owner_name",
  correctedMeaning:
    "内部货主/分公司名称；经已确认货主主数据映射派生独立销售国家",
  ownerDomain: "shipment-registry",
  targetObject: "cargo_owner_reference",
  dataType: "string",
  validationRule: "resolve_confirmed_cargo_owner_and_derive_iso_sales_country",
  targetDisposition: "typed_reference",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
  dataQualityRule: "UNKNOWN_REFERENCE_CODE",
  deprecationPolicy: "active",
});
define("备货单号", {
  canonicalFieldCode: "upstream.replenishment_order.number",
  correctedMeaning: "可核验的上游备货单业务编号",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_upstream_reference",
  dataType: "identifier",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "resolve_replenishment_order_or_report_conflict",
  targetDisposition: "versioned_upstream_reference",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("备货单状态", {
  canonicalFieldCode: "upstream.replenishment_order.source_status",
  correctedMeaning: "来源备货单状态快照，不驱动 Shipment 生命周期",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_upstream_reference",
  dataType: "enum",
  validationRule: "map_external_status_or_manual_review",
  targetDisposition: "versioned_upstream_reference",
});
define(["箱号(集装箱号)", "集装箱号"], {
  canonicalFieldCode: "container.number",
  correctedMeaning: "ISO 6346 集装箱号规范值",
  ownerDomain: "shipment-registry",
  targetObject: "container_record",
  dataType: "identifier",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "iso_6346_canonical_container_number",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("提单号", {
  canonicalFieldCode: "transport_document.source_bill_number",
  correctedMeaning: "来源未区分类型的提单号，预检必须解析为 MBL/HBL/AMS 之一",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_transport_document",
  dataType: "identifier",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "resolve_bill_type_and_identity_or_manual_review",
  targetDisposition: "versioned_transport_document",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("船公司", {
  canonicalFieldCode: "shipment.ocean.carrier_code",
  correctedMeaning: "实际承运船公司规范代码",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "map_carrier_dictionary_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("船名", {
  canonicalFieldCode: "shipment.ocean.vessel_name",
  correctedMeaning: "实际出运船名",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "string",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_blank_text",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("航次", {
  canonicalFieldCode: "shipment.ocean.voyage_number",
  correctedMeaning: "实际出运航次",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "string",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_blank_text",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("柜型", {
  canonicalFieldCode: "container.equipment_type_code",
  correctedMeaning: "集装箱箱型规范代码",
  ownerDomain: "shipment-registry",
  targetObject: "container_record",
  dataType: "enum",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "map_equipment_type_dictionary_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("Wayfairspo", {
  canonicalFieldCode: "upstream.wayfair_spo.number",
  correctedMeaning: "Wayfair 上游 SPO 引用",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_upstream_reference",
  dataType: "identifier",
  validationRule: "non_blank_identifier_when_present",
  targetDisposition: "versioned_upstream_reference",
});
define("是否装配件", {
  canonicalFieldCode: "cargo.attribute.contains_assembly_parts",
  correctedMeaning: "本次装载是否包含装配件产品",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_cargo_attribute",
  dataType: "boolean",
  validationRule: "map_explicit_boolean_or_manual_review",
  targetDisposition: "governed_cargo_attribute",
});
define("特殊货物体积", {
  canonicalFieldCode: "container.cargo.special_volume_m3",
  correctedMeaning: "本柜特殊货物体积，单位立方米",
  ownerDomain: "shipment-registry",
  targetObject: "container_cargo_summary",
  dataType: "decimal",
  validationRule: "non_negative_decimal_m3",
  targetDisposition: "derived_allocation_summary",
});
define("起运港", {
  canonicalFieldCode: "shipment.route.port_of_loading_unlocode",
  correctedMeaning: "Shipment 主航线起运港 UN/LOCODE",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "map_port_to_unlocode_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("目的港", {
  canonicalFieldCode: "shipment.route.port_of_discharge_unlocode",
  correctedMeaning: "Shipment 主航线目的港 UN/LOCODE",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "map_port_to_unlocode_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
define("起运港货代公司", {
  canonicalFieldCode: "shipment.party.origin_forwarder",
  correctedMeaning: "起运港货运代理主体引用",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_party_reference",
  dataType: "reference",
  validationRule: "resolve_party_or_preserve_external_reference",
  targetDisposition: "versioned_party_reference",
});
define("入库仓库组", {
  canonicalFieldCode: "shipment.destination.warehouse_group_code",
  correctedMeaning: "Shipment 最终目的仓库组规范代码",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "map_warehouse_group_dictionary_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "full",
});
timeFact(
  "出运日期",
  "shipment.departure.actual_at",
  "有证据支持的实际离港时间 ATD",
  "post_departure_v1",
);
define("途径港", {
  canonicalFieldCode: "shipment.route.transshipment_port_unlocode",
  correctedMeaning: "有序海运航段中的途经港 UN/LOCODE",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_route_segment",
  dataType: "enum",
  validationRule: "map_port_to_unlocode_or_manual_review",
  targetDisposition: "versioned_route_segment",
});
audit("制单人", "source.audit.prepared_by", "string");
audit("制单日期", "source.audit.prepared_at", "date_time");
define("价格条款", {
  canonicalFieldCode: "shipment.trade.incoterm_code",
  correctedMeaning: "贸易价格条款 Incoterms 代码",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  validationRule: "map_incoterm_dictionary_or_manual_review",
  targetDisposition: "typed_column",
});
define("采购贸易模式", {
  canonicalFieldCode: "shipment.trade.mode_code",
  correctedMeaning: "采购贸易模式规范代码",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "enum",
  validationRule: "map_trade_mode_dictionary_or_manual_review",
  targetDisposition: "typed_column",
});
define("箱数合计", {
  canonicalFieldCode: "container.cargo.carton_count",
  correctedMeaning: "本柜装载箱数汇总，不用于反推 SKU 数量",
  ownerDomain: "shipment-registry",
  targetObject: "container_cargo_summary",
  dataType: "integer",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_negative_integer_reconcile_allocations",
  targetDisposition: "derived_allocation_summary",
});
define("体积合计(m3)", {
  canonicalFieldCode: "container.cargo.volume_m3",
  correctedMeaning: "本柜装载总体积，单位立方米",
  ownerDomain: "shipment-registry",
  targetObject: "container_cargo_summary",
  dataType: "decimal",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_negative_decimal_m3_reconcile_allocations",
  targetDisposition: "derived_allocation_summary",
});
define("毛重合计(KG)", {
  canonicalFieldCode: "container.cargo.gross_weight_kg",
  correctedMeaning: "本柜装载总毛重，单位千克",
  ownerDomain: "shipment-registry",
  targetObject: "container_cargo_summary",
  dataType: "decimal",
  storageNullable: false,
  profileRequired: ["post_departure_v1"],
  validationRule: "non_negative_decimal_kg_reconcile_allocations",
  targetDisposition: "derived_allocation_summary",
});
for (const [rawHeader, code, meaning] of [
  ["出运总价", "shipment.amount.total", "Shipment 出运总价"],
  ["议付金额", "shipment.amount.negotiated", "Shipment 议付金额"],
  ["议付金额FOB", "shipment.amount.negotiated_fob", "FOB 口径议付金额"],
  ["议付金额CIF", "shipment.amount.negotiated_cif", "CIF 口径议付金额"],
  [
    "标准海运费金额",
    "shipment.amount.standard_ocean_freight",
    "标准海运费金额",
  ],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "charges-settlement",
    targetObject: "shipment_charge_fact",
    dataType: "decimal",
    validationRule: "non_negative_decimal_requires_currency",
    targetDisposition: "versioned_money_fact",
  });
}
define("海运费币种", {
  canonicalFieldCode: "shipment.amount.ocean_freight_currency",
  correctedMeaning: "海运费金额使用的 ISO 4217 币种",
  ownerDomain: "charges-settlement",
  targetObject: "shipment_charge_fact",
  dataType: "enum",
  validationRule: "iso_4217_currency_code",
  targetDisposition: "versioned_money_fact",
});
define("目的地", {
  canonicalFieldCode: "shipment.destination.delivery_place",
  correctedMeaning: "最终交付地点文本，不替代目的国家、目的港或仓库组",
  ownerDomain: "shipment-registry",
  targetObject: "shipment",
  dataType: "string",
  validationRule: "non_blank_text_when_present",
  targetDisposition: "typed_column",
});
for (const [rawHeader, code, meaning] of [
  ["免堆期(天)", "container.free_time.demurrage_days", "码头免堆天数"],
  [
    "场内免箱期(天)",
    "container.free_time.detention_terminal_days",
    "场内免箱天数",
  ],
  [
    "场外免箱期(天)",
    "container.free_time.detention_off_terminal_days",
    "场外免箱天数",
  ],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "charges-settlement",
    targetObject: "container_free_time_term",
    dataType: "integer",
    validationRule: "non_negative_integer",
    targetDisposition: "versioned_charge_term",
  });
}
timeFact(
  ["预计到港日期(ETA)", "预计到港日期"],
  "shipment.arrival.estimated_at",
  "来源原始 ETA 预计到港时间",
  "post_departure_v1",
);
audit("修改人", "source.audit.updated_by", "string");
audit("修改时间", "source.audit.updated_at", "date_time");
define("母船船名", {
  canonicalFieldCode: "shipment.route.mother_vessel_name",
  correctedMeaning: "中转后母船船名",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_route_segment",
  dataType: "string",
  validationRule: "non_blank_text_when_present",
  targetDisposition: "versioned_route_segment",
});
define("母船船次", {
  canonicalFieldCode: "shipment.route.mother_voyage_number",
  correctedMeaning: "中转后母船航次",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_route_segment",
  dataType: "string",
  validationRule: "non_blank_text_when_present",
  targetDisposition: "versioned_route_segment",
});
timeFact(
  "ETA修正（组织）",
  "shipment.arrival.estimated_revision_at",
  "经组织确认的 ETA 修订版本，不覆盖原始 ETA",
  null,
);
define("ETA修正", {
  canonicalFieldCode: "source.shipment.arrival_estimate_revision_raw",
  correctedMeaning:
    "物流表 ETA 修正原始值；当前样本全部为损坏的 Java 对象字符串",
  ownerDomain: "source-governance",
  targetObject: "source_row_review",
  dataType: "string",
  validationRule: "reject_java_object_string_and_require_corrected_evidence",
  targetDisposition: "quarantine",
  currentPhysicalSupport: "missing",
  currentContractSupport: "missing",
  dataQualityRule: "INVALID_SOURCE_VALUE",
  deprecationPolicy: "rejected_source_value",
});
timeFact(
  "计划清关日期",
  "customs.clearance.planned_at",
  "计划完成清关时间",
  "customs_stage",
  "customs-compliance",
);
timeFact(
  "实际清关日期",
  "customs.clearance.actual_at",
  "有证据支持的实际清关完成时间",
  "customs_stage",
  "customs-compliance",
);
define("清关状态", {
  canonicalFieldCode: "customs.case.status",
  correctedMeaning: "清关案件独立状态",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "enum",
  validationRule: "map_customs_status_or_manual_review",
  targetDisposition: "typed_column",
  currentPhysicalSupport: "full",
  currentContractSupport: "partial",
});
define("目的港清关公司", {
  canonicalFieldCode: "customs.case.broker_party",
  correctedMeaning: "目的港清关服务商主体引用",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "reference",
  validationRule: "resolve_party_or_preserve_external_reference",
  targetDisposition: "typed_reference",
});
define("是否已发送换单文件", {
  canonicalFieldCode: "document.exchange.sent",
  correctedMeaning: "换单文件是否已发送的来源快照",
  ownerDomain: "document-records",
  targetObject: "document_record",
  dataType: "boolean",
  validationRule: "map_explicit_boolean_or_manual_review",
  targetDisposition: "versioned_document_transmission",
});
define("换单状态", {
  canonicalFieldCode: "customs.document_exchange.status",
  correctedMeaning: "换单业务的独立处理状态",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "enum",
  validationRule: "map_document_exchange_status_or_manual_review",
  targetDisposition: "typed_column",
});
for (const [rawHeader, code, meaning] of [
  ["换单收货人", "transport_document.release_recipient_party", "换单接收主体"],
  ["发货人", "transport_document.shipper_party", "提单发货主体"],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "shipment-registry",
    targetObject: "shipment_transport_document_party",
    dataType: "reference",
    validationRule: "resolve_party_or_preserve_external_reference",
    targetDisposition: "versioned_transport_document",
  });
}
timeFact(
  "全部生成日期",
  "document.package.generated_at",
  "清关单证包全部生成时间",
  null,
  "document-records",
);
define("是否查验", {
  canonicalFieldCode: "customs.case.inspection_flag",
  correctedMeaning: "是否发生海关查验",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "boolean",
  validationRule: "map_explicit_boolean_or_manual_review",
  targetDisposition: "typed_column",
});
define("是否开箱", {
  canonicalFieldCode: "customs.case.container_opened_flag",
  correctedMeaning: "查验过程中是否实际开箱",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "boolean",
  validationRule: "map_explicit_boolean_or_manual_review",
  targetDisposition: "typed_column",
});
define("异常原因", {
  canonicalFieldCode: "customs.exception.reason",
  correctedMeaning: "清关异常原因，不并入清关主状态",
  ownerDomain: "customs-compliance",
  targetObject: "exception_case",
  dataType: "string",
  validationRule: "non_blank_text_when_present",
  targetDisposition: "exception_case",
  currentPhysicalSupport: "missing",
});
define("ISF申报状态", {
  canonicalFieldCode: "customs.isf.status",
  correctedMeaning: "ISF 申报独立状态",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "enum",
  validationRule: "map_isf_status_or_manual_review",
  targetDisposition: "typed_column",
});
timeFact(
  "ISF申报日期",
  "customs.isf.filed_at",
  "ISF 实际申报时间",
  null,
  "customs-compliance",
);
timeFact(
  "放单日期",
  "transport_document.released_at",
  "运输单证实际放单时间",
  null,
  "shipment-registry",
);
for (const [rawHeader, code, meaning, kind] of [
  ["MBL SCAC", "transport_document.mbl.scac", "主提单 SCAC", "enum"],
  ["MBL Number", "transport_document.mbl.number", "主提单号码", "identifier"],
  ["HBL SCAC", "transport_document.hbl.scac", "分提单 SCAC", "enum"],
  ["HBL Number", "transport_document.hbl.number", "分提单号码", "identifier"],
  ["AMS Number", "transport_document.ams.number", "AMS 申报号码", "identifier"],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "shipment-registry",
    targetObject: "shipment_transport_document",
    dataType: kind,
    validationRule:
      kind === "enum"
        ? "validate_scac_or_manual_review"
        : "non_blank_identifier_when_present",
    targetDisposition: "versioned_transport_document",
    currentPhysicalSupport: "full",
    currentContractSupport: "full",
  });
}
timeFact(
  "传递日期",
  "document.package.sent_at",
  "清关单证包首次传递时间",
  null,
  "document-records",
);
timeFact(
  "重新传递时间",
  "document.package.resent_at",
  "清关单证包重传时间",
  null,
  "document-records",
);
define("清关单据状态", {
  canonicalFieldCode: "document.package.customs.status",
  correctedMeaning: "清关单证包独立状态",
  ownerDomain: "document-records",
  targetObject: "document_package",
  dataType: "enum",
  validationRule: "map_document_package_status_or_manual_review",
  targetDisposition: "versioned_document_package",
});
for (const [rawHeader, code, meaning] of [
  ["ISF传递", "document.isf.transmission_state", "ISF 文件传递状态"],
  [
    "提单传递",
    "document.bill_of_lading.transmission_state",
    "提单文件传递状态",
  ],
  ["箱单传递", "document.packing_list.transmission_state", "装箱单传递状态"],
  [
    "发票传递",
    "document.commercial_invoice.transmission_state",
    "商业发票传递状态",
  ],
  ["ENS传递", "document.ens.transmission_state", "ENS 文件传递状态"],
  [
    "产品资料传递",
    "document.product_material.transmission_state",
    "产品资料传递状态",
  ],
  [
    "植检证书传递",
    "document.phytosanitary_certificate.transmission_state",
    "植检证书传递状态",
  ],
  [
    "Energy-related Products传递",
    "document.energy_related_products.transmission_state",
    "能源相关产品资料传递状态",
  ],
  [
    "Nameplate传递",
    "document.nameplate.transmission_state",
    "铭牌资料传递状态",
  ],
]) {
  documentField(
    rawHeader,
    code,
    meaning,
    "enum",
    "map_document_transmission_state_or_manual_review",
  );
}
documentField(
  "清关单据更新.附件名称",
  "document.customs_update.file_name",
  "清关单据更新文件名",
  "string",
  "safe_file_name_when_present",
);
documentField(
  "清关单据更新是否重传",
  "document.customs_update.is_resend",
  "清关单据更新是否为重传",
  "boolean",
  "map_explicit_boolean_or_manual_review",
);
audit("创建人", "source.audit.created_by", "string");
audit("创建时间", "source.audit.created_at", "date_time");
for (const [rawHeader, code, meaning] of [
  ["提单附件", "document.bill_of_lading.file_ref", "提单文件引用"],
  ["箱单附件", "document.packing_list.file_ref", "装箱单文件引用"],
  ["发票附件", "document.commercial_invoice.file_ref", "商业发票文件引用"],
  ["ENS附件", "document.ens.file_ref", "ENS 文件引用"],
  ["产品资料附件", "document.product_material.file_ref", "产品资料文件引用"],
  [
    "植检证书附件",
    "document.phytosanitary_certificate.file_ref",
    "植检证书文件引用",
  ],
  [
    "农业产品声明附件",
    "document.agricultural_declaration.file_ref",
    "农业产品声明文件引用",
  ],
  [
    "Lacey Act Form附件",
    "document.lacey_act_form.file_ref",
    "Lacey Act 表单文件引用",
  ],
  ["药品监管附件", "document.drug_regulatory.file_ref", "药品监管资料文件引用"],
  ["婴童玩具证书", "document.toy_certificate.file_ref", "婴童玩具证书文件引用"],
  [
    "纺织品工厂信息",
    "document.textile_factory_information.file_ref",
    "纺织品工厂资料文件引用",
  ],
  [
    "Energy-related Products",
    "document.energy_related_products.file_ref",
    "能源相关产品资料文件引用",
  ],
  ["Nameplate", "document.nameplate.file_ref", "铭牌资料文件引用"],
  ["进口报关单", "document.import_declaration.file_ref", "进口报关单文件引用"],
]) {
  documentField(
    rawHeader,
    code,
    meaning,
    "reference",
    "resolve_file_reference_and_preserve_version",
  );
}
timeFact(
  "母船出运日期",
  "shipment.route.mother_vessel_departure_actual_at",
  "母船实际出运时间",
  null,
);
define("进口报关单号", {
  canonicalFieldCode: "customs.declaration.number",
  correctedMeaning: "进口报关单业务编号",
  ownerDomain: "customs-compliance",
  targetObject: "customs_clearance_case",
  dataType: "identifier",
  validationRule: "non_blank_identifier_when_present",
  targetDisposition: "typed_column",
});
define("物流状态", {
  canonicalFieldCode: "container.source_logistics_status",
  correctedMeaning: "来源物流状态快照，不替代 Shipment 或 Container 内部状态",
  ownerDomain: "lifecycle-control",
  targetObject: "source_status_snapshot",
  dataType: "enum",
  validationRule: "map_external_status_or_manual_review",
  targetDisposition: "versioned_source_status",
});
timeFact(
  "途径港到达日期",
  "shipment.route.transshipment_arrival_actual_at",
  "途经港实际到达时间",
  null,
);
timeFact(
  "目的港到达日期",
  "shipment.arrival.actual_at",
  "目的港实际到达时间 ATA",
  "arrival_stage",
);
timeFact(
  "目的港卸船/火车日期",
  "container.discharge.actual_at",
  "目的港卸船或卸火车实际时间",
  "arrival_stage",
);
define("目的港码头", {
  canonicalFieldCode: "shipment.route.destination_terminal_code",
  correctedMeaning: "目的港码头规范代码",
  ownerDomain: "shipment-registry",
  targetObject: "shipment_route_segment",
  dataType: "enum",
  validationRule: "map_terminal_dictionary_or_manual_review",
  targetDisposition: "versioned_route_segment",
});
timeFact(
  "最后免费日期",
  "container.free_time.last_free_at",
  "当前有效免费期截止时间",
  null,
  "charges-settlement",
);
define("是否预提", {
  canonicalFieldCode: "inland_move.pre_pull_required",
  correctedMeaning: "是否安排预提柜",
  ownerDomain: "inland-fulfillment",
  targetObject: "inland_move",
  dataType: "boolean",
  validationRule: "map_explicit_boolean_or_manual_review",
  targetDisposition: "typed_column",
});
define("运输方式", {
  canonicalFieldCode: "inland_move.transport_mode_code",
  correctedMeaning: "目的港后段运输方式规范代码",
  ownerDomain: "inland-fulfillment",
  targetObject: "inland_move",
  dataType: "enum",
  validationRule: "map_inland_transport_mode_or_manual_review",
  targetDisposition: "typed_column",
});
for (const [rawHeader, code, meaning] of [
  ["目的港卡车", "inland_move.truck_carrier_party", "目的港卡车承运主体"],
  ["目的港火车", "inland_move.rail_carrier_party", "目的港铁路承运主体"],
  ["货柜承运商", "inland_move.container_carrier_party", "货柜后段承运主体"],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "inland-fulfillment",
    targetObject: "inland_move",
    dataType: "reference",
    validationRule: "resolve_party_or_preserve_external_reference",
    targetDisposition: "typed_reference",
  });
}
define("仓库(计划)", {
  canonicalFieldCode: "warehouse_delivery.planned_warehouse_code",
  correctedMeaning: "计划交付仓库规范代码",
  ownerDomain: "inland-fulfillment",
  targetObject: "warehouse_delivery_instruction",
  dataType: "enum",
  validationRule: "map_warehouse_dictionary_or_manual_review",
  targetDisposition: "typed_column",
});
timeFact(
  "入库日期",
  "warehouse_receipt.actual_at",
  "实际入仓时间",
  "delivery_stage",
  "inland-fulfillment",
);
for (const [rawHeader, code, meaning, stage] of [
  [
    "最晚提柜日期",
    "container.pickup.deadline_at",
    "最晚提柜截止时间",
    "pickup_stage",
  ],
  [
    "计划提柜日期",
    "container.pickup.planned_at",
    "计划提柜时间",
    "pickup_stage",
  ],
  ["提柜日期", "container.pickup.actual_at", "实际提柜时间", "pickup_stage"],
  [
    "最晚送仓日期",
    "warehouse_delivery.deadline_at",
    "最晚送仓截止时间",
    "delivery_stage",
  ],
  [
    "计划送仓日期",
    "warehouse_delivery.planned_at",
    "计划送仓时间",
    "delivery_stage",
  ],
  [
    "最晚卸柜日期",
    "container.unloading.deadline_at",
    "最晚卸柜截止时间",
    "unloading_stage",
  ],
  [
    "计划卸柜日期",
    "container.unloading.planned_at",
    "计划卸柜时间",
    "unloading_stage",
  ],
  [
    "最晚还箱日期",
    "container.empty_return.deadline_at",
    "最晚还空箱截止时间",
    "empty_return_stage",
  ],
  [
    "计划还箱日期",
    "container.empty_return.planned_at",
    "计划还空箱时间",
    "empty_return_stage",
  ],
  [
    "还箱日期",
    "container.empty_return.actual_at",
    "实际还空箱时间",
    "empty_return_stage",
  ],
]) {
  timeFact(rawHeader, code, meaning, stage, "inland-fulfillment");
}
define("卸柜方式", {
  canonicalFieldCode: "container.unloading.method_code",
  correctedMeaning: "来源卸柜方式；必须按来源表解释为计划值或实际值",
  ownerDomain: "inland-fulfillment",
  targetObject: "container_unloading_operation",
  dataType: "enum",
  validationRule: "map_unloading_method_or_manual_review",
  targetDisposition: "versioned_unloading_fact",
  sourceOccurrenceOverrides: {
    logistics: {
      canonicalFieldCode: "container.unloading.planned_method_code",
      correctedMeaning: "计划卸柜方式",
    },
    warehouse: {
      canonicalFieldCode: "container.unloading.actual_method_code",
      correctedMeaning: "实际采用的卸柜方式",
    },
  },
});
define("还箱日期(组织时区)", {
  canonicalFieldCode: "container.empty_return.source_timezone",
  correctedMeaning: "还箱时间来源组织时区，不是第二个还箱事实",
  ownerDomain: "inland-fulfillment",
  targetObject: "lifecycle_time_fact",
  dataType: "string",
  validationRule: "iana_timezone_or_utc_offset",
  targetDisposition: "time_fact_source_metadata",
});
for (const [rawHeader, code, meaning] of [
  ["进港日期", "container.terminal_gate_in.actual_at", "集装箱实际进港时间"],
  [
    "进火车堆场日期",
    "container.rail_yard_gate_in.actual_at",
    "集装箱实际进入铁路堆场时间",
  ],
  [
    "进卡车堆场日期",
    "container.truck_yard_gate_in.actual_at",
    "集装箱实际进入卡车堆场时间",
  ],
  [
    "火车发出时间",
    "inland_move.rail_departure.actual_at",
    "铁路段实际发出时间",
  ],
  ["取空日期", "container.empty_pickup.actual_at", "实际取空箱时间"],
  ["送仓日期", "warehouse_delivery.actual_at", "实际送仓时间"],
]) {
  timeFact(rawHeader, code, meaning, null, "inland-fulfillment");
}
for (const [rawHeader, code, meaning] of [
  ["WMS入库状态", "warehouse_receipt.wms_source_status", "WMS 入库状态来源值"],
  ["EBS入库状态", "warehouse_receipt.ebs_source_status", "EBS 入库状态来源值"],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "inland-fulfillment",
    targetObject: "warehouse_receipt",
    dataType: "enum",
    validationRule: "map_external_status_or_manual_review",
    targetDisposition: "versioned_source_status",
  });
}
define("维护字段", {
  canonicalFieldCode: "source.legacy.maintenance_value",
  correctedMeaning: "来源系统未定义维护字段，不进入领域事实",
  ownerDomain: "source-governance",
  targetObject: "source_row_review",
  dataType: "string",
  validationRule: "reject_until_source_semantics_defined",
  targetDisposition: "source_trace_only",
  currentPhysicalSupport: "missing",
  currentContractSupport: "missing",
  dataQualityRule: "UNKNOWN_SOURCE_FIELD_SEMANTICS",
  deprecationPolicy: "source_only",
});
define("单据状态", {
  canonicalFieldCode: "warehouse_delivery.source_document_status",
  correctedMeaning: "仓库维护单据的来源状态，不替代仓库收货状态",
  ownerDomain: "inland-fulfillment",
  targetObject: "source_status_snapshot",
  dataType: "enum",
  validationRule: "map_external_status_or_manual_review",
  targetDisposition: "versioned_source_status",
});
define("仓库", {
  canonicalFieldCode: "warehouse_delivery.actual_warehouse_code",
  correctedMeaning: "实际接收仓库规范代码",
  ownerDomain: "inland-fulfillment",
  targetObject: "warehouse_receipt",
  dataType: "enum",
  validationRule: "map_warehouse_dictionary_or_manual_review",
  targetDisposition: "typed_column",
});
timeFact(
  "送仓时间",
  "warehouse_delivery.arrival_actual_at",
  "货柜实际到达仓库时间",
  "delivery_stage",
  "inland-fulfillment",
);
timeFact(
  "卸空时间",
  "container.unloading.completed_actual_at",
  "货柜实际卸空完成时间",
  "unloading_stage",
  "inland-fulfillment",
);
for (const [rawHeader, code, meaning] of [
  ["卸柜门", "container.unloading.dock_door", "实际卸柜月台或门位"],
  ["卸柜公司", "container.unloading.operator_party", "实际卸柜作业主体"],
]) {
  define(rawHeader, {
    canonicalFieldCode: code,
    correctedMeaning: meaning,
    ownerDomain: "inland-fulfillment",
    targetObject: "container_unloading_operation",
    dataType: rawHeader === "卸柜公司" ? "reference" : "string",
    validationRule:
      rawHeader === "卸柜公司"
        ? "resolve_party_or_preserve_external_reference"
        : "non_blank_text_when_present",
    targetDisposition: "versioned_unloading_fact",
  });
}
timeFact(
  "通知取空日期",
  "container.empty_pickup.notified_at",
  "通知承运人取空箱时间",
  null,
  "inland-fulfillment",
);
timeFact(
  "取空时间",
  "container.empty_pickup.actual_at",
  "承运人实际取空箱时间",
  null,
  "inland-fulfillment",
);
define("备注", {
  canonicalFieldCode: "warehouse_delivery.source_note",
  correctedMeaning: "仓库来源备注，仅作审计上下文，不驱动状态",
  ownerDomain: "inland-fulfillment",
  targetObject: "warehouse_delivery_note",
  dataType: "string",
  validationRule: "bounded_text",
  targetDisposition: "versioned_note",
  sensitivity: "restricted",
});
timeFact(
  "WMS CONFIRM DATE",
  "warehouse_receipt.wms_confirmed_at",
  "WMS 实际确认时间",
  null,
  "inland-fulfillment",
);
audit("审核人", "source.audit.reviewed_by", "string");
audit("审核日期", "source.audit.reviewed_at", "date_time");
define("WMS CONFIRM DATE非", {
  canonicalFieldCode: "source.warehouse.wms_confirm_date_unknown",
  correctedMeaning: "语义不明的来源列，不能作为 WMS 确认时间",
  ownerDomain: "source-governance",
  targetObject: "source_row_review",
  dataType: "string",
  validationRule: "reject_until_source_semantics_defined",
  targetDisposition: "source_trace_only",
  currentPhysicalSupport: "missing",
  currentContractSupport: "missing",
  dataQualityRule: "UNKNOWN_SOURCE_FIELD_SEMANTICS",
  deprecationPolicy: "source_only",
});
define("取空通知", {
  canonicalFieldCode: "container.empty_pickup.notification_ref",
  correctedMeaning: "取空通知文件或消息引用",
  ownerDomain: "document-records",
  targetObject: "document_record",
  dataType: "reference",
  validationRule: "resolve_document_or_message_reference",
  targetDisposition: "versioned_document_record",
});

export const POST_DEPARTURE_FIELD_REGISTRY_SOURCE = Object.freeze(entries);

export const POST_DEPARTURE_DETAIL_HEADER_ALIASES = Object.freeze({
  主备货单号: {
    canonicalFieldCode: "upstream.replenishment_order.parent_number",
    ownerDomain: "shipment-registry",
    targetObject: "shipment_upstream_reference",
    mappingKind: "projection_only_derived",
  },
  "Wayfair SPO": {
    canonicalFieldCode: "upstream.wayfair_spo.number",
    ownerDomain: "shipment-registry",
    targetObject: "shipment_upstream_reference",
    mappingKind: "projection_alias",
  },
  "异常原因(清关信息表）": {
    canonicalFieldCode: "customs.exception.reason",
    ownerDomain: "customs-compliance",
    targetObject: "exception_case",
    mappingKind: "projection_alias",
  },
  途经港: {
    canonicalFieldCode: "shipment.route.transshipment_port_unlocode",
    ownerDomain: "shipment-registry",
    targetObject: "shipment_route_segment",
    mappingKind: "projection_alias",
  },
  途经港到达日期: {
    canonicalFieldCode: "shipment.route.transshipment_arrival_actual_at",
    ownerDomain: "lifecycle-control",
    targetObject: "lifecycle_time_fact",
    mappingKind: "projection_alias",
  },
  "仓库(实际)": {
    canonicalFieldCode: "warehouse_delivery.actual_warehouse_code",
    ownerDomain: "inland-fulfillment",
    targetObject: "warehouse_receipt",
    mappingKind: "projection_alias",
  },
  "卸柜方式(计划)": {
    canonicalFieldCode: "container.unloading.planned_method_code",
    ownerDomain: "inland-fulfillment",
    targetObject: "container_unloading_operation",
    mappingKind: "projection_alias",
  },
  "卸柜方式（实际）": {
    canonicalFieldCode: "container.unloading.actual_method_code",
    ownerDomain: "inland-fulfillment",
    targetObject: "container_unloading_operation",
    mappingKind: "projection_alias",
  },
  卸空日期: {
    canonicalFieldCode: "container.unloading.completed_actual_at",
    ownerDomain: "inland-fulfillment",
    targetObject: "lifecycle_time_fact",
    mappingKind: "projection_alias",
  },
  "备注(物流信息表）": {
    canonicalFieldCode: "inland_move.source_note",
    ownerDomain: "inland-fulfillment",
    targetObject: "inland_move_note",
    mappingKind: "projection_only_derived",
  },
  提柜通知: {
    canonicalFieldCode: "document.container_pickup_notice.file_ref",
    ownerDomain: "document-records",
    targetObject: "document_record",
    mappingKind: "projection_only_derived",
  },
  "备注(仓库信息表)": {
    canonicalFieldCode: "warehouse_delivery.source_note",
    ownerDomain: "inland-fulfillment",
    targetObject: "warehouse_delivery_note",
    mappingKind: "projection_alias",
  },
  "WMS Confirm Date": {
    canonicalFieldCode: "warehouse_receipt.wms_confirmed_at",
    ownerDomain: "inland-fulfillment",
    targetObject: "lifecycle_time_fact",
    mappingKind: "projection_alias",
  },
  含要求打托产品: {
    canonicalFieldCode: "cargo.attribute.requires_palletization",
    ownerDomain: "shipment-registry",
    targetObject: "shipment_cargo_attribute",
    mappingKind: "projection_only_derived",
  },
});
