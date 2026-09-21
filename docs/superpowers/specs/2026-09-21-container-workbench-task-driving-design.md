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

**同形的根源见 §7.7**：权威映射里工作台是"**组织**管一段节点"（出运管 2 站、内陆运输管 3 站），而现有实现做成了"**一站一台**"。一台只管一个节点时，差异只剩中间那张事实表。

## 2. 目标与非目标

**目标**

1. 货柜工作台（全局）与岗位工作台（按节点）成为**同一任务池的两个投影方向**，不是两套数据。
2. 任务完成由**事实**驱动，人只负责填事实；事实走不通时有**可用的**人工兜底路径。
3. 补全货柜工作台的生命周期全貌（14 站轨道 + 下一步清单 + 标记/异常位）。
4. **结构先立、数据后填**（负责人 2026-09-21）。计划 / 预计 / 实际三轨、标记 / 异常位、`completionMode` 一律**预埋**；无数据时**显式留空**，不得因当前无数据而省略或延后。留空纪律见 §4.1。

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

### D5 · 不收敛组织台，只做分组导航

> 负责人 2026-09-21：**"不收敛，只分组导航。"**

现有 6 个单节点台**不合并**，路由、页面、表单全不动。只在侧栏按 [COMPLIANCE_MANAGEMENT §7.1](../product/domain/COMPLIANCE_MANAGEMENT.md) 的组织映射分组，让人看得出哪几个台属于同一个组织。

**成本如实说明**：这不只是改 `section` 字段。`AppSidebar.vue` 现在是**平铺渲染**（`v-for="item in navigation"`），`AppNavigationItem.section` 是**死数据** —— 全仓只有 `navigation.test.ts` 断言它透传，没有任何组件渲染它。所以分组需要：`AppSidebar` 新增分组渲染 + `navigation.ts` 填新 section 值 + 更新 `navigation.test.ts`。

分组结果：

```text
侧栏 · 作业
 ├ 我的任务
 ├ 备货
 │   └ 备货工作台
 ├ 出运
 │   ├ 装箱工作台
 │   └ 出运工作台
 ├ 清关
 │   └ 清关工作台
 └ 内陆运输
     ├ 提柜工作台
     └ 送仓工作台
```

### D6 · `completionMode` 先立字段，判据后补

> 负责人 2026-09-21：**"7.3 也先立字段。"**

在 `packages/contracts/catalogs/v1/lifecycle-nodes.json` 的每个节点上加 `completionMode`，**初值全为 `fact_driven`**。判据（服务端凭什么说"事实源不可用"）后补，见 §7.3。

原则与 §4.1 的三轨预埋一致：**结构先立，数据后填**。同批按此原则处理的还有标记 / 异常槽位（§7.1）。

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

纪律：轨道必须区分**已完 / 当前 / 未发生**，**未发生的节点不得画成已完成**（`UI_SYSTEM §5`）。

**三轨预埋（负责人 2026-09-21）**：计划 / 预计 / 实际三轨的**槽位必须一开始就立起来**，无数据时**显式留空**，不得因当前无数据而省略或延后。

```text
①✓备货            ②◐装箱            ③○出运            ⑥○中转
 计划 09-18         计划 —             计划 —             计划 不适用
 预计 09-18         预计 09-20         预计 —             预计 不适用
 实际 09-19         实际 —             实际 —             实际 不适用
```

留空纪律（与仓库既有规则一致，务必让实施计划遵守）：

| 允许 | 禁止 |
| ---- | ---- |
| 槽位常驻，无数据时显式留空（`计划 —` / `预计 待补`） | 用假值 / 演示数据填充（`WORKSPACE_UI_INVENTORY §4.4`、§6） |
| 三轨框架一开始就画 | 在空轨道上画进度条（`WORKSPACE_UI_INVENTORY §6`） |
| `不适用` 独立于"留空" | 把"无数据"渲染成"0 / 无风险"冒充分已接通 |

**`不适用` ≠ `留空`**：`applicability: optional_not_applicable` 的节点（中转 / 海铁）显示"不适用"，这是有意义的判定，不得与"暂无数据"混同，也不制造假取消。

