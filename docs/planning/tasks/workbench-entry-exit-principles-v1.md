---
status: coding
branch: docs/workbench-entry-exit-principles-v1
verification: 未完成。负责人 2026-09-28 确认落地：写入 HW-D17/HW-D18 并立后续切片 brief。
---

# 任务：工作台入口三源与退出三层原则

> 本文件是执行、评审与交接的唯一载体。状态只看 frontmatter。

## 目标

把负责人确认的两条产品原则写入
[`ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md`](../../product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md)：

1. **入口三源（HW-D17）**：接收 ∪ 自建 ∪ 导入（适用者）；上游推送不是唯一开工方式。
2. **退出三层（HW-D18）**：按需回退/重开 → 作废/归档 → 删除最后且最严；统一能力谱而非同一套状态码。

并立好后续实现切片（blocked），按对象串行推进，禁止「所有台一次加齐」。

## 边界 / 不做

- 本片只改产品原则文档与后续 brief；不改运行时代码、契约或迁移。
- 不在本片实现市场信号作废、选品自建或主数据自建。

## 验收

- [x] `HW-D17` / `HW-D18` 写入共同规则，含细则与避坑对照
- [x] 实施基线版本升至 v1.2；验收场景引用 `HW-D01`～`HW-D18`
- [x] 后续切片 brief 已立且为 `blocked`（等本片合入后再解锁）
- [ ] `pnpm repo:check` 与相关格式检查通过；PR 合入 main

## 业务与数据协同设计

| 业务步骤与岗位结果 | 信息产生时机/前置事实   | 操作时需要看到什么 | 系统允许做什么   | 数据如何可靠保存与反馈         |
| ------------------ | ----------------------- | ------------------ | ---------------- | ------------------------------ |
| 定原则             | 负责人确认入口/退出分析 | 原则条文与后续切片 | 写文档、立 brief | 版本化文档 + brief frontmatter |

## 后续切片（本片合入后按序解锁，同时仅一个 coding）

1. [market-signal-void-archive-v1.md](./market-signal-void-archive-v1.md) — 市场信号作废/归档（B）
2. 删除收紧（待 B 后另立）
3. [product-initiative-manual-intake-v1.md](./product-initiative-manual-intake-v1.md) — 选品手工新增
4. [product-master-data-manual-create-v1.md](./product-master-data-manual-create-v1.md) — 主数据手工建档

## 进度 log

| 日期       | 阶段   | 负责   | commit | 说明                              |
| ---------- | ------ | ------ | ------ | --------------------------------- |
| 2026-09-28 | coding | Cursor | —      | 写入 HW-D17/HW-D18 并立后续 brief |
