# 海关放行纵向切片实施设计

> 本稿是首个可执行纵向切片，不占用新的执行中任务槽位。
> 覆盖模块：`shipment-registry`、`lifecycle-control`、`work-execution`、`customs-compliance`。
> 主流程转换唯一服从[货柜生命周期状态机契约 V1](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)；本文中的候选转换描述不得覆盖公共状态机。

## 1. 目标与验收边界

以一个已登记货柜进入海关节点、完成一项或多项申报/查验工单、取得可验证的权威放行事实并进入提柜节点为闭环。切片必须同时交付数据结构、领域规则、应用用例、公共契约、API、操作台投影、测试和可观测性。

不在本切片内：完整 22 个运营环节配置、全部 14 节点自动化、供应商专属字段、费用结算、单证归档全量能力。本文中的具体 action/event/status 代码均为候选，只有在业务样本验证并合入权威契约后才可用于实现。

## 2. 端到端事实链

```text
ContainerRecord（货柜主任务）
  -> FlowInstance 到达海关节点
  -> 激活 Customs NodeTask（工序子任务）
  -> 创建一项或多项 WorkOrder（作业工单）
  -> 执行 ClientOperation，形成请求/受理/终态三阶段回执
  -> 保存结构化数据、原始证据、同步状态与审计记录
  -> 聚合 WorkOrder 结果，改变 NodeTask 状态
  -> 产出有来源、有证据、可去重的 canonical release event
  -> lifecycle-control 校验当前节点与转移守卫
  -> FlowInstance 进入提柜节点并激活下一 NodeTask
```

核心不变量：`WorkOrder` 和 `NodeTask` 不得直接修改 `FlowInstance`。只有通过来源、证据、时效、关联对象、幂等和公共状态机守卫校验的权威规范事件才能推进主链。外部放行事实可以先于内部工单到达；若流程当前位于清关节点，可先于工单完成推进；若流程仍在更早节点，则保存为待应用事实，不能越过缺失的主链实际事实。两种情况都不得伪造历史完成顺序。

## 3. 模块责任

| 模块                 | 拥有                                                                       | 不拥有                 | 本切片输出                         |
| -------------------- | -------------------------------------------------------------------------- | ---------------------- | ---------------------------------- |
| `shipment-registry`  | `ContainerRecord`、货柜身份、业务关联和查询入口                            | 流程、工单、海关裁决   | 稳定 `containerId` 与主任务摘要    |
| `lifecycle-control`  | `FlowInstance`、节点位置、转移守卫、生命周期历史                           | 工单执行、海关细节     | 海关节点激活、规范事件验真后的转移 |
| `work-execution`     | `NodeTask`、`WorkOrder`、分派、状态聚合、执行历史                          | 主流程位置、海关裁决   | 工序子任务及一至多项工单的执行闭环 |
| `customs-compliance` | 海关业务案卷、`ClientOperation`、申报/查验数据、回执、证据、规范化放行判断 | 主链状态、通用工单聚合 | 可审计的规范放行事件或明确拒绝     |

跨模块不共享可写表，不调用内部 Repository。同步查询走公开 Query Port；状态传播走事务 Outbox 事件。

## 4. 领域与数据结构

### 4.1 `shipment-registry`

| 对象                    | 关键字段                                                                  | 约束                                           |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `ContainerRecord`       | `container_id`, `container_number`, `shipment_id`, `tenant_id`, `version` | 租户内业务身份唯一；箱号格式边界校验；乐观并发 |
| `ContainerSummary` 投影 | 当前节点、任务摘要、异常标记                                              | 只读；来源模块和更新时间可追溯                 |

用例：创建/查找货柜、按稳定 ID 获取摘要。重复导入以业务幂等键返回既有对象；冲突字段明确失败，不静默覆盖。

### 4.2 `lifecycle-control`