由此 **§4.4 的时间事实聚合投影从二期提到一期**——槽位要有真实来源才算"埋好了"。

#### 4.1.1 视觉定稿（浏览器原型评审 · 负责人 2026-09-21）

原型会话产物在 `.superpowers/brainstorm/234-1789986779/content/`（已 gitignore，不入库；结构与约束在此固化，保证脱离原例会话也能实施）。三项选择：

| 项 | **选定** | 未采纳 |
| -- | -------- | ------ |
| 轨道形态 | **A 横向主轴**——14 站一条线铺开 | 垂直线性轨道（要滚动，丢掉"一眼看尽"） |
| 三轨落法 | **A3 主轴 + 展开卡**——主轴每站一个摘要日期或 `—`；展开卡常驻，含计划 / 预计 / 实际三行 | 三行全展（轨道变 5 行）、单行 + 三格存在条 |
| 整页布局 | **L1 竖向堆叠**——柜头 → 轨道 + 展开卡 → 下一步清单 | 轨道通栏 + 下方两栏、左栏常驻 + 右主区 |

未采纳 C 的**组织色带**（顺序轴不动 + 色带表达组织）：因选定 A 而默认不加。若要加是纯增量，不改变本设计。

**由原型得出的硬约束**（验收必查）：

1. **展开卡必须是常驻结构**——每一站都点得开、都有计 / 预 / 实三行，**不是"有数据才出现"**。这是"预埋"能否成立的判据。
2. **"留空可见"分层满足**——摘要层（主轴每站）显示一个日期或 `—`，空的是可见的；明细层（计 / 预 / 实各自的值）靠展开。A3 不隐藏留空，只是把明细收进展开卡。
3. **早期柜必须成立**——刚建柜、只完成第一站时：轨道仍**铺满 14 站**（不是只剩一格）；三轨槽位全部在位并写作 `—`；`不适用` 与 `留空` 是两种呈现；异常槽位空着写 `—`，**不写"0 项"**。

中程柜的目标形态（语义色见下行图例）：

```text
┌ KOCU4960726 · RO-20260901        已提柜 · 标记 — · 异常 1 ┐
├──────────────────────────────────────────────────────────┤
│ ①●  ②●  ③◐  ④○  ⑤○  ⑥╌  ⑦○  ⑧○  ⑨╌  ⑩○  ⑪○  ⑫○  ⑬○  ⑭○ │
│备货 装箱 出运 离港 海运 中转 清关 到港 海铁 提柜 送仓 卸柜 卸空 还箱│
│09-19 09-21  ▲    —  10-02 不适用 10-04 10-04 不适用  —    —    —    —    — │
├──────────────────────────────────────────────────────────┤
│ 展开：③ 出运 · 进行中                                     │
│   计划 09-22        预计 09-22        实际 —              │
│   ⚠ VGM 未被船司接收 · 承运交接未完成                      │
├──────────────────────────────────────────────────────────┤
│ 下一步该做                                                │
│  ③ 出运 · 缺 实际装船事实 + VGM 交接    → 出运工作台       │
│  ④ 离港 · 缺 离港事实（等外部权威源）   → 船务工作台       │
└──────────────────────────────────────────────────────────┘
```

图例：**实心绿 ● = 已完成** · **蓝环 ◐ = 当前站**（红环 = 有异常）· **灰空 ○ = 未发生** · **虚线 ╌ = 不适用** · **`—` = 留空**。四种状态互不混同，颜色只表达业务语义（`UI_SYSTEM §7.1`）。

### 4.2 岗位工作台

| 处 | 改动 |
| -- | ---- |
| **队列** | 每条从"任务标题"改为**缺口清单**：已收什么 / 缺什么 / 责任 / 时限 |
| **行动栏** | 「完成工单」不再无条件出现。事实驱动的站不出按钮；事实源不可用时出「人工补录事实」 |
| | ⚠️「人工补录事实」**不是新机制**——岗位台现有的表单本身就是人工录入事实（提交到 `/containers/:id/date-facts`）。此按钮只是**打开那个表单**，不需要新建通道。 |
| **表单** | **不动** |
| **顶部** | 新增"回货柜工作台"链接（当前两个入口互不链接） |
| **侧栏** | 不属于本页，见 D5：AppSidebar 改为按组织分组渲染 |

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

