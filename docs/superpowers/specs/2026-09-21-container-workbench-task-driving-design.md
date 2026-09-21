# 货柜工作台 × 岗位工作台 · 驱动模型设计

> 状态：**待评审** · 2026-09-21 · 分支 `feat/warehouse-delivery-operational-flow`
> 一句话：**货柜工作台看全局并指路，岗位工作台按节点干活；两者是同一任务池的两个投影；任务的完成由事实驱动，人只负责填事实。**
>
> 关联：[UX_CONTAINER_WORKBENCH](../product/UX_CONTAINER_WORKBENCH.md)、[WORKSPACE_UI_INVENTORY](../product/WORKSPACE_UI_INVENTORY.md)、[人话-货柜怎么往前走](../../人话-货柜怎么往前走.md)、[DOMAIN_VERTICAL_DELIVERY_PLAN](../planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md)

## 1. 问题：三个方向都是断的

现状（截至 2026-09-21）的实测结论：

| 方向 | 现状 | 证据 |
| ---- | ---- | ---- |
| 工作台 → 产生任务 | ❌ 不产生 | 任务由建柜一次展开 14 站 + 过站激活，工作台无写入 |
| 任务 → 驱动工作台 | ❌ 不驱动 | 点击只是往 URL 写 `?containerId=&taskId=`，工作台按 containerId 加载 |
| 任务 → 驱动流程 | ❌ 不驱动 | `complete-work-order.service.ts:306-320` 硬编码返回 `lifecycleApply: "not_applicable"` |

后端 `work-execution` 模块内搜 `workspace` / `工作台` **零命中**；唯一的 Task↔Workspace 关联是前端硬编码的 `1 nodeCode : 1 工作台`（`apps/web/src/data/*Workbench.ts`），14 站里只有 6 站有台。

### 1.1 界面层症状

每个工作台右栏**并排跑着两条互不相干的链**：

- **链 A · 业务事实链（真推进）**：填表单 / 上报日期事实 → 提交复核 → 采信 → 规范事件 → 过站
- **链 B · 工单链（不推进）**：领工单 → 完成工单 → `not_applicable`

界面靠一句小字注释区分二者（"完成工单只记录工作结果，不代替实际装船事实"）。而**左栏队列里排的任务恰恰全是链 B 的**——现场领活、干完、点完成，系统什么也没发生。

### 1.2 六个台是同一台机器换六次皮

`RoleWorkbenchFrame.vue` 是所有 6 个台的共用骨架（`PageHeader` → 岗位/货柜 context band → `LiveNodeRail` → 三列 grid），内容全靠 `queue` / `primary` / `secondary` 三个插槽。备货台与送仓台在结构上没有任何区别，尽管一个看 SKU、一个看仓库预约。

且 `UI_SYSTEM.md §5` 定义的四个页面模板（TaskWorkspace / ObjectRecord / PlanBoard / ManagementProjection）**并不包含"岗位工作台"**——它是实现阶段 2.1a 长出来的，不在设计里。

## 2. 目标与非目标

**目标**

1. 货柜工作台（全局）与岗位工作台（按节点）成为**同一任务池的两个投影方向**，不是两套数据。
2. 任务完成由**事实**驱动，人只负责填事实；事实走不通时有**可用的**人工兜底路径。
3. 补全货柜工作台的生命周期全貌（14 站轨道 + 下一步清单 + 标记/异常位）。

**非目标（本期不做）**

- 不新增"一键动作 / 动作中心"（`UX_CONTAINER_WORKBENCH §4` 的默认载荷 + 一键确认设想，本期改为"下一步清单 + 跳转"）。
- 不改动现有岗位台的表单（它们是资产，一行不改）。
- 不修改"工单完成 ≠ 过站"这条领域规则。
- 不做船务/单证/入库/还箱的新岗位台。

## 3. 设计决策

四项决策按提出顺序记录，均已确认。

### D1 · 驱动模型 = 货柜驱动

目标形态对齐 `UX_CONTAINER_WORKBENCH.md`：一柜一屏看尽全生命周期，而非"岗位收件箱"。

### D2 · 两个入口，同一任务池

> 负责人 2026-09-21：**"货柜工作是全局，岗位工作台按节点分割，二种不同的入口方式，但底层的任务是一致的。"**

- **货柜工作台** = 按 `containerId` 切任务池 → 一柜的全部 14 站
- **岗位工作台** = 按 `nodeCode` 切任务池 → 一个节点上的全部柜

与 `UX_CONTAINER_WORKBENCH §1.6` 一致："每个 rail 节点可以进入同一个 `NodeSopWorkspace`"。

### D3 · 货柜工作台只提示，不开办

