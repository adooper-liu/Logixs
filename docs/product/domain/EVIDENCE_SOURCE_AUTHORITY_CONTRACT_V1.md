# 证据与来源权威契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-006`  
> 版本：`1.0.0`  
> 定稿日期：2026-09-10  
> 所有者：证据治理负责人；事实裁决由各专业业务模块负责

## 1. 目的与权威边界

本文件是全系统证据、来源身份、来源资格、验证状态、置信状态、冲突裁决、撤销、更正、人工锁和历史密封的唯一业务权威。它回答“这条信息是谁声明、怎样进入、凭什么可信、能否用于某类事实和状态推进”，不替代专业事实规则、任务工单状态机或生命周期状态机。

不存在“API > 文件 > 人工”或“人工 > 外部”的全局排名。权威必须按事实类型、责任主体、对象、时间种类、地点/航段、司法辖区和业务场景通过版本化策略判定。

## 2. 核心概念

| 概念 | 回答的问题 | 示例 |
| --- | --- | --- |
| Evidence | 支持或反驳业务主张的不可变材料 | 海关回执、POD、EIR、WMS 门岗记录、API 原始响应 |
| Observation | 外部或内部观察到的原始值 | 飞驼返回 `PASS`、司机 GPS 到场 |
| Canonical Fact | 专业模块核验后形成的规范业务事实 | 海关案卷放行、码头重柜出场、仓库实际接收 |
| Source Authority Policy | 哪类来源在何种范围内有资格支持何种事实 | 海关对放行、码头对闸口、仓库对到仓 |
| Verification | 证据真实性、完整性、对象和适用范围的检查结果 | verified/rejected |
| Confidence | 当前事实是否足以被自动采用 | confirmed/provisional/disputed/unknown |
| Ingestion Channel | 数据怎样进入系统 | API、Webhook、文件导入、人工界面 |

渠道不决定权威；聚合供应商可以是传输方，但不是事实责任主体。

## 3. V1 公共枚举

```text
CaptureSource =
  external_evidence | manual_backfill | controlled_import
  | internal_operation | system_derived

AuthorityLevel =
  authoritative | corroborating | operational | contextual

VerificationState =
  pending | verified | rejected | revoked

ConfidenceState =
  confirmed | provisional | disputed | unknown

EvidenceValidity =
  effective | superseded | corrected | revoked

EvidenceRelationType =
  supports | contradicts | corrects | revokes | supersedes
```

### 3.1 语义

| 枚举 | 值 | 含义与限制 |
| --- | --- | --- |
| AuthorityLevel | `authoritative` | 事实责任主体或依法授权主体在匹配范围内签发，可单独满足对应来源资格，但仍需验证和业务守卫 |
|  | `corroborating` | 可佐证权威事实，默认不能单独形成受监管或物理交接终态 |
|  | `operational` | 作业参与方对自身行为的记录，可推进作业，但不自动证明其他主体的结论 |
|  | `contextual` | 预测、备注、轨迹或背景信息，只用于展示、预警或复核 |
| VerificationState | `pending` | 尚未完成验证，不得形成 confirmed 事实 |
|  | `verified` | 完整性、真实性、对象和范围验证通过 |
|  | `rejected` | 验证失败；保留记录但不得应用 |
|  | `revoked` | 先前 verified 决定被授权撤销；必须引用原决定 |
| ConfidenceState | `confirmed` | 已验证且满足适用来源政策，可进入专业规则和状态守卫 |
|  | `provisional` | 可形成观察或预计投影，但不足以完成节点或密封事实 |
|  | `disputed` | 有不可自动裁决的有效冲突，进入复核 |
|  | `unknown` | 信息不足；不等于未发生或 false |

`system_derived` 只能形成计算、预计、风险或解释，不能单独证明实际到港、放行、提柜、送仓、卸柜或还箱。

## 4. 来源身份模型

`EvidenceSourceV1` 必须把以下角色分开：