2. **`FACT_TARGET_NODE` 不能简单"换成 canonical-events 查表"——查证后有条坎。** `apps/api/src/modules/work-execution/domain/task-conditions.ts:8-13` 的 4 条映射只有 4 个站。原以为可以直接改用 canonical-events 的权威映射，但：

   - 那 4 个 code（`customs_clearance_completed` 等）是 **`ImportTimeFactCode`**（`integration-import/domain/import-field-catalog.ts` 的 `IMPORT_TIME_FACT_CATALOG`），**不是规范事件码** —— 在 `canonical-events.json` 里 0 命中。
   - **但 `ShipmentTimeFact` 表有一列 `eventCode`**（nullable），导入时由 `definition.eventCode` 解析得到 —— 这才是与规范事件的权威连接点。
   - `TaskConditionFact`（`evaluateTaskConditions` 的入参）**不带** `eventCode` 也不带 `nodeCode`，只有 `{ id, factCode, timeKind, captureSource, evidenceRef }`。

   **做法（增量而非替换）**：给 `TaskConditionFact` 加 `nodeCode: LifecycleNodeCode | null`，在 `PrismaContainerRepository.listCurrentTaskFacts` 里用 `ShipmentTimeFact.eventCode` → canonical-events 的 `defaultNodeCode` 填上；`evaluateTaskConditions` **优先按 `fact.nodeCode` 匹配，`FACT_TARGET_NODE` 降为兜底**（覆盖 `eventCode` 为空的 system_derived 事实）。

   这样 14 站全部可由事实驱动，且不丢掉现有覆盖。**直接删表会在 `eventCode` 为空的事实上丢覆盖**，所以是"降级为兜底"而非"删除"。

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

**字段立在哪**（D6，见 §3）：`packages/contracts/catalogs/v1/lifecycle-nodes.json` 每个节点加 `completionMode`，与 `sequence` / `nodeCode` / `applicability` 并列。它是**站的性质**（"这站的事实源可用吗"），不是单件任务的性质，因此**不给 `NodeTask` 加 DB 列**。仓库已有"目录给默认、实例可覆盖"的现成模式（`apps/api/src/modules/lifecycle-control/domain/node-applicability.ts` 的 `defaultApplicability`），将来要按柜覆盖时照 `applicability` 加列即可。

**三轨的数据源是 `LifecycleDateFact`（不是 `ShipmentTimeFact`）。** 仓库里有**两张**时间事实表，别搞混：

| 表 | 归属 | 关键列 | 用来做什么 |
| -- | ---- | ------ | ---------- |
| `LifecycleDateFact` | `lifecycle-control` | `nodeCode`、`eventCode`、`timeKind`（**planned / estimated / actual**）、`occurredAt`、`verificationState`、`applicationState`、`isCurrent` | **三轨轨道的来源**——它有 `nodeCode` 和全部三种 `timeKind` |
| `ShipmentTimeFact` | `shipment-registry` | `factCode`、`eventCode?`、`timeKind`（**只有 actual / estimated**）、`evidenceRef`、`isCurrent` | **任务条件计算**的来源（`TaskConditionFact`）——**没有 planned** |

现成查询：`PrismaLifecycleDateFactRepository.listCurrent({ tenantId, containerId })`（`prisma-lifecycle-date-fact.repository.ts:227`）已按 `isCurrent: true` 过滤，但**硬编码 `take: 100`**（14 站 × 3 轨 = 42，够用，但实施时应意识到这个上限）。

**事实录入通道本来就是通用的**：`record-lifecycle-date-fact.service.ts:304-306` 按 canonical-events 目录校验 `eventCode` + `allowedTimeKinds`，**任何一站都能录**，没有按节点写死的白名单。所以"人工补录事实"不需要新机制——岗位台那些表单本身就是人工录入事实。由此暴露一个空洞，见 §7.6：**8 个没有岗位台的站，不是没通道，是没界面。**

