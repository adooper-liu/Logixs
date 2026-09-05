# 导入领域模型（IMPORT_DOMAIN_MODEL · v0.3 人话重构）

> 状态：**候选 v0.3** · 2026-09-05 · 负责人：刘志高。
> 一句话：把"一柜一柜的数据怎么可靠地导进系统"讲成能落库的表：批次→行→预检→审核→执行→对账，每步可追责。
> 关键口径（已确认）：记录主锚=备货单号（一单一柜）；命中→更新、未命中→新建；箱号/实际出运日期迟绑定；文件「物流状态」列=真实当前状态。
> 证实度 S·R·O·C。流程状态(批次)正文在 LIFECYCLE/契约，不复制。

## ① 可落库清单

### A. 对象与值表（枚举/状态）

| 对象/枚举 | 值 | 含义 | 证实 |
| --- | --- | --- | --- |
| 批次状态(流程) | pending…executing…completed / failed·rejected·cancelled·expired | 引用 LIFECYCLE/契约 | O |
| 审核决策 | approved / modified / rejected | 采纳原样 / 修正后执行 / 拒绝(可重映射) | O |
| 行处置 | skipped | 整行跳过 | O |
| 行执行结果 | success / skipped / failed / duplicate | 成功带 orderNumber 回查 | O |
| 匹配判定 | hit=更新 / miss=新建 / dup=文件内重复 | 主锚 orderNumber | O |

### B. ImportBatch 结构（聚合）

| 部分 | 内容 | 说明 |
| --- | --- | --- |
| ImportBatch | idempotencyKey(来源+文件指纹) · targetTemplateVersion · 统计 | 一次上传全生命周期 |
| ImportRow | rowNo · 原始快照 · 分节内容 · 审核 · 执行结果 | 一行=一货柜流转记录 |
| 映射建议(AI 产物) | 源列→标准字段 · evidence · confidence · provenance | 不可变留痕 |
| 预检 | 违规项 · blocker 禁写 | PRECHECK |
| 对账 | 幂等/重复/差异报告 | 回查批次 |

### C. 匹配/去重判定表（主锚=备货单号）

| 情形 | 判定 | 行为 |
| --- | --- | --- |
| 同 orderNumber 命中库内记录 | hit | 更新该 ContainerRecord（含状态列/迟绑定回填） |
| orderNumber 未命中 | miss | 新建一条 |
| 同文件内多行同 orderNumber | duplicate | 只写一条，标重复 |
| 双方已带箱号且不一致 / 旧误解数据 | 异常 | 进对账/人工，不静默（DATA_CLEANUP） |

### D. 四类对象追踪（P2 门禁）

| 对象 | 本质 | 存放/键 | 单向链 |
| --- | --- | --- | --- |
| AI 产物(映射建议) | 非事实 | Row 建议 + provenance | 产物→… |
| 审核结果 | 人工处置 | 审核项(operator/reason) | 指向产物 |
| 执行结果 | 写入结局 | 行结果 + orderNumber | 指向审核 |
| 业务事实 | ContainerRecord | Shipment 域 | 记录来源批次/行/操作者 |

## ② 定义与澄清

- 导入只"把数据可靠放进来"，**不拥有业务事实**；写业务事实唯一通道 = Shipment 端口(候选 `applyContainerRecordPlan`)。
- 批次=一批文件；行=一柜；一次文件可命中更新也可新建（判定见 C）。
- AI 只产"建议"，全部人工确认后才预检/写入（首批策略）。
- 文件「物流状态」列：归一后直接作 currentStatus（真实），冲突进低置信/人工。

## ③ 规则与约束/边界

- 批次幂等：同 idempotencyKey 再次上传 → 返回原批次不重写。
- 预检 blocker → 禁止写业务表（硬约束）。
- 一备货单 ≤ 一柜记录；主备货单号不作键。
- 状态列归一须过字典；未知字典值进待处理（不静默）。
- 写入一次、逐行记结果；行失败不影响其它行。
- 写前过 来源权威(D7)/可写窗口/密封(LIFECYCLE)。

## ④ 流程（怎么走）

上传(幂等键) → 解析(结构) → AI 建议 → 全量人工审核(采纳/改/拒/跳) → 预检(PRECHECK) → 通过后经 Shipment 端口按 C 判定 更新/新建 → 逐行结果+对账 → 回写 ContainerRecord 来源。

## ⑤ 注意事项（坑）

- 别把 AI 建议当事实直接落业务表。
- 别跳过人工审核/预检硬闸当快捷方式。
- 别用主备货单号或箱号做唯一键（迟绑定/票级代表）。
- 状态文本列别静默吞成 not_shipped（老反例 A1）。
- 同一记录多次导入=更新，别误建多行。

## ⑥ 白话注解（🗣️）

🗣️ 导入像"报台账"：每次一个文件=一批，一行=一个货柜。先让 AI 猜每列是啥、人点头后系统才敢写；写得对不对先过"预检"这关，不过绝不落库；同一个备货单再传一次就是"更新"，不会重复多一条。每一步都记了"谁传的、谁审的、结果如何"，出事能倒查。

## ⑦ 落库映射

| 清单 | 落库 | 示例 |
| --- | --- | --- |
| 批次/行/审核/结果 | import_batch · import_row · review · row_result | orderNumber |
| 决策/结果枚举 | enum/字典 | approved |
| 匹配判定 | 应用逻辑(主锚 orderNumber) | hit/miss |
| AI 产物 | ai_artifact 记录 | mapping suggestion |
| 幂等 | idempotency_key 唯一 | source+hash |

## ⑧ 待评审/关联

- 待定：批次状态次序与叙事对齐(D7)、审核升级路径(D8)、写端口命名(D-portname)。
- 关联：CONTAINER_STATUS_MODEL(状态文本)、PRECHECK_RULES、DATA_CLEANUP_ORDER_CONTAINER、FIELD_MIGRATION_MAP、TARGET_FIELD_CATALOG、EXTERNAL_EVENT_MAPPING。