| 对象                     | 关键字段                                                                                          | 约束                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `FlowInstance`           | `flow_instance_id`, `container_id`, `flow_definition_version`, `current_node`, `state`, `version` | 一个有效主流程对应一个货柜；定义版本固定 |
| `FlowTransition`         | `from_node`, `to_node`, `canonical_event_id`, `occurred_at`, `recorded_at`                        | `canonical_event_id` 唯一；历史仅追加    |
| `ConsumedLifecycleEvent` | `message_id`, `business_key`, `payload_hash`                                                      | 重放同结果；同键异载荷拒绝并告警         |

守卫：事件对象必须匹配货柜与流程；当前节点允许该事件；证据与来源达到规则要求；事件未被消费；并发版本正确。失败不移动节点。

### 4.3 `work-execution`

| 对象                   | 关键字段                                                                                  | 约束                                          |
| ---------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| `NodeTask`             | `node_task_id`, `flow_instance_id`, `node_code`, `state`, `aggregation_policy`, `version` | 同一流程/节点/激活轮次唯一                    |
| `WorkOrder`            | `work_order_id`, `node_task_id`, `work_type`, `state`, `assignee`, `due_at`, `version`    | 必须属于一个 NodeTask；终态不可被普通命令改写 |
| `WorkOrderEvidenceRef` | `work_order_id`, `evidence_id`, `evidence_type`                                           | 仅保存跨模块稳定引用，不复制证据正文          |

NodeTask、WorkOrder 的正式状态线值、合法转换和外部事实直接满足规则统一引用[任务与工单契约 V1](./TASK_WORK_ORDER_CONTRACT_V1.md)，本切片不保留候选状态集合。

聚合策略必须显式存储：`all_required_completed`、`required_subset_completed` 或经评审的其他策略。工单完成只触发 NodeTask 重新聚合；NodeTask 完成只发布“作业完成事实”，不直接发布生命周期转移。

### 4.4 `customs-compliance`

| 对象               | 关键字段                                                                                      | 约束                                        |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `CustomsCase`      | `customs_case_id`, `container_id`, `jurisdiction`, `declaration_ref`, `case_state`, `version` | 管辖区与申报引用组合唯一规则需样本确认      |
| `ClientOperation`  | `operation_id`, `customs_case_id`, `action_type`, `idempotency_key`, `state`, `attempt_no`    | 租户/动作范围内幂等；请求内容哈希防止键复用 |
| `OperationReceipt` | `operation_id`, `stage`, `external_ref`, `received_at`, `payload_hash`, `evidence_id`         | 请求、受理、终态阶段仅追加；重复回执去重    |
| `CustomsEvidence`  | `evidence_id`, `source`, `captured_at`, `content_hash`, `retention_class`                     | 原始内容不可变；敏感字段受访问策略保护      |
| `SyncRecord`       | `operation_id`, `target`, `sync_state`, `attempt_count`, `next_attempt_at`, `last_error_code` | 同步状态不等于业务裁决状态                  |

三类状态严格分离：业务案卷/裁决状态、操作请求状态、数据同步状态。网络发送成功不能代表海关受理或放行；终态回执必须经规范化和证据规则校验后才能生成规范事件。

## 5. 命令、查询与事件

| 类型    | 候选名称                      | 所有者                       | 关键行为                                 |
| ------- | ----------------------------- | ---------------------------- | ---------------------------------------- |
| Command | `ActivateNodeTask`            | work-execution               | 对同一流程节点激活幂等                   |
| Command | `CreateCustomsWorkOrder`      | work-execution               | 创建申报/查验/补录工单                   |
| Command | `ExecuteCustomsOperation`     | customs-compliance           | 校验权限、数据、幂等键后调用 Port        |
| Command | `RecordCustomsReceipt`        | customs-compliance           | 保存回执与证据，更新操作但不混淆同步状态 |
| Command | `ReconcileExternalRelease`    | customs-compliance           | 外部事实先到时建立关联与补录任务         |
| Query   | `GetContainerOperationalView` | shipment-registry projection | 汇总货柜、流程、任务、工单和同步摘要     |
| Event   | `LifecycleNodeActivated`      | lifecycle-control            | 驱动 NodeTask 激活                       |
| Event   | `NodeTaskOutcomeRecorded`     | work-execution               | 表达工序聚合结果，不直接推进流程         |
| Event   | `CustomsReleaseCanonicalized` | customs-compliance           | 带来源、证据、对象、发生时间和业务幂等键 |
| Event   | `LifecycleTransitioned`       | lifecycle-control            | 记录主链已转移，并激活下一节点           |