## 5. 改动清单

**后端**

| 文件 | 改动 |
| ---- | ---- |
| `lifecycle-control/…/apply-lifecycle-event.service.ts:422` | 过站成功后，把该节点对应 `NodeTask` 置 `completed`（新增） |
| `work-execution/infrastructure/prisma-work-execution.repository.ts` | 新增"按 nodeInstanceId 完成任务"的方法 |
| `work-execution/domain/task-conditions.ts` | 废弃 `FACT_TARGET_NODE`（4 条影子表），改查 canonical-events 权威映射 |
| 新增缺口清单投影 | 见 §4.4 |
| 新增时间事实聚合投影（节点 × `timeKind`） | 三轨数据来源，见 §4.1。按 `containerId` 查 `date_fact`，按 `nodeCode` + `timeKind` 分组；事件→节点用 canonical-events 的 `defaultNodeCode`（权威，不新建映射） |
| `packages/contracts/catalogs/v1/lifecycle-nodes.json` | 每个节点加 `completionMode`（初值全 `fact_driven`），D6。**契约包变更，需重新生成 `contracts.d.ts`** |
| `work-execution/application/complete-work-order.service.ts` | 本期**保留不动**（`/tasks` 与 API 不改，避免一次动太多）；仅岗位台不再暴露入口。后续评估退役 |

**前端**

| 文件 | 改动 |
| ---- | ---- |
| `views/MicroWorkbench.vue` | 改为 **L1 竖向堆叠**：柜头（含标记 / 异常槽位）→ 轨道 + 展开卡 → 下一步清单（见 §4.1.1） |
| `components/container/LiveNodeRail.vue` | 改画全 14 站目录；主轴每站显示摘要日期或 `—`；四态视觉（已完成 / 当前 / 未发生 / 不适用，见 §4.1.1 图例） |
| **新增** 节点三轨展开卡组件 | **常驻结构**：每站都点得开，含计划 / 预计 / 实际三行（可为空）+ 该站异常。是"预埋"的判据，不得做成"有数据才出现" |
| `api/lifecycleNodes.ts` + `data/liveNodeProjection.ts` | DTO 与视图模型各加 `plannedAt` / `estimatedAt` / `actualAt`（可空） |
| `components/workbench/RoleWorkbenchFrame.vue` | 队列/行动栏插槽语义调整；顶部加回链 |
| `components/shell/AppSidebar.vue` | 新增**分组渲染**（现为平铺 v-for，`section` 是死数据） |
| `components/shell/navigation.ts` + `navigation.test.ts` | 按 D5 的组织映射填 `section` 值并更新断言 |
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
| **一期** | 后端接"过站自动完成任务" + 任务条件用 `eventCode` 权威映射（`FACT_TARGET_NODE` 降为兜底）+ **时间事实聚合投影** + **节点目录加 `completionMode`**（D6）；货柜工作台按 **L1 竖向堆叠**重排，轨道画全 14 站、**预埋三轨 + 常驻展开卡**、**预埋标记槽位**（留空）、**接通异常槽位**（消费已有的 `blockedReasonRefs`） | 走完一站后任务自动消失；轨道看到全部 14 站与三轨（计划轨留空、差异可见）；未关闭异常在柜头可见，标记槽位在位留空 |
| **二期** | **缺口清单投影** + 货柜工作台的"下一步"块 + 跳转 | 货柜工作台能指出下一步并跳到岗位台 |
| **三期** | 岗位台队列改缺口清单形态；行动栏按 `completionMode` 出按钮；回链；**侧栏按组织分组（D5）** | 岗位台从"任务列表"变"缺什么清单"；侧栏看得出组织归属 |

一期即产生可观察的正确性改善（任务不再永远挂着），建议先做。

## 7. 风险与未决

