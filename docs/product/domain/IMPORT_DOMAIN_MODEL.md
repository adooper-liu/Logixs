# 导入领域模型：批次 / 行 / 预检 / 审核 / 对账（P2-03）

> 状态：**候选（初稿，待 P2 评审）** · v0.2 · 2026-09-04 · 负责人：刘志高。
> 关键决策（负责人已确认 2026-09-04，2026-09-04 细化）：① 物流状态文本列=真实当前状态（见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6）；
> ② 行级写入 = 匹配**主锚 = 备货单号**（唯一建档身份）；**箱号与实际出运日期均为迟绑定**（装箱后与外部交换才进入，早期仅有预计出运日期），已有时参与一致性判定；命中→更新，否则新建；③ 一行=一份货柜流转记录整体。
> 上游：`IMPORT_WORKFLOW` §2–§6、架构 §8.3 / §9 / §11、[CONTEXT_MAP](./CONTEXT_MAP.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)（目标模板）、现状基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §4（导入现状）。
> 读者：Import/Shipment 域实现者、P2-09 Workflow 契约、P6 纵向切片、迁移实施者。
> 约定：本文定义导入域领域语义；批次流程状态正文归架构 §11 + P2-09；物理表结构归 P2-06。评审通过前为候选基线。

## 1. 范围

定义首期导入闭环领域模型：`ImportBatch` 聚合（行、映射建议、审核项、预检、执行结果、对账），以及
「AI 产物 / 审核结果 / 执行结果 / 业务事实」四类对象区分与追踪（P2 门禁）。与产品叙事的一致性锚点：`IMPORT_WORKFLOW`。
真实对象形态沿用 AS-IS：**一行 = 一个货柜的一次完整流转信息**（基线快照 §4），但包上 Logixs 的批次/幂等/预检/审核/对账与**确定性+人工确认**纪律。

## 2. ImportBatch 聚合与行模型

`ImportBatch` 是聚合根（边界理由见 [CONTEXT_MAP](./CONTEXT_MAP.md) §4），与业务事实（货柜流转记录 `ContainerRecord`）解耦。

| 组成 | 类型 | 职责 / 关键语义 |
| --- | --- | --- |
| `ImportBatch` | 聚合根 | 一次上传全生命周期：来源、文件、目标模板版本、流程状态、统计与结果 |
| `ImportRow` | 实体 | 一行原始记录（= 一货柜全流程信息）；分节解析 + 校验/审核/执行结果 |
| 分节内容 | 实体/值对象 | 按 [TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md) 分组的计划写入内容（对照 AS-IS：containers / seaFreight / portOperations / trucking / warehouse / emptyReturn） |
| 映射建议（AI 产物） | 实体/值对象 | 源列→标准字段建议 + 证据 + 置信 + 出处；不可变留痕 |
| 预检违规项 | 值对象 | 确定性校验通过与失败清单；`blocker` 级禁止写入 |
| 审核项 | 实体 | 人工确认/修正/拒绝（记录操作者） |
| 执行结果 | 值对象 | 每行写入结果（success/skipped/failed/duplicate）与落库 `ContainerNumber` |
| 对账差异报告 | 投影 | 导入后按幂等/重复/校验比对；可回查批次 |

`ImportBatch` 关键引用（ID/键，不做跨聚合对象引用）：

- 幂等键 `idempotencyKey` = 来源标识 + 文件指纹（`IMPORT_WORKFLOW` §3）；
- 文件引用（对象存储，P2-06 定路径/保留）；
- 目标模板版本 `targetTemplateVersion`（指向 TARGET_FIELD_CATALOG 选定版本，执行时钉死）；
- 逐行统计（成功/跳过/失败/重复行数）。

## 3. 批次流程状态（引用，不复制）

批次状态正文 = 架构 §11 + P2-09 Workflow 契约；本文只记语义约束：

- `pending → running → awaiting_validation → awaiting_review → approved → executing → completed`；任意阶段可进
  `failed / rejected / cancelled / expired`。
- **待评审 D7**：`IMPORT_WORKFLOW` §2.2 叙述为「先映射审核、后确定性校验/预检」，而统一状态机字面是 `awaiting_validation` 在
  `awaiting_review` 前；P2-09 契约定稿时对齐（本文假设：结构/列解析归 `awaiting_validation`；映射审核归 `awaiting_review`；
  基于确认映射的必填/字典/格式预检在 `approved` 前完成）。
- 预检硬闸：`blocker` 级违规时禁止进入 `executing`（产品硬约束）。

## 4. 审核项状态机（权威初稿，契约迁移点 P2-09）

审核对象 = 单条映射建议（及低置信/冲突项）：

```text
pending_review → approved   （采纳 AI 建议原样）
               → modified   （人工修正目标字段/值后执行）
               → rejected   （拒绝建议；行可重映射或 skip）
行级另有：skipped（整行跳过）
```

不变量：批次内所有审核项达终态后批次才可 `executing`；采纳/修正/拒绝记操作者与原因；AI 产物不被改写。
首期策略为全部人工确认（`IMPORT_WORKFLOW` §1）；自动执行仅按 P7-09 升级条件对白名单低风险 L1 项开放，本文不实现。

## 5. ImportRow 与行级不变量

`ImportRow`（一行原始记录 = 一货柜）：`rowNo`、原始值快照（供重放/对账，保留期 P2-06）；分节解析状态；
每条映射建议 + 审核决策；校验结果（字典命中/未命中、格式、必填、重复标记）；执行结果。

