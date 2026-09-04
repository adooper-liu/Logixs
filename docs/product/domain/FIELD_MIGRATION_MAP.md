# 字段级迁移映射（P2-06 主任务 · G2 初稿）

> 状态：**候选（初稿）** · 2026-09-04 · 负责人：刘志高。
> 目的：把现网 6 流程表 + dict 框架 + wms 字段 + 费用标准 逐字段映射到 ContainerRecord/标准字段，
> 落实：币种(定点)、时间口径(R0：S/E/A×TD/TA)、迟绑定、source、一备货单→一柜、主备货单号不作键。
> 衔接：[DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)（先清洗后映射）、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)（标准字段）、AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)。
> 表列约定：`类型/时间`（R0 口径）、`币种`、`source/迟绑定`、`处置`（映射/派生/展示保留/弃用/待确认）。

## 1. 映射规则（前置约定）

1. **备货单→柜**：`biz_replenishment_orders.order_number` → ContainerRecord 主锚；`main_order_number` **不映射为键/关系**（仅票级展示，标记 legacy 弃用）。
2. **时间**：凡 日期/时刻 按 R0 分 `计划(S)/预计(E)/实际(A) × 抵(TA)/离(TD)`，DATE 无时刻的按业务语义收口为 `date` 类型并显式标注（修 A8）。
3. **币种**：金额一律 定点 + 币种；现网缺失币种的（如备货单金额）先标 `currency: 待确认`（默认候选 USD，待业务复核，A6）。
4. **迟绑定**：箱号、实际出运日期等装箱后才有 → 标记 late，可空到外部交换。
5. **source**：每值记录来源（Feituo/AIS/ShipCompany/Terminal/User/Excel/Import/PlanSystem/WMS，见 D7）。
6. 无法干净映射的业务值进待处理/对账，禁止静默默认（A1/A2）。

## 2. 首轮映射（主表 → 标准对象）

### 2.1 `biz_replenishment_orders` → 备货单/计划层（暂落 备货单字段集，G5 续）

| 现网列 | 落点 | 类型/时间 | 币种 | source/迟绑定 | 处置 |
| --- | --- | --- | --- | --- | --- |
| order_number | 备货单号（主锚） | string | — | 计划/导入 | 映射 |
| main_order_number | —（不映射为键） | string | — | — | **弃用/仅票级展示** |
| customer_code/name、sell_to_country | 备货单客户/国别 | string | — | PlanSystem | 映射（G5） |
| expected_ship_date / actual_ship_date | 预计出运(S) / 实际出运(A·迟绑定) | date | — | 计划/导入 | 映射并拆计划/实际 |
| total_boxes/cbm/gross_weight | 备货单合计 | decimal | — | — | 映射（装箱对账用） |
| fob/cif/negotiation_amount | 金额 | decimal | **缺 → currency 待确认** | — | 映射+补币种（A6） |
| order_status(DRAFT…) | 备货单状态（域内） | enum | — | — | 待定状态权威 |
| container_number | 冗余列（应等于其货柜） | — | — | — | 校验/对账用，不作关系源 |

### 2.2 `biz_containers` → ContainerRecord（柜况+状态）

| 现网列 | 落点 | 类型/时间 | source/迟绑定 | 处置 |
| --- | --- | --- | --- | --- |
| container_number | containerNumber | string | 迟绑定 | 映射 |
| order_number | orderNumber(主锚引用) | string | 导入 | 映射（须与备货单一致） |
| container_type_code | containerTypeCode | dict | — | 映射（标准码+别名，W?） |
| cargo/gross/net/cbm/packages/seal | 对应柜况字段 | decimal/string | 装箱后 | 映射 |
| inspection_required/is_unboxing/requires_* | 柜况布尔（或转标记候选） | bool | — | 映射；装配/打托考虑转标记 |
| logistics_status | currentStatus（现简化 7 层） | enum | 系统 | 映射；转入状态机权威 |
| current_status_desc_cn/en | 外部状态描述（原始留痕） | string | API | 保留为描述/原始值 |
| is_rolled/operator/container_holder/tare/total/over_*/danger_class | 柜况扩展 | — | FeiTuo | 映射；超限/危险品入标记候选（MARKER） |
| created/updated_at | 审计时间 | ts | — | 映射 |

### 2.3 `process_sea_freight` → ContainerRecord（航次/单证/时间）

| 现网列 | 落点 | 类型/时间 | 币种 | 处置 |
| --- | --- | --- | --- | --- |
| booking_number/bill_of_lading_number | 订舱号/提单号（B/L 归组键） | string | — | 映射 |
| mbl/hbl_scac+number、ams_number | 单证字段 | string | — | 映射 |
| shipping_company_id/freight_forwarder_id | 船司/货代 | dict | — | 映射（能力矩阵，W10） |
| vessel_name/voyage_number | 船名/航次 | string | — | 映射 |
| port_of_loading/discharge(+transit) | 起/目/中转港 | dict(LOCODE) | — | 映射 |
| eta/etd/ata/atd | 预计/实际抵/离 | datetime | — | 按 R0 分拆（E/A×TA/TD）；语义以实际节点为准（ATA 澄清） |
| shipment_date | 出运（实际，迟绑定） | date | — | 映射（A6 与离港顺序） |
| freight_currency + standard_freight_amount | 海运费币种+金额 | decimal+币种 | 已有 | 映射 |
| rail_yard/truck_yard_entry_date 等 | 内段时间 | date | — | 映射（海铁 K9） |

