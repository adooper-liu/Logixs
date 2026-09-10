# 现状系统基线快照（AS-IS）：货柜物流状态系统 → Logixs P2 设计输入

> 状态：**现状快照（审计基线）** · 快照日期 2026-09-04 · 源 `D:/Github/logix` @ `main acfb50a8`（2026-03-03；工作树含未提交改动，以快照读取时为准）。
> 用途：Logixs P2 领域设计（状态机 / 目标对象字段 / 导入形态 / 主数据治理）的**真实依据**与迁移对照。
> 纪律：本文件是 Logixs 文档树内关于现状系统事实的**单一权威快照**；P2 文档引用它，不重复正文。源仓库变更需更新本快照并在头部留痕。
> 关系：Logixs 是重新设计（TO-BE，绿色实现）；本快照描述被替代的现网系统（AS-IS），二者在本文件末对照。

## 1. 系统形态（AS-IS）

Express + TypeORM（PostgreSQL）单体，前端另起。核心对象是**货柜**，围绕货柜用四类表组织：

| 表类别   | 前缀       | 表                                                                                                                                      | 角色                     |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 业务主表 | `biz_`     | `biz_containers`（货柜）、`biz_replenishment_orders`（备货单）、`biz_customers`                                                         | 业务事实                 |
| 流程表   | `process_` | `process_sea_freight`、`process_port_operations`、`process_trucking_transport`、`process_warehouse_operations`、`process_empty_returns` | 一条货柜的完整流转上下文 |
| 外部记录 | `ext_`     | `ext_container_status_events`、`ext_container_loading_records`、`ext_container_hold_records`、`ext_container_charges`                   | 外部/事件原始数据        |
| 字典     | `dict_`    | `dict_ports`、`dict_shipping_companies`、`dict_freight_forwarders`、`dict_container_types`、`dict_warehouses`、`dict_countries` 等      | 主数据                   |

外部数据经适配器（`FeiTuoAdapter` 等，见 `backend/src/adapters/`、`backend/docs/LogiX 外部数据适配器架构.md`）接入；另有 `logistics-path-system` 子项目提供详细状态与路径。

### 1.1 货柜对象关系（AS-IS，重要）

```text
biz_replenishment_orders(备货单)  ⇄  biz_containers(货柜)     [双向字符串引用；实际基数未在本仓库复现]
        │ 订单事实（金额/日期/柜型要求）
        ▼
   biz_containers.container_number = 主键
        ├─ 1:1 process_sea_freight        (本柜的订舱/海运/单证/母船/时间/费用)
        ├─ 1:n process_port_operations    (port_type: origin/transit/destination + port_sequence)
        ├─ 1:1 process_trucking_transport (PRE/POST_SHIPMENT 拖卡：提柜/派送)
        ├─ 1:1 process_warehouse_operations(卸柜/开箱/仓租)
        ├─ 1:1 process_empty_returns      (还空箱)
        ├─ 1:n ext_container_status_events(外部原始状态节点 DLPT/ARVD…)
        ├─ 1:n ext_container_loading_records / hold_records / charges
        └─ n:1 dict_container_types / dict_ports / dict_shipping_companies …
```

**关键事实**：现状把「一次 Excel 行 = 一个货柜的一次完整流转信息」，字段按上面多张表落库；一个货柜在同一时刻只对应一条海运记录（`process_sea_freight.container_number` 为主键），多条港口作业记录按港口类型/顺序表达航线路径。没有「同一箱号多条航次历史」的显式建模。

> 补充：种子另含 `sys_users/roles/user_roles`（schema 有、运行时代码未接线，身份为半成品）与 `ext_demurrage_standards`（滞港/堆存费标准，含免费期与费率），见回验底稿 F2/F3。

## 2. 状态机现状（AS-IS）

权威代码：`backend/src/utils/logisticsStatusMachine.ts`；调用见 `services/container.service.ts`、`controllers/import.controller.ts`、`services/externalDataService.ts`。

### 2.1 三层状态

- **简化状态（7 层）**＝ 落库值（`biz_containers.logistics_status`，默认 `not_shipped`）+ UI/桑基/筛选：
  `not_shipped 未出运 → shipped 已出运 → in_transit 在途 → at_port 已到港 → picked_up 已提柜 → unloaded 已卸柜 → returned_empty 已还箱`。
  ⚠️ 枚举无 `cancelled`；但导入规范化可产生 `cancelled`（不一致，见 §5）。
