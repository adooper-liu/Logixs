# 货柜状态模型（CONTAINER_STATUS_MODEL · v0.4 人话重构）

> 状态：**候选 v0.4** · 2026-09-05 · 负责人：刘志高。
> 本文件 = 货柜业务状态机的**唯一权威**（别的文件引用它，不抄正文）。
> 先分清：**状态码**(本表) ≠ 事件语义码(EVENT_CODES) ≠ 动作码(ACTION) ≠ 标记码(MARKER)。证实度 S·R·O·C。
> 关键口径（已确认）：导入文件「物流状态」文本列 = 真实当前状态；记录主锚=备货单号；禁止静默回退。

## ① 可落库清单

### A. 状态码主表（currentStatus 枚举 = DB enum 值）

| code | 中文 | 含义(一句话) | 终态? | 何时进入(证据) | 证实 |
| --- | --- | --- | --- | --- | --- |
| not_shipped | 未出运 | 已建档未出运（含已装未出） | 否 | 建档/导入/装箱后 | O·R |
| shipped | 已出运 | 已装船/发运确认 | 否 | 装船/发运事件(loaded/departed) | S·R |
| in_transit | 在途 | 海运途中 | 否 | sailing | S·R |
| at_port | 已到港 | 到中转或目的港（含清关/放行段） | 否 | arrived | S·R |
| picked_up | 已提柜 | 已从码头提走 | 否 | gate_out | S·R |
| unloaded | 已卸柜 | 已在仓库卸柜 | 否 | unloaded | S·R |
| returned_empty | 已还箱 | 空箱归还（终态，需还箱证据） | 是 | returned_empty | S·R |
| cancelled | 已取消 | 记录取消（仅计划段；终态） | 是 | cancel | O·R |

### B. 合法转换表（from × 触发 × to × 卫式/证据）

| from | 触发 | to | 卫式/证据 | isEsti |
| --- | --- | --- | --- | --- |
| —(新) | 建档/导入写入 | 按文件声明态或证据推导(默认 not_shipped) | 匹配键=备货单号；文件状态须字典归一 | — |
| not_shipped | shipped 证据(loaded/ship) | shipped | 装船确认 | N |
| shipped | sailing | in_transit | — | N |
| in_transit | arrived | at_port | 到港实际 | N |
| at_port | gate_out | picked_up | 相关主体放行齐全(五主体放行前提) | N |
| picked_up | unloaded | unloaded | 仓库卸柜实际 | N |
| unloaded | returned_empty | returned_empty | 还箱实际(证据) | N |
| 计划段各态 | cancel | cancelled | 未过离港；经审批 | N |
> 跳步（如直达提柜/还箱）允许但须对应实际证据；预计(isEsti=Y)事件只预告、不推进不密封（R3）。
> 放行/扣留不进主链：走五主体(FIVE_PARTY) → exception；清关放行是提柜前提，见卫式。

### C. 详细/外部态（词汇引用，不复制）

33 详细态 + 外部事件码(飞驼等) + 折叠规则 的现状与映射见 AS-IS 快照与 EVENT_CODES；本表 currentStatus 为内部收敛。

## ② 定义与澄清

- currentStatus 是"货柜现在到哪一步"的唯一当前值；历史推进由 事件流水账(TIMELINE) 记录。
- 简化 8 态 vs 详细态/外部码：外部千种叫法 → 映射字典 → 收敛到内部事件码(EVENT_CODES) → 推 currentStatus。
- 异常(扣留/甩柜/查验) 是"正交标签"，不占用主链状态码（主链仍是 at_port…）。
- 取消仅未离港的计划段可入；已发生运输后不得取消。

## ③ 规则与约束/边界

- 状态变更只经状态机/合法转换（服务端强制，前端不改库）。
- 密封/单调：实际时间单调、越过即不可回改（LIFECYCLE R1–R4）。
- AI 不得自主推进状态（架构 §7.3）；只能产建议进人工。
- 导入文件「物流状态」文本列 = 真实状态：经字典归一直接落 currentStatus；`已取消→cancelled`，不折 not_shipped；`returned_empty` 需还箱证据，冲突进人工/低置信（不静默）。
- 主锚=备货单号（一单一柜）；箱号迟绑定；未知字典值进待处理（禁止静默回退）。

## ④ 流程（怎么用）

1. 现状态→DB enum（A 表）。
2. 合法转换（B 表）→ 状态机配置/契约(P2-09)。
3. 外部码 → EVENT_CODES → 本表 推进（EXTERNAL_EVENT_MAPPING 目标侧）。
4. UI rail/工作台消费 currentStatus + 事件流；不反向写。

## ⑤ 注意事项（坑）

- 别把"过程/事件"存成状态（会丢历史）；也别用前端展示状态代替业务状态。
- 别把外部码直接落 currentStatus（要先经映射字典）。
- 别静默回退未知值到 not_shipped（老系统反例 A1）。
- 详细态中的 HOLD/DUMP 是异常，不是主链状态。
- 预计事件勿密封。

## ⑥ 白话注解（🗣️）

🗣️ 货柜从头到尾就 8 个"阶段词"（没出运→…→已还箱，加一个取消）；每到一个阶段必须有**确凿的"实际发生"证据**才变；别家用一万种代号叫这些事，我们都先翻译成统一的事件词，再决定该不该翻到下一个阶段。过了的节点不许回头改，改错代价大，所以点"确认推进"要二次确认。

## ⑦ 落库映射

| 清单 | 落库 | 示例 |
| --- | --- | --- |
| currentStatus | `container_record.current_status` enum(8) | at_port |
| 推进历史 | 时间线事件(TIMELINE) 记录，不改状态列 | arrived·ATA |
| 转换表 | 状态机配置/契约(P2-09) | from·event·to·guard |
| 外部码→内部 | external_event_mapping | DLPT→departed→shipped |

## ⑧ 待评审/关联

- 待定：投影策略(D-proj)、异常 hasAlert(D-alert)、跳步清单(D-transition-skip)、密封粒度 —— 均入 P2-09/P6。
- 关联：EVENT_CODES、CONTAINER_LIFECYCLE、LIFECYCLE_CONSISTENCY、FIVE_PARTY_CODES、TIMELINE_MAPPING、PRECHECK_RULES。
