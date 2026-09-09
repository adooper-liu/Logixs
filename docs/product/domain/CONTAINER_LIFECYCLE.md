# 货柜全生命周期（CONTAINER_LIFECYCLE · v0.4 人话重构）

> 状态：**候选 v0.4** · 2026-09-05 · 负责人：刘志高。
> V1 主流程节点代码、状态与合法转换以[货柜生命周期状态机契约 V1](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)为实现权威；本表保留业务对照与证据来源，不另建转换规则。
> 一句话：货柜从备货到还箱共 14 个节点（2 个可选），本文件是"每段走什么、记什么、谁来触发"的对照表；规范节点枚举以 LIFECYCLE_CONSISTENCY §2 为单一权威。
> 证实度 S·R·O·C。入库归 WMS，不在容器主链。

## ① 可落库清单：14 节点表（主链/可选/状态/时间/数据锚/来源）

| #   | 节点       | 可选    | currentStatus     | 时间(planned·actual) | 数据锚(现网)          | 来源          | 证实 |
| --- | ---------- | ------- | ----------------- | -------------------- | --------------------- | ------------- | ---- |
| 1   | 备货       | 否      | not_shipped       | ready                | 一备货单一确认        | 人工/ERP/供应链/导入 | O·R  |
| 2   | 装箱       | 否      | not_shipped(已装) | stuffing             | 定稿字段+箱号(迟绑定) | 导入/手工     | O·R  |
| 3   | 出运       | 否      | shipped           | ship                 | 装船/发运             | 导入/API      | S·O  |
| 4   | 离港       | 否      | shipped(离)       | depart(atd)          | sea_freight           | API           | S·R  |
| 5   | 海运       | 否      | in_transit        | sailing              | AIS/船司              | API           | S·R  |
| 6   | 中转港     | 是      | at_port(中转)     | transit              | port_ops(transit)     | API           | S·R  |
| 7   | 清关       | 否\*    | at_port           | customs              | customs 日期/单据     | 海关/报关     | S·R  |
| 8   | 到港       | 否      | at_port(目的)     | arrival(ata)         | port_ops(dest)        | API           | S·R  |
| 9   | 海铁       | 是      | 内段              | rail_handover        | 铁路实际接收货柜      | 铁路/场站/API | O·R  |
| 10  | 拖卡(提柜) | 否      | picked_up         | pickup(gate_out)     | port_ops/trucking     | 拖车/API      | S·R  |
| 11  | 送仓       | 否      | picked_up         | delivery             | trucking              | 拖车/API      | S·R  |
| 12  | 卸柜       | 否      | unloaded          | unload               | warehouse             | 仓库/WMS      | S·R  |
| 13  | 卸空       | 否      | unloaded(净)      | unstuff              | unboxing              | WMS/手工      | R    |
| 14  | 还箱       | 否      | returned_empty    | return               | empty_return          | 承运/API      | S·R  |
| —   | 入库       | 否(WMS) | —                 | —                    | WMS 收货/上架         | WMS           | O    |

\*清关特定条款可 N/A；放行(五主体齐全)是 #10 提柜前提。

## ② 定义与澄清

- 主链 14 节点；节点 = 状态/里程碑，由 实际事件(EVENT_CODES) 推进。
- 可选（中转/海铁）未发生就跳过；子里程碑(进场/靠泊/可提/放行)记在事件流，不加节点。
- 生命周期边界：箱号产生前只管理备货单及备货状态，不创建货柜主流程；箱号产生并完成货柜建档后，挂接对应备货完成事实进入主链。货柜建档后至还箱使用稳定 `containerId` 和箱号，业务关联继续保留备货单号。

## ③ 规则与约束/边界

- 入库(WMS 收货/上架/库存)不属容器主链，仅作交接确认。
- 箱号产生是生命周期准入点；装箱完成继续作为真实重量、件数、体积和封号的定稿点。
- 实际事件单调+密封（LIFECYCLE R1–R4）；`returned_empty` 需还箱证据。
- 数据来源分域：海上/港口/清关/陆侧各自进入（INTEGRATION），不合并造假。

## ④ 流程（怎么用）

按 L 节点推进 → 每节点读 NODE_TIME_FIELDS(时间字段) + 状态机(STATUS) + 事件(EVENT_CODES) → 关键环节看 NODE_PDCA 作战清单 → 结果落 ContainerRecord。

## ⑤ 注意事项（坑）

- 别把子里程碑塞成主链节点。
- 别把 WMS 库存/上架写进容器链（边界）。
- 别在箱号未定（装箱前）时强填。
- 中转/海铁"可选"不等于"可乱序"，仍要时间单调。

## ⑥ 白话注解（🗣️）

🗣️ 就是一柜子货从"备货"一路到"还箱"的 14 站导航；每站有固定的时间格子和"谁给的消息"。海铁、中转是"可停靠可不停靠"的站；"入库/上架"是交给仓库系统之后的活，不算柜子的站。看它走到哪站、下一站缺什么，就是我们工作台那条轨道的含义。

## ⑦ 落库映射

| 清单   | 落库                                                |
| ------ | --------------------------------------------------- |
| 节点表 | 阶段字典(L node) + node time 字段(NODE_TIME_FIELDS) |
| 推进   | 时间线事件(TIMELINE/EVENT_CODES)                    |
| 可选   | 事件按需，不入强制节点列                            |
| 入库   | WMS 交接记录（非主链表）                            |

## ⑧ 待评审/关联

- 待定：海铁多段路由深度；子里程碑集合随 P2-06。
- 关联：LIFECYCLE_CONSISTENCY、CONTAINER_STATUS_MODEL、EVENT_CODES、NODE_TIME_FIELDS、NODE_PDCA、INTEGRATION_BOUNDARIES、LEGACY_DB_CATALOG。
