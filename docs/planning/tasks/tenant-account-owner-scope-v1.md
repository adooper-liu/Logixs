---
status: blocked
branch: feat/tenant-account-owner-scope-v1
verification: not-run（业务定案与技术设计已写回；当前不实施 Schema、API 或 Web）
owner: claude
---

# 任务：集团租户、账套主体与用户范围 V1

## 目标

在一个集团租户下建立多个账套主体，让用户和用户组通过角色与明确范围访问对应主体。首版必须让业务管理员能够维护主体成员与授权，让用户选择已授权的当前主体，并让服务端可靠验证和审计该上下文。

本任务只完成身份、组织和授权范围底座；它不把任一工作台、业务对象或完整权限平台冒充完成。

## 当前状态与解阻条件

当前 `authz-default-deny-v1` 是唯一 `coding` 任务，本任务保持 `blocked`。满足以下条件后才能改为 `coding`：

1. 当前授权默认拒绝任务形成最终 PR 候选或由 Codex 明确释放唯一编码槽位。
2. 本 brief 的公共契约、组织所有权、迁移与兼容策略经过 Claude 或等价独立安全上下文复审，Codex 完成 finding 处置。
3. Cursor 收到包含准确 base SHA 的单行 `TASK` 指令；不得根据本文件自行启动实现。

## 权威来源

- 业务语义：[核心对象关系](../../../doc/cross-border-supply-chain/02-upstream-core-business-objects.md)“集团、账套主体与国家角色”。
- 已确认决定：[备货前业务域确认基线](../../../doc/cross-border-supply-chain/17-confirmed-upstream-business-baseline.md)“第三批”。
- 身份与范围：[IDENTITY_ACCESS_MODEL_V1](../../product/domain/IDENTITY_ACCESS_MODEL_V1.md) V1.1。
- 主体、国家与伙伴身份：[MASTER_DATA_DICTIONARY](../../product/domain/MASTER_DATA_DICTIONARY.md) v0.2。
- 动作授权与审计：[ACTION_PERMISSION_CONTRACT_V1](../../product/domain/ACTION_PERMISSION_CONTRACT_V1.md)。
- 国家参考数据：[COUNTRY_PORT_REFERENCE_DATA_V1](../../product/domain/COUNTRY_PORT_REFERENCE_DATA_V1.md)。

## 当前物理事实

1. `AuthenticatedUserIdentity` 当前只有 `actorId`、`tenantId`、认证方式、角色和能力；没有当前账套主体、组织或地点范围。
2. `AuthorizationContextV1` JSON Schema 已有 `organizationScope[]` 和 `locationScope[]`，但当前 OIDC/session 和 Application 消费链尚未完整承载这些范围。
3. Prisma 当前有版本化 `CountryCodeReference` 和内部货主到销售国家的 `CargoOwnerReference`。
4. Prisma 当前没有正式的 User、UserGroup、OrganizationUnit、LegalEntity、AccountOwnerProfile、成员关系或角色范围模型。
5. `CargoOwnerReference` 表达货主/内部分公司与销售国家的受控映射，不是账套主体，也不能直接升级为用户权限范围。

## 已定业务规则

1. 一个集团原则上一个 Tenant；多国公司通过同租户下多个账套主体表达。
2. 账套主体拥有稳定身份，注册国家只是属性；同国多个主体必须能独立授权。
3. 用户可以属于多个账套主体；用户组只用于人员分组和授权分配，不能冒充组织或公司。
4. 角色回答“能做什么”；账套主体、组织、地点、assigned/owned/designated 回答“可以对哪些对象做”。
5. 账套主体、货主、销售国、目的国、进出口国、原产国和制造国分轨保存，禁止相互推导。
6. 界面显示当前账套主体及注册国家；服务端验证选择值，浏览器不能自授范围。
7. 首版不建设总账、科目、凭证、结账或合并报表。

## 边界 / 不做

- 不修改当前 `authz-default-deny-v1` 的 B2F1R、Guard 或错误映射切片。
- 不按国家创建 Tenant，不给 User/UserGroup 增加可直接授权的自由文本 `country`。
- 不把 `CargoOwnerReference`、销售国家或目的国家当作账套主体。
- 不保存本地密码或复制 IdP 凭据；用户身份仍以稳定 issuer + subject 为外部身份来源。
- 不一次穷举未来角色，不建设无消费者的策略语言、低代码权限平台或完整 IAM 管理套件。
- 不在没有业务映射依据时给全部历史对象猜测 `accountOwnerId`；未映射对象进入待确认/只读兼容状态。
- 不在本任务内给 20 台工作台批量加主体字段。各台在自身“三体一面”切片中映射实际对象归属并验收。

## 逻辑模型基线

