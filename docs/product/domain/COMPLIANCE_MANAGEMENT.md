# 跨境合规管理与主流程接入（COMPLIANCE_MANAGEMENT）

> 状态：**负责人方向已确认 + 领域设计候选 v0.1** · 2026-09-19 · 负责人：刘志高。
> 已确认方向：合规进入主流程并提供独立管理界面；合规横贯生命周期，不新增第 15 个物流节点。
> 候选范围：对象字段、规则表达、门禁分布和页面路由须经业务/合规负责人逐项冻结后才进入公共契约。
> 消费者：产品、合规、Shipment Registry、Lifecycle Control、Work Execution、Document Records、Web。

## 1. 决策与边界

合规回答“这批货在当前国家、产品、主体、运输方式和生效日期下能不能继续走”，14 节点回答“货柜走到了哪里”。两者采用横向轨道与节点门禁组合：

```text
法规/客户/承运人/公司要求
        -> 适用性判断 -> 合规评审 -> 缺口整改 -> 证据核验 -> 决定
                                  |                         |
cargo_ready -> stuffing -> dispatch -> departure -> customs -> pickup -> ...
```

- 合规评审可生成任务、发现、阻断、允许动作和后续义务。
- 合规决定是独立业务事实；不得直接写 `currentStatus`、节点状态或规范事件。
- 生命周期仅在节点完成事件、日期事实、来源权威、证据、前序及合规门禁全部通过后推进。
- 法规原文、AI 解读、人工专业意见、已批准规则和执行事实分开保存。
- 本文是产品/领域设计，不构成法律意见；正式要求必须能追溯到官方来源和批准人。

## 2. 合规要求分层

| `requirementLayer`             | 含义                   | 例子                             | 是否可被低层要求覆盖 |
| ------------------------------ | ---------------------- | -------------------------------- | -------------------- |
| `law_regulation`               | 法律、法规、监管要求   | 产品准入、出口管制、海关、危险品 | 否                   |
| `company_policy`               | 公司风险政策           | 高风险国家加签、证书复核周期     | 不得放宽法律要求     |
| `customer_requirement`         | 客户或平台要求         | 标签、测试、包装、追溯           | 不得放宽前两层       |
| `carrier_facility_requirement` | 承运人、码头、仓库要求 | DG 申报、VGM、场站限制           | 不得放宽前两层       |
| `contract_obligation`          | 合同和贸易条款义务     | 单证、交付和责任边界             | 不得冒充监管放行     |

规则适用维度至少包括：国家/地区、进口或出口、产品类别、HS 编码、SKU 属性、主体角色、运输方式、贸易条款、地点/航段和有效期。同一规则未命中全部必要维度时不得静默套用。

国家、地点、设施与业务伙伴身份统一引用[参考字典与业务伙伴主数据](./MASTER_DATA_DICTIONARY.md)。出口国、进口国、原产国、销售市场国和公司注册国是不同关系角色，不得压成一个含糊的 `country` 字段；飞驼、云当等供应商值须经规范身份与别名映射后才能参与规则适用性判断。

## 3. 领域对象候选

| 对象                            | 关键内容                                                         | 责任                     |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| `ComplianceRequirement`         | 要求层级、司法辖区、官方来源、法律条文、义务摘要                 | 保存“要求是什么”         |
| `ComplianceRuleVersion`         | 稳定规则码、版本、适用条件、证据要求、阻断节点、生效期、批准状态 | 保存可执行且已审批的规则 |
| `ComplianceApplicability`       | 国家、方向、SKU/HS、主体、运输方式、贸易条款、日期               | 判断规则是否适用         |
| `ComplianceAssessment`          | 评审对象、规则版本集合、属性快照、评审状态                       | 固化一次可重放评审       |
| `ComplianceFinding`             | 缺件、不符合、冲突、风险、整改期限                               | 记录问题，不覆盖评审     |
| `ComplianceEvidenceRequirement` | 证据类型、签发主体、覆盖范围、有效期、验证要求                   | 定义“拿什么证明”         |
| `ProductCertificate`            | 证书号、类型、签发方、SKU/型号/国家范围、生效与到期、文件引用    | 保存产品证书事实         |
| `ComplianceDecision`            | 放行、有条件放行、阻断、豁免、待补证及决定人                     | 保存最终决定             |
| `ComplianceObligation`          | 后续申报、续证、标签、检测、通知和责任人                         | 生成可执行任务           |

