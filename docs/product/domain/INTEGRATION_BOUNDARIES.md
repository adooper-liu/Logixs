# 外部数据源与集成边界（INTEGRATION_BOUNDARIES）

> 状态：**候选（初稿，待 P2 评审）** · v0.1 · 2026-09-04 · 负责人：刘志高。
> 定位：Logix 与外部系统**交互的接口边界**（负责人 2026-09-04 描述），按生命周期区段给出：外部对象、交互内容、
> 集成渠道、主键、兜底方式与架构原则。
> 上游：架构 §3/§7.2、[MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)、AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)（FeiTuo/`integration` 适配器）、
> [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)（交互身份切换 §2.1）。

## 1. 概述

四个"区段起点"，每段对一组外部系统交互取数，均有**手工录入**兜底：

```text
① 备货起点   备货单信息   ← 外部计划系统（前期=导入；正式=数据库/系统交互）
② 海运段     状态/单证   ← 海关、港口、航司、三方API（如飞驼）等 / 手工
③ 提柜段     提柜/派送   ← 外部运输公司 / 手工
④ 卸柜后     收货/上架   ← WMS / 手工
```

## 2. 外部对象矩阵

| 区段 | 外部对象/系统 | 交互内容 | 集成渠道 | 主键 | 兜底 | 对应（AS-IS/适配器） |
| --- | --- | --- | --- | --- | --- | --- |
| ① 备货（起点） | 外部计划系统 | 获取备货单信息（建档/更新） | **前期=文件导入；正式=数据库/系统交互** | 备货单号 | 手工 | AS-IS `biz_replenishment_orders`（导入补建） |
| ② 海运段（装箱后→提柜前） | 海关 / 港口 / 航司 / 三方 API（飞驼等） | 状态事件/到离港/扣货/单证/清关 | 三方 API / 系统直连 | **箱号** | 手工录入 | FeiTuoAdapter 等 + `ext_container_status_events` |
| ③ 提柜段 | 外部运输公司（拖车） | 提柜/派送/司机/还箱安排 | 系统交互/API | **箱号** | 手工 | `process_trucking_transport` 相关 Adapter |
| ④ 卸柜后 | WMS | 卸柜确认/收货/上架/库存 | WMS 集成 | **备货单号**（货物侧）；箱号（还箱） | 手工 | `process_warehouse_operations`（`wms_status`/`ebs_status`） |

> 主键列与 [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md) §2.1 身份切换一致：①④ 以备货单号、②③ 以箱号。

## 3. 渠道与原则

- **渠道分级**：文件导入（首批/过渡）→ 系统/库直连（正式）→ 三方 API/适配器（常态）→ 手工录入（兜底，全程留审计）。
- **过渡策略**：备货单信息前期以导入启动、正式切换为与外部计划系统的**数据库/系统交互**；同类外部业务数据以适配器/API 为准，导入仅在切换前充当过渡。
- **身份切换**：对外取数键按区段切换（见 §2 主键列），内部记录双键可互解析（一单一柜）。
- **架构约束**：一切外部接入经 `integration` 模块 Port/Adapter（[MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) §3）；外部数据视为不可信、隔离解析；写入只经业务 API；接口具备幂等、去重与超时/重试（呼应 AGENTS §5/§10）。
- **多源冲突**：同一信息可能经 导入 + API + 手工 多次到达 → 由来源权威矩阵裁决（§3.1）。

### 3.1 数据来源权威矩阵（负责人已确认 2026-09-04）

来源：`手工` / `导入` / `API`。按**值级**记录来源与更新权限：

| 当前值来源 | 允许更新该值的来源 | 说明 |
| --- | --- | --- |
| 手工 | 仅手工 | 手工为最高权威；一旦手工设置，导入/API 到达**不覆盖**，进对账提示（不改写） |
| 导入 | 导入（二次）/ 手工 / API | **首次/冲突填充时导入优先于 API**（两者同时给同字段时先落导入值）；此后 API 到达亦可更新 |
| API | API / 导入 / 手工 | 普通更新 |

- 应用时机：导入与 API 同时为**同字段首次或冲突**提供时以导入值采纳（来源记导入）；"优先"仅指初始采纳顺序，不构成对后续更新的锁。
- 落地：写层按值记录 `source + occurredAt + actor/引用（批次/执行）`（供 P2-07 审计）；任何与手工锁冲突的外部到达被忽略并提示。

### 3.2 统一 source 枚举初值（G3，2026-09-04）

来源权威 D7 落地需绑定来源集；统一枚举初值（代码内固定、映射字典兼容外部叫法）：

`FeiTuo`（飞驼）、`AIS`、`ShipCompany`（船司）、`Terminal`（码头）、`Trucking`（拖车）、`Warehouse`/`WMS`、`Customs`（海关）、`CustomsBroker`（报关行）、`Railway`（铁路）、`PlanSystem`（外部计划系统）、`Import`（文件导入）、`User`（手工）、`System`（内部推导/规则）

- 映射：兼容现网 `Feituo/AIS/ShipCompany/Terminal/User/Excel`（历史值归并到上述枚举，Excel→Import）。
- 每值随 D7 矩阵 + LIFECYCLE R6 参与写前授权；枚举权威化进 GLOSSARY/契约（P2-09）。

## 4. 待评审决策

- 外部计划系统与 WMS 的**对接协议与部署边界**（库直连 vs API vs 中间件；数据驻留）。
- **字段级授权细化**：是否需按字段类型给导入/API 分授权（如静态业务字段导入权威、动态状态 API 可更，见 [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md) R6）。
- 海关/港口/航司及三方（飞驼等）的**首批接入范围与清单**（阶段二；配合 P2-04/P5）。
- 还箱对象归属（外部运输公司 vs 码头）与接口。
- 手工录入的界面范围与审计要求。

## 5. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)；AS-IS [快照](./AS_IS_LEGACY_BASELINE.md)（适配器现状）。
- 派生：P2-06 数据模型（来源/批次字段）、P5 服务身份与最小权限、阶段二 Adapter、P8 观测。
- 变更须评审；涉及架构 §19 先走 ADR；维护纪律见 `ENGINEERING_RULES` §12。
