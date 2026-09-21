---
status: review
branch: feat/container-workbench-phase1
---

# 任务：货柜工作台一期与生命周期事实对账

## 目标

让已经合法应用到生命周期节点的规范事件或日期事实，可靠对账到对应工单，并严格经过 `WorkOrderFactApplication -> WorkOrder 状态机 -> NodeTask 聚合 -> NodeTaskOutcome/审计` 闭环；同时让全局运营在“一柜一档”看到完整 14 站、计划/预计/实际三轨和未关闭阻塞，能够判断当前进度并跳转到对应岗位工作台。

本 brief 是一期执行、评审和跨子任务交接的唯一状态载体。逐文件步骤、测试样例和提交边界见[一期实施计划](../../superpowers/plans/2026-09-21-container-workbench-phase1.md)。

## 权威与影响范围

- `TASK_WORK_ORDER_CONTRACT_V1.md`（GC-005）是任务、工单、事实应用、合法转换、聚合、结果和事务的唯一业务权威。
- `MODULE_DEPENDENCIES.md §2.1` 规定 `lifecycle-control` 独占过站，`work-execution` 独占任务、工单和聚合；跨模块只经公开 Port 与 Outbox 协作。
- 一期设计输入来自 `2026-09-21-container-workbench-task-driving-design.md`，执行顺序和文件级要求来自上述一期实施计划；二者与 GC-005 或模块依赖图冲突时，以上位权威为准。
- 影响 `work-execution`、`lifecycle-control`、`shipment-registry`、公共节点目录、Prisma schema/追加迁移、生命周期节点 API，以及 Web 一柜一档视图。
- 这是数据库、公共契约、跨模块核心工作流和关键 UI 的高风险切片，最终需要完整门禁、专项迁移/契约验证和岗位主路径验收。

## 边界 / 不做

- 不因节点已经完成而直接批量更新 `NodeTask` 或 `WorkOrder` 为 `completed`；不新增通用 `setStatus`，不绕过 GC-005 的状态机、版本检查、聚合和审计。
- lifecycle 的本地事务只原子提交节点应用与专用 reconciliation Outbox；work-execution 在自己的事务内完成事实应用。两者不伪装成分布式事务。
- 工单完成不等于过站，对账已应用的 lifecycle 事实不得再次推进节点、激活下一节点或重写日期事实。
- 不把 `draft`、`failed`、`cancelled` 工单强改为完成，不复活 cancelled NodeTask；恢复必须走正式 ready/reopen/适用性命令后重放。
- 不猜测事实与任务的关联，不以裸箱号或 `containerId + eventCode` 代替 tenant/container/flow/node/event/domain fact 的完整因果范围。
- 不修改六个岗位工作台现有业务表单，不建设标记真实数据、二期缺口/下一步块、侧栏组织分组或 `completionMode` 配置后台。
- 无数据必须返回 `null` 并显示 `—`；`optional_not_applicable` 必须显示“不适用”，不得用 0、假日期、演示值或进度条冒充数据。
- 实施分支当前叠在卸柜切片提交之上；最终 PR 前必须确认前置卸柜提交已进入 `main`，再核对一期差异范围。
- 保留并隔离用户已有的 `apps/ai-service/uv.lock` 与 `workers/ai-worker/uv.lock` 修改。

## 验收