```text
sourceId: UUID
sourceType: organization | authority | system | person | device
originatorSystem: string(1..64)
authoritySystem: string(1..64)
provider?: string(1..64)
providerVersion?: string(1..64)
interfaceCode?: string(1..100)
sourceReference?: string(1..200)
sourceEventId?: string(1..200)
ingestionChannel: api | webhook | file_import | manual_ui | system_internal
captureSource: CaptureSource
actorId?: UUID
receivedAt?: date-time
```

- `authoritySystem` 是声明事实的责任主体，例如海关、船公司、码头、铁路场站或 WMS。
- `provider` 是承载或聚合数据的供应商，例如飞驼；不得自动继承 authority 身份。
- 人工录入必须有 `actorId`、权限、原因和原始证据；人工代录不把操作者变成事实责任主体。
- 外部输入必须保留 provider、接口、供应商版本、原始引用和映射版本。
- 设备或 GPS 只证明其测量结果；除非适用政策明确授权，不证明法律放行或对方接收。

## 5. 证据对象

`EvidenceRecordV1` 至少包含：

```text
evidenceId: UUID
tenantId: UUID
evidenceType: document | api_response | receipt | message
  | photo | scan | device_record | system_record | attestation
subjectType: stable object type
subjectId: UUID
source: EvidenceSourceV1
authorityLevel: AuthorityLevel
contentRef: controlled object reference
contentHash: sha256 lowercase hex
originalFileName?: sanitized string
mediaType?: registered media type
occurredAt?: date-time
issuedAt?: date-time
receivedAt: date-time
recordedAt: date-time
verificationState: VerificationState
confidenceState: ConfidenceState
validity: EvidenceValidity
relation?: EvidenceRelationV1
sensitivityClass: classification code
retentionPolicyRef: string
```

内容、来源元数据和哈希追加后不可修改。大文件保存在受控对象存储，数据库保存引用、哈希、元数据和访问策略；日志、错误消息和搜索索引不得复制敏感原文。

所有时间以带时区 ISO 8601 交换、UTC 持久化。无法确认原始时区时保存原文并进入复核，不得假定 UTC。

## 6. 来源权威策略

`SourceAuthorityPolicyV1` 使用版本化复合适用范围：

```text
policyId, policyVersion, effectiveFrom, effectiveTo?
tenantScope?
factType or eventType or fieldCode
subjectType
jurisdiction?
direction?
locationRole?
transportMode?
timeKind?
allowedAuthoritySystems[]
allowedSourceTypes[]
minimumAuthorityLevel
requiredEvidenceTypes[]
verificationRequirements[]
corroborationRule?
conflictAction: accept | reject | review
manualCorrectionPolicyRef
sealingPolicyRef
```

策略匹配必须：

1. 先按事实/事件/字段、对象和生效时间筛选。
2. 再按司法辖区、方向、地点角色、运输方式和时间种类选择最具体策略。
3. 无匹配策略时拒绝自动应用并进入复核。
4. 两条同等具体策略冲突时标记配置错误，不任意选一条。
5. 保存实际采用的 `policyId + policyVersion`；策略升级不重释历史，除非执行受审计重放。

### 6.1 最小权威矩阵

| 事实类别 | 原则权威主体 | 可佐证来源 | 不足以单独完成 |
| --- | --- | --- | --- |
| 备货完成 | ERP/供应链责任系统或授权业务确认 | 导入记录、仓库材料 | 无授权的备注或计划 |
| 船舶/货柜到离港 | 船公司、码头或港口责任系统 | 飞驼、AIS、货代 | ETA、AIS 推算或聚合文案 |
| 海关申报、查验、扣放 | 海关/监管机构；授权报关行只对自身申报动作负责 | 飞驼原始响应、正式单据 | 报关行“已处理”、HTTP 成功 |
| 铁路交接 | 铁路主体或铁路场站 | 物流平台、GPS | 订单受理、预约、计划 |
| 码头提柜/还箱 | 码头、堆场或设备交接责任主体 | 拖车报工、定位 | 司机单方点击 |
| 送仓 | POD/有效签收主体，或仓库/WMS/门岗责任系统 | 拖车轨迹、照片 | 仅 GPS 围栏 |
| 卸柜/卸空 | 仓库/WMS 或授权现场验收 | 照片、扫描设备 | 运输方到场报告 |
| 费率、账单、审核、支付 | 合同/服务商/内部审核/支付系统分别负责各自事实 | 计算结果 | 单一金额字段跨阶段覆盖 |

