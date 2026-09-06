# AS-IS 实现 vs TO-BE 评审清单 · 差异 / 漏点 / 不足 / 优势

> 状态：**分析记录（供 P2 评审）** · 2026-09-04 · 评审人：刘志高。
> 方法：将现网实现（`D:/Github/logix`，锚点 `main acfb50a8`）与 Logix TO-BE 领域文档/评审清单
> （[P2_REVIEW_CHECKLIST](./P2_REVIEW_CHECKLIST.md) 的 D1–D21、`docs/product/domain/*`）逐维对照；本文仍是 2026-09-04 形成的现网差异快照，后续新增追踪项以评审清单为准。
> 目的：找出评审清单**漏掉**的现网资产与差异，避免新设计推倒有用资产或漏建必要结构。
> 现网事实只以 AS-IS [快照](./AS_IS_LEGACY_BASELINE.md) + 源码路径为准，不再复制。

## 1. 一页差异对照（TO-BE 决策 vs AS-IS 现状）

| 维度       | AS-IS（现网）                                                                                                        | TO-BE（评审清单/文档）                                               | 关系                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| 对象单位   | `biz_containers`，`container_number` 为主键                                                                          | ContainerRecord，**主锚=备货单号**（一单一柜），允许同箱历史         | **冲突→TO-BE 更普适，但需数据迁移键映射** |
| 计划层     | **无** ShipmentPlan/出运计划表；仅 `biz_replenishment_orders` 备货单（含 main_order）                                | 新增 ShipmentPlan 顶层聚合（候选）                                   | TO-BE 补足                                |
| 导入       | 单箱 Excel 直 upsert 六表，无批次/幂等/预检/审核/对账                                                                | ImportBatch + 幂等 + 预检硬闸 + 审核 + 对账 + 来源权威               | TO-BE 补足（修 A7）                       |
| 身份/租户  | 运行时无 User/Role/权限/租户实体与鉴权中间件；但种子含 `sys_users/roles/user_roles`（schema 有、代码未接线，半成品） | Identity/RBAC/租户（P2-05/P5）                                       | TO-BE 补足；迁移输入                      |
| 外部集成   | **已有适配器层**：IExternalDataAdapter + AdapterManager + 主备/故障转移 + webhook + 健康检查                         | INTEGRATION_BOUNDARIES 仅列数据源，**无故障转移/适配器生命周期设计** | AS-IS 强 → **TO-BE 应复用/继承**          |
| 状态       | 三层（7 简化/33 详细/外部码）+ 读时推导投影                                                                          | 词汇复用 + 取消/异常正交 + 受约束推进 vs 投影（候选）                | 兼容方向一致，TO-BE 补纪律                |
| 主数据别名 | `dict_universal_mapping`（通用框架：dict_type/多语言别名）、`dict_port_name_mapping`                                 | Dictionary 上下文 + 未知值队列（P2-04 未写）                         | **现网已有资产待复用**                    |
| 仓库       | `WarehouseOperation` 含 `wms_status/ebs_status`、卸柜/开箱/仓租/出入库类型                                           | ④ 卸柜后归 WMS，Logix 收卸柜完成/还箱                                | 映射点（字段复用/迁移）                   |
| 观测       | 已配 Prometheus/Grafana/TimescaleDB、monitoring.controller、桑基统计                                                 | P8 才定义                                                            | AS-IS 资产可继承                          |

## 2. AS-IS 强项 · TO-BE 评审清单的「漏点」（应复用未复用）