- **详细状态（已列 27）**＝ 外部/微服务流转语言：基础 16（`NOT_SHIPPED, EMPTY_PICKED_UP, GATE_IN, LOADED, DEPARTED, SAILING, TRANSIT_ARRIVED, TRANSIT_DEPARTED, ARRIVED, DISCHARGED, AVAILABLE, GATE_OUT, DELIVERY_ARRIVED, STRIPPED, RETURNED_EMPTY, COMPLETED`）+ 异常 9（`CUSTOMS_HOLD, CARRIER_HOLD, TERMINAL_HOLD, CHARGES_HOLD, DUMPED, DELAYED, DETENTION, OVERDUE, CONGESTION`）+ 通用 2（`HOLD, UNKNOWN`）。旧资料称“33”但未列出另外 6 个值，因此不得按 33 作为迁移验收数。
- **外部事件码**＝ 飞驼/船公司/AIS/码头原始码（`BO 装船, DLPT 航行, ARRIVE, ATA 实际到港, ETA 预计到港, GATE_IN, GATE_OUT, DISCHARGED, AVAIL 可提, EMPTY_RETURN, HOLD/CUSTOMS_HOLD/CARRIER_HOLD/TERMINAL_HOLD`）。

### 2.2 映射（合成方向：外部码 → 详细 → 简化；Excel 中文 → 简化）

- `ExternalApiToDetailedMap`：外部码 → 详细。
- `DetailedToSimplifiedMap`：详细 → 简化；异常折叠规则：清关/船司/码头/费用扣货、倒箱(`DUMPED`)、延误(`DELAYED`)、滞港(`DETENTION`)、通用 `HOLD` → `at_port`；`OVERDUE` → `returned_empty`。
- `ExcelStatusToSimplifiedMap`：Excel 中文状态 → 简化；**`已取消 → not_shipped`（取消语义丢失）**。

### 2.3 转换与推导

- 显式转换 `SimplifiedStatusTransitions`：线性推进 + 允许跳步（`shipped→picked_up`、`in_transit→picked_up`、`at_port→unloaded`、`picked_up→returned_empty`）。
- **实际状态由推导函数 `calculateLogisticsStatus()` 决定（读时投影 + 写回缓存）**，优先级 1–9，基于关联表时间字段是否存在：
  1 还空箱 `returnTime` → `returned_empty`；2 仓库 `unloadDate` → `unloaded`；3 拖车 `pickupDate` → `picked_up`；
  4 目的港 `ataDestPort` → `at_port(dest)`；5 中转港 `transitArrivalDate` → `at_port(transit)`；6 目的港记录(无到达) → `in_transit`；
  7 中转港记录(无到达) → `shipped`；8 有出运日期(`sea_freight.shipmentDate` / `order.actualShipDate`) → `shipped`；9 默认 `not_shipped`。
- `container.service.ts` `enrichSingleContainer`：列表读取即重算，与缓存列不一致则 save 写回。

### 2.4 事件与时间线（AS-IS）

- `ext_container_status_events`：外部原始节点（`status_code/status_name/occurred_at/location/data_source(AIS|ShipCompany|Terminal)/raw_data(jsonb)`）。
- `process_port_operations` 冗余外部节点字段（`status_code/status_occurred_at/has_occurred/location_name_*/lat/lng/timezone/data_source`）。
- 前端时间线由 `getContainerStatusEvents()` 从四张流程表**时间字段合成伪事件**（ETA/ATA/UNLOADED/GATE_IN/GATE_OUT/AVAILABLE/DISCHARGED/PICKED_UP/DELIVERED/WAREHOUSE_ARRIVAL/UNBOXED/RETURNED_EMPTY）。
- 未做事件溯源；`logistics_status` 不是独立受约束状态，而是投影缓存。

## 3. 货柜相关字段目录（AS-IS）

字段完整定义以 `backend/src/entities/*.ts` 与 `backend/03_create_tables.sql`、`backend/migrations/` 为权威；此处为 Logixs 设计用的分组摘要。EXCEL＝Excel 映射新增；FEITUO＝飞驼外接新增；DERIVE＝参与状态推导。

### 3.1 `biz_containers`（货柜）