### 2.4 费用/免费期（滞港费，P4）

| 现网 | 落点 | 处置 |
| --- | --- | --- |
| `ext_demurrage_standards`（目的港/船司/免费期/费率/币种/计算基准） | 费用标准字典（K7 免费期/预警/预估输入） | 映射为费用标准；接 P4 |
| `ext_container_charges` | 费用记录（含币种） | 映射费用/对账记录 |

### 2.5 `process_port_operations` → ContainerRecord（港口作业序列 C，含中转/清关/免费期）

| 现网列 | 落点 | 类型/时间 | source | 处置 |
| --- | --- | --- | --- | --- |
| port_type(origin/transit/destination) | 港口作业段类型 | enum | — | 映射（地点语义，P6 评估） |
| port_code/name/sequence | 港口引用+顺序 | dict/LOCODE | — | 映射 |
| eta/ata_dest_port、etd/atd_transit、transit_arrival_date | 各段 预计/实际 抵/离 | datetime(R0) | API/导入 | 映射并拆 E/A×TA/TD；中转(K5/6) |
| gate_in/out_time、discharged/available_time、dest_port_unload_date | 进场/出场/卸船/可提/到港卸 | datetime | API | 映射（子里程碑 进场/可提） |
| customs_status/isf_status/planned·actual_customs_date/document_status/customs_broker | 清关段（K6） | datetime(R0) | API | 映射；放行/查验进 exception（五主体） |
| free_storage/free_detention/free_off_terminal_days | 免费期字段 | int | 导入 | 映射（滞港费 P4 输入） |
| status_code/status_occurred_at/has_occurred/location_*/lat/lng/timezone/data_source | 外部节点原样 | — | API | 保留为事件/原始值（W1 信封） |

### 2.6 `process_trucking_transport` → 拖卡/送仓（K9/K10）

| 现网列 | 落点 | 时间 | 处置 |
| --- | --- | --- | --- |
| trucking_type(PRE/POST) | 段属性（预/出运后） | — | 映射 |
| pickup_date/planned/last、delivery_date/planned/last | 提柜/送达 计划·实际 | R0 | 映射 |
| driver/driver_phone/truck_plate | 司机/车牌 | — | 映射（车牌为箱事件必带，规范） |
| pickup/delivery_location、carrier_company | 地点/承运 | — | 映射 |
| unload_mode_plan | 卸柜方式(Drop off/Live load) | — | 映射到送仓/卸柜前 |
| distance_km/cost | 里程/费用 | — | 映射（费用项确认币种） |

### 2.7 `process_warehouse_operations` + `process_empty_returns` → 卸柜/卸空/还箱（K11–K14）+ WMS 边界

| 现网列 | 落点 | 处置 |
| --- | --- | --- |
| warehouse_* / planned_actual_warehouse / arrival | 送仓→卸柜前 | 映射（入库仓库，K11） |
| unload_date/planned/last、unload_mode_actual、unboxing_time | 卸柜/卸空（K12/13） | 映射（卸空独立节点） |
| wms_status/ebs_status/wms_confirm_date | **WMS 交接确认（④边界）** | 映射为交接记录，**上架/库存归 WMS**（非主链） |
| empty_returns.return_time/planned/last、return_terminal_code/name | 还箱（K14，`returned_empty` 证据） | 映射 |
| empty_returns.notification_return_date/time | 通知取空 | 映射（候选） |

### 2.8 现网 dict 框架 → Dictionary/别名/能力（G3/W4/W10）

| 现网 | 落点 | 处置 |
| --- | --- | --- |
| `dict_universal_mapping` / `dict_port_name_mapping`(is_primary) | 别名映射字典（复用） | 迁移为 Dictionary 别名；多语言+本地名保留 |
| `dict_ports`(LOCODE 风格)/`dict_container_types`(标准码+别名)/`dict_shipping_companies`(scac) | 港口/柜型/船司主数据 | 映射；柜型以标准码为主键（W? P5）、别名入字典 |
| 船司 BK/BL/箱号 能力、API 归组、港口 能力/方向/必填（宁波船名航次） | 能力/规则配置表 | 新增配置（W10/W4） |
| `ext_demurrage_standards`/`ext_container_charges` | 费用标准/记录 | 映射（P4 滞港费） |

## 3. 待补（随 P2-06 迭代 + P2-12 样本校验）

- `ext_container_status_events`（外部事件原始表）→ 阶段二事件接入（信封 W1），映射策略
- `ext_container_loading_records`/`hold_records` → 装载/HOLD（exception/五主体）
- `sys_*`/`sys_roles`（身份半成品）→ P5 身份设计输入
- 每字段的 `source` 默认值与历史数据回填规则
- 全表行级样本回验（P2-12）逐字段落定类型/币种/口径

## 4. 验收

- 映射表经真实脱敏样本回验（P2-12）+ 币种/时间口径逐字段落定；
- 输出 = 迁移/建表脚本依据 + 导入列映射 + 对账查询（衔接 DATA_CLEANUP）。

## 5. 关联与维护

- 上链 G2 / P2-06；[DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)、AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)。
- 变更须评审；涉及架构 §19 先走 ADR。