所有名称均为设计候选。实现前在公共契约权威位置确定 schema、枚举、版本、必填字段和兼容规则，并同步 OpenAPI、JSON Schema、TypeScript/Python 类型及生成客户端（如项目实际存在）。

## 6. 事务、Outbox 与异常顺序

每个模块只在本地事务内修改自身聚合，并在同一事务写 Outbox。消费者先登记消息幂等事实，再执行业务变更；同一业务键但内容哈希不同必须进入冲突队列。

| 场景                     | 处理结果                                                |
| ------------------------ | ------------------------------------------------------- |
| 工单先完成，尚无海关放行 | NodeTask 可完成；主流程停留海关节点                     |
| 放行先到，内部工单未完成 | 验真后主流程前进；创建/标记对账任务                     |
| 重复终态回执             | 返回既有结果，不重复事件和转移                          |
| 旧回执晚到               | 保存历史并标记乱序；不得回退较新裁决                    |
| 同键异载荷               | 拒绝、告警、人工处理                                    |
| 生命周期并发转移         | 一方成功；另一方收到稳定冲突码并重读                    |
| 下游暂不可用             | Outbox 重试；超过阈值进死信并告警，不回滚已提交领域事实 |

## 7. API 草案

| Method/Path                                       | 用例                 | 权限         | 幂等/并发                    |
| ------------------------------------------------- | -------------------- | ------------ | ---------------------------- |
| `GET /containers/{containerId}/operations`        | 获取操作台聚合视图   | 货柜读取策略 | 稳定 ETag/更新时间           |
| `POST /node-tasks/{nodeTaskId}/work-orders`       | 创建海关工单         | 工序主管     | `Idempotency-Key` + 请求哈希 |
| `POST /customs-cases/{caseId}/operations`         | 发起客户操作         | 海关操作员   | `Idempotency-Key` + 聚合版本 |
| `POST /customs-operations/{operationId}/receipts` | Adapter 写入阶段回执 | 服务身份     | 外部引用/阶段/载荷哈希去重   |
| `POST /customs-cases/{caseId}/reconciliations`    | 人工对账             | 对账权限     | 幂等键 + 审计原因            |

所有请求使用 schema 边界校验。写接口服务端授权；冲突返回稳定错误码和最新版本；错误体带 `traceId`。回执入口不得直接公开给浏览器，并应验证来源身份、签名/渠道与重放窗口。

## 8. 前端操作台

主路由候选：`/operations/containers/{containerId}`。页面是一个工作界面，不复制四个模块各做一套页面。

| 区域       | 内容                                       | 动作与状态                                   |
| ---------- | ------------------------------------------ | -------------------------------------------- |
| 主链条     | 14 节点当前位置、已完成历史、阻塞/对账标记 | 点击节点查看事实与证据；状态由服务端投影提供 |
| 当前工序   | NodeTask、聚合规则、负责人、时限           | 服务端返回允许动作；显示冲突后的刷新入口     |
| 工单列表   | 类型、状态、负责人、截止时间、证据         | 创建、领取、执行、重试；权限不足只读         |
| 海关操作   | 请求、受理、终态回执时间线                 | 发起操作、查看外部引用、失败重试             |
| 数据与证据 | 字段来源、更新时间、证据摘要               | 敏感内容按权限遮蔽；原始证据审计访问         |
| 同步与异常 | 独立同步状态、重试次数、最后错误           | 不用“同步成功”替代“业务放行”                 |
| 审计栏     | 谁在何时基于什么事实执行何动作             | 可按 traceId、operationId、eventId 追踪      |

