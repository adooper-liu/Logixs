# 货柜状态模型与合法转换（P2-02）

> 状态：**候选（初稿，待 P2 评审）** · v0.3 · 2026-09-04 · 负责人：刘志高。
> 关键决策（负责人已确认 2026-09-04）：**导入文件「物流状态」文本列 = 该记录的当前真实状态**（经字典归一后直接落 `currentStatus`，见 §6）。
> 上游：`GLOSSARY` §2、[CONTEXT_MAP](./CONTEXT_MAP.md)、架构 §7.3 / §11、现状基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §2（状态词汇事实源）。
> 读者：Shipment/物流状态域实现者、阶段二 `logistics-status` 事件接入、P2-09 契约执行者、迁移实施者。
> 单一权威纪律：同一状态机只在一处维护正文（`ENGINEERING_RULES` §10/§12）。本文件是**货柜业务状态机的唯一权威初稿**；AS-IS 原始三层映射正文在基线快照，本文引用不复制。

## 1. 状态机归属表（防复制）

| 状态机 | 权威归属 | 本文处理 |
| --- | --- | --- |
| 货柜业务状态机（本文） | **本文 → 契约迁移点 P2-09** | 正文 |
| 统一流程状态（导入批次等） | 架构 §11 + P2-09 Workflow 契约 | 不复制，见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §3 |
| 审核项状态 | Import 域 + P2-09 | IMPORT_DOMAIN_MODEL 定义 |
| AS-IS 三层映射现状 | [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §2 | 词汇复用源，不复制 |

### 1.1 实现原则（负责人指令 2026-09-04）

- 状态机是货柜全生命周期节点变化的**核心驱动**：状态集与转换由受控配置/契约驱动，不在业务代码散落死代码分支。
- 代码内状态/事件标识**固定**（枚举/常量，单一权威）；外部多变取值（供应商状态码、来源列名、多语言别名）经**映射字典**归一为内部固定码，平衡稳定与弹性，未知进待处理，禁止静默默认。
- 扩展优先用**属性/标记扩展字段**（受控字典键），不因每次新语义新增独立列；确需升格为列的走迁移。
- 标记为**正交属性**：多变特征（危险品/需植检/含致冷剂等）打标记、不同标记触发不同动作，可作为转换卫式但**不改变主链状态**，见 [CONTAINER_MARKERS](./CONTAINER_MARKERS.md)。
- 全局纪律见 `ENGINEERING_RULES` §3.3；与 [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md) 规则对齐。

## 2. 状态词汇（复用 AS-IS，最小修正）

货柜 `Container` 聚合根持有**当前业务状态** `currentStatus`。取值复用真实系统简化七层并显式补取消终态
（修 AS-IS 反例 A4）：

```text
not_shipped 未出运
  → shipped 已出运
    → in_transit 在途
      → at_port 已到港（含中转/目的）
        → picked_up 已提柜
          → unloaded 已卸柜
            → returned_empty 已还箱（终态）
另有：cancelled 已取消（终态，未离港前可入）
```

- **详细状态 / 外部事件码**（33 详细 + 外部码 + 折叠规则）作为外部语言与展示语言，正文见
  [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §2.1–2.2，本文不重复。TO-BE 把它们作为
  `logistics-status` 接入（阶段二）与「异常/警报」识别（§5）的来源。
- 折叠直觉沿用 AS-IS：扣货/倒箱/延误/滞港等异常折到 `at_port`（在港处置中）；`OVERDUE` → `returned_empty`。
  `cancelled` 不再折成 `not_shipped`（区别于 AS-IS 导入归一）。

## 3. 合法转换（TO-BE 初稿）

| # | 事件 | from | to | 触发 | 卫式 |
| --- | --- | --- | --- | --- | --- |
| 1 | `container.recorded`（建档/落库） | —(新) | 导入声明的归一化状态，无声明则按证据推导 | 导入写端口/人工 | 见 §6 导入状态口径；记录唯一性见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6 |
| 2 | `container.shipped` | `not_shipped` | `shipped` | 导入(有出运证据)/人工/运营 | 有出运时间或船司确认 |
| 3 | `container.in_transit` | `shipped` | `in_transit` | 运营 | 已离出发地 |
| 4 | `container.at_port` | `shipped`、`in_transit` | `at_port` | 运营（到港/中转到港） | 有到港时间 |
| 5 | `container.picked_up` | `at_port`（支持 `shipped`/`in_transit` 跳步） | `picked_up` | 运营/拖卡提柜 | 有提柜时间 |
| 6 | `container.unloaded` | `picked_up`（支持 `at_port` 跳步） | `unloaded` | 运营/仓库卸柜 | 有卸柜时间 |
| 7 | `container.returned_empty` | `unloaded`（支持 `picked_up` 跳步） | `returned_empty` | 运营/还空箱 | 有还箱时间 |
| 8 | `container.cancelled` | `not_shipped`、`shipped`、`at_port`（仅计划段） | `cancelled` | 操作员（须审批依据）/导入取消 | 未 `in_transit` 之后不可取消 |

约束：

- 禁止回退；终态（`returned_empty`、`cancelled`）不再转换。
- 允许的跳步沿用 AS-IS 直觉（直达提柜/卸柜/还箱），但**必须携带对应时间证据**。
- 状态转换只能由确定性系统或**人**触发；AI 不得自主推进关键状态（架构 §7.3）。AI 产物只能产出建议，经人工/确定性路径落地。
- 转换落地即记审计事件（前后值、操作者、来源，P2-07 口径）；外部事件的完整原始报文只留存证（基线快照 §2.4）。

## 4. 投影 vs 事件推进（修 AS-IS 反例 A5，决策草案）

AS-IS 的问题：`logistics_status` 是**读时重算 + 静默写回**的缓存列，转换无约束、重算无审计（基线快照 A5）。

TO-BE 初稿（待评审 D-proj）：

- `currentStatus` 是 **Container 聚合的受约束业务状态列**，只经 §3 的合法转换改变并留审计。
- UI/统计所需的「按数据证据推导的简化状态」允许作为**只读投影**存在（沿用 AS-IS `calculateLogisticsStatus` 的优先级直觉），
  但**投影不得静默改库**；若投影与 `currentStatus` 分歧，作为对账/告警信号进入 exception-management，不自动写回。
- 阶段二 `logistics-status`（AIS/船司/码头）接入时以事件形式触发 §3 转换，收敛外部码 → 详细 → 当前状态（复用基线 §2.2 折叠表）。

## 5. 异常 / 扣留（正交，不占主链状态）

详细态中的 HOLD 族（清关/船司/码头/费用）、DUMPED、DELAYED、DETENTION、CONGESTION 等是**处置异常**而非流转阶段：

- 展示折叠沿用 AS-IS（主链状态仍为 `at_port` 等在港段 + 异常标记）。
- TO-BE 归 `exception-management` 上下文登记（异常类型、发生/解除时间、处置），不改变主链状态码；
  是否在 Container 上暴露 `hasAlert` 布尔投影给前端，待评审（D-alert）。
- 放行/扣留主体对标**五主体**（海关 CUIP/PASS、船司 SRHD·PRLD/SRRS、**海事 MCRP**、码头 TMHD/TMPS、运费 SRSD/SRSE），扣留与放行成对；"清关放行"是其子集，**海事放行 MCRP 为本模型当前缺口**（映射见 [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) P3，候选）。

## 6. 导入（首期闭环）对状态的影响

导入不产生运营事件，只把「文件声明的事实」落库（负责人已确认：文件「物流状态」文本列 = **真实当前状态**）：

- 若行内含「物流状态」文本列：该列经字典同义词归一后（修 A3 单一权威，别名权威在字典）**直接作为该记录的 `currentStatus`**。
  `已取消` 归一为 `cancelled` 终态（修 A4），**不再折成 `not_shipped`**。
- 若无状态文本列：按行内时间证据推导初值（沿用 §4 推导直觉：有出运日期→`shipped`、有到港时间→`at_port`…），无证据则 `not_shipped`。
- 一致性防线：状态断言需证据时才做强校验——声明 `returned_empty` 必须同时带还空箱记录时间，否则预检失败进人工补证，不静默接受/丢弃（修 A1）；
  声明 `cancelled` 仅允许未离港段。状态文本与该行时间证据冲突时**以文本为准**，但该行标记待人工复核（走 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) 预检/审核）。
- 状态文本与时间字段来自同一行；冲突/低置信均不阻断整份记录其余字段的合法部分，处置见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)。

