---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/role-workbench-cargo-ready
verification: `pnpm validate`；新增路由后的 `pnpm --filter @logix/web exec playwright test e2e/shell-layout.spec.ts`；PR #31 build/e2e/static/unit/quality
---

# 任务：岗位工作台公共骨架与备货真实接入

> 承接 [`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `2.1` 的岗位 UI 收口，为后续 `2.2` 装箱与出运工作台提供经真实切片验证的公共骨架。

## 目标

建立一个不拥有业务状态的岗位工作台公共骨架，并以备货岗位为首个真实消费者。备货人员能按货柜查看装载 SKU、`cargo_ready` 节点、生命周期任务、合规整改项与当前合规评审，并进入现有任务和合规操作页面。

## 边界 / 不做

- 工作台只是 14 节点、任务、装载事实与合规事实的 UI 投影，不在前端判断过站、放行或来源权威。
- 生命周期 `NodeTask` 与专业整改 `ExternalWorkItem` 分栏展示，不合并状态，也不把完成整改解释成合规批准。
- 只落地备货工作台；出运、船务、单证、清关、内陆运输、入库和还箱不先建空页面。
- 不新增数据库表、动态页面搭建器、前端权限替代品、任务领取/整改完成接口或新的生命周期事件。
- 新增只读货物投影 API；复用现有装载事实公开 Port，不暴露 Prisma 实体或供应商模型。

## 验收

- [x] `/workspaces/cargo-ready` 出现在 operator/planner/manager 导航，并使用公共岗位工作台骨架。
- [x] 可选择真实货柜并展示真实 14 节点实例；未初始化流程时明确为空，不补造节点。
- [x] 无论是否已有合规评审，都可通过只读 API 查看当前活动装载集合与 SKU 明细。
- [x] 分开显示 `cargo_ready` 生命周期任务与开放合规整改项；允许动作只读取 `nextAction`。
- [x] 展示当前评审、发现和决定，并可带货柜上下文进入 `/compliance`；任务链接进入 `/tasks`。
- [x] 任一辅助投影失败不伪造“0 项/已完成”，以局部提示降级；切换货柜不显示旧响应。
- [x] API、组件、视图的成功、空态、局部失败和窄屏行为有自动化测试。
- [x] 公共 API 契约检查、Web/API 模块门禁及 `pnpm validate` 通过。

## 方案

1. 在 Shipment Registry 增加 `GET /containers/:id/cargo`，显式映射活动装载集合和行项目；无活动集合返回同一稳定 DTO 的空态。
2. 增加 Web `workItems` 与货物投影 API 客户端，以及 `useCargoReadyWorkbench` 查询编排。
3. 建立 `RoleWorkbenchFrame` 公共壳；公共壳只承载布局、选择器、节点轨道和插槽。
4. 建立备货摘要与工作队列组件；路由页只负责组合与 URL 查询参数同步。
5. 更新导航、UI 清单和路线图；不复制状态码、节点目录或合规决定规则。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                       |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------- |
| 2026-09-21 | coding | Codex | -      | PR #30 合入后，开始岗位公共骨架与备货真实接入。                            |
| 2026-09-21 | review | Codex | -      | 真实货物投影、公共壳、备货工作台、导航与自动化验证完成；等待 PR 必需检查。 |
| 2026-09-21 | done   | Codex | #31    | 本地完整门禁与 PR 必需检查通过。                                           |
