---
status: coding # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/lifecycle-specialized-guards
verification:
  - "pnpm db:verify:lifecycle-date-facts：通过；验证旧库连续应用日期事实、来源权威/租约和逐目标节点应用迁移后事务回滚，以及临时空库完整迁移链；断言策略约束、租约字段、节点应用约束和索引。"
  - "pnpm validate：通过；包含仓库策略、契约漂移、格式、lint、类型、API/Web 全量测试、Playwright E2E 与全仓构建。"
  - "API 测试：123 个测试文件、573 项测试通过。"
  - "Web 测试：59 个测试文件、189 项测试通过。"
  - "Playwright E2E：50 项通过、7 项按既有条件跳过。"
  - "git diff --check：通过。"
  - "来源权威、pending 重放、日期/导入/Inbox 定向测试：10 个测试文件、42 项测试通过。"
  - "pnpm contract:check、pnpm contract:drift、API lint/typecheck：通过。"
  - "完成资格事件时间种类回归：record-lifecycle-date-fact.service.test.ts 12 项通过；公共目录门禁要求 planned/estimated/actual 三种能力。"
  - "生命周期模块定向测试：59 个测试文件、283 项测试通过；覆盖前序阻断、optional N/A、多目标逐步应用、幂等、密封和时间倒挂。"
  - "事实资格与绕行封堵定向测试：11 个测试文件、70 项测试通过；覆盖服务端事实回读、工单不过站、旧客户端/Inbox 拒绝、Outbox 事实上下文和 Prisma 映射。"
  - "规范事件事实上下文迁移：旧库事务回滚与临时空库完整迁移链均通过；断言四字段一致性、日期事实外键与 domainFactId 唯一索引。"
  - "云当网对象解析定向测试：3 个测试文件、16 项通过；API typecheck/lint 通过。"
  - "pnpm db:verify:ocean-provider-events：通过；真实 PostgreSQL 验证租户内唯一/歧义箱号解析、接入事务和生命周期隔离，临时空库完整迁移链验证对象解析列与约束。"
  - "本次 pnpm validate：repo/contract/drift/generate/lint/format/typecheck 与全量单测通过（API 124 文件/579 项、Web 59 文件/189 项）；Web E2E 首跑 49 通过、7 跳过、移动侧栏 1 项时序失败，因此整条命令记为失败。该失败用例单独复跑 1 项通过，pnpm build 随后通过；未把复跑写成整条 validate 通过。"
  - "2026-09-20 pnpm validate：通过；仓库政策、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试、Web E2E（50 通过、7 条件跳过）与构建全部完成。"
  - "2026-09-20 pnpm db:verify:lifecycle-date-facts：通过；旧版本升级改用隔离临时数据库构造目标迁移前历史，可重复验证事务回滚和空库完整迁移链，不再依赖开发库恰好停留在旧版本。"
  - "2026-09-20 pnpm db:verify:evidence-idempotency：通过；隔离临时数据库验证旧 Evidence 回填、非空/长度约束、租户级唯一键、跨租户同键及空库完整迁移链。"
  - "2026-09-20 云当网 Evidence/日期事实接入 pnpm validate：通过；仓库策略、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试（API 124 文件/583 项、Web 59 文件/189 项）、Playwright E2E（50 通过、7 条件跳过）与构建全部完成。"
  - "2026-09-20 blocked 节点守卫：生命周期模块定向测试 60 个文件/296 项通过；API lint、typecheck、build，pnpm docs:check 与 git diff --check 均通过。"
---

# 任务：全生命周期统一日期事实

## 目标

让 API、受控导入和人工录入通过同一日期事实用例更新货柜的计划、预计和实际时间。日期事实追加留痕；只有来源与证据核验通过的实际时间才能形成规范事件并申请推进生命周期。

## 权威入口