货柜工作台负责"一眼看尽 + 告诉我下一步该干什么"，**不动手**。点下一步带着 `containerId + nodeCode` 跳到对应岗位台执行。

### D4 · 事实自动完成，人工兜底 = 人工补录事实

- **默认**：事实被采信 → 系统自动完成任务 → 过站（同一件事）。
- **兜底**：事实源不可用时，缺口清单上的按钮是**「人工补录事实」**，跳到日期事实复核台走现有事实链（权限 + 证据 + 理由 + 四眼）→ 采信 → 过站。

**为什么不直接做"手工完成工单"**：若手工完成不过站，它解不开下游的锁，是个摆设；若过站，就打破了"工单完成 ≠ 过站"。人工补录事实同时满足"按钮有用"与"规则不破"——它本来就是合法事实，只是来源是人不是外部系统，且此路径**已经存在**（`/reviews/date-facts`）。

## 4. 详细设计

### 4.1 货柜工作台

复用 `/container/:id`（`apps/web/src/views/MicroWorkbench.vue`），改三处：

| 块 | 现在 | 改后 | 数据来源 |
| -- | ---- | ---- | -------- |
| **轨道** | `LiveNodeRail.vue` 只画**已落库**的站（有 `node_instance` 才画） | 画**全 14 站**目录，叠加已落库状态 | 目录 `packages/contracts/catalogs/v1/lifecycle-nodes.json`；状态 `GET /containers/:id/lifecycle-nodes` |
| **下一步清单** | 无 | 新增。每条 = 哪一站 + 缺什么 + 去哪个岗位台办 | 新增投影，见 §4.3 |
| **标记 / 异常位** | 无 | 新增位（`WORKSPACE_UI_INVENTORY §4.4` 已登记为"补回条件"） | 待定，见 §7 |

目标形态：

```text
┌ 货柜 KOCU4960726 · 备货单 RO-20260901 ──────────────┐
│ 状态:已提柜   标记:无   异常:无                       │
├─────────────────────────────────────────────────────┤
│ ①✓备货 ②✓装箱 ③✓出运 ④✓离港 ⑤◐海运 ⑥○中转 … ⑭○还箱 │
│         预计09-22  实际09-20  预计10-04              │
├─────────────────────────────────────────────────────┤
│ 下一步该做：                                          │
│  ⑤ 海运 · 缺 到港事实（等外部权威源）  → 船务工作台    │
└─────────────────────────────────────────────────────┘
```

纪律：轨道必须区分**已完 / 当前 / 未发生**，且计划·预计·实际分轨；**未发生的节点不得画成已完成**（`UI_SYSTEM §5`）。

### 4.2 岗位工作台

| 处 | 改动 |
| -- | ---- |
| **队列** | 每条从"任务标题"改为**缺口清单**：已收什么 / 缺什么 / 责任 / 时限 |
| **行动栏** | 「完成工单」不再无条件出现。事实驱动的站不出按钮；事实源不可用时出「人工补录事实」 |
| | ⚠️「人工补录事实」**不是新机制**——岗位台现有的表单本身就是人工录入事实（提交到 `/containers/:id/date-facts`）。此按钮只是**打开那个表单**，不需要新建通道。 |
| **表单** | **不动** |
| **顶部** | 新增"回货柜工作台"链接（当前两个入口互不链接） |

目标形态：

```text
● KOCU4960726 · 装箱                     等待实际装箱时间
  ├ 已收：装箱快照 v3（箱号 / 封号 / VGM）
  ├ 缺：实际装箱时间 + 合格证据
  └ 责任：出运装箱岗   时限：09-22 18:00
                          [ 人工补录事实 ]   ← 仅事实源不可用时出现
```

### 4.3 任务模型变化

| | 现在 | 改后 |
| -- | ---- | ---- |
| 任务是什么 | 一件要你点「完成」的活 | **这一站还缺什么的清单** |
| 谁判定完成 | 人点按钮 | 事实被采信时，系统自动完成 |
| 完成与推进的关系 | 完成 → 什么也不发生 | 事实采信 → 任务完成 + 过站（同一件事） |
| 「完成工单」按钮 | 无条件出现 | 移除；事实源不可用时改为「人工补录事实」 |
| 人的动作 | 领活、干、点完成 | **只填事实** |

**工单（`WorkOrder`）保留**，但它不再是完成的判定者，只承载**分派 / 领取 / 责任人 / 时限**（`assigneeId` / `assignmentState` / `dueAt` 都在工单上，`NodeTask` 上没有）。事实到齐时任务与其工单**一并自动完成**。

#### 4.3.1 关键查证结论

**A. 「什么事件完成哪个节点」已是完整且数据驱动的映射 —— 不需要补业务。**

