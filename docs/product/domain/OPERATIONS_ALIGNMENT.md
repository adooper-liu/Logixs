# 22 节点运营框架 → 14 节点领域模型 对拍映射与缺口报告（OPERATIONS_ALIGNMENT · v0.1 候选）

> 状态：**候选 v0.1** · 2026-09-07 · 负责人：刘志高。
> 一句话：把运营共享框架 [OPERATIONS_CONTAINER_LIFECYCLE](../OPERATIONS_CONTAINER_LIFECYCLE.md)（6 阶段 22 节点）与系统领域主链（14 节点）逐一对照，标清"哪些已覆盖、哪些是子里程碑、哪些是任务、哪些归未来上游、哪些是管理视图"，并列出缺口与建议落点。
> 证实度：S=规范 · R=现网 · O=负责人 · C=候选(待对拍/待业务补)。
> 🔗 关键上游前提：[SHIPMENT_FLOW_OVERVIEW §A0](./SHIPMENT_FLOW_OVERVIEW.md) 已预言"计划→采购→备货→订舱→出运"上游切片；本报告的"未来上游"缺口在该切片定稿后承接。

## ① 对拍说明（口径先对齐）

| 项   | 22 节点运营框架                                                            | 14 节点系统主链                                                                                                          |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 文档 | [OPERATIONS_CONTAINER_LIFECYCLE](../OPERATIONS_CONTAINER_LIFECYCLE.md)     | [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)（节点枚举权威在 [LIFECYCLE_CONSISTENCY §A](./LIFECYCLE_CONSISTENCY.md)） |
| 视角 | 运营团队管理视图：节点 = "这一环节做什么、谁负责、什么单据/系统、常见风险" | 系统建模视图：节点 = **状态/里程碑**，由实际事件推进                                                                     |
| 关注 | 责任方(RACI)、KPI/SLA、成本与风险、应急                                    | 状态机、事件、时间单调/密封(R1–R4)、来源权威(D7)                                                                         |
| 目的 | 运营作战手册                                                               | 系统主链与可视化轨道                                                                                                     |

**关键判据（决定映射口径）：**

- 主链原则（LIFECYCLE §③⑤）："节点 = 状态/里程碑；子里程碑(进场/靠泊/可提/放行)记在事件流，**不加节点**""别把子里程碑塞成主链节点"。→ 22 节点里大量"环节"不是状态，而是**事件/任务**。
- [NODE_PDCA §④](./NODE_PDCA.md) 已有 14 节点 → 任务拆分，比 22 节点更细（派拖/送货预约/还箱…）。→ 22 节点里"该干嘛"的环节多数已由任务承接。
- [SHIPMENT_FLOW_OVERVIEW §A0](./SHIPMENT_FLOW_OVERVIEW.md)：订舱(Booking)为候选未来前端对象。→ 22 节点 **#1–3（订舱/放箱/提空箱）不是主链节点**，归"未来上游"切片。

**结论：** 对拍不主张把 22 节点整体升级为主链，而按五档分类：`已覆盖` / `子里程碑`(事件) / `任务`(NODE_PDCA) / `未来上游`(上游切片) / `管理视图`(七组⑤⑦)。

## ② 映射主表（22 行 · 关键交付物）