必须实现加载、空数据、部分数据、无权限、校验失败、乐观冲突、外部等待、重试中、死信/需人工处理和完成状态。前端动作完成后依据服务端返回和投影刷新，不在浏览器推演下一生命周期状态。

## 9. 测试与验收样本

### 9.1 必测矩阵

- Domain：非法节点事件拒绝；非权威/无证据放行拒绝；工单聚合策略；终态不可逆；外部事实先到。
- Application：权限、事务、幂等键复用、乐观并发、Outbox 原子性。
- Database：唯一约束、外键/稳定引用、版本冲突、回执仅追加、空库和旧版本迁移。
- Contract/API：schema、错误码、认证授权、分页/稳定排序、重复与同键异载荷。
- Integration：Adapter 超时、重试、乱序、重复、死信、重放和人工对账。
- UI/E2E：正常闭环、等待外部、放行先到、操作失败重试、权限只读、并发冲突刷新。

### 9.2 最小验收样本

1. 正常：货柜位于海关节点，两项必需工单完成，终态放行回执经验证，主链只转移一次至提柜节点。
2. 未放行：所有内部工单完成但无权威放行事件，主链仍停留海关节点。
3. 外部先到：先收到有效放行事实，主链前进，系统创建对账/补录任务且保留真实时间顺序。
4. 重复：同一回执与事件重放多次，只保留一个业务结果和一次生命周期转移。
5. 冲突：同一幂等键提交不同载荷，系统拒绝并产生安全审计与告警。
6. 并发：两个有效候选事件同时尝试转移，只有一个提交，另一个返回可恢复冲突。
7. 乱序：旧的非放行回执晚到，不回退已经完成的放行裁决和主流程。
8. 同步失败：外部同步失败被重试/告警，但已确认的业务事实不被错误改写。

每个样本在进入 `ready` 前补齐真实脱敏输入、预期 JSON、证据等级、Actor、时间和权威事件代码。

## 10. 可观测性与安全

统一关联键：`traceId`, `tenantId`, `containerId`, `flowInstanceId`, `nodeTaskId`, `workOrderId`, `operationId`, `canonicalEventId`。指标至少包括节点停留时长、工单超时率、操作受理/终态延迟、同步失败率、重复消息率、事件冲突率和对账积压。

原始回执和证据按数据分类控制访问与保留；日志只记录引用和脱敏摘要。人工覆盖必须要求原因、权限、双人复核规则（若业务确认需要）并写不可变审计。外部调用必须具备超时、重试上限、熔断/隔离和死信处理。

## 11. 实施顺序

1. 用脱敏真实样本确认海关动作、裁决、证据等级和节点转移语义。
2. 在唯一公共契约位置定稿状态、命令、事件、DTO、错误码及版本策略。
3. 追加数据库迁移并完成空库/旧库升级测试。
4. 依次实现四模块 Domain 与 Application，用 Port/Adapter 连接模块和外部渠道。
5. 实现 API 与操作台投影，再实现前端工作界面和权限状态。
6. 完成集成、E2E、重放、并发、迁移、可观测性与运行手册验收。

每一步拆成独立任务；在当前 `review` 任务结束前，本稿保持 `design`。只有业务样本、权威契约、迁移方案、权限矩阵和上述八个验收样本完成评审后，才能升级为 `ready`。

## 12. 完成定义

- 四个模块的数据所有权和依赖方向未被破坏；
- 主流程只能被合格规范事件推进，工单/子任务无直接写通道；
- 流程、任务、工单、操作/同步状态在数据、API 和 UI 中明确分离；
- 外部事实先到、重复、乱序、并发和失败重试均有可验证行为；
- 公共契约唯一，跨语言/生成客户端无漂移；
- API 服务端授权、幂等、并发、错误码、追踪和审计通过测试；
- 前端可见状态与服务端事实一致，关键操作 E2E 通过；
- 文档、迁移、监控、告警、对账和恢复方案齐备。