| 分组      | 字段                                                                                                                                                                           | 备注             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 标识/关联 | `container_number`(PK)、`order_number`(NN→备货单)、`container_type_code`(FK 柜型字典)                                                                                          |                  |
| 货物      | `cargo_description`、`gross_weight/net_weight/cbm/packages`、`seal_number`                                                                                                     |                  |
| 操作标志  | `inspection_required`、`is_unboxing`、`requires_pallet`(EXCEL)、`requires_assembly`(EXCEL)                                                                                     |                  |
| 状态      | `logistics_status`(DERIVE 缓存)、`current_status_desc_cn/en`                                                                                                                   | 外部状态中文描述 |
| 外接/超限 | `container_size`、`is_rolled` 甩柜、`operator`、`container_holder` 持箱人、`tare_weight` 皮重、`total_weight` 总重、`over_length/over_height` 超长/超高、`danger_class` 危险品 | FEITUO           |

### 3.2 流程表（均 `container_number` 关联；时间列 DATE 与 TIMESTAMP 混用）

- `process_sea_freight`：单证 `bill_of_lading_number, booking_number, mbl/hbl_scac+number, ams_number`；承运 `shipping_company_id, freight_forwarder_id, vessel_name, voyage_number, route_code, transport_mode, imo/mmsi/flag`；母船/中转 `mother_vessel_name/number, transit_port_code`；港口 `port_of_loading, port_of_discharge`；时间 `eta/etd/ata/atd, shipment_date, customs_clearance_date, document_release_date, port_entry_date, port_open/close_date, rail_yard/truck_yard_entry_date`；费用 `freight_currency(USD/CNY), standard_freight_amount`(EXCEL)。
- `process_port_operations`：`port_type(origin/transit/destination), port_code/name, port_sequence`；时间 `eta_dest_port, ata_dest_port, etd/atd_transit, transit_arrival_date, gate_in/out_time, discharged_time, available_time, dest_port_unload_date`(EXCEL)；清关 `customs_status, isf_status, planned/actual_customs_date, document_status, customs_broker_code`；免费期 `free_storage/free_detention/free_off_terminal_days`(EXCEL)；外部节点 `status_code/status_occurred_at/has_occurred/location/lat/lng/timezone/data_source`(FEITUO)。
- `process_trucking_transport`：`trucking_type(PRE/POST_SHIPMENT), is_pre_pickup`；时间 `pickup_date/last/planned, delivery_date/last/planned`(DERIVE pickup)；`unload_mode_plan(Drop off/Live load), driver/phone/truck_plate, pickup/delivery_location, distance_km/cost`。
- `process_warehouse_operations`：`operation_type(INBOUND/OUTBOUND/TRANSIT), warehouse_id→dict, warehouse_arrival_date, unload_date/last/planned`(DERIVE unload), `unload_mode_actual, wms_status/ebs_status/wms_confirm_date, is_unboxing, unboxing_time, storage_start/end_date`。
- `process_empty_returns`：`return_time/last/planned`(DERIVE)、`notification_return_date/time`(EXCEL)、`return_terminal_code/name, container_condition`。

### 3.3 字典与外部表

- 字典（Logixs `dictionary` 模块输入）：`dict_ports(port_code/name_cn/name_en/country/city/timezone/lat/lng/support_export/import)`, `dict_shipping_companies(company_code/name_cn/name_en/scac_code/api_provider)`, `dict_container_types(type_code/name_cn/name_en/size_ft/type_abbrev/dimensions/max_weight_kg/max_cbm/teu/is_active)`, `dict_warehouses/freight_forwarders/customs_brokers/trucking_companies/overseas_companies/countries/customer_types`。
- 别名映射（归一入口）：`create_universal_dict_mapping` / `create_port_name_mapping` 迁移建立的 `dict_*_mapping`（港口/通用字典别名）。
- 外部：`ext_container_status_events, loading_records, hold_records(hold_type/hold_date/release_date/status), charges(charge_type/amount/currency/date)`。
- `biz_replenishment_orders`：`order_number(PK), main_order_number, container_number, order_status(DEFAULT 'DRAFT'), customer_code/name, sell_to_country, total_boxes/cbm/gross_weight, shipment_total_value/fob_amount/cif_amount/negotiation_amount(无币种列), order_date, expected/actual_ship_date, container_required, inspection_required, is_assembly, pallet_required, wayfair_spo`。

## 4. Excel 导入现状（AS-IS）

`backend/src/controllers/import.controller.ts`：一次 Excel 上传，**一行 = 一个货柜**，按子结构分列：
`containers / seaFreight / portOperations(可多条) / trucking / warehouse / emptyReturn`；按 `container_number` 对六类表 upsert（存在即更新、无则插入），并在导入内做三类规范化：

