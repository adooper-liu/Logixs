# 逻辑数据模型（P2-06 · 初稿）

> 状态：**候选（初稿）** · 2026-09-04 · 负责人：刘志高。
> 依据/输入：决策 D1–D14、生命周期 L(R0–R6/A6)、[FIELD_MIGRATION_MAP](./FIELD_MIGRATION_MAP.md)（现网列映射）、
> [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[INTEGRATION_BOUNDARIES](./INTEGRATION_BOUNDARIES.md)(source)、
> [DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)、[CONTAINER_MARKERS](./CONTAINER_MARKERS.md)、[PRINCIPLES](../PRINCIPLES.md)（滞港费 P4）。
> 本文为**逻辑层**（对象/关系/约束），不落物理 DDL（P3 `database/`）。单一事实见上链文档，本文不抄正文。

## 1. 对象与关系（首期）

```text
ShipmentPlan(出运计划,候选) 1:N ReplenishmentOrder(备货单)         1:1 ContainerRecord(货柜流转记录,主锚=order)
  容器侧扩展:  B/L归组(提单,候选) N:1 ContainerRecord? → B/L(单证) 1:N ContainerRecord(多柜并票)
ContainerRecord
  ├─ Journey(航次/海运 1:1)            ← process_sea_freight 映射
  ├─ PortOperations(数组,港口作业序列)     ← process_port_operations（origin/transit/destination）
  ├─ 运营后段(拖卡/卸柜/卸空/还箱关联)   ← trucking/warehouse/empty_returns 映射
  ├─ currentStatus + 各节点时间(planned/actual)   ← L/状态权威
  ├─ Markers / Attributes(受控键扩展) ← ENGINEERING §3.3 / CONTAINER_MARKERS
  └─ source / 审计(来源·操作者·前后值)   ← D7
相关: Dictionary(各字典+别名) · Exception(处置/五主体扣留放行) · Task/工单(候选) · FeeStandard+Charges(滞港费 P4)
```

## 2. ContainerRecord 关键字段与约束（要点）

| 要素 | 设计要点 |
| --- | --- |
| 标识 | surrogate `id`；业务唯一 `orderNumber`(备货单号,备货阶段) ；`containerNumber` 可空(迟绑定)，允许同箱号跨不同订单(复用)，非全局唯一 |
| 主键/唯一 | `UNIQUE(orderNumber)`（一单一柜）；`UNIQUE(id)`；索引 `containerNumber`(查询/外部回填) |
| 状态 | `currentStatus`（简化 7+取消，状态机权威） |
| 时间 | 各节点 `planned(计划/预计, R0 收口)` 与 `actual(实际,迟绑定)`；`S/E/A×TD/TA` 语义在契约统一（E 与 S 的差异见 §4 待定） |
| 金额 | `decimal` + `currency`；滞港费标准/费用记录独立对象（P4） |
| 来源 | 每值/字段带 `source`（统一枚举 §3.2）+ 时间戳 + 引用；手工值锁（D7） |
| 密封 | 推进封印：链已越过则前置节点不可改（R3）——由写端口强制，非库级 |
| 标记/扩展 | `markers`（child 集合）与受控 `attributes`（键受字典约束），新增标记不加列 |

## 3. 约束清单（逻辑不变量）

1. 一备货单 ≤ 一 ContainerRecord（`UNIQUE(orderNumber)`）。
2. `main_order_number` 不作业务键/关系（仅票级展示；迁移清洗 DATA_CLEANUP）。
3. 实际时间沿 L 单调（R1，服务端校验）；密封（R3）。
4. 标记键在受控字典内；动作绑定数据可配（D13）。
5. 金额定点 + 币种；缺币种不落库（A6）。
6. 写前过来源权威（D7）与可写窗口（R4）。
7. 时间按 R0；DATE 无时刻者显式标记（A8 收口）。

## 4. 待定（P2-06 评审项）

- 节点时间组织：每节点 planned/actual 两列 vs 子表 `node_times`（中转/清关等多时间点倾向子表）。
- `S计划` 与 `E预计` 是否合并存储（外部常仅给 E/实际两档）——契约 P2-09 定。
- markers/attributes 物理形态：child 表 vs 受控 JSONB（查询/约束权衡）→ P3 schema 前定。
- B/L 归组、ShipmentPlan、Task 是否纳入本模型/或阶段二（默认候选）。

## 5. 关联与维护

- 上链：P2-06 / 决策 D1–D14 / [FIELD_MIGRATION_MAP](./FIELD_MIGRATION_MAP.md)。
- 派生：P3 `database/schema`（物理）、P2-09 事件/契约、导入列映射、滞港费对象。
- 变更须评审；涉及架构 §19 先走 ADR。