建议稳定状态码：

```text
assessmentState = draft | evaluating | action_required | awaiting_approval | decided | superseded
decisionCode = approved | approved_with_conditions | blocked | exempted | evidence_required
findingState = open | remediation_in_progress | resolved | accepted_risk | voided
ruleState = draft | in_review | published | retired
```

这些码当前仍为候选；进入运行时前必须形成单一 JSON Schema/目录并完成 TypeScript、Python、OpenAPI 与数据库映射一致性门禁。

## 4. 规则与证据治理

每个已发布规则至少保存：

```text
ruleCode, version, requirementLayer, jurisdiction, direction,
productCategory/hsCode/attributePredicates, partyRole, transportMode,
tradeTerm, effectiveFrom/effectiveTo, requiredEvidenceTypes,
blockingNodeCodes, severity, officialSource, legalCitation,
owner, approvedBy, approvedAt, supersedesRuleVersion
```

- 规则变更追加新版本，不原地改写已被评审引用的版本。
- 评审锁定 `complianceRuleVersionId + productAttributeSnapshotId + certificateVersionIds + assessmentDecision`，法规、证书或产品属性更新不得静默重算历史决定。
- AI 只产生摘要、差异和规则候选；`published` 必须由有权限的责任人批准。
- 证书必须区分“文件已上传”“真实性已核验”“仍在有效期”“确实覆盖该 SKU/型号/国家”。
- 豁免必须有适用范围、批准人、依据、生效期和到期日；不得使用永久无范围豁免。

## 5. 14 节点合规映射

下表是规划目录；节点集合、顺序和完成事件仍以 GC-001/002/003 为唯一权威。

| 节点                        | 主要数据/单据                                         | 合规检查                                      | 完成事实与典型阻断                             |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| 备货 `cargo_ready`          | SKU、数量单位、合同、产地、材质、属性、证书、检验要求 | 市场准入、产品安全、标签、商检/植检、出口管制 | 实际备妥事实；证书缺失、SKU 未覆盖、禁限运阻断 |
| 装箱 `container_stuffing`   | 装箱单、箱/托盘层级、重量体积、照片、封识计划         | DG、锂电、制冷剂、木包装、隔离配载、温控      | 实际装箱完成；错误配载、包装或标签阻断         |
| 出运 `shipment_dispatch`    | 箱号、封号、VGM、订舱、SI、DG 声明、分配明细          | 出口许可、制裁筛查、运输声明和承运人要求      | 实际装载；许可/声明/放行不齐阻断               |
| 离港 `origin_departure`     | ATD、舱单、装船和码头回执                             | 海关、船司、码头放行                          | 实际离港；对象、起运港或航段不符阻断           |
| 海运 `ocean_transit`        | 航段、位置、下一港 ETA/ATA                            | 危险品航线和中途港限制                        | 匹配航段的实际抵达；甩柜、改港、失联异常       |
| 中转 `transshipment`        | 中转抵/离港、卸装船、换船信息                         | 中转国限制、DG 过境及港口限制                 | 匹配中转港实际离港；漏装、滞港阻断             |
| 清关 `customs_clearance`    | 申报、HS、估价、原产地、许可证、税费、查验            | 申报完整性、主体放行、扣留集合                | 货柜级聚合清关完成；单一 release 不足          |
| 到港 `destination_arrival`  | ATA、靠泊、卸船、码头、可提                           | 进口许可、港口/卫生要求                       | 目的港实际到港；ETA/ATB 不替代 ATA             |
| 海铁 `rail_transfer`        | 铁路运单、场站、班次、交接                            | 铁路危险品、限重和线路要求                    | 铁路主体/场站实际接收；预约不完成              |
| 提柜 `container_pickup`     | 预约、司机车辆、EIR、Gate Out                         | 海关、船司、码头、海事、运费等适用放行        | 重柜实际出场；任一有效 Hold 阻断               |
| 送仓 `warehouse_delivery`   | 路线、预约、POD、门岗/WMS 到场                        | 道路运输、司机资质、温控、DG 资质             | 实际签收/权威到场；GPS 或司机点击不足          |
| 卸柜 `container_unloading`  | 月台、卸柜方式、开始/完成、差异单                     | 仓库安全、污染、破损和操作要求                | 实际卸柜完成；部分卸货不等于完成               |
| 卸空 `container_unstuffing` | SKU 收货、短溢损、破损、WMS 接收、空箱确认            | 产品追溯、隔离和异常处置                      | 实际卸净/空箱确认；WMS 入库时间不可推导代替    |
| 还箱 `empty_return`         | 场站预约、空箱 EIR、箱况、维修责任                    | 场站接收、污染/损坏和环境处置                 | 指定场站实际接收；计划还箱不完成               |