```text
Tenant
└── OrganizationUnit
    ├── parentOrganizationUnitId?
    ├── organizationType = group | region | account_owner | department | team
    └── AccountOwnerProfile?（仅 account_owner）
        ├── legalEntityId / approvedBranchId
        ├── registeredCountryId
        ├── baseCurrencyId
        ├── defaultTimeZoneId
        └── status + version

ExternalUserIdentity（issuer + subject）
└── TenantMembership
    ├── direct RoleAssignment[]
    └── UserGroupMembership[]
        └── UserGroup
            └── RoleAssignment[]

RoleAssignment
├── roleCode
├── scopeMode
├── OrganizationScope[]
├── LocationScope[]
├── effectiveFrom / effectiveTo
└── policyVersion + audit facts
```

物理设计必须规范化成员关系和多对多范围，不把组织 ID、国家或角色列表塞进逗号文本或无约束 JSON。租户内对象使用稳定 UUID；所有租户范围唯一键、外键和主要查询索引包含或验证 `tenant_id`，外键列显式建索引。状态和关系变化保留版本、操作者、时间和审计，不物理改写历史授权结论。

`AccountOwnerProfile` 是账套主体档案，不是会计账簿。未来 `Ledger/AccountingBook` 如获批准，必须作为独立对象关联主体。

## 第一版业务路径

| 步骤与结果                 | 数据事实                                                                               | 允许动作与技术保障                                             | 界面承接                               | 验收状态 |
| -------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- | -------- |
| 业务管理员建立账套主体     | 组织节点、主体档案、LegalEntity/分支引用、注册国家、状态和版本                         | `identity.manage` 或后续更窄能力；幂等、乐观锁、复核和审计     | 主体列表/详情；不暴露内部表结构        | 待实现   |
| 管理员维护用户和用户组成员 | 外部用户身份、租户成员关系、组成员关系                                                 | 未知 IdP 身份拒绝；跨租户关系拒绝；历史留痕                    | 用户与组的受控维护面                   | 待实现   |
| 管理员分配角色与主体范围   | principal、roleCode、scopeMode、organization scope、有效期、策略版本                   | 不能给自己提权；空范围不等于全租户；服务端校验稳定码           | 角色和范围分开选择                     | 待实现   |
| 用户进入或切换主体         | 已授权主体清单、当前主体、注册国家、本位币、时区                                       | 客户端选择后服务端重验 membership/scope/status；伪造值失败关闭 | 应用壳主体选择器显示“主体名称（国家）” | 待实现   |
| 操作形成审计               | actor、tenant、activeAccountOwner、role/capability/scope、policyVersion、结果、traceId | 授权审计与业务事实同事务或可靠提交                             | 用户只看必要结果，内部拒绝原因不泄露   | 待实现   |

## 相关数据事实子集

| 轨道               | 事实                                   | 来源与状态                   | 承载决定                           |
| ------------------ | -------------------------------------- | ---------------------------- | ---------------------------------- |
| `current_physical` | `tenantId + roles[] + capabilities[]`  | 当前身份代码可证             | 保留并扩展，不复制第二套身份上下文 |
| `current_physical` | ISO 国家和 CargoOwner 销售国家映射     | Prisma/迁移可证              | 保留；不自动转成主体或授权         |
| `approved_gap`     | OrganizationUnit / AccountOwnerProfile | `doc/02`、`doc/17` 已定      | 正规实体与关系，追加迁移           |
| `approved_gap`     | User、UserGroup、成员和角色范围        | `doc/02`、Identity V1.1 已定 | 规范化关系与审计历史               |
| `approved_gap`     | 当前账套主体上下文                     | `doc/02`、Identity V1.1 已定 | 契约字段 + 服务端校验 + Web 选择器 |
| `deferred`         | 多账簿、科目、凭证、结账和合并报表     | 明确不在首版                 | `undecided`；不得默认建表          |

## 迁移与兼容策略

1. 所有结构采用加法迁移；不得修改已共享迁移。
2. 先建立主体与成员关系，再启用主体绑定写动作；旧业务对象在完成批准映射前不得按销售国、目的国、货主名称或租户默认值猜测回填。
3. 若现有租户经负责人确认只有一个账套主体，可通过受审计映射清单回填；仍须保存来源、批准人、执行时间、验证查询和恢复方案。
4. 旧 Token 在过渡期只能访问不要求账套主体的路径；主体绑定动作缺少 `activeAccountOwnerId` 必须失败关闭，不用“第一个主体”静默兜底。
5. 公共 JSON Schema、生成类型、API、Web 和测试在同一契约切片更新；不得手写重复字段绕过 contract parity。

## 执行切片与代理交接

### A：契约与迁移设计冻结

| 项目     | 内容                                                                  |
| -------- | --------------------------------------------------------------------- |
| 基线     | 解阻时由 Codex 填写准确 SHA                                           |
| 执行角色 | Codex 设计收口；Claude 独立反证                                       |
| 写入范围 | 本 brief、Identity/GC-008/主数据契约、公共 JSON Schema 设计和迁移设计 |
| 禁止范围 | 不写生产 Schema/API/Web，不改当前 authz 任务                          |
| 验证命令 | `pnpm docs:check`、契约 schema 校验和 drift 检查                      |
| 停止条件 | 组织所有权、稳定 ID、迁移策略和拒绝语义通过独立复审                   |