- [x] 已合法应用的规范事件/日期事实可经耐久 Outbox 对账到匹配工单；临时失败可重试、死信可重放，生命周期节点不回退且不重复过站。
- [x] 同一 `workOrderId + businessFactKey` 同载荷重放返回原结果；同键异载荷明确 `IDEMPOTENCY_CONFLICT`，并发请求不产生重复 FactApplication、状态迁移或 Outcome。
- [x] 工单只经合法状态转换完成；全部 required/conditional-required 完成后 NodeTask 才聚合完成，optional 不阻断，失败/取消/draft 和 cancelled NodeTask 不被误完成。
- [x] 首次完成才形成带 canonical event、domain fact、证据、操作者和 trace 因果的 Outcome/审计；事务故障时事实应用、工单、任务和 Outcome 全部回滚。
- [x] 任务条件优先使用规范事件目录解析出的 `nodeCode`，旧影子映射仅作兼容兜底；14 节点目录均有受控 `completionMode`。
- [x] 生命周期节点 API 始终返回 planned/estimated/actual 三轨槽位和未关闭阻塞；只投影当前权威事实，不用假值填空。
- [x] 全局运营打开“一柜一档”可看到完整 14 站、完成/当前/未发生/不适用四态、摘要日期、异常数量和所选站点三轨，并能跳往对应岗位台完成实际业务。
- [x] 空态、阻塞、不可执行、重试和不适用有不同且可行动的反馈；窄屏仍能浏览完整轨道且文字、动作不重叠。
- [x] 数据库追加迁移通过空库升级、旧版本升级、约束、回滚与并发验证；公共契约生成物无漂移。
- [x] API、Web、E2E、迁移、契约、架构和仓库完整质量门禁通过，实际证据写回本 brief 后才能标记 `done`。

## 业务与数据协同设计

| 业务岗位要完成什么               | 操作时需要看到什么                                                             | 系统允许做什么                                                                                   | 数据如何可靠保存与反馈                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 全局运营判断一柜走到哪、哪里异常 | 14 站完整轨道、当前/完成/未发生/不适用、三轨时间、未关闭阻塞、空值与来源       | 选择站点、查看三轨与阻塞、跳转对应岗位工作台；本期不在货柜页直接办理专业业务                     | 读取 lifecycle 权威投影；三轨缺值为 `null`；状态、日期和异常不从颜色或文案反推                    |
| 对应岗位用事实完成节点工作       | 当前工单、完成谓词、已有/缺失事实、责任与时限、证据、不可执行原因              | 通过人工、导入或 API 形成事实；按服务端 allowed actions 领取、处理或恢复；不得手工指定 completed | 规范事实经 FactApplication、状态机、确定性聚合和 Outcome/审计落库；事务、版本、幂等和租户范围受控 |
| 复核岗位判断实际日期是否可采信   | 原始值、时区、来源、证据、核验/确认状态、目标节点和冲突原因                    | 核验、拒绝或追加更正；合格 actual 才进入规范事件和节点应用链                                     | 不可变日期事实保留版本与 supersedes 关系；已应用事实通过 Outbox 对账，不覆盖历史                  |
| 运维处理迟到事实和失败对账       | canonical event、domain fact、目标节点、Outbox 状态/attempt/reasonCode/traceId | 排空到期消息、重放死信；定义未解析或对象错配时转人工处理                                         | 节点应用与 reconciliation Outbox 同事务；消费端按业务键幂等，暂时失败重试，业务拒绝留稳定原因     |

## 方案与 11 Task 摘要

执行顺序固定为事实对账主链（Task 1-4）→ 权威映射与三轨 API（Task 5-7）→ 前端投影和一柜一档（Task 8-11）。每个 Task 使用全新子代理实现，主代理在进入下一 Task 前审查权威边界、差异和定向验证；共享文件不得并行编辑。

