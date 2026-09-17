# 身份与访问模型 V1

> 状态：**正式 V1（P2-05 最小实施基线）** · 2026-09-17 · 所有者：权限治理负责人
> 消费者：P5-02 OIDC/授权实现、各 Application 用例、API、Web 允许动作投影和审计。
> 边界：本文定义身份、角色、能力和数据范围；动作风险、复核及固定授权协议仍以 [GC-008](./ACTION_PERMISSION_CONTRACT_V1.md) 为唯一权威。

## 1. 核心规则

1. 角色只是能力包，服务端授权比较稳定 `capabilityCode`，不得只比较中文角色名或前端菜单。
2. 每次访问至少同时满足：已认证、租户成员、所需能力、数据范围、对象父链、业务守卫；任一不满足即拒绝。
3. `tenantId`、`actorId`、角色和能力从已验证 Token/服务身份解析，禁止信任请求体、查询参数或开发身份头。
4. 查询必须从 Repository 起就带租户范围；写入还须在 Application 层重新验证对象和动作。
5. AI、Worker、Integration 与定时任务使用独立服务身份，不模拟用户、不继承浏览器会话。
6. Web 的路由、按钮和 `allowedActions` 只优化体验，不是安全边界。

🗣️ 白话：角色像“岗位套餐”，能力是套餐里的具体钥匙，范围说明这把钥匙能开哪几扇门。三样缺一个都不能操作。

## 2. 身份与授权上下文

| 字段                  | 规则                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `actorType`           | `user / service / integration / scheduled_job`，不可互相冒充        |
| `actorId`             | IdP subject 或稳定工作负载 ID；显示名变化不改变审计身份             |
| `tenantId`            | 当前租户必须来自 Token 中已验证的成员关系；切换租户要重新取得上下文 |
| `roles[]`             | IdP 组到应用角色的显式映射结果；未知角色不授予能力                  |
| `capabilities[]`      | 角色、临时委托和策略计算后的稳定能力码集合                          |
| `organizationScope[]` | 空集合不表示全部；必须配合显式 `scopeMode`                          |
| `locationScope[]`     | 港口、仓库组、仓库等受控地点 ID，不使用自由文本名称                 |
| `delegatedBy`         | 临时委托必须记录授权人、原因、能力、范围和到期时间                  |
| `policyVersion`       | 授权决定所用策略版本，进入审计记录                                  |
| `traceId`             | 串联认证、授权、业务写入、Outbox/Inbox 和审计                       |

`AuthorizationContextV1` 的公共字段形状继续引用 `GC-008`，P5-02 只能增加内部校验信息，不能创建另一套同名上下文。

## 3. 最小角色目录

| roleCode                | 中文名        | 主要职责                                             | 默认数据范围                            |
| ----------------------- | ------------- | ---------------------------------------------------- | --------------------------------------- |
| `field_operator`        | 现场作业员工  | 领取并完成本人/班组任务，提交现场证据                | tenant + assigned/organization/location |
| `operations_dispatcher` | 运营调度      | 查看货柜、派发与协调任务、合法推进业务动作、起草计划 | tenant + organization/location          |
| `import_operator`       | 导入操作员    | 上传、确认映射、预检、执行并查看对账                 | tenant + owned/import scope             |
| `review_supervisor`     | 审核主管      | 证据裁决、高风险复核、异常恢复和补偿处置             | tenant + designated review scope        |
| `finance_controller`    | 财务管控      | 查看费用并维护经授权的费率/结算规则                  | tenant + organization/location          |
| `manager`               | 管理者        | 查看租户内运营、计划、费用、风险与绩效投影           | tenant read-only                        |
| `business_admin`        | 业务管理员    | 管理主数据、角色映射、阈值和授权配置                 | tenant administration scope             |
| `audit_analyst`         | 数据分析/合规 | 查询对账、操作、证据与审计，不执行业务写入           | tenant read/audit scope                 |

