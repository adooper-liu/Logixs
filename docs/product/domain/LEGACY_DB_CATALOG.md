# 老库表与字典目录（LEGACY_DB_CATALOG）

> 状态：**现状快照（审计基线）** · 2026-09-05 · 源 `D:/Github/logix @ main acfb50a8`。
> 用途：迁移/映射（FIELD_MIGRATION_MAP）与 P2-04/06 的**权威表·字典目录**；含表关系、主/外键、字段定义与用途。
> 权威定义文件：`backend/03_create_tables.sql`（dict/biz/process/ext 主体）· `backend/src/entities/*.ts`（实体）·
> `backend/scripts/init-database*.sql`（sys_/demurrage/早期字典变体）· `backend/migrations/`（映射/补丁）。
> ⚠️ 存在多处 schema 漂移（见 §7），迁移前必须先对齐权威列。
> 🗣️ 白话：这就是老系统"每张表是干嘛的、主键是什么、跟谁挂钩、有哪些列"的家底目录；照它才能把老数据搬到新库时不漏不串。看到"漂移/没币种/名单复数对不上"这些标记，就是搬家前要先处理的坑。

## 1. 表组织与关系

```text
biz_customers(客户) 1:N biz_replenishment_orders(备货单, PK order_number; 冗余 container_number)
      │ customer_code
      ▼
biz_replenishment_orders ── 1:1(按 order_number 绑) ──▶ biz_containers(货柜, PK container_number, FK order_number→备货单, FK container_type_code→柜型)
      │                                                                            │
      │ main_order_number(票级代表,勿作键)                                          │
      ▼                                                                            ▼
(计划层·上游)                                                               ┌────────┴───────────────┐
                                                                          ▼                        ▼
  biz_containers 1:1/1:N ── process_sea_freight(PK container) · process_port_operations(PK id, FK container)
                                                                          process_trucking_transport · process_warehouse_operations · process_empty_return (PK container, FK→CASCADE)
                                                                          ▼
                                                            ext_container_status_events / loading_records / hold_records / charges (FK container)
                                                            ext_demurrage_standards / ext_demurrage_records (费用/免费期)
主数据引用：dict_countries/customer_types/ports/shipping_companies/freight_forwarders/customs_brokers/trucking_companies/container_types/overseas_companies/warehouses
别名：dict_universal_mapping / dict_port_name_mapping    身份：sys_users/roles/user_roles/audit_logs/configs/notifications
```

## 2. 字典表（dict_*）

### dict_countries（国家）

PK `code`。字段：`name_cn/name_en NOT NULL`、`region/continent/currency/phone_code`、`sort_order/is_active/remarks/时间`。用途：国别/币种关联（currency 可作币种初值来源）。

### dict_customer_types（客户类型）

PK `type_code`。`type_name_cn/en`、`sort_order/is_active/remarks`。用途：客户分类。

### dict_ports（港口）

PK `port_code`(LOCODE 风格)。`port_name/port_name_en`、`port_type`、`country/state/city`、`timezone/latitude/longitude`、`support_export/support_import/support_container_only`、`status/remarks`。用途：起运/目的/中转港引用与别名归一入口。

### dict_shipping_companies（船司）

PK `company_code`。`company_name/company_name_en`、`scac_code`、`api_provider`、`support_booking/bill_of_lading/container`、`website/contact`、`status`。用途：承运人主数据（含 SCAC/查询能力）。

### dict_freight_forwarders / dict_customs_brokers / dict_trucking_companies（货代/报关行/拖车）

PK `*_code`；`*_name`、`*_name_en`、`contact_*`、`status`。用途：货代/报关/拖车引用。

### dict_container_types（柜型主字典，Logix「柜型字典」映射源）

PK `type_code`（如 40HQ）。`type_name_cn/en`、`size_ft`(20/40/45/53)、`type_abbrev`(GP/HC/FR/OT/TK/RF/HT)、`full_name/dimensions`、`max_weight_kg/max_cbm/teu`、`sort_order/is_active/remarks/时间`。
⚠️ 种子 `init-database.sql` 用 `id/container_code/container_name/length/width/height/max_weight/cbm` 变体 → 迁移选一套权威并别名映射。