| Task                                    | 交付摘要                                                                                                                           | 完成证据                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. 冻结运行时对账命令与领域决定         | 定义含完整租户/货柜/流程/节点/事件/事实因果的公开命令、稳定业务键和请求哈希；复用 WorkOrder 合法转换、NodeTask 聚合和 Outcome 规则 | 纯领域测试覆盖成功、拒绝、no-op、取消、聚合边界、Outcome 因果与顺序无关哈希   |
| 2. 落地 FactApplication、版本和因果审计 | 追加 `WorkOrderFactApplication`、任务/工单版本与适用性、Outcome 因果字段、历史 applied 节点的 reconciliation Outbox 回填           | Prisma 校验、专项验证脚本、空库与旧库升级、唯一/哈希/租户约束通过             |
| 3. 实现 work-execution 原子事实对账     | 在本地事务内查唯一任务、校验范围、匹配工单、写不可变应用、合法转换、聚合和首次 Outcome；注册公开 Port                              | Application 测试及真实 PostgreSQL 集成/并发/回滚测试通过，Nest 公共端口已登记 |
| 4. 用现有 Outbox 可靠投递               | 节点首次应用时同事务写专用 Outbox，由既有租约、退避、死信和重放链调用 work-execution；不复制第二套投递状态机                       | 原子提交、暂时失败重试、业务拒绝死信、重放幂等、历史回填和 DI 装配测试通过    |
| 5. 事实到节点改用权威映射               | `ShipmentTimeFact.eventCode` 经 canonical-events 目录解析为 `nodeCode`，任务条件优先按节点匹配，旧影子表仅兜底                     | 新旧路径、未知事件、节点匹配和兼容回退测试通过                                |
| 6. 节点目录增加 `completionMode`        | 14 个节点目录加入 `fact_driven` 与 `needs_manual_fact`，一期默认 `fact_driven`，运行时只读权威目录                                 | Schema/fixture/生成类型一致，14 节点目录与读取测试、契约漂移检查通过          |
| 7. 生命周期节点 API 提供三轨            | 聚合每节点当前 planned/estimated/actual 事实并透出常驻三槽；不适用与留空分离                                                       | 领域投影、Repository、Service、DTO/Controller 测试及 API 模块测试通过         |
| 8. 前端视图模型承接三轨与异常           | 扩展 API 类型和 `LiveNodeView`，保留三轨 null、阻塞数量与不适用语义                                                                | 前端纯映射测试、类型检查通过                                                  |
| 9. 轨道铺满 14 站                       | 将 `LiveNodeRail` 改为可横向浏览的 14 站主轴，区分四态、显示摘要日期/空值和阻塞提示                                                | 组件交互、空值、不适用和选择事件测试通过，并完成桌面/窄屏视觉检查             |
| 10. 新增常驻三轨展开卡                  | 所选站点始终展示计划/预计/实际三行；无数据为 `—`，未选中时给出人话空态                                                             | 三轨有值、全空、不适用和无选择组件测试通过                                    |
| 11. 一柜一档 L1 竖向堆叠                | 页面按柜头/标记异常槽位 → 14 站轨道 → 三轨卡 → 下一步排列；默认选择当前站                                                          | 页面主路径、异常计数、空态和窄屏 E2E 通过，Web 完整门禁通过                   |

## 验证路径

按任务从窄到宽执行；检查命令不得修改文件，失败结果不得隐藏或以放宽断言绕过。

1. Task 1-4：运行对应 Domain/Application/Outbox 单测、真实数据库集成与并发测试、Nest 装配测试、`pnpm repo:check`。
2. Task 2：运行 `pnpm exec prisma validate --schema database/schema.prisma`、`pnpm db:generate`、`pnpm db:migrate`、`pnpm db:verify:work-order-fact-application`，并验证空库和旧版本升级。
3. Task 5-7：运行相关 API 模块测试；Task 6 另运行 `pnpm contract:generate`、`pnpm contract:check`、`pnpm contract:drift`。
4. Task 8-11：运行相关 Web 映射/组件/页面测试、`pnpm --filter @logix/web validate` 和一柜一档关键 E2E；用桌面与窄屏视口核对轨道、三轨、空态和交互。
5. 收尾运行 `pnpm --filter @logix/api test`、`pnpm contract:drift`、迁移专项门禁及根目录 `pnpm validate`。
6. 手工验收：已过站货柜的匹配任务已正确对账且不会再次过站；新建货柜铺满 14 站，三轨槽位常驻为空时显示 `—`，中转/海铁在不适用时显示“不适用”。

## Review notes（review 阶段填写，只读不改代码）

