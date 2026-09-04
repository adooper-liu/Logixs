# Logix 产品原则（负责人坚持，2026-09-04）

> 状态：**负责人确认（本批方案不可漂移的基线原则）** · 2026-09-04。
> 定位：任何设计取舍都不得违背以下四项；冲突时以本清单为准，并回查各领域文档口径。
> 关联：`PRODUCT_BRIEF`、[UX_CONTAINER_WORKBENCH](./UX_CONTAINER_WORKBENCH.md)、[NODE_PDCA](./domain/NODE_PDCA.md)、
> [CONTAINER_LIFECYCLE](./domain/CONTAINER_LIFECYCLE.md)、费用/滞港费见下映射。

## 四项原则

| # | 原则 | 落点 |
| --- | --- | --- |
| P1 | **可视化**：货柜抽象为可视化实体，单屏一眼看尽全生命周期状态/动态/异常与"下一步动作"；动作一键确认执行 | [UX_CONTAINER_WORKBENCH](./UX_CONTAINER_WORKBENCH.md)（rail/节点/标记/异常/动作中心；V1 随 P6） |
| P2 | **任务驱动与闭环工作流程（PDCA）**：每个关键节点都走 计划→派发工单/任务→Check→改善 的闭环 | [NODE_PDCA](./domain/NODE_PDCA.md)（8 关键节点、工单对象、预警规则） |
| P3 | **货柜全生命周期管理**：备货→装箱→出运→…→还箱 端到端，时间/状态/密封/来源权威一体 | [CONTAINER_LIFECYCLE](./domain/CONTAINER_LIFECYCLE.md)、[LIFECYCLE_CONSISTENCY](./domain/LIFECYCLE_CONSISTENCY.md) |
| P4 | **费用管理（滞港费）**：滞港费（Demurrage/Detention/堆存）为核心能力——免费期/费率标准、产生/预警/对账/一键处置闭环 | 见 §1（本次明确纳入；此前仅列候选的项收口） |

## 1. 费用管理（滞港费）的纳入口径（负责人 2026-09-04）

- **纳入核心范围**：围绕"滞港费"建立 免费期(Last Free Day)跟踪、费率标准、费用预估/预警、对账与一键处置 的闭环；对接 K7 到港→提柜/还箱 与异常（滞留）预警。
- 依据/资产：现网 `ext_demurrage_standards`（目的港+船司+免费期+费率+币种，LAX 免5天 Demurrage 80 USD/天）与 `ext_container_charges`（费用记录）→ 迁移与复用输入；外部规范 `SRSD/SRSE`(运费滞留/结清)、码头超期滞留预警 作对标。
- 尚未纳入（保持候选，另审）：其他费用种类（海运费核对除外）、扣货/罚款等——如需纳入另走评审。
- 关联动作：`notify_delay`/`dispatch_exception`/`schedule_empty_return`（ACTION_CATALOG）；K7 免费期剩余预警（NODE_PDCA）。

## 2. 应用规则

- 方案评审以此四原则为验收锚（见 [PROPOSAL_SELF_AUDIT](./domain/PROPOSAL_SELF_AUDIT.md) A 类矛盾回查）。
- 术语/口径漂移即时回正；不因单点便利牺牲四项原则之一。
