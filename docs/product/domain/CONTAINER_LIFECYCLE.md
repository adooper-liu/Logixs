# 货柜全生命周期管理（CONTAINER_LIFECYCLE）

> 状态：**候选（初稿，待 P2 评审）** · v0.3 · 2026-09-04 · 负责人：刘志高。
> 阶段链已定稿（2026-09-04）：起运侧三级分工（装箱/出运/离港分开）、清关单列节点、卸空独立、**入库归 WMS（货物侧交接终点，非容器主链）**。
> 定位：Logix **全过程生命周期管理**目标定义。**规范节点枚举（顺序/可选/状态）以 [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md) §2 为单一权威**，本文给出各节点的数据锚与首期/阶段二映射。
> 关联：[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)（计划/订舱上游）、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)（状态权威）、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[INTEGRATION_BOUNDARIES](./INTEGRATION_BOUNDARIES.md)、AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)。

## 1. 目标

对**每条货柜流转记录（ContainerRecord，一单一柜）**端到端管理生命周期（备货→…→还箱），全程可查当前阶段、
历史事件、预计/实际时间与异常；时间与状态满足单调/密封约束（见 LIFECYCLE_CONSISTENCY）。

## 2. 规范阶段链（已定稿）

```text
备货 → 装箱 → 出运 → 离港 → 海运 → (中转港?) → 清关 → 目的港(到港)
    → (海铁联运?) → 拖卡(提柜+拖运) → 送仓 → 卸柜 → 卸空 → 还箱（终）
[入库 = WMS 收货/上架，货物/订单侧交接终点，非容器主链]
```

| # | 节点 | 可选 | 主链状态 | 实际时间字段（候选） | 数据锚（AS-IS） | 首期(P6 导入) vs 阶段二 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 备货 | 否 | `not_shipped`（计划） | 备货完成/期望出运 | 备货单 | 计划层建档（非导入） |
| 2 | 装箱 | 否 | `not_shipped`（已装未出） | 装箱完成时间 | 真实毛重/件数/体积/封号定稿；**箱号迟绑定起点**；前置事件=提空箱 | **导入（装箱后数据）主场景** |
| 3 | 出运 | 否 | `shipped`（已发运/装船确认） | 出运/装船时间 | 出运/装船确认 | 导入或阶段二 |
| 4 | 离港 | 否 | `shipped`（离港） | atd/实际离港 | `process_sea_freight.atd/shipment_date` | 导入或阶段二 |
| 5 | 海运 | 否 | `in_transit` | 航行/预计到港 | sailing/ETA | 阶段二 |
| 6 | 中转港 | 是 | `in_transit`/`at_port(transit)` | 中转到/离 | `process_port_operations`(transit) | 阶段二；导入可带途经港 |
| 7 | 清关 | 否（特定条款可 N/A） | `at_port`(清关中) | 计划/实际清关 | customs_status / customs 日期 | 导入可带；放行须先于 #10 拖卡提柜 |
| 8 | 目的港(到港) | 否 | `at_port(dest)` | ata/卸船 | `ata_dest_port / dest_port_unload_date` | 导入或阶段二 |
| 9 | 海铁联运 | 是 | 目的侧内段 | 进铁路堆场/内陆 | rail_yard_entry_date（随路由扩展） | 阶段二；导入可带进火车堆场日期 |
| 10 | 拖卡（提柜+拖运） | 否 | `picked_up` | gate_out/提柜、拖运 | `process_port_operations.gate_out_time`、`process_trucking_transport` | 导入或阶段二 |
| 11 | 送仓（送达仓库） | 否 | `picked_up`(待卸) | 送达时间 | `process_trucking_transport.delivery_date` | 导入可带 |
| 12 | 卸柜 | 否 | `unloaded` | 卸货时间 | `process_warehouse_operations.unload_date` | 导入或阶段二 |
| 13 | 卸空 | 否 | `unloaded`(已卸净) | 卸空/开箱完成 | `unboxing_time` | 导入或阶段二 |
| 14 | 还箱 | 否 | `returned_empty`（终） | 还箱时间 | `process_empty_returns.return_time` | 导入或阶段二；`returned_empty` 需还箱时间证据 |

### 2.1 入库（WMS 交接，不在容器主链）

- `入库` = WMS 收货/上架，按**备货单/库存**管理（货物/订单侧）。
- Logix 与 WMS 的边界：卸柜/卸空/还箱确认在 Logix 侧（或 WMS 回传），**入库及之后仓库作业归 WMS**（负责人已确认 ④）。
- 交互身份切换（装箱后→卸柜前用箱号；卸柜后备货单号重新激活）见 [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md) §2.1 与本文以下 §3。

## 3. 交互身份切换（负责人已确认 2026-09-04）

| 阶段 | 主导键 |
| --- | --- |
| 备货 → 装箱前 | 备货单号（内部） |
| 装箱后 → 卸柜前 | **集装箱号**（与船司/海关/码头/拖卡等外部交互；备货单号不可用） |
| 卸柜完成 → 上架/库存 | **备货单号（重新激活）**（WMS 侧） |

隐含两条子生命周期：货物/订单生命周期（备货单号驱动）与设备/运输生命周期（箱号驱动，装箱后至还箱）。

## 4. 数据来源与补全策略

- 定稿点在装箱：装箱前多为预估，装箱后真实数据 + 箱号进入。
- 输入形态：外部交换/API、操作员录入、Excel/文件导入三种；首期以导入为主承载装箱后到还箱的已知数据（阶段锚点可整链回填，见 LIFECYCLE_CONSISTENCY R5）。
- 同一 ContainerRecord（按备货单号命中）在各时点可反复更新补全，而非每次新建。

## 5. 字段模板关系

字段模板分节 A–D/E（[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)）＝本生命周期某时间点的"横向快照"：
A=柜况、B=航次海运、C=港口作业（含中转/清关）、D=拖卡/仓库/还箱（含铁路堆场）、E=状态文本。

## 6. 待评审决策

- 阶段二各事件（提空箱/中转/铁路/清关放行）的来源适配器优先级与 SLO。
- 海铁联运多段路由的表达深度（首期仅单层 vs 多段）。

## 7. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；规范链单一权威 [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md) §2。
- 外部数据源：见 [INTEGRATION_BOUNDARIES](./INTEGRATION_BOUNDARIES.md)。
- 派生：P2-06 数据模型、P2-09 事件契约、阶段二 `logistics-status`。
- 变更须评审；涉及架构 §19 先走 ADR；维护纪律见 `ENGINEERING_RULES` §12。
