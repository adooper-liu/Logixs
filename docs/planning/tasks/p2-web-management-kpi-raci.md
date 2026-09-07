---
status: coding # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/<任务名>（RAID I-04 / P3-01）
verification: # status: done 时填写；当前仍在 coding
---

# 任务：补管理视图——Web 演示 看板 KPI 指标 + RACI 责任投影（运营框架对齐）

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准，只改 frontmatter，不另写自由文本状态。
> 同一时刻仅一个进行中任务；`done` 必须附验证证据，未验收不得标 `done`。

## 目标

把运营框架 [OPERATIONS_CONTAINER_LIFECYCLE](../../product/OPERATIONS_CONTAINER_LIFECYCLE.md) 的「全局核心看板指标」（§2.1）与「RACI 责任矩阵」（§3）补进 Web 演示的**管理视图层**：在现有管理驾驶舱/PDCA 运营页新增 看板 KPI 指标条 + RACI 责任投影，让运营框架的管理口径有可操作的可视化落点，而不改动 14 节点主链。

## 边界 / 不做（本切片不越界）

- 权威约束不得改写：`ENGINEERING_RULES` §3/§7、`AGENTS.md`、架构 §6/§8/§9/§10.3、`MODULE_DEPENDENCIES`、`GLOSSARY`。
- **不改主链**：14 节点 rail、状态码、事件码、状态机、NODE_PDCA 任务拆分——全部保持现状（对齐口径见 `OPERATIONS_ALIGNMENT §④`：KPI/RACI 属"管理视图"，由七组④周期/⑤费用/⑦会议承接，不产生主链节点）。
- **不臆造 KPI**：只放"现有演示投影可推出的指标"（在线柜数 / 高风险柜数 / 滞箱滞港费用占比 / 待服务器确认数 / 未关闭异常数）。OTD、D2D 分位、一次放行率、单柜成本 等无演示数据支撑的指标**不显示不占用卡片**，避免违反 v73/v74 "不虚构历史趋势/无支撑数字"纪律。
- **不做 22 节点全矩阵页**：RACI 收敛到 14 主链节点（与演示 rail 一致），每节点单 A，R/A/C/I 折叠进 Tooltip；不新开"22 节点大矩阵"页面。
- 演示适配级别：不新增后端、数据库、迁移或正式公共契约（`packages/*` 实例化属 P3-05）；所有新数据/契约标 `candidate` 演示值，标明来源（框架 RACI 22→14 收敛），不冒充正式规则。

## 验收（review 阶段核对）

- [ ] `pnpm validate` 全绿：仓库规则 + ESLint + Prettier + 类型 + 单测 + E2E + 构建；现有基线不回归（当前 6 规则/单测/E2E 计数不应下降）。
- [ ] 看板 KPI 组件：只显示 上述 5 个可推出指标；每个指标带 InfoTooltip 说明口径与数据来源；**无** OTD/D2D 分位/一次放行率/单柜成本 等臆造指标。
- [ ] RACI 责任投影：14 节点 × 8 角色，每节点**单 A**；数据契约 `RaciRole` + `RaciCell` + `RaciNodeRow` 存在；节点 key 与 `sample.ts` railDefinitions 一致（ready/stuffing/shipment/depart/sailing/transit/customs/arrival/rail/pickup/delivery/unload/unstuff/return）。
- [ ] 管理视图下钻：KPI 卡片 → 对应列表/区块（异常→决策队列、待确认→任务台、费用→费用区块）；RACI 行 → 对应节点详情（若节点在 rail 中可定位）。
- [ ] 数据来源正确性：KPI 从 `useDemoOperationsStore` / `sample.ts` 现有投影派生，**不新增臆造字段**；RACI 为新增 seed，注释注明"来源=框架 RACI 表 22→14 收敛，待负责人回验"。
- [ ] 视觉：挂入现有 DashboardGlobal / MesoPaper，无新增路由；三视口 + 深色模式视觉基线人工复核；无迷你图（UI_SYSTEM 纪律）。
- [ ] 前端单测补 KPI 派生与 RACI 契约断言（对照现有 `.test.ts` 模式）。
- [ ] `docs/README.md` 登记新文档（若新增）与其读者；相对链接可解析（自检）。
- [ ] 设计评审记录与任务前端状态更新（评审通过前复选框保持 `[ ]`）。

## 方案（design 阶段填写）

### 涉及文件

