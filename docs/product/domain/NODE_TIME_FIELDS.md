# 节点时间字段清单 v0.1（NODE_TIME_FIELDS · 候选）

> 状态：候选 · 2026-09-15 对齐填空表 §2.1 · 用途：把 14 流程节点落成 schema 字段名草案，**尚未升格**。
> 填空表必有槽见 [LIFECYCLE_NODE_IO_CATALOG](./LIFECYCLE_NODE_IO_CATALOG.md) §2.1：到港/提柜/送仓/卸柜/还箱要有计划与实际；ETA 单独成槽；最晚提柜日/还箱日是计算截止，不进本表的 plan/actual 列。
> 类型 `ts`=时刻(UTC)，`d`=日期(可无时刻)。允许空：计划常在备货/订舱即有；实际多为迟绑定。
> **禁止**把计划（STA）和预计（ETA）塞进同一列。GC-004 已分 `planned` / `estimated` / `actual`。

| #   | 节点       | planned 字段       | actual 字段          | 类型 | 迟绑定?    | source 默认   | 备注                                          |
| --- | ---------- | ------------------ | -------------------- | ---- | ---------- | ------------- | --------------------------------------------- |
| 1   | 备货就绪   | `ready_plan`       | `ready_actual`       | d    | —          | 计划/导入     | 备货完成                                      |
| 2   | 装箱       | `stuffing_plan`    | `stuffing_actual`    | ts   | 实际迟绑定 | 导入/手工     | 定稿点（含封号/重量）                         |
| 3   | 出运       | `ship_plan`        | `ship_actual`        | d    | 实际迟绑定 | 导入/API      | 装船/发运确认；≤#4                            |
| 4   | 离港       | `depart_plan`      | `depart_actual`      | ts   | 实际迟绑定 | API           | atd；出运同刻可相等(A6)                       |
| 5   | 海运在途   | `sailing_eta`      | `sailing_actual`     | ts   | —          | API           | **ETA 必有滚动槽**；sailing 为进行中；下一港实际抵达完成阶段 |
| 6   | 中转(可选) | `transit_eta_plan` | `transit_arr_actual` | ts   | —          | API           | 中转到；离为次要                              |
| 7   | 清关       | `customs_plan`     | `customs_actual`     | ts   | 实际迟绑定 | 海关/报关     | 放行须先于提柜                                |
| 8   | 到港       | `arrival_plan`     | `arrival_actual`     | ts   | 实际迟绑定 | API           | STA=`arrival_plan`；ATA=`arrival_actual`；**ETA 另列 `arrival_eta`，禁止与 STA 共用** |
| 9   | 海铁(可选) | `rail_plan`        | `rail_actual`        | ts   | —          | API/铁路      | 铁路实际接收货柜；订单受理不算                |
| 10  | 拖卡提柜   | `pickup_plan`      | `pickup_actual`      | ts   | —          | 拖车/API      | gate_out；**最晚提柜日不在此列**，见下「计算截止」 |
| 11  | 送仓       | `delivery_plan`    | `delivery_actual`    | ts   | —          | 拖车/仓库/WMS | 计划+实际必有；POD/签收 delivered 或权威 warehouse_arrival；预计到仓不叫 ETA |
| 12  | 卸柜       | `unload_plan`      | `unload_actual`      | ts   | —          | 仓库/WMS      | 计划+实际必有                                 |
| 13  | 卸空       | `unstuff_actual`   | —                    | ts   | 迟绑定     | WMS/手工      | 可还箱前提                                    |
| 14  | 还箱       | `return_plan`      | `return_actual`      | ts   | 实际迟绑定 | 承运/API      | returned_empty；**最晚还箱日不在此列**，见下「计算截止」 |

## 到港 ETA（与 STA 分列）

| 字段             | 含义     | `timeKind` | 挂节点                     |
| ---------------- | -------- | ---------- | -------------------------- |
| `arrival_eta`    | 预计到港 | estimated  | 海运滚动 + 到港当前预计    |
| `arrival_plan`   | 计划到港 | planned    | 到港 STA                   |
| `arrival_actual` | 实际到港 | actual     | 到港 ATA                   |

## 计算截止（不是 plan/actual）

| 屏幕名     | 建议落点（引擎端口，非本表列） | 挂站 | 备注 |
| ---------- | ------------------------------ | ---- | ---- |
| 最晚提柜日 | `latestPickupAt`（charges-settlement 计算，inland-fulfillment 只读） | 提柜 | Last Free Day / 滞港等取最小；缺标准显式失败 |
| 最晚还箱日 | `latestReturnAt` | 还箱 | Detention 等取最小；不得用计划还箱冒充 |

## 说明

- 计划与预计必须分槽。开/截港、截关、截单等港口配置另列（`cut_off`、`cy_open`、`port_close`、`customs_close`，行业 W9，C）。
- 每个节点 additional 事件时间（如 gate_in/gate_out/available）以子里程碑存 TIMELINE 事件，不在此加列（见 EXTERNAL_EVENT_MAPPING/EVENT_CODES）。
- 入库归 WMS，不入此表。
- 本清单仍是候选：填空表锁定槽位后，字段进契约才能进 Seed/API。

## 关联

- [LIFECYCLE_NODE_IO_CATALOG](./LIFECYCLE_NODE_IO_CATALOG.md) §2.1
- [CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §5
- [FEE_DEMURRAGE](./FEE_DEMURRAGE.md)
- [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)。
