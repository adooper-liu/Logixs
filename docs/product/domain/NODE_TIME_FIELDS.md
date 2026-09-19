# 节点日期投影别名目录 V1（NODE_TIME_FIELDS）

> 状态：**正式 V1（负责人确认）** · 2026-09-18
> 定位：本文件只定义查询、API 和 UI 使用的日期投影别名；日期事实语义与落库规则唯一服从 [货柜生命周期时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §5。
> 禁止：不得按本表增加 30 多个可覆盖数据库列，不得把别名当新事件码，不得让界面字段反向定义领域事实。

## 1. 统一事实形态

14 个节点至少保留 `planned` 和 `actual` 两种查询槽；存在可靠滚动预测来源时再提供 `estimated`。底层统一保存为追加式事实：

```text
containerId + nodeCode + eventCode + timeKind + occurredAtUtc
```

投影别名由 `nodeCode + eventCode + timeKind` 显式映射。一个节点有多个到/离事件或航段时，还必须按 `eventCode + segmentId/location` 消歧，不能把多个事实压进一个字段。

## 2. 14 节点投影别名

| #   | 节点                        | planned 投影别名                                  | estimated 投影别名                                          | actual 投影别名                                       | 正式事件码                             |
| --- | --------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| 1   | 备货 `cargo_ready`          | `ready_plan`                                      | 通常不提供                                                  | `ready_actual`                                        | `cargo_ready`                          |
| 2   | 装箱 `container_stuffing`   | `stuffing_plan`                                   | 通常不提供                                                  | `stuffing_actual`                                     | `stuffed`                              |
| 3   | 出运 `shipment_dispatch`    | `ship_plan`                                       | `ship_estimated`，有可靠来源时                              | `ship_actual`                                         | `loaded`                               |
| 4   | 离港 `origin_departure`     | `depart_plan`（STD）                              | `depart_estimated`（ETD）                                   | `depart_actual`（ATD）                                | `departed`                             |
| 5   | 海运 `ocean_transit`        | `next_port_arrival_plan`                          | `next_port_arrival_estimated`                               | `next_port_arrival_actual`                            | `transit_arrived` 或 `arrived`         |
| 6   | 中转 `transshipment`        | `transit_arrival_plan` / `transit_departure_plan` | `transit_arrival_estimated` / `transit_departure_estimated` | `transit_arrival_actual` / `transit_departure_actual` | `transit_arrived` / `transit_departed` |
| 7   | 清关 `customs_clearance`    | `customs_plan`                                    | `customs_estimated`，有可靠来源时                           | `customs_actual`                                      | `container_customs_completed`          |
| 8   | 到港 `destination_arrival`  | `arrival_plan`（STA）                             | `arrival_eta`（ETA）                                        | `arrival_actual`（ATA）                               | `arrived`                              |
| 9   | 海铁 `rail_transfer`        | `rail_plan`                                       | `rail_estimated`，有可靠来源时                              | `rail_actual`                                         | `rail_handover`                        |
| 10  | 提柜 `container_pickup`     | `pickup_plan`                                     | `pickup_estimated`，有可靠来源时                            | `pickup_actual`                                       | `gate_out`                             |
| 11  | 送仓 `warehouse_delivery`   | `delivery_plan`                                   | `delivery_estimated`                                        | `delivery_actual`                                     | `delivered` 或 `warehouse_arrival`     |
| 12  | 卸柜 `container_unloading`  | `unload_plan`                                     | `unload_estimated`，有可靠来源时                            | `unload_completed_actual`                             | `unloaded`                             |
| 13  | 卸空 `container_unstuffing` | `empty_plan`                                      | `empty_estimated`                                           | `empty_confirmed_actual`                              | `unstuffed`                            |
| 14  | 还箱 `empty_return`         | `return_plan`                                     | `return_estimated`，有可靠来源时                            | `return_actual`                                       | `returned_empty`                       |

“有可靠来源时”表示已登记的业务来源确实提供该预测；系统不得自行用固定天数、下一站计划或服务器时间推算。历史名称 `sailing_eta`、`transit_eta_plan` 混合了节点、事件和时间种类，V1 不再使用。

## 3. 子里程碑

提空箱、重柜进场、装船、开航、中转抵离、靠泊、卸船、可提、海关申报/查验/扣留/解除/放行、铁路场站接收/发出、码头出场、仓库门岗/POD/WMS 接收、卸柜开始/完成、卸空确认及空箱场站接收，都进入同一时间线，但不增加主管道节点。

子里程碑使用 [事件码目录 V1](./EVENT_CODES.md) 中的正式 `eventCode`；目录尚未登记的语义必须先评审，禁止临时造码或借用相近事件。

## 4. 截止日期与免费期

以下值不是发生事实，不进入本表的 `planned / estimated / actual` 槽，也不能过站：

- 开港、截港、截单、截关；
- 最晚提柜日 `latestPickupAt`、最晚送仓日、最晚卸柜日、最晚还箱日 `latestReturnAt`；
- 免费期起止时间。

截止日期由相应港口、计划或费用模块按版本化依据管理。最晚提柜日不能冒充计划提柜日，ETA 不能冒充 ATA；缺少标准时必须明确显示未知，禁止套默认天数。

## 5. 日期事实随附信息

投影字段只负责展示时间值，不能丢掉事实背后的来源。完整最小字段清单唯一登记在 [GC-004 §5.5](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)；本目录不复制第二份。API、Webhook、文件导入和人工界面分别记录为 `api`、`webhook`、`file_import`、`manual_ui`，渠道只说明数据怎么进入系统，不授予来源权威。

## 6. 应用规则与当前缺口

- `planned`：追加计划版本并更新计划投影，不推进流程。
- `estimated`：追加预计版本并更新当前预计，旧版本保留，不推进流程。
- `actual`：先保存实际声明；只有 `verified + confirmed + effective`、命中唯一来源权威策略，并通过地点、航段、时区、证据和状态机守卫，才申请过站。
- 不合格的实际声明进入待复核；前序未满足的合格事实进入待应用，均不得硬跳流程。
- 更正追加新版本并关联 `supersedesFactId`，禁止覆盖历史。

公共事件目录已为所有节点完成资格事件开放 planned/estimated/actual，统一日期事实用例负责组合校验，并保证非 actual 事实不申请过站。尚未完成的是各数据入口、查询和界面对全部别名的实际采集与展示，不能因目录已开放就宣称日期已经存在。

## 7. 关联

- [货柜生命周期时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §5
- [14 流程节点作业填空表](./LIFECYCLE_NODE_IO_CATALOG.md) §2
- [生命周期节点目录 V1](./LIFECYCLE_NODE_CATALOG_V1.md)
- [事件码目录 V1](./EVENT_CODES.md)
- [超期费用](./FEE_DEMURRAGE.md)