1. **标记 / 异常位——按负责人 2026-09-21 决定预埋为常驻槽位。**（**已修正**：初稿说"异常缺读投影"是错的，查证后两者处境如下。）

   | | 模型 | 写路径 | 读路径 | 前端 |
   | --- | --- | --- | --- | --- |
   | **异常** | ✅ `NodeBlock` + `NodeBlockResolution` | ✅ 创建 / resolve | ✅ **已通**——`prisma-lifecycle.repository.ts:34` 的查询带 `where: { resolution: { is: null } }`，`blockedReasonRefs` **只含未关闭的阻塞**，且已出现在 `GET /containers/:id/lifecycle-nodes` 响应里 | ❌ **唯一断点**：`LifecycleNodeItem` 类型里没这个字段，前端没用 |
   | **标记** | ❌ `schema.prisma:450` 只有一行 `TODO(D13 物理形态)` | — | — | — |

   所以：**异常一期就能接真数据**（补前端字段 + 消费即可，无需后端改动）；**标记是真·空槽位**，等 `CONTAINER_MARKERS` 落地。

   **共同的留空纪律**（同 §4.1）：空数组**不得**渲染成"0 项异常 / 无风险"（`WORKSPACE_UI_INVENTORY §4.1` 明写），必须是显式未知。
2. **计划轨会长期空着——已知并接受。** 三轨槽位按 §4.1 **预埋**（不因当前无数据而省略），但三种时间的**供给**差别很大，实施与后续维护都要知道：

   **结构上必须新建三层**：`NodeInstance` 表只有 `state` / `applicability` / `completedAt`，**没有时间列**（时间属于事实流水账，不属于节点实例，这是有意的设计）。`LifecycleNodeItem` 与 `LiveNodeView` 同样除 `completedAt` 外无时间字段，`LiveNodeRail.vue` 模板里也没有渲染时间的标记。三轨 = 新增按节点聚合时间事实的投影 + 打通 DTO → 视图模型 → 组件三层。**已提到一期**（见 §6）。

   **数据供给上**：

   | 轨道 | 生产者 | 现状 |
   | ---- | ------ | ---- |
   | 实际 `actual` | 导入、岗位台表单、外部追踪源（`ocean-port-visibility`） | ✅ 三个来源 |
   | 预计 `estimated` | 导入（`import-time-facts.ts`）、外部追踪源 | ⚠️ 有来源，覆盖面窄 |
   | 计划 `planned` | **无任何生产者** | ❌ 全仓 `"planned"` 只命中 `lifecycle-date-fact.dto.ts:19-20` 的枚举声明 |

   **接受的风险**：计划轨将**长期为空**，因为系统里没有"计划编制"这个业务动作。按 §4.1 留空纪律它必须显式留空而非隐藏——但实施与验收都必须知道"**空的计划轨是正常的，不是加载失败**"。界面上"暂无数据"与"加载失败"必须是两种可见状态，不得混同。

   若哪天要填满计划轨，需先发明"计划编制"这个业务动作，那是独立的一件事，不在本设计内。
3. **`completionMode` 已按 D6 先立字段，判据后补。** 字段立在 `lifecycle-nodes.json`，初值全 `fact_driven`（见 §4.4 / D6）。

   **已知后果**：一期上线后 `needs_manual_fact` **没有生产者**，等于兜底按钮暂时不出现。这与 D4 的意图（事实优先）一致，但实施与验收必须知道——**和计划轨是同一类情况：槽位已立、暂无写入方**。

   **待补的判据**：服务端凭什么说"事实源不可用"？候选：
   - (a) **按节点配置** —— 即本字段的配置值本身，最自然，也是 D6 选定的位置
   - (b) 按柜标记 —— 历史补录柜整柜转人工
   - (c) 事实超预期窗口未到 → 自动降级；但"预期窗口"这个概念现在也不存在
   - (d) 按钮常驻弱化 —— 实质放弃 D4 的严格性

   倾向 **(a) 起步、(c) 以后补**。

   **将来要按柜覆盖**时，照 `applicability` 的模式在 `NodeInstance` 加列，不改目录语义。