| 文件                                                     | 动作 | 说明                                                                                                 |
| -------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/src/data/raciContract.ts`                      | 新建 | RACI 数据契约：`RaciRole`/`RaciCell`/`RaciNodeRow`（演示适配级别）                                   |
| `apps/web/src/data/sample.ts`                            | 改   | 新增 `raciRows: RaciNodeRow[]`（14 行，来源=框架 RACI 3.2 表 22→14 收敛，标 candidate）              |
| `apps/web/src/data/kpiProjection.ts`                     | 新建 | 看板 KPI 计算投影：从 `useDemoOperationsStore` 现有派生                                              |
| `apps/web/src/components/management/KpiSignalStrip.vue`  | 新建 | 看板 KPI 指标条（复用 ManagementSignalStrip 视觉：label+大数值+supporting+InfoTooltip+tone+icon+to） |
| `apps/web/src/components/management/RaciMatrixPanel.vue` | 新建 | RACI 责任投影组件（14 行 × 8 角色，单 A 高亮，C/I 折叠 Tooltip）                                     |
| `apps/web/src/views/DashboardGlobal.vue`                 | 改   | 挂 `KpiSignalStrip` + `RaciMatrixPanel`（或其中一个区块）                                            |
| `apps/web/src/views/MesoPaper.vue`                       | 改   | 挂 `RaciMatrixPanel`（管理视图）                                                                     |
| `docs/README.md` / `docs/INDEX.md`                       | 改   | 若新增文档则登记                                                                                     |

### 数据契约（演示适配级别）

`raciContract.ts`：

```ts
export type RaciRole =
  | "ops"
  | "forwarder"
  | "customs"
  | "trucking"
  | "warehouse"
  | "finance"
  | "sales"
  | "manager";
export interface RaciCell {
  role: RaciRole;
  code: "R" | "A" | "C" | "I";
}
export interface RaciNodeRow {
  nodeKey: string;
  nodeName: string;
  cells: RaciCell[];
}
```

### 组件要点

1. **KpiSignalStrip.vue** —— 复用 `ManagementSignalStrip.vue` 的 card 结构与 tone 语义（brand/ok/warn/risk/info）。指标从 store 派生：
   - 在线货柜数（`containers.length`）
   - 高风险货柜数（`tone === "risk"`）
   - 滞箱滞港费用占比：`feeRows` 中 Demurrage + Detention 金额 ÷ 总费用额（Tooltip 标"演示口径，合同样本待回验"）
   - 待服务器确认数（`syncStatus` 非 committed/idle）
   - 未关闭异常数（`exceptions` 非 verified_closed）
2. **RaciMatrixPanel.vue** —— 14 行 rail 节点；每行单 A 主显、R 次显、C/I 折叠进 InfoTooltip；列=8 角色；无迷你图；移动端横向滚动或折叠。

### 步骤

1. 本 brief 定稿 → 任务状态进入 `coding`（由交接方操作）。
2. 建 `raciContract.ts` → `sample.ts` RACI seed → `kpiProjection.ts`。
3. 建 `KpiSignalStrip.vue` + `RaciMatrixPanel.vue`（复用 signal 视觉）。
4. DashboardGlobal / MesoPaper 挂载；三视口 + 深色视觉基线复核。
5. 前端单测补 KPI 派生 / RACI 契约断言。
6. 验证 `pnpm validate` 全绿；提交 `review`（不自行标 `done`）。

## Review notes（review 阶段填写，只读不改代码）

**解除记录（2026-09-07）：** 前序任务 `p2-shipment-import-domain.md` 已转 `blocked` 归档（负责人决定启动本切片），本任务按 ENGINEERING_RULES §10 由 `blocked` 转 `coding`，成为当前唯一进行中任务，交由 Codex 实现。

- **责任方：** Codex（实现）；负责人 刘志高（评审）；**交接入口：** 本文件（唯一载体）。
- 验收清单在评审通过前保持一致（`[ ]`），不提前勾选。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责   | commit | 说明                                                                                                                                                                                        |
| ---------- | ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-07 | design | Claude | —      | 对齐核查（Web 演示缺管理视图投影）→ 方案设计 → brief 定稿。因 ENGINEERING_RULES §10 串行化（前序任务 `p2-shipment-import-domain` 进行中），状态标 `blocked` 排队，Review notes 记录解除条件 |
| 2026-09-07 | coding | Claude | —      | 负责人决定启动本切片：前序任务 `p2-shipment-import-domain.md` 转 `blocked` 归档，本任务转 `coding` 成为唯一进行中任务。Review notes 记录解除，交由 Codex 实现                               |