`packages/contracts/catalogs/v1/canonical-events.json` 每个事件带 `completionEligibleNodeCodes`，由 `apps/api/src/modules/lifecycle-control/domain/event-catalog.ts:9-45` 生成为 `EVENT_TO_COMPLETION_NODES`，**14 站全覆盖**（cargo_ready / stuffed / loaded / departed / arrived / transit_departed / container_customs_completed / rail_handover / gate_out / delivered / warehouse_arrival / unloaded / unstuffed / returned_empty）。

**B. 真正缺的只有两件事。**

1. **过站时没有把对应任务置为 completed。** 全仓 `nodeTask.update` 仅 4 处：
   - `prisma-work-execution.repository.ts:191` — upsert，只改 readiness / eligibility，**从不改 state**
   - `:217` — create
   - `:262` — claim
   - `:286` — 工单完成时聚合

   **没有一处来自生命周期事件。** 所以事实过站后，那一站的任务永远停在 `pending`。这是"事实自动完成"唯一需要新接的线，位置在 `apps/api/src/modules/lifecycle-control/application/apply-lifecycle-event.service.ts:422`（`if (transition.applied)` 过站成功处）。

2. **`FACT_TARGET_NODE` 是需要废弃的冗余影子表。** `apps/api/src/modules/work-execution/domain/task-conditions.ts:8-13` 只有 4 条映射（`customs_clearance_completed` / `container_unloading_completed` / `container_empty_confirmed` / `container_empty_estimated`），仅用于算任务红绿灯，与真正的过站无关。应改为查 canonical-events 的权威映射。

**C. 一个站卡住会锁死后面所有站。**

```text
本站不过站
  → 下一站不是 current
  → 下一站 NodeTask.readinessState = "waiting_conditions"   [task-conditions.ts:37]
  → 下一站工单 state = "draft"                              [repository.ts:235]
  → "draft" 不在 CLAIMABLE_STATE                            [work-order-claim.ts:11-15]
  → 下一站的人【领都领不了】
```

唯一例外：外部事实可以先到、先存着（被锁的只是工单，不是事实）。这正是 D4 兜底路径必须**真的能过站**的原因。

### 4.4 缺口清单投影（新增）

"下一步该做什么 / 缺什么"目前**没有现成投影**。最近的是：

- `apps/api/src/modules/work-execution/domain/object-task-activity.ts` 的 `projectNextActions`（`:56`）与 `projectTaskActivities`（`:94`）——但它的"下一步"只有**领工单 / 完工单**，不回答"缺哪条事实"。
- `evaluateTaskConditions`（`task-conditions.ts:21-41`）已产出 `readinessState` / `completionEligibility` / `conditionFactRefs`——**方向正确但只覆盖 4 站**，且只给二值判断，不列具体缺口。

需要新增一个投影，对每个未完成任务回答：

```text
{ nodeCode, nodeName, containerId, taskId,
  receivedFacts: [...],        // 已收：来自 conditionFactRefs 解析
  missingFacts: [...],         // 缺什么：由 canonical-events 的目标事实推导
  responsibleRole, dueAt,      // 责任与时限：来自 WorkOrder
  completionMode: "fact_driven" | "needs_manual_fact" }
```

`completionMode` 的判据：该站是否存在可用事实源。**注意**：14 站的 `EVENT_TO_COMPLETION_NODES` 全部有映射，所以 `needs_manual_fact` **不是"这一站没有事实通道"**，而是"**该通道当前不可用**"（外部系统未对接、历史柜补录、事实源永久失效）。

**事实录入通道本来就是通用的**：`record-lifecycle-date-fact.service.ts:304-306` 按 canonical-events 目录校验 `eventCode` + `allowedTimeKinds`，**任何一站都能录**，没有按节点写死的白名单。所以"人工补录事实"不需要新机制——岗位台那些表单本身就是人工录入事实。

由此暴露一个空洞，见 §7.6：**8 个没有岗位台的站，不是没通道，是没界面。**

## 5. 改动清单

**后端**

| 文件 | 改动 |
| ---- | ---- |
| `lifecycle-control/…/apply-lifecycle-event.service.ts:422` | 过站成功后，把该节点对应 `NodeTask` 置 `completed`（新增） |
| `work-execution/infrastructure/prisma-work-execution.repository.ts` | 新增"按 nodeInstanceId 完成任务"的方法 |
| `work-execution/domain/task-conditions.ts` | 废弃 `FACT_TARGET_NODE`（4 条影子表），改查 canonical-events 权威映射 |
| 新增缺口清单投影 | 见 §4.4 |
| `work-execution/application/complete-work-order.service.ts` | 本期**保留不动**（`/tasks` 与 API 不改，避免一次动太多）；仅岗位台不再暴露入口。后续评估退役 |

