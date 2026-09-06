# 节点时间字段清单 v0.1（NODE_TIME_FIELDS · 候选）

> 状态：候选 · 2026-09-05 · 用途：把 L 14 节点落成 schema 字段（planned/actual），可建表/契约。
> 命名：`<节点>_plan`(计划/预计) 与 `<节点>_actual`(实际)；类型 `ts`=时刻(UTC)，`d`=日期(可无时刻)。
> 允许空：计划节点常在备货/订舱即有计划值；实际多为迟绑定（装箱后/外部交换）。`S计划/E预计` 语义差异见 LIFECYCLE R0，契约 P2-09 收口。

| #   | 节点       | planned 字段       | actual 字段          | 类型 | 迟绑定?    | source 默认 | 备注                    |
| --- | ---------- | ------------------ | -------------------- | ---- | ---------- | ----------- | ----------------------- |
| 1   | 备货就绪   | `ready_plan`       | `ready_actual`       | d    | —          | 计划/导入   | 备货完成                |
| 2   | 装箱       | `stuffing_plan`    | `stuffing_actual`    | ts   | 实际迟绑定 | 导入/手工   | 定稿点（含封号/重量）   |
| 3   | 出运       | `ship_plan`        | `ship_actual`        | d    | 实际迟绑定 | 导入/API    | 装船/发运确认；≤#4      |
| 4   | 离港       | `depart_plan`      | `depart_actual`      | ts   | 实际迟绑定 | API         | atd；出运同刻可相等(A6) |
| 5   | 海运在途   | `sailing_eta`      | `sailing_actual`     | ts   | —          | API         | 到港预计为主            |
| 6   | 中转(可选) | `transit_eta_plan` | `transit_arr_actual` | ts   | —          | API         | 中转到；离为次要        |
| 7   | 清关       | `customs_plan`     | `customs_actual`     | ts   | 实际迟绑定 | 海关/报关   | 放行须先于提柜          |
| 8   | 到港       | `arrival_plan`     | `arrival_actual`     | ts   | 实际迟绑定 | API         | ata                     |
| 9   | 海铁(可选) | `rail_plan`        | `rail_actual`        | ts   | —          | API/铁路    | 进铁路堆场等            |
| 10  | 拖卡提柜   | `pickup_plan`      | `pickup_actual`      | ts   | —          | 拖车/API    | gate_out                |
| 11  | 送仓       | `delivery_plan`    | `delivery_actual`    | ts   | —          | 拖车/API    | 送达仓库                |
| 12  | 卸柜       | `unload_plan`      | `unload_actual`      | ts   | —          | 仓库/WMS    | —                       |
| 13  | 卸空       | `unstuff_actual`   | —                    | ts   | 迟绑定     | WMS/手工    | 可还箱前提              |
| 14  | 还箱       | `return_plan`      | `return_actual`      | ts   | 实际迟绑定 | 承运/API    | returned_empty 证据     |

## 说明

- planned 统一存放 计划(S)/预计(E) 双意（差异字段另列如 `cut_off`、`cy_open`、`port_close`、`customs_close` 归 C 港口计划配置，见 行业 W9）。
- 每个节点 additional 事件时间（如 gate_in/gate_out/available）以子里程碑存 TIMELINE 事件，不在此加列（见 EXTERNAL_EVENT_MAPPING/EVENT_CODES）。
- 入库归 WMS，不入此表。

## 关联

- [LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)。