- 一名用户可有多个角色，最终能力取并集，但数据范围取每项授权明确允许的并集，不能把“某角色全租户”错误扩散给其他能力。
- `business_admin` 不是超级管理员，不自动获得业务执行、证据裁决、费用核销或跨租户权限。
- 平台级运维身份不属于业务角色；其紧急访问使用 break-glass，短期授权并强制告警、复核和失效。

## 4. 最小能力目录

| capabilityCode        | 允许的能力边界                                | 不自动包含                     |
| --------------------- | --------------------------------------------- | ------------------------------ |
| `container.read`      | 按范围读取货柜及其投影                        | 修改状态、读取原文件           |
| `task.read`           | 按范围读取节点任务和工单                      | 领取或完成                     |
| `task.execute`        | 领取/完成授权范围内的工单                     | 越过证据、状态机或并发守卫     |
| `evidence.read`       | 读取授权对象的证据元数据                      | 下载原件、核验                 |
| `evidence.submit`     | 登记证据或补充引用                            | 自行核验                       |
| `evidence.review`     | verify/reject/revoke；按风险执行职责分离      | 修改历史证据                   |
| `import.read`         | 查看批次、预检和对账                          | 读取对象存储内部键             |
| `import.operate`      | 上传、确认映射、运行预检                      | 绕过 blocker、直接写业务表     |
| `import.execute`      | 执行已确认且预检通过的批次                    | 修改已执行批次或伪造来源       |
| `lifecycle.read`      | 读取节点、事件和当前投影                      | 推进状态                       |
| `lifecycle.operate`   | 申请合法事件、设置适用性等受控动作            | 直接改 `currentStatus`         |
| `planning.read`       | 查看计划、容量与截止日                        | 占用资源                       |
| `planning.draft`      | 生成或修改未确认计划草稿                      | 确认、占用或取消已执行计划     |
| `charges.read`        | 查看费用标准、预计、应计和对账投影            | 改标准或确认账单               |
| `charges.manage`      | 维护授权范围的标准并触发确定性重算            | 审核付款或越过币种/生效期规则  |
| `reliability.read`    | 查看 ClientOperation、死信、补偿与同步状态    | 重放或补偿                     |
| `reliability.recover` | 重放死信、申请/推进补偿；按风险要求原因和复核 | 修改原消息、原操作或原死信     |
| `identity.manage`     | 管理租户内角色映射、委托和范围                | 给自己提权、跨租户或平台级授权 |
| `audit.read`          | 读取脱敏审计、授权决定和对账记录              | 查看秘密、Token 或无关证据正文 |

能力码是访问控制稳定键，不是 `actionCode`。一个动作可要求多个能力；动作、目标类型、风险和业务前置由 `GC-008 ActionDefinitionV1` 绑定。

## 5. 角色能力矩阵

`R`=读取，`W`=执行/写入，`A`=管理或复核；空白=默认拒绝。

| 角色                    | 货柜/任务             | 证据        | 导入                               | 生命周期                   | 计划       | 费用        | 可靠性/审计          | 身份管理 |
| ----------------------- | --------------------- | ----------- | ---------------------------------- | -------------------------- | ---------- | ----------- | -------------------- | -------- |
| `field_operator`        | container R, task R/W | read/submit |                                    | read                       |            |             |                      |          |
| `operations_dispatcher` | container R, task R/W | read/submit | read                               | read/operate               | read/draft | read        | read                 |          |
| `import_operator`       | container R           |             | read/operate/execute               |                            |            |             |                      |          |
| `review_supervisor`     | container R, task R   | read/review | read；高风险例外复核由动作策略要求 | read；高风险动作按策略复核 | read       | read        | read/recover；审计 R |          |
| `finance_controller`    | container R           | read        |                                    | read                       | read       | read/manage | 审计 R               |          |
| `manager`               | container R, task R   | read        | read                               | read                       | read       | read        | read；审计 R         |          |
| `business_admin`        | container R           |             | read                               | read                       | read       | read        | read；审计 R         | manage   |
| `audit_analyst`         | container R, task R   | read        | read                               | read                       | read       | read        | read；审计 R         |          |