- 2026-09-21：主审确认 brief 与 GC-005、模块依赖图和修订后计划一致；修正 Task 6 表格显示后进入 coding。
- 2026-09-21：Task 1 主审修正事实型 Outcome 为 `reference_existing_event`，并改用共享 `CaptureSource`；领域测试、API lint/typecheck/format 与 repo:check 通过。
- 2026-09-21：Task 2 主审补齐 Outcome 时间列 UTC/TIMESTAMPTZ 对齐与完整租户作用域索引；当前库、旧库夹具、空库迁移链及专项约束验证通过，7 个定向测试文件共 43 项通过。
- 2026-09-21：Task 3 主审移除 work-execution 对 lifecycle-control 私有表的反向读取，并将一期匹配收紧为唯一且定义明确的 required 工单；真实 PostgreSQL 并发、回滚与迟到事实重放验证通过。
- 2026-09-21：Task 4 主审确认节点首次应用与逐目标 reconciliation Outbox 同事务；组合 delivery 只从 lifecycle 权威记录组装命令，经 shipment 公共端口核租户后调用 work-execution 公共端口。专用消息显式校验 `eventVersion`，未知版本稳定拒绝；临时任务缺失和并发冲突可重试，稳定业务拒绝进死信，普通规范事件仍走原投递路径。
- 2026-09-21：Task 5 实现自检确认 `ShipmentTimeFact.eventCode` 只经 canonical-events 的 `defaultNodeCode` 解析；显式 `nodeCode` 优先，只有 `eventCode === null` 的历史事实才允许四个精确旧 `factCode` 兼容兜底，未知事件、无默认节点事件或未知事实码不作字符串猜测。仓库内 Port 为加法型变更，无数据库或外部 wire 迁移，契约生成物无漂移。
- 2026-09-21：Task 6 主审补齐 lifecycle-nodes 的正式包导出、生成声明与契约校验；`CompletionMode` 为加法型共享枚举，14 站均显式配置 `fact_driven`，目录缺项或目录外节点明确失败，不以静默默认掩盖配置错误。
- 2026-09-21：Task 7 将三轨定义为节点完成摘要轨，只消费公共事件目录对目标节点声明 `completionEligible` 的 current effective 事实；按 `completionEligibleNodeCodes` 投影全部目标，不把事实默认 `nodeCode` 误当唯一目标。actual 还要求 `verified + confirmed`、命中来源权威策略，且已进入 `pending_application | applied | rejected`，来源未采信的 `review_required` 不进入摘要。单柜与批量 API 共用一次批量查询并常驻返回三槽。一个槽出现多个完成候选时一期保守返回 `null`，不按数据库顺序或时间猜测；Task 8-11 只能把它显示为空值，后续明细投影需增加明确的歧义状态和候选入口。
- 2026-09-21：Task 8 前端 DTO 与纯视图映射已承接必填三轨、未关闭阻断数量和不适用标识；映射不为缺失字段静默补零或空对象，API 契约漂移会在类型检查或运行期显式暴露。后续 Task 9-11 直接消费该视图模型，不在组件内重新推导业务状态。
- 2026-09-22：Task 9 将节点轨道改为原生按钮组成的水平可滚动主轴；摘要按实际、预计、计划、完成时间顺序选择，并以显式用户 IANA 时区格式化。当前、完成、不适用和未关闭阻断均有文字或结构语义，不只依赖颜色。组件及两个消费者回归通过；当前会话无可用浏览器实例，桌面/窄屏实机视觉检查未伪报完成，保留到 Task 11 页面级 E2E 与视觉验收。
- 2026-09-22：Task 10 新增只读三轨展开卡；计划、预计、实际三槽始终占位，缺值显示 `—`，不适用显示“不适用”，未选站点给出下一步提示。日期按显式用户 IANA 时区显示，阻断数量保留独立警示；组件不读取数据、不判断权限、不改变节点状态。
- 2026-09-22：Task 11 将“一柜一档”收敛为柜头、标记/异常、14 站轨道、所选节点三轨、动态/助手和下一步的单列工作流；当前站默认展开，无当前站时退回第一站，轨道选择只改变只读详情。标记模型尚未落地时明确显示 `—`，异常数量来自节点未关闭阻断汇总。新增页面级 Playwright 用例，在桌面、窄屏和移动端验证 14 站完整、当前站与切站三轨、轨道内部横向滚动及页面无横向溢出；Web E2E 77 项通过、7 项按既有视口条件跳过。
- 2026-09-22：一期自动化收尾通过：`contract:drift`；API 196 个测试文件 929 项；数据库集成 3 个文件 16 项；Web 完整门禁 93 个测试文件 273 项、E2E 77 项通过/7 项按既有条件跳过；根级 `pnpm validate` 全绿。事实应用专项在隔离数据库完成当前结构、旧版本升级、空库 69 迁移和约束验证。默认 `logix/public` 因迁移后写入的历史测试夹具缺 reconciliation Outbox 而据实失败，未修改或删除该现有数据；该环境问题不影响隔离迁移结论。两项真实业务数据人工确认仍留在实施计划，brief 进入 `review` 而非 `done`。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                                                                                                                                                         |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-21 | design | Codex | —      | 建立一期正式 brief，冻结 GC-005/模块所有权边界、四者协同、11 Task 摘要与验证路径                                                                                                                                                             |
| 2026-09-21 | coding | Codex | —      | 主审通过，开始按全新子代理逐 Task 串行实现                                                                                                                                                                                                   |
| 2026-09-21 | coding | Codex | —      | Task 1 完成：冻结事实对账身份、领域决定、既有事件引用 Outcome 与公共 Port                                                                                                                                                                    |
| 2026-09-21 | coding | Codex | —      | Task 2 完成：落地事实应用账、版本/适用性、因果审计与历史对账 Outbox 回填                                                                                                                                                                     |
| 2026-09-21 | coding | Codex | —      | Task 3 完成：实现原子事实对账、乐观并发、幂等重放与公开 Port                                                                                                                                                                                 |
| 2026-09-21 | coding | Codex | —      | Task 4 完成：节点应用原子写对账 Outbox，复用既有重试/死信/重放链；修正本阶段 PostgreSQL 集成测试 schema 隔离。当前本地 public 库残留旧测试夹具，历史回填专项脚本据实失败，未删除现有数据。                                                   |
| 2026-09-21 | coding | Codex | —      | Task 5 完成：日期事实按 canonical-events 解析节点，仅无事件关联的历史事实允许精确旧映射兜底；三模块 119 个测试文件共 626 项、API lint/typecheck/build、格式、仓库政策及契约漂移检查通过。                                                    |
| 2026-09-21 | coding | Codex | —      | Task 6 完成：14 站目录新增完成模式，补齐包导出、生成类型、契约完整性校验与严格运行时读取；共享契约保持加法兼容。                                                                                                                             |
| 2026-09-21 | coding | Codex | —      | Task 7 完成：单柜/批量生命周期节点 API 接入节点完成摘要三轨；领域、仓储、服务与控制器回归覆盖权威 actual、跨目标投影、子里程碑排除、歧义保守留空和 ISO 输出，生命周期模块 80 个测试文件共 432 项及 API lint/typecheck/build 通过。           |
| 2026-09-21 | coding | Codex | —      | Task 8 完成：Web API 类型与节点视图模型承接三轨、阻断数量和不适用语义；契约字段缺失不静默兜底，Web 91 个测试文件共 259 项及 lint/typecheck/build 通过。                                                                                      |
| 2026-09-22 | coding | Codex | —      | Task 9 完成：14 站轨道改为水平可滚动按钮主轴，显式展示四态、摘要日期种类、空值与阻断数量；相关 3 个测试文件 15 项、Web 全量 92 个测试文件 264 项、lint/typecheck/build、格式和仓库政策检查通过。浏览器实例不可用，实机视觉验收并入 Task 11。 |
| 2026-09-22 | coding | Codex | —      | Task 10 完成：新增常驻节点三轨卡，覆盖有值、全空、不适用、阻断与未选择状态；组件 5 项测试及 Web 全量 93 个测试文件 269 项、lint/typecheck/build、格式和仓库政策检查通过。                                                                    |
| 2026-09-22 | coding | Codex | —      | Task 11 完成：一柜一档按业务判断顺序纵向组合柜头、标记/异常、14 站轨道、三轨详情、动态/助手和下一步；Web 完整门禁通过：93 个测试文件 273 项、E2E 77 项通过/7 项按既有条件跳过，以及 lint、format、typecheck、build 全绿。                    |
| 2026-09-22 | review | Codex | —      | 一期自动化收尾完成：契约漂移、API 全测、数据库集成、隔离迁移专项与根级 `validate` 全绿；保留默认 public 库既有缺 Outbox 测试夹具，未改数据。待两项真实业务数据人工确认后方可转 `done`。                                                      |