## 6. 备货、产品与出运重点目录

SKU、品类扩展属性和结构化合规属性的存储边界统一引用[产品属性治理](./PRODUCT_ATTRIBUTE_GOVERNANCE.md)，不在本文复制字段定义。

出运关系必须允许：

```text
ReplenishmentOrder N <-> N ContainerRecord
ReplenishmentOrderLine/SKU N <-> N ContainerRecord
```

通过装载分配明细保存“哪条备货单明细、哪个 SKU、多少数量、哪些外箱/托盘进入哪个柜”。箱号不能继续只挂在备货单表头。规划字段包括箱型、SOC/COC、皮重/载重、封识及换封历史、VGM 与方法、装柜地点和时间、冷柜参数、DG 积载、箱况照片、订舱/船名航次/POL/POD/中转港、MBL/HBL、SI 及放行回执；进入运行时前逐项进入正式字段目录。

## 7. 前端规划

### 7.1 组织工作台与节点映射

| 工作台   | 后端节点/能力                                                               |
| -------- | --------------------------------------------------------------------------- |
| 备货     | `cargo_ready`                                                               |
| 出运     | `container_stuffing`、`shipment_dispatch`                                   |
| 船务     | `origin_departure`、`ocean_transit`、`transshipment`、`destination_arrival` |
| 单证     | 横跨备货、出运、船务和清关，只拥有单证义务，不拥有主链状态                  |
| 清关     | `customs_clearance`                                                         |
| 内陆运输 | `rail_transfer`、`container_pickup`、`warehouse_delivery`                   |
| 入库     | `container_unloading`、`container_unstuffing`                               |
| 还箱     | `empty_return`                                                              |

页面按组织职责分工，后端仍复用一套节点、事件、任务、证据和允许动作，禁止按页面复制状态机。
所有岗位工作台的入口、队列和信息动线统一引用
[角色工作台以人为中心的设计契约](../ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md)。合规中心可以管理完整规则目录，但岗位工作台只显示当前对象真正适用且会改变该岗位下一步的要求、缺口和等待；不得把规则目录复制成每个 SKU 的固定评审清单。

### 7.2 合规中心

独立合规中心候选页面：总览、国家要求库、产品/SKU 合规档案、规则管理、评审队列、证书与到期、法规变化、审计记录。一柜一档增加合规摘要、适用规则版本、证书覆盖、发现/整改、阻断、豁免和允许动作。

国家要求库必须显式展示司法辖区、方向、产品/HS 范围、来源层级、官方链接、生效期、最后复核时间和负责人。AI 摘要与已批准解释使用不同视觉状态，不能让用户误认为 AI 文本是正式规则。

## 8. 与现有模块的结合

- `shipment-registry`：拥有备货单、产品明细、货柜身份和装载分配引用。
- `master-data`：拥有 Product/SKU 稳定身份及版本化结构合规档案；电池、危险品、制冷剂、检验要求和证书版本第一刀已落地，不由出运明细代管。
- `document-records`：拥有证书、报告、回执和证据版本。
- `compliance-management`：拥有规则、适用性、评审、发现、决定和义务；`cargo_ready` 第一段运行时已经落地。
- `work-execution`：把义务和整改投影为任务/工单；完成工单不自动形成放行。
- `lifecycle-control`：只查询当前节点所需的有效合规决定/阻断，不解释法规原文。
- API、导入、人工录入共用 Application 用例、幂等、授权、证据和审计；渠道不决定权威。

