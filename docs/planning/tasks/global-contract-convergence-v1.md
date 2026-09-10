---
status: coding # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/global-contract-convergence-v1
verification: 待执行；每阶段先 docs:check / contract parity，最终执行 pnpm validate
---

# 任务：全局公共契约收敛 V1

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准；同一时刻仅一个进行中任务。各阶段只有达到对应证据门禁后才能升格，文档定稿不等于运行时实现完成。

## 目标

将货柜生命周期跨模块语义收敛为一组有唯一权威入口、可评审、可生成、可验证的 V1 公共契约，并从单一 JSON Schema 源派生 TypeScript、OpenAPI、Python 和数据库显式映射，防止状态、事件、DTO、错误码和持久化语义漂移。

## 权威入口

- [全局公共契约登记表](../../product/domain/GLOBAL_CONTRACT_REGISTRY.md)
- [货柜生命周期状态机契约 V1](../../product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)
- [货柜生命周期时间线契约 V1](../../product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)
- [模块化单体 ADR-010](../../architecture/decisions/ADR-010-bounded-context-modules.md)
- `AGENTS.md` 与 `ENGINEERING_RULES.md`

## 已批准业务口径

1. `sailing` 仅表示海运进行中，不完成海运节点。
2. `transit_arrived` 可申请完成 `ocean_transit`。
3. `arrived` 可申请完成 `ocean_transit` 和 `destination_arrival`。
4. `delivered` 凭 POD 或签收证据可申请完成 `warehouse_delivery`。
5. `warehouse_arrival` 凭仓库、WMS 或门岗权威证据可申请完成 `warehouse_delivery`。
6. 保留 `completionEligibleNodeCodes`；事件接收按 `eventId` 幂等，节点事实应用按 `(eventId, nodeInstanceId)` 幂等。

## 兼容性与影响范围

- 变更分类：行为变更并包含后续公共边界实例化；进入运行时代码前必须明确版本和兼容策略。
- 影响消费者：生命周期、任务工单、海关、船期、港口、拖卡、仓库、外部 Adapter、API、Web 查询投影、审计和数据库。
- 依赖方向保持 `UI / Transport -> Application -> Domain <- Infrastructure`。
- 外部供应商值只停留在 Adapter，经复合映射进入内部规范事件；数据库实体、API DTO 和领域对象显式映射。
- 当前仓库已有用户文档改动必须保留，不得格式化或回退无关文件。

## 串行阶段

### P1 节点与事件目录正式 V1

- [x] 将 14 节点稳定代码、顺序、可选性、模块归属和完成口径收敛到唯一节点目录 V1。
- [x] 将规范事件名称、版本、节点资格、幂等和兼容规则收敛到唯一事件目录 V1。
- [x] 状态机、时间线和 14 节点事件矩阵完成反向一致性校验。
- [x] 登记表 `GC-001`、`GC-003` 更新为有证据支持的真实门禁。

### P2 任务与工单契约 V1

- [x] 定稿节点任务、子任务、工单、作业事实和聚合边界。
- [x] 定稿任务与工单状态机、创建/领取/执行/阻断/完成/取消/重开规则。
- [x] 定稿“一或多个工单如何聚合推进子任务、节点如何消费子任务完成事实”。
- [x] 外部权威证据更新与内部后补录采用同一事实应用语义，同时保留来源、授权和审计差异。

### P3 证据与来源权威契约 V1

- [ ] 定稿证据等级、来源资格、验证、冲突、撤销、人工锁和历史密封。
- [ ] 定稿外部、系统计算、人工录入和导入的裁决顺序及置信状态。
- [ ] 未知供应商值明确失败或进入复核队列，不使用静默默认值。

### P4 跨模块引用、动作权限与同步可靠性 V1

- [ ] 定稿货柜、流程、节点实例、任务、工单、专业事实、证据、操作和回执 ID 关系。
- [ ] 定稿角色、动作、业务前置条件、服务端授权、复核、撤销和补录边界。
- [ ] 定稿三阶段回执、幂等、并发冲突、超时、重试、死信、补偿、Inbox/Outbox 和审计。

### P5 查询投影与公共错误 V1

- [ ] 定稿当前节点、流程/任务/工单/同步状态、关键时间、时间线、证据和允许动作读模型。
- [ ] 列表定义分页、最大页大小、稳定排序、字段授权和时区展示。
- [ ] 定稿稳定错误码、追踪 ID、HTTP 映射、重试性、冲突类型和兼容策略。

### P6 JSON Schema 权威源

- [ ] 明确 Schema 包位置、版本策略、命名规则和 `$id`。
- [ ] 以 JSON Schema 表达公共 ID、枚举、事件信封、DTO、错误及约束；禁止手工维护平行枚举。
- [ ] 提供成功、拒绝、边界、重复、乱序、更正、撤销和冲突 fixtures。
- [ ] 建立 Schema 自校验、引用完整性和破坏性变更检查。

### P7 生成器与技术载体实现

- [ ] 从同一 Schema 源生成 TypeScript 类型及运行时边界校验。
- [ ] 生成或组装 OpenAPI，并验证所有公共请求、响应和错误引用同一组件。
- [ ] 生成 Python 模型及验证器。
- [ ] 建立数据库实体与公共契约的显式映射；迁移只进入 `database/migrations/`。
- [ ] 建立生成漂移检查、跨语言 fixture 对拍、API 契约测试、数据库约束与迁移测试。

## 阶段门禁

每个阶段依次满足：领域语义无候选歧义、权威入口唯一、消费者清单完整、兼容性明确、文档检查通过。P6 完成只表示 Schema 权威源建立；只有 P7 的生成产物、映射、迁移和测试实际存在并通过，相关契约才能进入实现或验证门禁。

## 不做

- 不新增微服务，不改变已批准的模块化单体与限界上下文边界。
- 不让供应商 DTO、数据库实体或前端演示类型成为公共领域契约。
- 不在多个语言中手工复制枚举、事件或错误码。
- 不在业务负责人未批准候选语义时将其写入生产 Schema。
- 不修改已进入共享环境的历史迁移。

## 验证计划

1. 每个文档阶段运行 `node scripts/check-repository.mjs --docs-only` 与 `git diff --check`。
2. Schema 阶段运行 Schema 方言校验、引用检查、fixture 校验和兼容性检查。
3. 生成阶段运行生成漂移检查、TypeScript 类型检查、Python 测试、OpenAPI 校验、数据库集成及迁移升级测试。
4. 最终运行仓库已配置的 `pnpm validate`；环境不能执行的门禁必须明确记录，不得用旧结果冒充。

## 进度 log

| 日期 | 阶段 | 负责 | commit | 说明 |
| --- | --- | --- | --- | --- |
| 2026-09-09 | coding | Codex | — | 负责人批准前序 KPI/RACI 任务并指令启动；建立七阶段串行任务，P6/P7 分离验收。 |
| 2026-09-09 | coding | Codex | — | P1 完成：节点目录与事件目录升格为正式 V1；状态机、时间线和完成资格矩阵反向校验一致，等待文档门禁结果。 |
| 2026-09-09 | coding | Codex | — | P1 验证：docs-only 与 diff check 通过；节点 14/14 唯一，完成资格目标覆盖 14 个节点且未知引用为 0；敏感信息扫描无匹配。 |
| 2026-09-10 | coding | Codex | — | P2 定稿：建立任务与工单契约 V1，统一状态、转换、聚合、事实应用和生命周期结果边界；等待文档一致性验证。 |