**前端**

| 文件 | 改动 |
| ---- | ---- |
| `views/MicroWorkbench.vue` + `components/container/LiveNodeRail.vue` | 轨道改画全 14 站；新增下一步清单、标记/异常位 |
| `components/workbench/RoleWorkbenchFrame.vue` | 队列/行动栏插槽语义调整；顶部加回链 |
| `components/{cargo-ready,stuffing,dispatch,customs,pickup,delivery}/*WorkQueue.vue` | 队列项改缺口清单形态 |
| 各 `*ActionPanel.vue` | 移除无条件「完成工单」；按 `completionMode` 决定是否出「人工补录事实」 |

**文档**

| 文件 | 改动 |
| ---- | ---- |
| `docs/product/UX_CONTAINER_WORKBENCH.md` | §4「动作中心 + 一键执行」改为"下一步清单 + 跳转"（D3） |
| `docs/product/UI_SYSTEM.md` §5 | 补入货柜工作台/岗位工作台的页面模板定义（现在缺） |
| `docs/product/WORKSPACE_UI_INVENTORY.md` | 更新页面定位与拿掉/补回清单 |

## 6. 分期

| 期 | 内容 | 可演示结果 |
| -- | ---- | ---------- |
| **一期** | 后端接"过站自动完成任务" + 废弃 `FACT_TARGET_NODE`；货柜工作台轨道画全 14 站（只读） | 走完一站后任务自动消失；轨道能看到全部 14 站 |
| **二期** | 缺口清单投影 + 货柜工作台的"下一步"块 + 跳转 | 货柜工作台能指出下一步并跳到岗位台 |
| **三期** | 岗位台队列改缺口清单形态；行动栏按 `completionMode` 出按钮；回链 | 岗位台从"任务列表"变"缺什么清单" |
| **四期** | 标记 / 异常位 | 全貌补齐 |

一期即产生可观察的正确性改善（任务不再永远挂着），建议先做。

## 7. 风险与未决

1. **标记 / 异常的投影不存在。** `WORKSPACE_UI_INVENTORY §4.4` 登记补回条件是"专业事实与检查清单查询"，属四期，需单独 brief。
2. **轨道画全 14 站依赖计划/预计时间。** 现在只有已落库 `node_instance`，没有 `plannedAt` / `estimatedAt` 分轨（`WORKSPACE_UI_INVENTORY §4.4` 已登记）。若无计划时间，一期轨道只能画"已完/当前/未发生"三态与已落库日期。
3. **`completionMode` 的判据需要定义"事实源不可用"的信号。** 目前系统里没有这个概念，需要一个显式标记或人工触发的降级，属二期待定。
4. **前端 6 个台是同一骨架的六次换皮。** 本设计不动结构（表单是资产），但长期应评估是否收成一个页面参数化。不在本期。
5. **已存在的并行数据**：`ExternalWorkItem`（跨模块整改/义务，按 `assignedRoleCode` 派，与 `NodeTask` 无 FK）走 `GET /work-items`，界面强制分栏。本期不合并两者。
6. **8 个没有岗位台的站，入口未定。** 14 站里只有 6 站有岗位台（备货/装箱/出运/清关/提柜/送仓）。货柜工作台的"下一步"清单一旦覆盖全 14 站，剩下 8 站（离港、海运、中转、到港、海铁、卸柜、卸空、还箱）点下去**无处可去**。三个选项，需决策：
   - (a) 新建一个**通用事实录入页**（通道通用、表单按 eventCode 生成，工作量小）
   - (b) 跳到已有的 `/reviews/date-facts` 日期事实复核台（但它的语义是"审批"，不是"录入"）
   - (c) 本期先不通，轨道上标注"该站暂无作业界面"

   推荐 (a)：最正，且顺带解决了 D4 兜底路径对无台站的覆盖。

## 8. 测试策略

- **过站自动完成任务**：TDD。先在 `apply-lifecycle-event.service.test.ts` 加断言（过站后该节点任务 state = `completed`），再实现。
- **`FACT_TARGET_NODE` 废弃**：改前先补 `task-conditions.test.ts` 覆盖 14 站，确保行为等价或更好。
- **缺口清单投影**：纯函数 + 表驱动测试，14 站各一例。
- **前端**：沿用各 `*Workbench.test.ts` 的既有模式；轨道新增全 14 站渲染的断言。
- 高风险切片（生命周期状态机）按 `DOMAIN_VERTICAL_DELIVERY_PLAN §7` 跑 `pnpm validate` 与专项门禁。