### 8.1 `cargo_ready` 已实现规则子集 V1

当前运行时不是任意表达式规则引擎，只允许以下受控条件：

| 运行时字段                         | V1 语义                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `ruleCode + version`               | 租户内稳定规则身份与追加版本；发布新版后旧版只退役、不覆盖                 |
| `jurisdictionCountryCode`          | ISO 3166-1 alpha-2 司法辖区；不得从仓库、租户或币种猜测                    |
| `effectiveFrom / effectiveTo`      | 日期有效期；按评审业务日期匹配，不按服务器当地时间                         |
| `appliesToAllSkus / productSkuIds` | 二选一；SKU 范围为空时不得解释成“全部”                                     |
| 电池/制冷剂/DG 条件                | 固定枚举 `any/present/absent`、`any/regulated/not_regulated`；未知即待整改 |
| `requiredCertificateTypes`         | 证书同时满足类型、已核验、有效期和国家覆盖才算满足                         |
| `blockingNodeCodes`                | 本子集只允许 `cargo_ready`；其他节点随对应纵向切片单独冻结                 |
| 来源与批准                         | HTTPS 官方来源、法律引用、负责人、证据、批准人和批准时间均必须保存         |

运行顺序固定为“SKU 权威属性 → 规则适用性 → 所需证据 → 证据有效性 → 发现/决定”。属性明确且没有规则命中的低风险 SKU 不产生无差别人工评审；属性未知形成具体属性确认发现，只有已命中规则要求的证据缺失、失效或未核验才形成补证发现。前端必须消费服务端返回的适用原因和发现，不得因评审记录不存在而把电池、危险品、制冷剂、商检和证书统一显示为“未评审”。

评审把命中的 `ruleVersionId + productSkuId` 固化为快照。没有任何已发布规则覆盖司法辖区，或某个 SKU 没有适用规则、属性不足以判断、所需证书无效时，均形成明确发现，禁止把“规则库为空”当作合规。装载集合、SKU 合规档案版本或当前适用规则版本变化后，旧放行决定自动失效。

运行入口：

```text
POST /compliance/rules/{ruleCode}/versions        compliance.rule.manage
POST /containers/{id}/compliance/cargo-ready/assessments
GET  /containers/{id}/compliance/cargo-ready
POST /containers/{id}/compliance/cargo-ready/decisions  -> 决定提交后自动尝试重放 pending 日期事实
GET  /work-items?containerId={id}                       -> 查询开放的非生命周期工作项
```

决定写入成功后，上层编排用例调用生命周期公开重放 Port；只有之前已经保存为 `pending_application` 的实际日期事实才会重新申请过站。重放响应区分 `completed / deferred / retry_required`，重放失败不会回滚或伪装已经提交的合规决定，也不会丢失待应用日期事实。

当前实现边界：路线 `1.3` 已完成评审输入事实及公开读写 Port；`2.1` 已完成基础事实评审、追加式规则版本、国家/日期/SKU/结构化属性适用性、证书校验、版本化发现/决定、受权限保护的 API、`cargo_ready` 生命周期查询门禁、决定后自动重放、整改工作项投影和备货合规最小 UI。整改项进入 `work-execution` 独立的 `ExternalWorkItem` 全局开放池，不伪装成 `NodeTask`；新评审版本取消旧版本仍开放的整改项，空发现也会关闭旧项，重复和旧版本投影由版本检查保护。当前只提供查询，不包含领取、完成或把“任务完成”解释成合规放行。档案、证书、整改任务或合规决定本身仍不会凭空生成实际日期或直接改生命周期状态。

## 9. 实施顺序

1. **P0**：冻结合规对象、规则适用性、决定码、证书边界和节点门禁查询 Port。
2. **P1**：完成“SKU 档案 -> 证书 -> `cargo_ready` 评审 -> 整改任务 -> 合规决定”的纵向切片。
3. **P2**：接入装箱/出运，以及清关/到港/提柜/送仓/入库/还箱门禁。
4. **P3**：法规变化监测、受影响范围分析、到期预警和 AI 辅助解读。

上线前仍须由合规负责人确认首批国家、产品类别、官方来源、证据类型、硬阻断点、豁免权限和复核周期。