1. **多数据源适配器与故障转移**：现网 IExternalDataAdapter + AdapterManager 提供 主备（FeiTuo Primary / LogisticsPath Secondary / Custom Fallback）、健康检查、自动故障转移、webhook、`syncContainerData`。评审清单 INTEGRATION_BOUNDARIES 只列了外部对象与渠道，**没规划适配器接口/优先级/故障转移/重试降级**——这正是 R-03/架构 §7.2 的落地载体。建议：阶段二直接继承此模型（ADP 接口 + 管理器），新设计不该另起炉灶。
2. **通用字典别名框架**：`dict_universal_mapping`（dict_type→target_table/target_field→standard_code + 中/英/本地别名）与 `dict_port_name_mapping`（is_primary 主别名）已实现。P2-04 的 Dictionary/别名/未知值设计应**以此为迁移与复用基线**，评审清单未引用。
3. **现网 source 混合了主体与渠道**：外部路由已有 `dataSource: Feituo/AIS/ShipCompany/Terminal/User/Excel`，但 `User/Excel` 与业务来源主体不在同一维度。TO-BE 可复用其值作迁移别名证据，必须拆为来源主体、操作者和接入渠道，再按 D7 绑定字段/事件权威策略，不能整套直接升格。
4. **仓库/WMS 交接字段已存在**：`wms_status/ebs_status/wms_confirm_date`、`is_unboxing/unboxing_time`、`storage_start/end`、`cargo_received_by/delivered_to`。④ 边界与卸空/还箱的 WMS 回传**应映射到这些字段**（迁移映射表缺失）。
5. **HOLD / 费用 / 装载 外部对象**：`ext_container_loading_records / hold_records / charges`（含 charge_currency）已建模；TO-BE 生命周期只到状态/异常，**扣货(HOLD)与费用(D&D)对象尚未在清单里**（D8 升级路径含糊）——建议列入后续 scope 决策。
6. **出库/逆向操作已存在**：`WarehouseOperation.operation_type INBOUND/OUTBOUND/TRANSIT`、`TruckingTransport.trucking_type PRE/POST_SHIPMENT` → 现网不止"进口到仓"；TO-BE 生命周期只建模了进口侧，**出库/中转/再发运维度未在清单显式声明为不做**（需明确 out-of-scope）。
7. **生产监控资产**：docker-compose（timescaledb/prometheus/grafana）、monitoring.controller、桑基统计（containerStatistics 千人千面）已运行——P8 宜继承而非从零。
8. **费用/免费期标准**：`ext_demurrage_standards`（目的港+船司+免费期+费率+币种，含 LAX 免 5 天 Demurrage 80 USD/天）已建模——支持 G4 费用对象与 K7 免费期预警阈值回验（见 [NODE_PDCA_VALIDATION](./NODE_PDCA_VALIDATION.md)）。

## 3. AS-IS 不足 · TO-BE 已覆盖的「优势」（评审确认方向正确）

1. 无身份/租户/权限与对象级授权 → TO-BE P2-05/P5 不可绕过（AGENTS §5）。
2. 导入无批次幂等/预检/审计/对账，直接 upsert 且曾出现重复 container_number 列 → TO-BE P2-03（A1–A9 修复）。
3. 未知柜型/状态/船司静默回退或自动建 `NEW_*` 主数据 → TO-BE 未知值进队列（A1/A2）。
4. 状态为读时重算+静默写回、无受约束转换 → TO-BE 状态机纪律（D8/R1–R6）。
5. 箱号唯一、无同箱多航次历史 → TO-BE 以备货单为记录、支持历史。
6. 金额缺币种（备货单多金额列无币种）→ TO-BE 定点+币种（A6）。
7. 迁移分散在仓库根与 backend/migrations 多处、无统一门禁 → TO-BE 唯一迁移入口纪律。

## 4. TO-BE 相对 AS-IS 的「不足/待补」（本批评审要回查的洞）

1. **集成冗余/故障转移缺失**：INTEGRATION_BOUNDARIES 未定义 主备适配器/健康检查/自动故障转移/重试（现网已有，勿重造）。
2. **数据迁移映射未列**：现网 6 张流程表 + dict 框架 + wms 字段 → ContainerRecord 各节点/字段的**字段级迁移映射**尚未规划（P2-06 必须接盘，否则丢历史数据语义）。
3. **多源冲突语义需接现网来源集**：D7 权威矩阵需绑定具体 `source` 枚举（Feituo/AIS/ShipCompany/Terminal/User/Excel）。
4. **扣货/费用/装载/出库逆向**未显式收边：要么纳入 scope，要么写入"明确不做"（PRODUCT_BRIEF §4 需补）。
5. **备货单/PO 字段层未细化**：现网备货单带 customer/country/多金额/PO(wayfair_spo)/main_order；ShipmentPlan→备货单 的金额币种与客户引用在 TO-BE 计划层文档里仍是空白（影响 P2-04/06）。
6. **现网时间 DATE/TIMESTAMP 混用与 rail/truck yard 等字段**需在 planned/actual 分列时对号入座（LIFECYCLE_CONSISTENCY §6 候选字段集应参照现网列集）。

## 5. 行动建议（并入评审清单）

- 更新 INTEGRATION_BOUNDARIES：增加「适配器与故障转移（继承现网 AdapterManager）」+ 来源枚举复用。
- P2-04 前先盘点并复用 `dict_universal_mapping` / `dict_port_name_mapping` 别名数据。
- P2-06 首项任务 = 现网 6 表 + dict 框架到 ContainerRecord/标准字段的**字段级映射表**（含币种、时间口径）。
- 生命周期/边界文档显式写明 out-of-scope：扣货/费用对象、出库逆向、统计报表（或挂阶段二/后续切片）。
- 评审清单 §3「全局待确认」增加上述 5 项复核。

## 6. 关联与维护

- 关联 [P2_REVIEW_CHECKLIST](./P2_REVIEW_CHECKLIST.md)、AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)、INTEGRATION_BOUNDARIES。
- 本文档为分析记录，结论落地到对应设计文档后随评审更新；无独立消费者即删除（ENGINEERING_RULES §12）。