### dict_overseas_companies（海外公司）

PK `company_code`。`company_name/en`、`country/address/contact`、`currency/tax_id/bank_*`、`sort_order/is_active`。用途：目的侧主体（费、清关关系）。

### dict_warehouses（仓库）

PK `warehouse_code`。`warehouse_name/en、short_name`、`property_type(自营/平台/第三方 枚举)`、`warehouse_type/company_code/address/city/state/country/contact`、`status`。FK `company_code→dict_overseas_companies`(SET NULL)。用途：仓库主数据。

### dict_universal_mapping / dict_port_name_mapping（别名/归一）

见 `D:/Github/logix/backend/migrations/`（定义于 `create_universal_dict_mapping.sql`、`create_port_name_mapping.sql`）：

- `dict_universal_mapping`：`dict_type + target_table/target_field + standard_code/name + name_cn/en/local`，通用"名称→标准码"框架。
- `dict_port_name_mapping`：`port_code + name + port_code_old + is_primary`，港口新旧码/别名主映射。

## 3. 业务表（biz_*）

### biz_customers（客户）

PK `customer_code`。`customer_name`、`customer_type_code`(FK→类型)、`country`(FK→dict_countries SET NULL)、`overseas_company_code`(FK SET NULL)、`customer_category/address/contact_*`、`payment_term/price_term/tax_number/customs_code/status`。用途：客户主数据。

### biz_replenishment_orders（备货单）

PK `order_number`。`main_order_number`（票级代表，勿作键）、`sell_to_country`、`customer_code`(FK→customers SET NULL)+`customer_name` 冗余、`order_status(默认 DRAFT)`、`procurement_trade_mode/price_terms`、`total_boxes/cbm/gross_weight`、`shipment_total_value/fob_amount/cif_amount/negotiation_amount`（**均无币种列**）、`order_date/expected_ship_date/actual_ship_date`、`container_required/inspection_required/is_assembly/pallet_required/special_cargo_volume/wayfair_spo`、`created_by`。索引：customer/status/actual_ship_date。用途：采购→备货→装箱的订单主体（订单含金额需补币种）。

### biz_containers（货柜主数据）

PK `container_number`；FK `order_number→replenishment`(级联删)、`container_type_code→container_types`(RESTRICT)。
字段（分组/来源）：

- 货物：`cargo_description、gross_weight、net_weight、cbm、packages、seal_number`
- 操作标志：`inspection_required、is_unboxing、requires_pallet(EXCEL)、requires_assembly(EXCEL)`
- 状态：`logistics_status(默认 not_shipped，派生缓存)、current_status_desc_cn/en`
- 飞驼外接：`container_size、is_rolled、operator、container_holder、tare_weight、total_weight、over_length、over_height、danger_class`
索引：order/status/type。⚠️ 03 中 `order_number NOT NULL`；Entity 却可空 → 漂移。

## 4. 流程表（process_*，均按 container_number 关联）

### process_sea_freight（海运 1:1，PK container_number；FK CASCADE）

单证 `bill_of_lading_number、booking_number、mbl/hbl_scac+number、ams_number`；承运 `shipping_company_id、freight_forwarder_id、vessel_name、voyage_number、route_code、transport_mode、imo/mmsi/flag、mother_vessel_name/number、transit_port_code`；港口 `port_of_loading/discharge`；时间 `eta/etd/ata/atd、customs_clearance_date、shipment_date、document_release_date、port_entry_date、port_open/close_date、rail_yard/truck_yard_entry_date、eta_origin/ata_origin`；费用 `freight_currency、standard_freight_amount`。用途：一柜的订舱/船期/单证/费用（ATA 语义需澄清，A8）。

### process_port_operations（港口作业序列 1:N，PK id；FK container CASCADE）

`port_type(origin/transit/destination)、port_code/name、port_sequence`；时间 `eta/ata_dest_port、etd/atd_transit、transit_arrival_date、gate_in/out_time、discharged/available_time、dest_port_unload_date`；清关 `customs_status、isf_status、planned/actual_customs_date、document_status、customs_broker_code、isf_declaration_date、document_transfer_date`；免费期 `free_storage/detention/off_terminal_days`；外部节点 `status_code/status_occurred_at/has_occurred/location_*/lat/lng/timezone/data_source/cargo_location`。用途：一柜航线分段（起/中转/目的）与到港清关免费期。