该矩阵只给出原则；P6 实例化必须使用复合策略，不得编码成全局来源排序。

## 7. 验证与裁决

`EvidenceVerificationDecisionV1` 是 append-only：

```text
verificationDecisionId, evidenceId, verificationSequence
decision: verified | rejected | revoked
checks[], policyId, policyVersion
decidedAt, actorOrServiceId, reasonCode, reason?
previousDecisionId?
```

固定裁决流程：

1. 校验 Schema、租户、大小、媒体类型、恶意内容和 contentHash。
2. 验证来源身份、接口/签名/链路、原始引用和映射版本。
3. 验证业务对象、货柜、流程、节点、任务/工单及专业事实关联。
4. 解析业务发生时间、时区、地点/航段和事实适用范围。
5. 选择唯一来源权威策略并执行证据类型、真实性和佐证要求。
6. 计算业务幂等键；同键同哈希返回既有结果，同键异哈希进入冲突。
7. 与当前有效事实比较，处理重复、迟到、更正、撤销和并存来源。
8. 输出 confirmed/provisional/disputed/rejected，并保存完整决策依据。
9. confirmed 结果只交给专业模块或工单事实应用；最终状态仍由各自状态机决定。

验证服务不得自行解释未知供应商码。外部码必须先通过版本化复合映射；未知值保存原文并进入映射复核队列。

## 8. 冲突规则

| 场景 | 处理 |
| --- | --- |
| 同一来源同一业务键、同一哈希 | 幂等返回，不新增有效事实 |
| 同一来源同一业务键、不同哈希 | 标记 conflict，禁止覆盖 |
| 两个 authoritative 来源结论冲突 | 两者保留为 disputed，按专业复核处理 |
| authoritative 与较低等级冲突 | 保留两者；只有策略明确且范围匹配时采用 authoritative，不删除另一条 |
| 新预计与旧预计 | 追加并以 supersedes 关联，更新当前预计投影 |
| 实际事实迟到 | 追加并按业务时间重放；不按接收时间覆盖 |
| 自由文本与结构化码冲突 | 不从文本猜测，进入复核 |
| 暂无数据、超时、NODATA | 记录同步结果，不生成“未发生”或撤销事实 |

禁止 last-write-wins、按渠道排序、按“最新接收时间”推定业务真相或用空值清除最后有效事实。

## 9. 更正、撤销与关系

`EvidenceRelationV1`：

```text
relationType: supports | contradicts | corrects | revokes | supersedes
relatedEvidenceId: UUID
reasonCode: string(1..64)
reason?: string(1..500)
authorizedBy?: UUID
createdAt: date-time
```

- 更正和撤销通过新证据/决定引用旧记录，不物理更新或删除原证据。
- `revoked` 只能引用先前 verified/effective 记录；撤销本身必须有权限和证据。
- 更正实际事实后重新验证受影响投影、工单和节点；已密封历史不自动倒退。
- 证据失效不等于现实事实必然未发生。专业模块必须依据剩余证据重新裁决。

## 10. 人工补录、人工锁与纠偏

人工补录与外部证据表达相同业务事实时使用相同事实类型、业务键、发生时间、完成谓词和状态机。人工路径额外要求操作者、对象级权限、原因、原始证据和预期版本。

`ManualAuthorityLockV1`：

```text
lockId, tenantId
scopeType: evidence | fact | field | event | projection
scopeId, fieldCode?
effect: review_before_replace | freeze_projection
reasonCode, reason, evidenceRefs[1..]
createdBy, createdAt, expiresAt?
expectedVersion
releasedBy?, releasedAt?, releaseReason?
```

- 人工锁只改变自动裁决方式，不改变来源等级、不删除迟到证据，也不阻止原始观察入库。
- `review_before_replace` 使新冲突进入复核；`freeze_projection` 仅用于批准的高风险纠偏，并要求期限或定期复核。
- 创建、释放和越过人工锁都必须服务端授权并审计；UI 隐藏不是权限控制。
- 人工选择某证据后，仍保存未采纳证据及理由，不能把人工决定伪装成外部权威事实。