- [货柜生命周期时间线契约 V1](../../product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)：日期事实、时间种类、来源权威、版本和投影。
- [生命周期节点目录 V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)：14 节点、顺序、所有者与完成资格。
- [证据与来源权威契约 V1](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)：渠道不等于权威，实际事实必须核验证据和适用策略。
- [事件码目录 V1](../../product/domain/EVENT_CODES.md)：事件、允许时间种类和可完成节点。
- [节点日期投影别名目录 V1](../../product/domain/NODE_TIME_FIELDS.md)：14 节点计划/预计/实际的查询与界面别名，不作为物理列。

## 边界 / 不做

- 不在 `container_record` 增加一组可覆盖日期列；当前日期由追加式事实投影。
- 不让供应商、导入文件或人工表单直接写 `currentStatus`、节点状态或 `canonical_event`。
- 不把计划、ETA、推导时间或服务器提交时间冒充实际发生时间。
- 本任务不实例化未经批准的供应商来源权威策略；无策略的外部实际观察保留并进入复核。
- 最晚提柜日、最晚还箱日属于费用截止投影，不作为生命周期发生事实。

## 验收

- [x] API、导入和人工入口复用同一日期事实命令与目录校验。
- [x] 14 节点相关规范事件均按公共事件目录校验 `timeKind`，未知组合明确失败。
- [x] 同业务键同载荷幂等；异载荷冲突；新计划/预计追加版本并保留历史。
- [x] `planned` / `estimated` 只更新投影；`actual + verified + confirmed + effective` 才申请规范事件。
- [x] 未来节点实际事实可保存为待应用并在前序满足后幂等重放。
- [x] 人工入口要求能力、操作者、原因、证据和预期版本。
- [x] 迁移验证、契约检查和 `pnpm validate` 通过。

## 方案

1. 在公共契约中定义统一日期事实命令、结果状态和查询投影，事件/节点线值引用现有目录。
2. 在 `lifecycle-control` 增加追加式日期事实模型、Repository Port、统一 Application 用例和读模型。
3. 人工 HTTP 入口只负责解析身份与 DTO；API Adapter 和 `integration-import` 通过公开 Port 调用同一用例。
4. 实际事实先落账，再按幂等键申请规范事件；应用失败保留事实及明确状态，供重放或复核。
5. 收紧现有直接生命周期事件入口，禁止外部渠道绕过时间种类和来源权威裁决。

## 数据与恢复

采用追加迁移新增日期事实表和索引，并为既有 `shipment_time_fact` 追加可空的 `authority_system`；历史记录不回填、不猜测权威系统，新日期导入必须显式提供。Evidence 注册幂等键采用 expand/backfill/constraint：旧记录回填 `legacy:<evidenceId>`，再收紧非空、长度与租户级唯一约束。代码回退时保留新表和新增列不读；删除日期事实表会丢失日期审计历史，删除 Evidence 幂等键会丢失重试身份，都只能在确认无生产记录或完成备份恢复后执行。

## Review notes