### process_trucking_transport（拖卡，PK container CASCADE）

`trucking_type(PRE/POST_SHIPMENT)、is_pre_pickup`；`pickup/last/planned_pickup_date、delivery/last/planned_delivery_date`、`unload_mode_plan`；司机 `driver_name/phone、truck_plate`；`pickup/delivery_location、carrier_company`、`distance_km/cost`。用途：提柜→派送（车牌为箱事件关联键）。

### process_warehouse_operations（仓库操作，PK container CASCADE；FK warehouse_id→dict_warehouses SET NULL）

`operation_type(INBOUND/OUTBOUND/TRANSIT)`；仓 `warehouse_id、planned/actual_warehouse、warehouse_group、warehouse_arrival_date`；卸 `unload_date/planned/last、unload_mode_actual、unload_gate/company`；WMS `wms_status/ebs_status/wms_confirm_date`；开箱 `is_unboxing、unboxing_time`；仓租 `storage_start/end_date`、收货 `cargo_received_by/delivered_to`。用途：卸柜/卸空与 WMS 交接（Logix ④边界回传源）。

### process_empty_return（还空箱，PK container CASCADE）

`return_time/planned/last_return_date`、`notification_return_date/time`、`return_terminal_code/name`、`container_condition`。用途：还箱（`returned_empty` 的证据）。
⚠️ 表名 `process_empty_return`（03 DDL）vs 实体 `process_empty_returns` → 漂移。

## 5. 扩展/外部表（ext_*）

### ext_container_status_events（外部状态事件流，FK container CASCADE）

`status_code(DLPT/ARVD…)、status_name、occurred_at、location、description、data_source(AIS/船司/码头)、raw_data(jsonb)`。用途：外部原始事件节点（阶段二接入源）。

### ext_container_loading_records / hold_records / charges

- loading：`load_number、loading/discharge_port、loading/discharge_date`（装载记录）。
- hold：`hold_type、hold_reason、hold_date、release_date、status`（扣留/放行）。
- charges：`charge_type、charge_amount、charge_currency、charge_date、status`（费用，含币种）。
用途：外部装载/HOLD/费用对象（扣留五主体与费用治理源）。

### ext_demurrage_standards / ext_demurrage_records（滞港费标准/记录；定义于 init-database-complete.sql）

- standards：`overseas_company、destination_port、shipping_company、freight_forwarder、transport_mode、charge_type(DEMU/STOR)、is_chargeable、free_days_basis、free_days、calculation_basis、rate_per_day、currency、process_status`。
- records：费用产生/记录明细。
用途：**滞港费（P4 原则）** 标准与计费/对账输入。

## 6. 系统表（sys_*，定义于 init-database-complete.sql；运行时代码未接线=半成品）

`sys_users(username/password_hash/full_name/department…)`、`sys_roles(role_code…)`、`sys_user_roles`、`sys_audit_logs`、`sys_configs`、`sys_notifications`。用途：P5 身份/审计/配置的设计输入。

## 7. 数据质量注记（迁移前必查）

1. schema 漂移：柜型字典三套列变体；`process_empty_return(s)` 表名单复数；容器 `order_number` NOT NULL vs 实体可空。
2. 主键/关联老结构：`biz_containers` 以 `container_number` 为主键、与备货单经冗余互指（曾修复重复 container_number 列）。
3. 金额无币种（备货单多金额）、`sea_freight.freight_currency` 与 charges 才带币种。
4. 时间 DATE/TIMESTAMP 混用、`sea_freight.ata` 语义待澄清、多表时间命名不统一。
5. `main_order_number` 语义为票级代表（见 GLOSSARY §5）。

## 8. 关联与维护

- 关联 [FIELD_MIGRATION_MAP](./FIELD_MIGRATION_MAP.md)、[AS_IS snapshot](./AS_IS_LEGACY_BASELINE.md)、[DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)。
- 本文随源库变更更新；变更在头部留痕。
