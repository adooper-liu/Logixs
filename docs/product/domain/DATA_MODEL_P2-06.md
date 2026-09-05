# 逻辑数据模型（DATA_MODEL_P2-06 · v0.2 人话重构）

> 状态：**候选 v0.2** · 2026-09-05 · 负责人：刘志高。
> 一句话：新库长什么样的"对象+约束"图纸；字段定义与列映射在 NODE_TIME_FIELDS / FIELD_MIGRATION_MAP，物理 DDL 在 P3。
> 依据：D1–D14、L 节点(R0–R6)、一单一柜主锚=备货单号、迟绑定、来源权威、标记/费用。

## ① 可落库清单

### A. 逻辑对象与关系（基数）

| 对象 | 角色 | 关系 | 状态 |
| --- | --- | --- | --- |
| ReplenishmentOrder(备货单) | 建档身份 | 1:1 → ContainerRecord | O |
| ContainerRecord | 业务事实主记录 | 1:1 备货单；1:N 时间线事件 | O |
| B/L(提单归组) | 单证(候选) | 1:N ContainerRecord | C |
| ShipmentPlan | 计划层(候选) | 1:N 备货单 | C |
| markers/attributes | 扩展集 | 属 ContainerRecord | O |
| FeeStandard/Charges | 滞港费 | 独立 | O(P4) |
| Task/工单 | 作业(候选) | 挂节点/记录 | C |

### B. ContainerRecord 字段要点（约束）

| 要素 | 定义/约束 |
| --- | --- |
| 标识 | surrogate id；`UNIQUE(orderNumber)`（一单一柜）；containerNumber 可空(迟绑定)、非全局唯一(跨单复用) |
| 状态/时间 | currentStatus(8) + 各节点 planned/actual（NODE_TIME_FIELDS） |
| 金额 | decimal + currency（缺币种不落库） |
| 来源 | 每值 source + 时间 + 引用（D7） |
| 标记/扩展 | markers(child)/attributes(受控键) —— 新增标记不加列 |
| 密封 | 推进即 seal（写端口强制，非库级） |

### C. 逻辑不变量（数据库/应用可强制）

| # | 不变量 |
| --- | --- |
| 1 | 一备货单 ≤ 一 ContainerRecord（UNIQUE orderNumber） |
| 2 | main_order_number 不作键/关系（仅票级展示） |
| 3 | 实际时间沿 L 单调(R1) + 密封(R3)，服务端 |
| 4 | 标记键受控字典内；动作绑定数据可配(D13) |
| 5 | 金额定点+币种 |
| 6 | 写前过来源权威(D7)/可写窗口(R4) |
| 7 | 时间按 R0 分列；DATE 无时刻显式标注 |

## ② 定义与澄清

- 逻辑层=对象+约束图纸；物理层=表/索引/迁移（P3）——别混。
- ContainerRecord 是"一柜实情"；备货单是身份；两者 1:1 但语义不同。

## ③ 规则与约束/边界

- 入库(WMS)不入主链数据表（另有交接记录）。
- 迟绑定列可空；禁止用 main_order/未映射值造唯一键。
- 扩展示例优先 markers/attributes，列升格走迁移与评审。

## ④ 流程（怎么落到库）

逻辑图纸 → 字段级映射(FIELD_MIGRATION) 校验 → P3 物理 schema/迁移 → Seed(枚举/字典) → 契约(P2-09)对齐。

## ⑤ 注意事项（坑）

- 别把物理列名当业务键（order_number 唯一锚，container_number 迟绑定）。
- 别为每个新特征加列（用标记/属性）。
- 别在未清洗主备货单关系前建唯一约束（先跑 DATA_CLEANUP）。

## ⑥ 白话注解（🗣️）

🗣️ 这张图回答"新库里谁是谁、谁归谁、哪列不许空、哪些值不许乱"：每个柜子=一条记录，用备货单号锁死不重复；箱号可以后补；时间分"预计/实际"两格；凡是钱的都得带币种；五花八门特征走"标签"而不是无限加列。

## ⑦ 落库映射

| 清单 | 落库 |
| --- | --- |
| 对象/关系 | schema(P3) 表 + FK |
| 约束 | UNIQUE/CHECK/枚举/版本 |
| 枚举值 | EVENT_CODES/STATUS/SOURCE 等 Seed |
| 标记/属性 | 受控键字典 + 扩展表/字段(P3 评审) |

## ⑧ 待评审/关联

- 待定：节点时间 子表 vs 双列、S/E 是否合并、markers/attributes 物理形态、B/L·ShipmentPlan·Task 是否入库。
- 关联：FIELD_MIGRATION_MAP、NODE_TIME_FIELDS、EVENT_CODES、DATA_CLEANUP_ORDER_CONTAINER、CONTRACTS_DRAFT、INTEGRATION_BOUNDARIES。