## 7. 决策记录与待评审

### 已确认（2026-09-04，负责人）

- D-import-status：文件「物流状态」文本列 = 真实当前状态，经字典归一直接落值；`已取消`→`cancelled` 不再折成 `not_shipped`（§6）。

### 仍待评审

- D-proj：`currentStatus` 受约束推进 vs 只读投影的信号策略（§4）。
- D-alert：异常是否在 ContainerRecord 上暴露 hasAlert 投影。
- D-transition-skip：跳步清单是否沿用 AS-IS 全量允许，或收紧为白名单（结合评测）。
- 订舱/提空箱/装箱等**预出运阶段**是否显式成态：现状详细态已含 `EMPTY_PICKED_UP/GATE_IN/LOADED` 但简化 7 层折叠为 `shipped`；候选清单与取舍见 [SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md) §4/§5（默认：主链不加，前段走计划/事件）。
- 状态码/事件名定稿后并入 `GLOSSARY` §2 状态权威与 P2-09 契约。

## 8. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；P2-02；[CONTEXT_MAP](./CONTEXT_MAP.md)；基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md)。
- 端到端阶段链与数据锚（装箱→…→还箱，含可选中转/海铁）：[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)。
- 派生：P2-06 数据模型、P2-09 事件/状态契约（迁移点）、阶段二 `logistics-status`、`exception-management`。
- 变更须评审；正文迁入契约包后本文转指针并标「已过时」。