- 柜型 `validateAndNormalizeContainerType`：大别名表（`40DV/40HQ→40HC`、`20→20GP`…），**未知静默回退 `20GP`**，仅 DB 有码才接受。
- 物流状态 `validateLogisticsStatus`：中文/英文变体→简化码；**未知静默回退 `not_shipped`**。
- 船司 `validateShippingCompany`：按 code/name 查字典，**查不到自动创建**（生成 `NEW_<时间戳>` 之类含糊码）。

有基础一致性校验（如「`已还箱` 必须有还空箱记录」）。无批次/幂等/预检/审核/对账的概念。

## 5. 现状反例与 Logixs 迁移注意（教训清单）

以下违反 Logixs `AGENTS.md` / `ENGINEERING_RULES`，是 TO-BE 必须修复、且可作 P2-04 主数据与 P2 预检规则的输入：

| #   | 反例（AS-IS）                                                                                                      | Logixs 处置方向                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| A1  | 非法/未知柜型、状态**静默回退** `20GP` / `not_shipped`                                                             | 未知值进待处理队列，明确失败，禁止静默默认（`ENGINEERING_RULES` §4.3）         |
| A2  | 未匹配船司**自动创建字典项**（`NEW_*`）                                                                            | 人工补主数据或进未知队列，禁止自动生成含糊字典项                               |
| A3  | 同义词映射**两份重复**（utils 与 import.controller）且漂移（`已装船`、`cancelled` 缺失）                           | 单一权威源（字典别名 + 共享状态契约），Contract Parity 防漂移                  |
| A4  | `cancelled` 不在简化态枚举，`已取消` 被归成 `not_shipped`，取消语义丢失                                            | TO-BE 状态模型显式含取消终态并定折叠口径                                       |
| A5  | `logistics_status` 是读时投影缓存，无受约束转换、无审计                                                            | TO-BE 定「事件推进 vs 投影」边界；转换受约束、留痕                             |
| A6  | 金额多处**无币种列**（备货单金额）；仅 `sea_freight.freight_currency`、`charges.charge_currency` 带币种            | 定点数 + 币种强制（`ENGINEERING_RULES` §4.1）                                  |
| A7  | 直接 upsert 覆盖、无批次幂等/审计；曾出现重复 `container_number` 列需修复迁移                                      | TO-BE 批次幂等键、行级结果、可审计事务导入（P2-03）                            |
| A8  | 时间 DATE/TIMESTAMP 混用、跨表时间字段命名不统一（已有 `convert_date_to_timestamp` 演进迁移）                      | UTC 存储、ISO-8601 交换、统一命名（`ENGINEERING_RULES` §4.1）                  |
| A9  | 货柜↔备货单使用**双向字符串引用**；本快照曾解读为多对多，LEGACY_DB_CATALOG 又解读为 1:1，原始 DDL/数据当前不可复现 | 先以原始 DDL、唯一约束和双向数据探查确定物理基数；TO-BE 关系再以 ID/值对象建模 |

## 6. AS-IS → TO-BE 对照结论

| 主题     | 直接复用（词汇/字段/规则）                              | 需重新设计                                                              |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 状态机   | 简化 7 层、已列详细态 27 个、外部码、异常折叠、跳步直觉 | 受约束转换 + 取消/异常口径 + 事件/投影边界 + 单一权威（P2-02）          |
| 目标对象 | 一行=一货柜全流程信息（多表分组字段）                   | 聚合边界、批次/预检/审核/对账（P2-01/P2-03）                            |
| 字段模板 | 上述真实列 + 别名/同义词集合                            | 标准字段目录（类型/必填/字典/唯一键/关键字段，见 TARGET_FIELD_CATALOG） |
| 主数据   | 港口/船司/柜型字典结构                                  | 未知值策略、别名单一权威、币种/时间纪律（P2-04 输入）                   |
| 导入     | 六子结构行模型、柜型/状态/船司别名直觉                  | 批次幂等、预检硬闸、AI 映射建议、逐行审核与对账                         |

## 7. 关联与维护

- 本快照服务于：`CONTEXT_MAP`、`CONTAINER_STATUS_MODEL`、`IMPORT_DOMAIN_MODEL`、`TARGET_FIELD_CATALOG`（均引用本文件）。
- 源仓库（`D:/Github/logix`）变更后需在本文件头部更新 commit 与留痕；读取时若与旧快照冲突，以新快照为准并在变更记录注明。
- 关联 Logixs：任务 brief `docs/planning/tasks/p2-shipment-import-domain.md`；P0 基线（`IMPORT_WORKFLOW`/`GLOSSARY`/`NFR`）。
