# 时间线定义 ↔ 状态机关系（TIMELINE_MAPPING · v0.2）

> 状态：**候选 v0.2（关系映射）** · 2026-09-06 · 源 `D:/Github/logix`（container.service.ts + StatusEventsTimeline/KeyDatesTimeline）。
> 用途：把现网"时间线"定义接到 TO-BE 状态机/生命周期，避免"事件流"与"当前状态"混用。
> 关联：[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[UX_CONTAINER_WORKBENCH](../UX_CONTAINER_WORKBENCH.md)、[时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)。

## 1. 现网"时间线"定义（AS-IS 摘要）

现网有两类时间线视图，底层都由**各流程表时间字段合成事件**：

- **StatusEventsTimeline（统一状态事件流）**：`getContainerStatusEvents()` 从 港口作业/拖卡/仓库/还箱 四表的字段合成事件
  `{ statusCode, occurredAt, locationCode/name, description, isEstimated(预计), dataSource, hasOccurred }`，再与
  `ext_container_status_events`（外部原始节点 DLPT…）合并，按时间倒/正序展示；前端把**预计(E/A 前缀或 isEstimated)与实际成对分组**。
- **KeyDatesTimeline（关键日期 + 倒计时告警）**：直接取目的港/关键时间字段，按"距今天数"给 红(≤0)/橙(≤3)/绿 警示（用于免费期/到期类日期）。

字段→事件合成映射（container.service.ts）：

| 事件 statusCode      | 来源字段                                | isEstimated     |
| -------------------- | --------------------------------------- | --------------- |
| ETA                  | po.etaDestPort                          | true            |
| ATA                  | po.ataDestPort                          | false           |
| UNLOADED             | po.destPortUnloadDate / wo.unloadDate   | false           |
| GATE_IN / GATE_OUT   | po.gateInTime / po.gateOutTime          | false           |
| AVAILABLE            | po.availableTime                        | false           |
| DISCHARGED           | po.dischargedTime                       | false           |
| PICKED_UP            | tt.pickupDate                           | false           |
| DELIVERED            | tt.deliveryDate                         | false           |
| WAREHOUSE_ARRIVAL    | wo.warehouseArrivalDate                 | false           |
| UNBOXED              | wo.unboxingTime                         | false           |
| RETURNED_EMPTY       | er.returnTime                           | false           |
| (po.statusCode 节点) | po.statusCode + statusOccurredAt        | !po.hasOccurred |
| ext 原始节点         | ext_container_status_events.status_code | 按外部语义      |

## 2. 关系原则（TO-BE）

1. **时间线 = 有序事件/证据流；状态机 currentStatus = 当前状态**，二者分离、互相引用：
   - 时间线条目是**证据**（含 E/A、来源、原始值）；状态机决定**当前状态与合法转换**。
2. **预计(Estimated)事件只做预告，不密封**；**实际(Actual)事件才是推进/密封依据**（R0 E/A、R3）。
3. 每类事件归属一个 **L 节点/子里程碑**；事件到齐/条件满足时经合法转换推进状态（R2/R4），不再用旧"字段优先级推导+静默写回"。
4. UI 工作台：rail(状态/节点) + TimelineDrawer(事件流) + KeyDates 式倒计时预警；动作中心 = 由事件缺口/规则推导（UX V1/V2）。
5. PDCA 的 Check：以时间线实际事件为证据校验（如 `returned_empty` 需有 RETURNED_EMPTY 证据）。
6. 权威事件可先于任务、乱序或迟到；事件按业务发生语义重放投影，接收顺序只作审计。外部更正/撤回追加关联事件，不原地覆盖历史。

## 3. 事件 → 节点/状态映射

| 现网事件                       | 语义           | L 节点/子里程碑       | 状态依据                    |
| ------------------------------ | -------------- | --------------------- | --------------------------- |
| ETA/ATA                        | 到港 预计/实际 | #8 目的港（或中转段） | `at_port` 实际到达证据      |
| GATE_IN                        | 进港/进场      | 装箱后·进场子里程碑   | —（K 前段）                 |
| LOAD/装船（外部）              | 装船           | #3 出运               | `shipped` 证据              |
| DLPT/离港（外部）              | 离港           | #4 离港(atd)          | `shipped` 证据              |
| BDAR/POCA                      | 抵港/靠泊      | #8 到港·靠泊子里程碑  | —                           |
| DISCHARGED/AVAILABLE           | 卸船/可提      | #8 后段子里程碑       | —                           |
| GATE_OUT                       | 提柜/出场      | #10 拖卡(提柜)        | `picked_up` 证据            |
| DELIVERED/送达                 | 送仓           | #11 送仓              | —                           |
| WAREHOUSE_ARRIVAL/入库仓       | 到仓           | #11（卸柜前）         | —                           |
| UNLOADED(仓)                   | 卸柜           | #12 卸柜              | `unloaded` 证据             |
| UNBOXED                        | 卸空/开箱      | #13 卸空              | 可还箱前提                  |
| RETURNED_EMPTY                 | 还箱           | #14 还箱              | `returned_empty` 证据（终） |
| 外部节点(statusCode)/HOLD/DUMP | 外部/异常      | exception/甩柜        | 异常域，不作主链状态        |

## 4. 需转正的差异（AS-IS → TO-BE）

- 旧时间线由字段**现场合成**：无稳定事件 ID、可重复、`isEstimated` 靠字段拼；TO-BE 存**内部规范事件**（字段引用时间线契约 V1），支持来源幂等、乱序重放和追加式更正。
- 旧"字段优先级推导状态+静默写回" → 改为 事件证据→受约束推进/密封（LIFECYCLE R1–R4）。
- KeyDates 倒计时（红≤0/橙≤3/绿）可复用到我们 planned 时间与免费期预警（滞港费 P4 / NODE_PDCA K7）。

> 🗣️ **白话注解（本条）**：老系统没存现成时间线，每次打开货柜都是“当场拼”。新系统把事件当不可丢的流水账：晚到的按真实发生时间放回正确位置，重复的认成同一件事，改错的再记一笔“更正哪一笔”，然后重算当前视图；历史不靠覆盖来假装一直正确。

## 5. 落点与待定

- 时间线事件模型进 [DATA_MODEL_P2-06](./DATA_MODEL_P2-06.md)（作为 ContainerRecord 事件子表/信封）与[时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)。
- TimelineDrawer/rail 进 UX V1；证据链进 PDCA Check。
- 待定：事件类型全集、无 `sourceEventId` 时的确定性指纹、乱序窗口、重放范围及更正/撤回权限；用正常、迟到、重复和撤回样本验证。

## 6. 关联

- 上链 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)。