行级不变量：

- 一行原始记录最多产生一次对业务事实（`ContainerRecord`）的应用；写入幂等且逐行记录结果。
- 分节字段归属唯一（一个源列只映射到一个标准字段，冲突进低置信/人工）。
- 字典未命中的业务值进 `DictionaryUnknown` 待处理队列，行可在预检标失败；**禁止**系统擅自生成含糊字典项或静默回退
  （修 AS-IS 反例 A1/A2；对比 AS-IS 的 `20GP`/`not_shipped`/`NEW_*` 静默处理）。
- 到 `returned_empty` 的断言必须带还空箱记录时间（沿用 AS-IS 一致性校验直觉，[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6）。
- 重复行/跨批次与库内同匹配键记录冲突：标 `duplicate`/对账差异，不静默覆盖（修 A7；匹配键见 §6.2）。
- **一单一柜不变量**：一个备货单号至多对应一条 `ContainerRecord`（负责人 2026-09-04 确认保持 1:1）。导入/迁移中同备货单号命中多行或多条记录 → 判数据异常进对账/人工，不建模为多柜。

## 6. 幂等与行级写入判定（负责人已确认）

### 6.1 批次幂等

- `idempotencyKey`（来源 + 文件指纹）命中已有批次 → 识别为重复，返回原批次，**不重复写入**。

### 6.2 行级写入判定（匹配主锚 = 备货单号；箱号与实际出运日期迟绑定）

| 判定 | 情形 | 行为 |
| --- | --- | --- |
| 命中·更新 | 备货单号与库内记录一致（备货单号唯一） | 更新该条 `ContainerRecord`（含物流状态文本列；迟绑定的箱号/实际出运日期在此补填） |
| 未命中·新建 | 备货单号在库内不存在 | 新建一条 `ContainerRecord` |
| 文件内重复 | 同文件内多行命中同一备货单号 | 标 `duplicate`，只写一条 |

> 注：备货单号是**备货阶段的唯一建档身份**（采购阶段为采购订单号 PO）；同备货单号重复导入 = 同一条 → 更新。同一物理箱出现在不同备货单下是不同记录，不误判。
> 迟绑定（2026-09-04）：**箱号**与**实际出运日期**都在备货单装箱后、与外部（船司/海关/拖车等）交换数据时才进入系统；建档/早期记录可两者皆无，备货/订舱阶段仅有**预计出运日期**。导入文件（装箱后数据）通常备货单号/箱号/出运日期已齐备。

## 7. 四类对象的区分与单向追踪（P2 门禁）

| 对象 | 本质 | 存放 | 关键字段 |
| --- | --- | --- | --- |
| AI 产物（映射建议） | 非事实，可解释留痕 | `ImportRow` 建议对象 | `sourceColumn → targetField`、`evidence[]`、`confidence`、`isLowConfidence`、`provenance`（aiExecutionId、能力+版本、promptVersion、模型） |
| 审核结果 | 人工处置 | 审核项 | `decision`、`appliedMapping`、`operator`、`reason`、时间 |
| 执行结果 | 确定性写入结局 | 行执行结果 | `success/skipped/failed/duplicate`、落库记录 id 与匹配键、来源批次 |
| 业务事实 | 货柜流转记录（`ContainerRecord`）所有 | [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) | 经 Shipment 公共端口建立/更新；记录来源批次/行与操作者 |

单向追踪链：

```text
ContainerRecord(业务事实) ← ImportBatch + rowNo + 执行结果 ← 审核决策 ← AI 映射建议 + provenance ←（可选）ai_execution 观测
```

对应架构 §10.3 的 `ai_artifact / ai_review / ai_feedback` 等记录在 P2-11 / P2-07 落库。

## 8. 写入唯一通道（导入 → 业务事实）

- 批次 `executing` 后，应用层对每行通过预检的计划调用 Shipment 公共端口（[CONTEXT_MAP](./CONTEXT_MAP.md) §5，候选名
  `applyContainerRecordPlan`），由 Shipment 域按 §6.2 匹配键执行**更新或新建**一次货柜流转记录；
  物流状态按 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6 落地（文件文本列归一或证据推导）。
- Import 不直接持 Shipment 仓储；写入一次、幂等；成功行回填落库记录 id 与匹配键。行失败不影响其他行事务结果。

## 9. 决策记录与待评审

### 已确认（2026-09-04，负责人）

- D-write（细化）：匹配主锚 = 备货单号（唯一建档身份）命中 → 更新；否则新建。箱号与实际出运日期迟绑定（§6.2）。
- D-import-status / D-聚合：见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §7 / [CONTEXT_MAP](./CONTEXT_MAP.md) §7。

### 仍待评审

- D7：批次流程状态与 `IMPORT_WORKFLOW` 叙述次序对齐（归 P2-09）。
- D8：审核项是否需 `escalate` 升级路径（与 exception-management 关系）。
- 目标字段集合/分节与必填规则确认（[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md) 评审）。

## 10. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；P2-03；[CONTEXT_MAP](./CONTEXT_MAP.md)；基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md)。
- 依赖：[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、`GLOSSARY`、架构 §10.3。
- 派生：P2-06 数据模型、P2-09 Workflow 契约、P6 纵向切片。
- 变更须评审；涉及架构 §19 触发条件先走 ADR。