具体动作若要求 four-eyes，拥有业务能力的发起人也不能自批；职责分离优先于角色能力并集。

## 6. 数据范围模型

| scopeMode      | 判断规则                                                        |
| -------------- | --------------------------------------------------------------- |
| `tenant`       | 仅租户全域；只允许明确授予，不从空组织/地点集合推断             |
| `organization` | 对象的 organizationId 必须在授权集合；跨组织共享需显式关系      |
| `location`     | 对象关联港口/仓库组/仓库等受控 ID 至少一个命中动作定义要求      |
| `assigned`     | actor 是任务受让人，或属于受让班组；不能仅凭同租户操作          |
| `owned`        | actor 创建的批次/草稿；转交后按新授权关系决定，不依赖可变显示名 |
| `designated`   | actor 被指定为该对象/风险级别的复核人，且不是受限动作的发起人   |

- 对象没有所需范围字段时失败关闭，不能用 tenant 兜底扩大权限。
- 列表、计数、导出和搜索必须使用同一范围谓词，防止总数或错误信息侧漏。
- 跨租户平台操作必须使用独立平台身份和显式用例，不给普通角色 `tenant=*`。

## 7. 固定授权决策

```text
验证 Token / 工作负载身份
-> 建立 actor + tenant membership
-> 解析 role -> capability（未知值拒绝）
-> 加载 actionDefinition.requiredCapabilities
-> 用 tenant + organization/location/assigned/owned/designated 查询目标
-> 检查委托、职责分离、审批和策略版本
-> 检查状态机、证据、人工锁、密封、幂等和 expectedVersion
-> Application 事务写业务结果 + 授权审计 + Outbox
```

拒绝应使用 `GC-011` 稳定错误码和 traceId。对外响应不得泄露“对象存在但属于其他租户”等可枚举信息；内部审计仍记录真实拒绝原因。

## 8. 服务身份

| 服务身份用途             | 最小能力                                 | 禁止事项                          |
| ------------------------ | ---------------------------------------- | --------------------------------- |
| business worker          | 领取/执行明确 Activity；调用指定内部端点 | 扫描全部租户、模拟用户            |
| inbox integration        | 接收指定来源和租户的消息                 | 任意提交业务动作                  |
| outbox publisher         | 发布已领取消息并回写结果                 | 创建或修改业务事件正文            |
| scheduled job            | 触发指定租户或系统级调度用例             | 携带长期用户 Token                |
| AI gateway/tool executor | 调用注册模型/Tool；透传原授权上下文      | 自授能力、保存用户 Token、执行 L4 |

P5-03 为每个身份建立独立 client、audience、凭据轮换和调用白名单；共享万能服务密钥禁止进入生产。

## 9. P5-02 实施验收

1. 生产配置下开发身份头无效，JWT 缺失或无效统一拒绝。
2. 所有非公开路由默认经过认证；所有写路由有能力与对象范围策略注册。
3. 用户在租户、组织、地点、assigned/owned/designated 六类边界上有正反向测试。
4. 角色变化、撤权、委托到期和策略版本变化不会被长期缓存放行。
5. 前端伪造角色、能力、tenant、actor 或 `allowedActions` 不改变服务端决策。
6. 授权审计包含 actor、tenant、capability、scope、action、target、policyVersion、结果和 traceId，不包含 Token。

## 10. 待绑定事项

- 具体员工与 IdP 组映射在 P5-02 配置，不进入本文。
- 组织、地点和班组主数据由 P2-04/P5-02 选择稳定 ID 后绑定。
- 计划确认、资源占用、付款和其他尚未实现的高风险动作，在其 ActionDefinition 定稿时补能力要求与职责分离，不提前赋权。
