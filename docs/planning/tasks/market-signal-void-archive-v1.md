---
status: blocked
branch: feat/market-signal-void-archive-v1
verification: pending。阻塞：等待 workbench-entry-exit-principles-v1 合入后再解锁。
---

# 任务：市场信号作废 / 归档（B）

> 承接 [product-initiative-return-path-v1](./product-initiative-return-path-v1.md) 切片顺序中的 **B**。
> 原则依据：`HW-D18`（见 [ROLE_WORKBENCH](../../product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md)）。

## 目标

经营岗可对不再推进的市场信号执行**作废或归档**，队列不再占用「待判断 / 选品退回」注意力；事实可审计、可只读回看。

## 边界 / 不做

- 本片不做物理删除（删除另立，条件最严）。
- 不改已交接机会快照的不可变语义；已 handoff 的机会是否随信号作废而 supersede，须在 design 阶段定案。
- 不做选品侧作废（若需要另立）。

## 验收（草案，解锁后细化）

- [ ] 岗位能识别可作废/可归档对象与理由必填项
- [ ] 作废/归档后队列分组可见；不可再误当作在办推进（除非明确重开）
- [ ] 缺理由不得关闭；幂等与跨租户隔离
- [ ] 相关质量门禁按风险等级通过

## 相关

- 前置：退回闭环 A 已 done（#76）
- 后续：删除（收紧条件）
- 原则：`HW-D18`