4. **前端 6 个台是同一骨架的六次换皮。** 本设计不动结构（表单是资产），但长期应评估是否收成一个页面参数化。不在本期。
5. **已存在的并行数据**：`ExternalWorkItem`（跨模块整改/义务，按 `assignedRoleCode` 派，与 `NodeTask` 无 FK）走 `GET /work-items`，界面强制分栏。本期不合并两者。
6. **未建的站属于未建的组织工作台，是排期问题，不是设计空洞。** 权威映射见 [COMPLIANCE_MANAGEMENT §7.1](../product/domain/COMPLIANCE_MANAGEMENT.md)（`UI_SYSTEM §8.5` 指定它为权威）：8 个组织工作台**分段覆盖**全部 14 个节点，不是一站一台。仍缺的 3 个组织台——

   | 缺的组织台 | 覆盖节点 |
   | ---------- | -------- |
   | 船务 | `origin_departure`、`ocean_transit`、`transshipment`、`destination_arrival` |
   | 入库 | `container_unloading`、`container_unstuffing` |
   | 还箱 | `empty_return` |

   已在路线图 `DOMAIN_VERTICAL_DELIVERY_PLAN §3` 的 3.2 项（送仓到还箱）内。另 `rail_transfer` 归**内陆运输**（台已建，节点尚未接）。

   因此货柜工作台"下一步"清单里，未建组织中的节点，点击目标 = 待建台；一期标注"该组织工作台待建"即可，不阻塞轨道铺满 14 站。
7. **现有 6 台与权威映射不一致：把"组织工作台"做成了"一站一台"。** 权威映射中**出运**拥有 `container_stuffing` + `shipment_dispatch` 两站，**内陆运输**拥有 `rail_transfer` + `container_pickup` + `warehouse_delivery` 三站；而现有实现拆成了 4 个独立的单节点台（装箱 / 出运 / 提柜 / 送仓）。

   **这正是"六个台长得一模一样"的根源**：一台只管一个节点时，台与台之间的差异就只剩中间那张事实表，骨架必然同形（见 §1.2）。组织台的意义在于"管一段"，那才会长出不同的形状。

   **已决策（D5）**：不收敛，只做分组导航。所以"六台同形"的观感在页面层保留，由侧栏分组与 §4.2 的队列改造缓解；收敛留待船务 / 入库 / 还箱建台时一并评估（那时反正要动一次）。
8. **组织分段与节点顺序对不上**（原型评审时发现）。按权威顺序，`customs_clearance`⑦ 夹在船务的 `transshipment`⑥ 与 `destination_arrival`⑧ 之间，所以 **船务 = ④⑤⑥⑧，中间被清关打断**。

   侧栏按组织分组（D5）不受影响——那只是导航，不要求连续。但若将来要让**轨道**按组织分段，必然出现一个组被切成两截。原型选项 C 正是为解决它而设计（**顺序轴不动 + 组织色带**），本期选定 A 故未采纳，留作记录：真要做组织分段时，色带是正解，切轴是错的。

## 8. 测试策略

- **过站自动完成任务**：TDD。先在 `apply-lifecycle-event.service.test.ts` 加断言（过站后该节点任务 state = `completed`），再实现。
- **`FACT_TARGET_NODE` 废弃**：改前先补 `task-conditions.test.ts` 覆盖 14 站，确保行为等价或更好。
- **缺口清单投影**：纯函数 + 表驱动测试，14 站各一例。
- **时间事实聚合投影**：表驱动测试，覆盖"某一站只有实际 / 只有预计 / 三者全无 / 不适用"四类。
- **前端**：沿用各 `*Workbench.test.ts` 的既有模式；轨道新增断言：
  - 全 14 站渲染（含未发生的站）
  - **三轨预埋**——无数据时槽位仍存在且显示留空，**不是消失**
  - **空轨道不画进度条**
  - `不适用` 与 `留空` 是两种不同呈现
  - "暂无数据"与"加载失败"是两种不同呈现（§7.2）
  - **展开卡对任意站都渲染计 / 预 / 实三行**，包括三轨全空的站（§4.1.1 约束 1）
  - **早期柜用例**：只完成第一站时，轨道仍渲染 14 站、槽位全部在位（§4.1.1 约束 3）
- 高风险切片（生命周期状态机）按 `DOMAIN_VERTICAL_DELIVERY_PLAN §7` 跑 `pnpm validate` 与专项门禁。
