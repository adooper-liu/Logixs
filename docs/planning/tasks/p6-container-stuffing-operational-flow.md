---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/stuffing-dispatch-operational-flow
verification:
  - pnpm --filter @logix/api test
  - pnpm --filter @logix/api lint
  - pnpm --filter @logix/api typecheck
  - pnpm --filter @logix/api build
  - pnpm --filter @logix/web test
  - pnpm --filter @logix/web lint
  - pnpm --filter @logix/web typecheck
  - pnpm --filter @logix/web build
  - pnpm --filter @logix/web exec playwright test e2e/stuffing-workbench.spec.ts
  - pnpm repo:check
  - pnpm contract:check
  - pnpm contract:drift
  - pnpm db:generate
  - pnpm db:verify:container-stuffing
  - pnpm validate
---

# 任务：2.2a 装箱事实与岗位操作闭环

> 承接 [`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `2.2`。本刀先让装箱岗位形成可靠、可更正、可追溯的实际装箱快照，并在同一工作台提交装箱完成日期事实；出运装船与 `loaded` 闭环由紧接的 `2.2b` 承接。

## 目标

装箱岗位从全局任务池进入一只货柜后，能够核对当前 SKU 装载版本，录入箱号、封号、包装数、毛净重、体积和可选 VGM，登记并核验证据，保存不可覆盖的装箱快照；快照齐备后可提交实际装箱时间，由统一日期事实与来源权威链决定是否推进 `container_stuffing`。

## 边界 / 不做

- 不让工单完成直接产生 `stuffed`；实际日期仍经 `LifecycleDateFact`、来源权威裁决和状态机应用。
- 不在装箱快照中重复保存生命周期日期；时间统一保存在日期事实模型。
- 不实现装船 `loaded`、船名航次、提单和出运岗位闭环；这些进入 `2.2b`。
- 不实现完整装箱单文件解析、托盘明细或任意单位换算；V1 只接受规范单位 `KGM` 和 `MTQ`，原始文件由证据记录承接。
- 不允许在普通装箱更正中把已绑定箱号静默改成另一只柜；身份纠错需要独立的受审计流程。
- 不修改或提交 `apps/ai-service/uv.lock`、`workers/ai-worker/uv.lock`。

## 验收

- [x] 装箱岗位能从“我的任务 / 可执行 / 阻塞 / 临期 / 全部”定位 `container_stuffing` 工作。
- [x] 页面同时展示当前装载版本、SKU 数量及装箱快照的齐备/缺失项，不把内部代码作为主要操作语言。
- [x] 首次保存可绑定箱号；后续更正追加新版本并关联旧版本，不覆盖历史。
- [x] 保存时验证当前装载版本、乐观锁、幂等键、证据 UUID、数量/重量/体积范围及 VGM 字段完整性。
- [x] 装箱快照保存成功后，岗位可提交 `stuffed + actual` 日期事实；页面明确显示“已应用 / 待复核 / 被拒绝”，不声称写入即过站。
- [x] 快照保存前核验证据确属本租户、本货柜且有效；保存后自动重放本柜既有 `pending_application` 日期事实。
- [x] 工单领取/完成仍只执行服务端 `nextAction`，并展示既有三段回执。
- [x] 成功、非法输入、幂等冲突、版本冲突、装载版本变化、箱号冲突、部分投影失败和窄屏路径有自动化覆盖。
- [x] 数据库迁移通过空库升级与约束验证；API/Web 风险对应门禁通过。

## 业务与数据协同设计

| 业务岗位要完成什么 | 操作时需要看到什么                                    | 系统允许做什么                                     | 数据如何可靠保存与反馈                                                 |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 找到下一项装箱工作 | 我的/可执行/阻塞/临期任务、货柜与备货单、责任和时限   | 选择任务；只执行后端返回的领取动作                 | 读取全局 `NodeTask` 投影，选择通过 URL 保留货柜与任务上下文            |
| 核对本柜装载范围   | 当前装载版本、每个 SKU 数量/单位、是否已有装箱快照    | 装载未形成或版本变化时禁止确认装箱                 | 快照锁定 `allocationSetId + allocationSetVersion`，旧快照保留          |
| 记录实际装箱结果   | 箱号、封号、包装数、毛净重、体积、VGM、证据和具体缺口 | 保存首版或基于当前版本更正；已绑定箱号不可静默换柜 | 单事务写版本化快照、幂等哈希、操作者、原因、证据和取代链               |
| 确认装箱实际发生   | 当前快照是否齐备、实际时间、时区、来源权威裁决结果    | 提交 `stuffed + actual` 日期事实；只显示服务端结果 | 日期事实走公共契约；`applied` 才过站，`pending_application` 保留待复核 |
| 完成当前装箱工单   | 服务端允许动作、完成条件和操作回执                    | 领取或完成工单，不直接改生命周期                   | 复用现有幂等工作执行 API 和三段回执；失败保留恢复入口                  |

## 方案

### 权威链

`装箱单/称重/箱封证据 -> ContainerStuffingSnapshot -> stuffed actual date fact -> 来源权威裁决 -> 生命周期状态机`

`ContainerStuffingSnapshot` 属 `shipment-registry`，是实际装箱内容的权威快照；它不是生命周期事件。日期事实属 `lifecycle-control`，两者通过证据引用与货柜身份关联，但不互相覆盖。

跨模块写入由 `shipment-lifecycle-orchestration` 编排：先通过 `document-records` 公开 Port 核验证据，再经 `shipment-registry` 公开 Port 保存快照，最后请求 `lifecycle-control` 重放本柜待处理日期事实。任一模块不反向依赖另外两个事实所有者。

### 数据模型

- 每柜最多一个 `active` 快照，历史版本为 `superseded`。
- 每版绑定当前 `ContainerCargoAllocationSet`，保存箱号、封号、包装数、毛净重、体积、可选 VGM、来源、证据、操作者、原因、幂等键和载荷哈希。
- 重量使用定点十进制 + `KGM`，体积使用定点十进制 + `MTQ`；VGM 方法限定 `method_1 | method_2`。
- VGM 值、方法和核验时间必须同时有或同时无；净重不得大于毛重，VGM 不得小于毛重。

### 组件图

| 组件 / composable       | 单一职责                                                     | 输入 / 输出                                  |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `StuffingWorkbench.vue` | 组合路由上下文、任务池、装箱事实和动作区                     | 输入 URL；输出选择、保存、日期事实与工单动作 |
| `useStuffingWorkbench`  | 并发加载货柜/任务/装载/节点/快照/日期事实，并防旧响应覆盖    | 输入货柜/任务；输出稳定岗位投影与重载方法    |
| `StuffingWorkQueue`     | 筛选、排序并选择装箱任务                                     | props 队列/筛选；emit 任务选择               |
| `StuffingSnapshotPanel` | 展示当前装载与装箱快照齐备度                                 | props 装载/快照；无业务写入                  |
| `StuffingActionPanel`   | 收集装箱字段、登记证据、保存快照、提交实际时间和执行允许工单 | props 当前上下文；emit 明确命令              |

## 影响与验证计划

- 高风险面：新增数据库表与迁移、受保护写 API、装箱业务规则、Vue 关键流程。
- 兼容性：加法式 API 与表；既有货柜和装载数据无需回填，当前快照可为空。
- 迁移恢复：应用旧版本可忽略新表；迁移只新增对象，发生问题时停止新写入并保留已写快照，不做破坏性回滚。
- 验证：领域/仓储/API 测试，迁移空库与约束脚本，Web 单测与装箱岗位 E2E，最终运行 `pnpm validate`。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                 |
| ---------- | ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------- |
| 2026-09-21 | coding | Codex | -      | 冻结 2.2a 边界、四项协同映射、权威链与组件图，开始领域和持久化实现。                                 |
| 2026-09-21 | review | Codex | -      | 后端、迁移、装箱岗位 UI 和三档视口 E2E 已实现；补齐证据核验与快照后 pending 自动重放，进入全量门禁。 |
| 2026-09-21 | done   | Codex | -      | 迁移专项验证与 `pnpm validate` 全部通过，2.2a 验收完成。                                             |