## 11. 历史密封

- 证据原文和验证决定一经追加即不可修改。
- 预计和 provisional 事实不密封生命周期历史。
- actual + effective + verified + confirmed 的事实被状态机接受后，密封相应事实版本和节点应用。
- 后续节点推进后，已越过区间不得原地重写；外部更正仍可接收，但必须进入重放与人工纠偏。
- 解封或改变密封投影必须有专用命令、权限、原因、证据、预期版本和审计；不得使用数据库直改。
- 法务保留、数据保留和对象存储生命周期必须一致；销毁前证明无活动引用并保存销毁记录。

## 12. 与任务、事件和生命周期的关系

```text
Raw Observation / Evidence
  -> Verification + Source Authority Policy
  -> Canonical Domain Fact
  -> ApplyFactToWorkOrder（如匹配）
  -> WorkOrder / NodeTask 聚合
  -> CanonicalLifecycleEvent（形成或引用既有事件）
  -> lifecycle-control 守卫
```

- 一份证据可支持多个事实，但每个事实关联独立保存适用性和裁决。
- 同一事实可分别应用多张工单，每张工单保存独立 FactApplication。
- 工单完成不授予证据权威；证据 verified 也不自动完成工单或节点。
- 规范事件必须引用有效 evidenceRefs、专业事实和采用的来源政策版本。
- 外部权威事件先推进节点后，工单可以用同一事实补充闭环，但不得重复发布或推进。

## 13. 安全、隐私与审计

- 文件进入隔离区，执行大小、类型、恶意内容和哈希检查后才能成为可验证证据。
- 真实凭据只来自密钥管理；证据、日志和错误不得包含 Token、Cookie、密码或不必要个人数据。
- 内容访问按租户、对象、角色、用途和敏感等级授权；下载使用短期受控引用。
- 审计至少保存主体、动作、对象、策略版本、证据引用、前后决定、原因、时间和 traceId。
- AI 只能提出分类、匹配或冲突建议，输出必须标记 suggestion；未经规则或人员批准不得成为 verified/confirmed。

## 14. 验收矩阵

至少覆盖：

1. authoritative 来源、对象和证据均匹配后形成 confirmed 事实。
2. API 只是传输渠道，provider 与 authoritySystem 正确分离。
3. 人工补录与外部证据得到相同业务结果但审计不同。
4. controlled import 与直连复用同一验证和事实写入规则。
5. system derived 只能形成预计/预警，不能完成实际节点。
6. 无匹配策略、策略歧义和未知供应商码均进入复核。
7. 同键同哈希幂等、同键异哈希冲突。
8. 两个 authoritative 来源冲突时不使用最后写入胜出。
9. 新 ETA 替换当前预计但保留旧历史。
10. 实际事实迟到按业务时间重放，不按接收时间覆盖。
11. 更正和撤销追加记录，原证据不可修改。
12. 人工锁不阻止新证据入库，只改变自动裁决。
13. 密封节点收到更正时进入纠偏，不静默回退。
14. 一份证据支持多个事实、一个事实应用多张工单时关系可追溯。
15. 跨租户、错货柜、错案卷、错地点/航段和过期策略明确拒绝。
16. 恶意文件、哈希不符、未知媒体类型和时区不明明确隔离或复核。
17. 暂无数据、同步失败和 NODATA 不清空既有有效事实。
18. AI 建议无法直接成为 verified 或 confirmed。

## 15. 版本与实例化

- 新增证据类型或可选策略条件通常为加法兼容；收紧来源资格、改变权威等级、冲突动作或密封规则属于行为变更。
- 删除/改名枚举线值、重释既有来源等级或新增必填字段属于破坏性变更，必须发布新版本和迁移策略。
- 当前公共证据记录与枚举已在 P6 达到 `D4`；尚无生成类型、数据库迁移或运行时裁决器。
- P7 将派生技术载体，并继续实例化来源策略映射和测试。