| #   | 22 节点          | 对应 14 主链        | 覆盖类型             | 现有承载（节点/事件码/任务/七组）                                                           | 缺口说明                                             | 建议落点                                 |
| --- | ---------------- | ------------------- | -------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| 1   | 订舱（SO 申请）  | 备货前/出运前       | 未来上游             | SHIPMENT_FLOW Booking(候选)                                                                 | 主链不含订舱；EVENT_CODES 无 booking 事件            | 上游切片；事件码待补(C)                  |
| 2   | 放箱（提箱单）   | 出运前              | 未来上游             | SHIPMENT_FLOW 上游                                                                          | 主链无放箱；属 Booking 切片子环节                    | 上游切片；事件码待补(C)                  |
| 3   | 提空箱           | 装箱(#2)前          | 未来上游 + 子里程碑  | EVENT_CODES 已有 `empty_picked_up`(提空箱,里程碑)                                           | 主链无独立节点；但事件已存在                         | 事件已覆盖；上游切片承接单据环节         |
| 4   | 拖柜到仓         | 装箱(#2)前          | 子里程碑 + 任务      | NODE_PDCA `prepare_stuffing`(装箱协调)                                                      | 主链无"拖柜"节点；属装箱前置                         | 任务承接；事件按需                       |
| 5   | 装柜（Loading）  | 装箱(#2)            | 已覆盖（主链）       | `stuffed` 定稿；NODE_PDCA `execute_stuffing`/`finalize_stuffing`                            | 已覆盖                                               | 无需改动                                 |
| 6   | 还重柜进港       | 装箱后/出运前       | 子里程碑             | EVENT_CODES `gate_in`(进港/进场)                                                            | 主链无节点；事件已存在                               | 事件已覆盖                               |
| 7   | 报关（出口）     | 清关/出运前         | 子里程碑 + 任务      | EVENT_CODES `customs_filed`；NODE_PDCA §③ 清关六问                                          | 主链归清关段；出口报关为子环节                       | 事件+任务已覆盖                          |
| 8   | 截关/开船        | 出运(#3)/离港(#4)   | 已覆盖（主链）       | `loaded`→shipped、`departed`→shipped(离)；A6 出运≤离港                                      | 已覆盖；"截关"是出运前置里程碑                       | 无需改动                                 |
| 9   | 海运在途         | 海运(#5)            | 已覆盖（主链）       | `sailing`→in_transit；NODE_PDCA `monitor_ocean_leg`                                         | 已覆盖                                               | 无需改动                                 |
| 10  | 到港前预报       | 到港(#8)前          | 任务 + 子里程碑      | NODE_PDCA `send_arrival_notice`(到港通知)；EVENT_CODES 对应                                 | 主链到港前无节点；任务已承接                         | 任务已覆盖                               |
| 11  | 到港（ATA）      | 到港(#8)            | 已覆盖（主链）       | `arrived`→at_port；`berthed`/`discharged` 子事件                                            | 已覆盖                                               | 无需改动                                 |
| 12  | 换单（D/O）      | 到港后清关段        | 子里程碑 + 任务      | EVENT_CODES `release`(放行,前提)；FIVE_PARTY 换单相关                                       | **缺 D/O 换单专属事件/任务**；主链到港段无换单子环节 | NODE_PDCA 清关任务细分或事件码(C,待样本) |
| 13  | 进口清关         | 清关(#7)            | 已覆盖（主链）       | `customs_filed`/`inspection`/`hold`/`release`；NODE_PDCA §③                                 | 已覆盖                                               | 无需改动                                 |
| 14  | 缴税放行         | 清关放行段          | 子里程碑 + 管理      | `release`(主体放行) 前提含税；七组⑤费用                                                     | **缺"缴税"作为到港清关的显式子环节**                 | 事件/任务或七组⑤承接(C,待样本)           |
| 15  | 码头提柜         | 拖卡提柜(#10)       | 已覆盖（主链）       | `gate_out`→picked_up；NODE_PDCA `dispatch_trucking_pickup`/`execute_gate_out`               | 已覆盖                                               | 无需改动                                 |
| 16  | 派送（Delivery） | 送仓(#11)           | 已覆盖（主链）+ 任务 | `delivered`→`warehouse_arrival`；NODE_PDCA `schedule_warehouse_delivery`/`execute_delivery` | 已覆盖；FBA 预约是送货预约特例                       | 无需改动                                 |
| 17  | 拆柜/卸货        | 卸柜(#12)           | 已覆盖（主链）       | `unloaded`→unloaded；NODE_PDCA `schedule_unload`/`execute_unload`                           | 已覆盖                                               | 无需改动                                 |
| 18  | 空箱返还         | 卸空(#13)→还箱(#14) | 已覆盖（主链）       | `unstuffed`→`returned_empty`→returned_empty；NODE_PDCA `execute_empty_return`               | 已覆盖                                               | 无需改动                                 |
| 19  | 箱检/验箱        | 还箱(#14)前后       | 任务 + 子里程碑      | NODE_PDCA `verify_empty_condition`(卸空核验)；修箱费关联七组⑤费用                           | 缺"验箱/修箱费"显式任务；已有关联核验                | NODE_PDCA 候选任务(C,待样本)             |
| 20  | 费用结算         | 全链路              | 管理视图             | 七组⑤费用(FEE_DEMURRAGE 承接)                                                               | 不进主链；已由七组承接                               | 无需改动主链                             |
| 21  | 单据归档         | 全链路              | 管理视图             | 七组⑦会议/资料；归档为管理动作                                                              | 不进主链                                             | 管理闭环，不进主链                       |
| 22  | 绩效复盘         | 全链路              | 管理视图             | 七组④周期/⑦会议 承接 KPI                                                                    | SLA/看板指标为管理口径                               | 管理闭环，不进主链                       |

**统计：** 已覆盖(主链) 8 · 子里程碑/事件 6 · 任务承接 6 · 未来上游 3(含 #3 事件已存在) · 管理视图 3。多数 22 节点环节在主链模型**已有落点**，真缺口集中在 **上游切片(#1–2)与到港清关子环节(#12/#14)**。

## ③ 缺口清单（按处理类别分组）

### A. 未来上游切片缺口（#1 订舱 / #2 放箱）

- 现象：22 节点把订舱/放箱列为起运前核心环节；主链从"备货"开始，无订舱节点。
- 归属：[SHIPMENT_FLOW_OVERVIEW §A0](./SHIPMENT_FLOW_OVERVIEW.md)"未来前端"切片；Booking 为候选对象。
- 建议：随上游切片定稿时，补 BOOKING 对象 + 事件码（`booking_confirmed`/`container_released` 候选，C 级），**不新增主链节点**。登记入 NODE_PDCA §⑦ / SHIPMENT_FLOW 待办。
- #3 提空箱：事件 `empty_picked_up` 已存在，仅需上游切片承接"提箱单/EIR"单据环节，**非主链缺口**。

### B. 到港清关子环节缺口（#12 换单 D/O / #14 缴税放行）

- 现象：22 节点把换单、缴税单列为到港清关的子环节；主链到港段无显式"换单/缴税"子里程碑。
- 归属：清关(#7)到港段的事件/任务层（NODE_PDCA §③/§④ 清关任务细分）。
- 建议：登记候选事件码（`delivery_order` = D/O 换单、`duty_paid` = 缴税完成）或候选任务（`convert_delivery_order`/`pay_duties`），C 级，待 P2-12 样本回验。**不新增主链节点**——按 LIFECYCLE 原则，子环节记事件流。

### C. 任务承接（#16 派送预约 / #19 验箱 等已覆盖或待补）

- 已覆盖：派送预约→`schedule_warehouse_delivery`；拆柜卸货→`schedule_unload`/`execute_unload`；还箱→`execute_empty_return`。
- 待补候选：验箱/修箱费核验任务（关联七组⑤费用）——建议入 NODE_PDCA §④ 候选行，待样本。

### D. 管理视图对齐（#20 费用 / #21 归档 / #22 复盘 + KPI/SLA + RACI）

- 承接：NODE_PDCA 七组 ④周期(KPI/SLA) · ⑤费用(Demurrage/Detention/Storage) · ⑦会议(复盘/供应商绩效/决议)。
- RACI 责任角色 → 任务定义 `ownerRole`/`assignmentMode`（NODE_PDCA §① 任务定义骨架）。
- 不产生主链节点；KPI/SLA 为运营管理口径，非系统状态。

## ④ 口径差异表（管理视图 vs 系统口径）

| 差异项          | 22 节点运营框架                               | 14 节点系统主链                                            | 处理                                         |
| --------------- | --------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| 阶段边界        | 6 阶段（订舱提箱…还箱收尾）                   | 14 节点顺序链                                              | 阶段=运营分组，不映射为主链状态；两套并存    |
| 全链路时效(D2D) | 提箱→还箱总天数                               | 主链实际时间戳单调(R1)可算                                 | KPI 由主链时间戳派生，不新增字段             |
| 费用三类型      | 聚焦 Demurrage/Detention 雷区                 | [FEE_DEMURRAGE](./FEE_DEMURRAGE.md) 三类型分离(含 Storage) | 管理框架以三类型口径为准，Storage 不混入雷区 |
| 发生率 KPI      | 滞箱费发生率 ≤10% / 滞港费 ≤15%               | 系统按账单事件统计                                         | 指标在管理报表(七组⑤)实现                    |
| 看板占比        | Demurrage+Detention ÷ 总运费 ≤5%              | 系统费用账单聚合                                           | 指标在管理报表实现                           |
| RACI            | 角色：运营/货代/报关/拖车/仓库/财务/销售/主管 | 任务 ownerRole 角色                                        | RACI 作为运营治理，映射到任务 ownerRole      |
| 异常分级 L1-L3  | 运营分级（时效/费用阈值）                     | 系统异常/复核规则（D-alert）                               | 管理分级≠系统状态；两者可并行                |

## ⑤ 分阶段演进建议

| 阶段       | 动作                                                              | 涉及文档/路径                     | 状态   |
| ---------- | ----------------------------------------------------------------- | --------------------------------- | ------ |
| S1（本次） | 对拍映射 + 缺口登记，不改主链                                     | 本报告                            | 完成   |
| S2         | P2-12 真实样本回验：核实 换单/缴税/验箱/订舱 事件的真实存在与责任 | EVENT_CODES / NODE_PDCA 样本      | 待办   |
| S3         | 上游切片定稿：Booking/配箱对象进入 SHIPMENT_FLOW                  | SHIPMENT_FLOW_OVERVIEW / 规划切片 | 待定稿 |
| S4         | 补事件码/候选任务（C→S/R）：booking/D-O/duty/验箱                 | EVENT_CODES / NODE_PDCA §④        | 样本后 |
| S5         | 管理指标落地到报表/看板（KPI/SLA/RACI）                           | 管理投影（UX §1.6 五组）          | 待实现 |

> 演进原则：**所有"子里程碑"按主链原则记事件流，不新增主链节点；只有上游切片才引入新对象**。缺口以本报告为登记基线，逐阶段推进，避免对拍演变成拍脑袋改主链。

## ⑥ 关联与后续

- 运营框架：[OPERATIONS_CONTAINER_LIFECYCLE](../OPERATIONS_CONTAINER_LIFECYCLE.md)
- 主链/权威：[CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)
- 事件/任务：[EVENT_CODES](./EVENT_CODES.md)、[NODE_PDCA](./NODE_PDCA.md)、[FIVE_PARTY_CODES](./FIVE_PARTY_CODES.md)
- 费用：[FEE_DEMURRAGE](./FEE_DEMURRAGE.md)
- 上游：[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)
- 后续：S3–S5 需评审；登记入 NODE_PDCA §⑦ 待办与规划切片；P2-12 样本回验驱动 C→S/R。

🗣️ 白话：运营手册把柜子拆成 22 个"要办的事"，系统主链只认 14 个"到了哪一步"的硬节点。对拍说清：多数"要办的事"系统里已经有对应对应事件或任务，只有订舱/放箱/换单/缴税这几个是系统还没细抠的，我们先把缺口列出来，等样本回验和上游切片定稿再一步步补，不硬塞进主链。