- 已完成公共命令/结果契约、追加式数据库模型与迁移、统一 Application 用例、Prisma Repository、人工录入和当前投影查询。
- 已移除可绕过日期种类与来源权威裁决的外部 `POST /containers/:id/lifecycle-events`；内部模块仍通过正式 Port 申请生命周期事件。
- 人工实际日期与 API/导入使用同一运行时裁决；人工操作者不自动成为权威主体，未命中唯一策略时进入复核，客户端传入的策略引用不受信任。
- 来源权威运行时裁决器已实例化：策略版本化落库，按事件、对象、生效时间、租户、时间种类和可选业务范围选择唯一最具体策略；无策略进入复核，同等具体策略歧义标记配置错误，`system_derived` 不得证明 actual。调用方传入的 `authorityPolicyRef` 或旧 `authorityPolicyValidated` 均不授予权威。
- `pending_application` 已按 `occurredAt, projectionVersion, id` 稳定领取，使用短租约避免并发重复消费，并在生命周期事件成功或节点适用性变化后自动重放；409/412 与暂时性错误保留 pending，永久业务拒绝转 rejected，仍复用原 `date-fact:{factId}` 幂等键。
- 受控导入已在备货单/产品明细/原始时间事实的同一事务写入确定性 Inbox 消息；消费端复用统一日期事实用例，导入审核不授予来源权威。
- 负责人已确认 14 节点至少保留计划与实际槽，可靠来源下增加预计；子里程碑进入同一时间线，截止日期独立管理。目标投影目录已定稿，完成资格事件已开放 planned/estimated/actual，非 actual 仍不得申请过站。
- `ApplyLifecycleEvent` 已补齐节点前序和逐目标应用守卫：规范事件只接收一次，按 `(eventId,targetNodeInstanceId)` 记录 `pending_application / applied / rejected`；required 或适用的 optional 前序未完成时不得越站，`optional_not_applicable` 可跳过，前序时间晚于后序事件时明确冲突。多目标事件可在前序满足后用原幂等键继续应用，已完成目标不覆盖密封时间。
- `ApplyLifecycleEvent` 现在必须按 `domainFactId` 回读持久化事实；只有 `actual + verified + confirmed + effective + pending/applied` 且事实中的租户、货柜、事件、发生时间、证据和服务端采用策略全部一致才可继续。新规范事件强制持久化事实、节点、时间种类和策略上下文，并由数据库外键保证事实存在。
- 工单完成只记录工作结果，不再把装箱、出运或离港工单完成冒充 `stuffed/loaded/departed`；旧客户端操作缺少专业事实时落拒绝审计，旧 Inbox 直推进入业务拒绝，日期事实 Inbox 不受影响。
- Outbox 的载荷完整性哈希已包含 `domainFactId/nodeCode/timeKind/authorityPolicyRef`，防止事件发布时丢失服务端实际采用的事实与权威策略。
- 云当网供应商接入已贯通“原始载荷 → 唯一货柜解析 → 幂等 Evidence → 统一日期事实”：未知码或对象未唯一解析时不生成下游事实；Evidence 与日期事实分开保存 provider 和未解析权威主体，初始核验状态确保供应商事件只进入 `review_required`。重复 Inbox 会复用原记录继续未完成后处理，同键异内容明确冲突。下一步仍需补齐完整节点专项守卫（地点、航段、主体、阻断等）；当前通用顺序守卫已成立，但不能把它等同于全部 14 节点专项业务守卫，因此本任务保持 `coding`。
- 阻断守卫第一刀已封住两条路径：领域决策遇到 `blocked` 目标节点时保留 `pending_application`，Repository 在原子应用前再次发现并发阻断时返回 `LIFECYCLE_NODE_BLOCKED`，日期事实不会丢失且可后续重放。`BlockNode/ResolveNodeBlock` 的追加式持久化、来源事实校验和精确解除仍未实现，不能把本刀等同于完整阻断管理。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                 |
| ---------- | ------ | ----- | ------ | ---------------------------------------------------- |
| 2026-09-18 | coding | Codex | —      | 负责人确认三入口统一日期事实与实际时间过站规则       |
| 2026-09-18 | coding | Codex | —      | 完成核心事实链、人工入口、持久化与首组回归测试       |
| 2026-09-18 | coding | Codex | —      | 完成导入事务内 Inbox 投递与统一日期事实消费          |
| 2026-09-18 | coding | Codex | —      | 定稿 14 节点日期投影、子里程碑与截止日期边界         |
| 2026-09-18 | coding | Codex | —      | 扩展完成资格事件时间种类并增加公共契约门禁           |
| 2026-09-18 | coding | Codex | —      | 完成来源权威运行时裁决与 pending 租约自动重放        |
| 2026-09-18 | coding | Codex | —      | 完成节点前序与逐目标事件应用守卫                     |
| 2026-09-19 | coding | Codex | —      | 封堵非日期事实过站并固化规范事件事实上下文           |
| 2026-09-19 | coding | Codex | —      | 完成云当网租户内货柜对象解析与歧义留痕第一刀         |
| 2026-09-20 | coding | Codex | —      | 修复日期事实旧库升级验证的可重复执行性并完成合并门禁 |
| 2026-09-20 | coding | Codex | —      | 云当网候选接入 Evidence 并进入统一日期事实与复核链   |
| 2026-09-20 | coding | Codex | —      | 封堵 blocked 节点直接及并发过站路径                  |