### B：组织、主体与成员关系持久化

| 项目     | 内容                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| 基线     | A 审查通过后的集成分支 SHA                                                         |
| 执行角色 | Cursor                                                                             |
| 写入范围 | additive migration、Prisma、master-data/identity Repository 与定向测试             |
| 禁止范围 | 不做工作台批量回填，不做财务账簿，不改货主语义                                     |
| 验证命令 | 模块单测、真实 PostgreSQL 空库/旧库升级、lint、typecheck、repo:check、format:check |
| 停止条件 | 正反租户/主体关系测试通过后 `ready-for-review`，不单独建 PR                        |

### C：OIDC、授权上下文与管理动作

| 项目     | 内容                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| 基线     | B 审查通过后的集成分支 SHA                                                   |
| 执行角色 | Cursor                                                                       |
| 写入范围 | identity Application/Infrastructure/API、公共契约、审计和定向测试            |
| 禁止范围 | 不信任浏览器角色/主体，不建立万能策略引擎                                    |
| 验证命令 | identity 单元/集成、跨租户与越主体 API 反证、contract parity、lint/typecheck |
| 停止条件 | 管理员分配与用户切换路径通过后 `ready-for-review`                            |

### D：应用壳主体选择器

| 项目     | 内容                                                                |
| -------- | ------------------------------------------------------------------- |
| 基线     | C 审查通过后的集成分支 SHA                                          |
| 执行角色 | Cursor                                                              |
| 写入范围 | Web 应用壳、API client、组件与 E2E                                  |
| 禁止范围 | 不按国家过滤冒充主体权限，不把技术 ID 暴露给业务用户                |
| 验证命令 | Web 单测、typecheck、build、桌面/移动 E2E 和截图检查                |
| 停止条件 | 已授权切换、未授权拒绝、刷新恢复和文本容纳通过后 `ready-for-review` |

## 负责人决策记录

| 决策 ID | 已知事实与未知                                 | 选项、成本/收益/风险/可逆性                                                                                                                                                              | 推荐与理由                                  | 负责人结论 | 权威落点 / 状态                      |
| ------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------- | ------------------------------------ |
| ORG-D01 | 多集团公司包含多国分公司，需要账套所有者维度   | A 一个集团一 Tenant + 多账套主体：统一集团视角，增加主体范围复杂度；B 每国一 Tenant：隔离简单但集团协同与共享主数据成本高；C User/Group 加 country：最便宜但无法表达一国多主体和跨国岗位 | A；主体是稳定业务身份，国家只是属性         | 采用 A     | `doc/02`、`doc/17`，approved         |
| ORG-D02 | 货主、销售国和目的国已有物理/契约事实          | A 分轨并建立明确关系；B 货主等同主体；C 国家等同主体                                                                                                                                     | A；避免第三方货主、代理、多货主和多公司混淆 | 采用 A     | `doc/02`、Master Data v0.2，approved |
| ORG-D03 | 未来可能需要多账簿，但当前项目不是财务总账系统 | A 首版只做主体与范围；B 同时建设完整账簿；C 把主体表当账簿                                                                                                                               | A；满足当前权限与上下文，避免无消费者平台   | 采用 A     | `doc/17`、本 brief，approved         |

## 验收

- [ ] 同一租户可建立两个相同注册国家的不同账套主体，身份与授权互不混淆。
- [ ] 同一用户可通过直接授权或用户组获得两个主体范围；撤权或组成员移除后不再可用。
- [ ] 未授权、停用、其他租户、空值和伪造 `activeAccountOwnerId` 全部失败关闭且不泄露主体存在性。
- [ ] 注册国家、销售国、目的国和 CargoOwner 的变化不会自动改变用户权限或当前主体。
- [ ] 空组织范围不等于全租户；集团级只读必须显式授予并有审计。
- [ ] 主体选择器显示业务名称和注册国家，刷新后恢复经服务端验证的上下文，不展示内部 ID。
- [ ] 用户组、组织单元、账套主体和 LegalEntity 均有独立稳定身份，数据库关系有 FK、索引和跨租户反证。
- [ ] 现有数据没有通过国家、货主名称或默认值猜测回填；批准映射具有验证与恢复证据。
- [ ] API、Schema、生成类型和 Web 无契约漂移；高风险最终候选运行一次完整 `pnpm validate`。
- [ ] Claude 或等价独立上下文已复审公共契约、安全范围、迁移和未授权路径，Codex 已处置 findings。
- [ ] 未宣称任何业务工作台因本底座完成而达到闭环。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                                    |
| ---------- | ------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | design | Codex | —      | 负责人采用方案 A；业务权威、Identity V1.1、Master Data v0.2 与本 brief 同步，等待当前 authz coding 收口和独立复审后解阻 |
