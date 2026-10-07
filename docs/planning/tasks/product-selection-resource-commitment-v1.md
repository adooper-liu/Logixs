---
status: done
branch: feat/product-selection-resource-commitment-v1
verification: PR #145 merged as 9a507b92d6efd0c2b791352edce0d083b13e67e6; CI run 37423464110 quality passed
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/product-selection-resource-commitment-v1.md
  - docs/planning/tasks/market-signals-opportunity-radar-v1.md
  - docs/planning/tasks/_template.md
  - .claude/settings.json
  - package.json
  - docs/product/UI_SYSTEM.md
  - scripts/check-ui-structure-gate.mjs
  - scripts/check-ui-structure-gate.test.mjs
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
  - docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md
  - packages/contracts/schemas/v1/product-initiative.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - database/schema.prisma
  - database/migrations/**
  - database/seed.ts
  - database/seeds/seed-authoritative-currency-reference-data.ts
  - database/seeds/seed-authoritative-currency-reference-data.test.ts
  - database/seeds/reference-data/iso-4217-list-one-synthetic-rehearsal.json
  - scripts/generate-currency-reference-snapshot.mjs
  - scripts/generate-currency-reference-snapshot.test.mjs
  - scripts/import-authorized-currency-reference.mts
  - scripts/import-authorized-currency-reference.test.ts
  - scripts/verify-currency-reference-data.mts
  - package.json
  - database/dictionary/dictionary.annotations.json
  - database/dictionary/DATA_DICTIONARY.generated.md
  - database/dictionary/NATIVE_OBJECTS.generated.md
  - database/dictionary/database-data-dictionary.xlsx
  - apps/api/src/modules/product-selection/**
  - apps/api/src/modules/master-data/master-data.module.ts
  - apps/api/src/modules/master-data/index.ts
  - apps/api/src/modules/master-data/reference-currency-directory.port.ts
  - apps/api/src/modules/master-data/infrastructure/prisma-reference-currency-directory.ts
  - apps/api/src/modules/master-data/infrastructure/prisma-reference-currency-directory.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-test-fixtures.ts
  - apps/api/src/infrastructure/integration/product-definition-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-identity-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-npi-intake-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/supplier-nomination-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/workbench-network-volume.integration.test.ts
  - apps/api/src/modules/master-data/module.manifest.ts
  - apps/api/src/modules/product-selection/module.manifest.ts
  - apps/web/src/api/marketSignals.ts
  - apps/web/src/api/marketSignals.test.ts
  - apps/web/src/components/product-selection/**
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/composables/useProductOpportunityWorkbench.ts
  - apps/web/src/composables/useProductOpportunityWorkbench.test.ts
  - apps/web/src/data/productInitiativeQueue.ts
  - apps/web/src/data/productInitiativeQueue.test.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/src/views/ProductNpiWorkbench.test.ts
  - apps/web/src/components/product-npi/ProductNpiHandoffDetail.vue
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:ps-d01
  - business-policy:ue-d01
  - business-policy:ue-d02
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - public-contract:product-initiative-v1
  - reference-data:iso-4217
  - generated:contracts
  - repository-governance
sharedIntegrationScopes:
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - docs/product/UI_SYSTEM.md
  - docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - docs/planning/tasks/market-selection-handoff-v1.md
uiStructure:
  - 全局工作台固定壳（负责人 2026-10-05 定案）：PageHeader → 岗位/交接上下文 → 左侧任务队列 + 中间任务详情 + 右侧操作上下文
  - 任务状态只驱动局部内容：未完成任务的中间栏显示机会事实/评审依据、右栏显示办理动作；已立项任务的中间栏显示冻结结果、右栏显示只读状态/后续入口；不得改变三栏壳
uiMustStayVisible:
  - 任务切换时 PageHeader、岗位/交接上下文、左侧任务队列与右侧操作上下文栏位保持不变
  - 真实结果、立项责任人、NPI 承接、资源说明、目标日期、下一决策日期与问题
  - 单位经济基准/保守贡献、引用失效、当前阻断、失败原因、恢复动作与主动作
uiProgressiveDisclosure:
  - 后补事实语义、为何只读、历史未记录原因与专业要求适用理由进入 InfoTooltip
  - 评审证据、备注、单位经济精确字段缺口与交接原文按需展开
uiForbidden:
  - 已立项任务的编辑控件、历史缺失冒充当前待补、内部字段 code、重复状态横幅、免责声明墙
  - 以所选任务结果状态切换整页 Mode、隐藏岗位/交接上下文、移除右侧栏或把三栏收缩成两栏
  - 等权字段卡墙、逐端点缺口警示墙、技术字段总数作为岗位待办、用 text contains 或测试通过代替截图验收
uiViewportEvidence:
  - 1440x900：固定三栏壳与岗位上下文可见；选择已立项任务时仅中栏切为结果详情，首屏可见结果、责任、单位经济、目标日期与下一决策且无横向溢出
  - 1024x768：固定三栏壳不因任务状态改成两栏；结果摘要可见且无横向溢出
  - 390x844：保持同一办理台区域顺序并可切回未完成任务；结果详情顺序为结果 → 责任/投资摘要 → 机会 → 评审依据 → 原文
---

# 任务：选品立项——立项资源责任与可复算单位经济 V1

## 目标

消除“立项通过但没人、没资源、没下一检查日期”和“暂缓后无人重判”：立项前必须明确立项责任人、下一阶段资源承诺、目标日期和下一决策点；暂缓必须带验证计划与重判日期，到期回到选品优先队列。立项交 NPI 的不可变快照携带这些承诺。随后让“利润可接受”变成可复算的两情景数字，口径不明不能立项。

## 阶段与调度

- `market-selection-handoff-v1` 已由 PR #136 合入 `main`，本分支已合并至 `eb5e2598`（含 PR #137、#138）；原串行前置与 Schema / 契约锁冲突均已解除。
- 2026-10-05 S3a 提交 `06cb41ab` 已经主代理验收及 fresh Codex 独立复审 no-findings；当前按预授权执行 `S3b-unit-economics-ui`。
- 主代理在 S1 同步把负责人 2026-10-04 对 `选品立项.md` 13 条基线中本片涉及的资源责任、暂缓重判和 NPI 交接承诺写回 `doc/08`；未进入本片的结论仍按后续切片留存，不提前铺字段。
- frontmatter 是当前 coding 写入范围和锁的唯一机器事实；正文不再维护第二份范围清单。

## 边界 / 不做

- 不做假设完整元数据（U1）、五面评审重构、组合检查、权限拆分、队列双轴、预算区间、汇率换算和利润率阈值；它们是已确认基线的后续切片或未采纳选项。
- 不改 NPI 领取、阶段门槛和 NPI 回程语义；NPI 只读展示快照中的承诺。
- 不新增角色；继续 `planning.read` / `planning.draft`，权限拆分属于基线已定但后续切片。
- 存量立项与交接快照不改写；新规则只约束新写入。

## 智慧开启基线

负责人 2026-10-04 原话（AskQuestion 选择）：“全部由我确认为已定：主代理等 S1 合入后写回 doc/08 选品规格，但只实现第一刀涉及的部分，其余按切片逐步做”。

| 基线文件与原结论（摘要 + 位置）                                                                             | 处置   | 依据                                                                                                                                    | 落点 / 决策 ID       |
| ----------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 定位：商业论证与投资门工作台（`选品立项.md` 已定基线）                                                      | `沿用` | 负责人 2026-10-04 确认                                                                                                                  | doc/08 写回          |
| 入口：只接收可信机会包，人工提议先进统一机会入口                                                            | `沿用` | 同上；与 MS-D04“接受才转责”一致                                                                                                         | doc/08 写回          |
| 五面评审 + 适用风险项                                                                                       | `沿用` | 同上；本刀不实现                                                                                                                        | 后续切片             |
| 财务区间与情景；事实/假设/计算/判断四轨                                                                     | `沿用` | 同上；本刀不实现                                                                                                                        | 后续切片             |
| R1 资源：投入前明确立项责任人、下一阶段资源、目标日期和下一决策点（124）                                    | `沿用` | 同上；基线第 46 行指出当前责任人只是操作人                                                                                              | 本刀 / PS-D02        |
| R1 补充：立项责任人不得由“最后点击按钮的人”自动代替（135、148）                                             | `修正` | 负责人 2026-10-04 裁决：PS-D01 A 作为过渡，以显式“由我对此立项负责”承诺代替自动代替；退出条件为人员目录上线后改为“指定他人并由对方接受” | PS-D01-X             |
| F1 区间与情景：市场、渠道、币种、售价/到岸成本区间、平台/履约/广告/退货假设、贡献空间、基准/保守情景（122） | `沿用` | 负责人 2026-10-04 选薄版                                                                                                                | S3 / UE-D01          |
| U1 四轨：每个关键假设记来源、截至时间、可信度、验证方式、失效条件（123）                                    | `沿用` | 负责人 2026-10-04：本刀只区分“有证据/待验证假设”，完整元数据后续切片                                                                    | 后续切片             |
| 口径不明不能立项；部分数字可为区间；无依据不得写成固定百分比（131～133）                                    | `沿用` | 负责人 2026-10-04 选口径门槛，不设数值门槛                                                                                              | S3 / UE-D02          |
| 队列：规则分层，同层双轴，不做万能总分（154）                                                               | `补强` | 本刀只加“暂缓到期”优先层，双轴后续                                                                                                      | 本刀 / PS-D03        |
| 权限：准备、专业复核、投入决定按能力分开                                                                    | `沿用` | 同上；本刀不拆                                                                                                                          | 后续切片             |
| G1 结果：投入、暂缓、否决、退回均有后续责任；暂缓须有验证计划和日期（98）                                   | `沿用` | 同上                                                                                                                                    | 本刀 / PS-D03        |
| 恢复：暂缓、否决重开、市场退回、NPI 退回均形成新版本                                                        | `沿用` | 同上；与 MS-D04 一致                                                                                                                    | 本刀沿用现有版本机制 |
| 门槛：风险比例门槛，阻断未知不能带病立项                                                                    | `沿用` | 同上；本刀不改现有门槛表                                                                                                                | 后续切片             |
| 组合检查；结果反馈校准                                                                                      | `沿用` | 同上；本刀不实现                                                                                                                        | 后续切片             |
| 差距 7：人工直接新增选品绕过可信机会门（`product-initiative-manual-intake-v1`）                             | `沿用` | 同上；该 brief 已 blocked，不恢复原方案                                                                                                 | 后续处置             |
| 差距 8：选品与 NPI 须联合验收退回与重新接受                                                                 | `沿用` | 本刀改动交接快照，NPI 只读展示须一并验收                                                                                                | 本刀验收             |

## 负责人决策记录

| 决策 ID             | 已知事实与未知                                                                   | 选项、成本/收益/风险/可逆性                                                                                        | 推荐与理由                                       | 负责人结论                                                    | 权威落点 / 状态              |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- | ---------------------------- |
| PS-D00 基线确认     | 13 条“已定基线”此前未写回 `doc/08`                                               | 全部确认 / 部分确认 / 再开智慧开启                                                                                 | 全部确认，分刀实现                               | 2026-10-04 全部确认                                           | 待写回 doc/08                |
| PS-D00b 第一刀      | 候选：资源责任 / 单位经济 / 证据完整性                                           | —                                                                                                                  | 资源责任                                         | 2026-10-04 选资源责任                                         | 本 brief                     |
| PS-D01 立项责任人   | 现有 `responsibleActorId` = 作决定的操作人，界面未表达其为立项责任               | A 当前认证用户，服务端绑定 / B 指定他人并经其接受 / C 取机会接受人                                                 | A：最小改动，转派另定，可逆                      | 2026-10-04 选 A                                               | 待写回 doc/08 / approved     |
| PS-D02 资源承诺内容 | 现有快照无资源、目标日期、下一决策点                                             | A 承接团队或岗位 + 资源说明 + 目标日期 + 下一决策点（日期 + 决策问题），不含金额 / B 另加预算区间 / C 只要两个日期 | A：针对“没人没资源”，预算随单位经济切片          | 2026-10-04 选 A                                               | 待写回 doc/08 / approved     |
| PS-D01-X 与基线冲突 | PS-D01 A 与基线 R1“不得由点按钮的人自动代替”冲突；系统无人员目录                 | 过渡保留 A / 改为指定他人并接受 / 本刀不写责任人                                                                   | 过渡保留 A：先解决没资源没日期，退出条件明确     | 2026-10-04 选过渡保留 A                                       | 待写回 doc/08 / approved     |
| UE-D01 单位经济范围 | 现有“价格带与利润”只有自由文本结论与证据引用                                     | 薄版 F1 / F1+U1 / 单情景                                                                                           | 薄版 F1：可复算，录入负担可控                    | 2026-10-04 选薄版 F1                                          | 待写回 doc/08 / approved     |
| UE-D02 单位经济门槛 | 基线：口径不明不能立项；无数据前无可信阈值                                       | 口径门槛 / 另加数值门槛 / 只展示                                                                                   | 口径门槛：不硬编码利润阈值                       | 2026-10-04 选口径门槛；保守情景贡献为负时须写仍投入理由       | 待写回 doc/08 / approved     |
| PS-D03 暂缓验证计划 | 现有暂缓只要 `deferReason`；无重判日期，队列按更新时间                           | A 验证重点 + 重判日期，责任人为当前用户，到期进最前分组，不自动改状态 / B 另加逾期标记 / C 只要日期                | A：与市场“单一当前验证承诺”同构                  | 2026-10-04 选 A                                               | 待写回 doc/08 / approved     |
| UE-D03 币种底座收窄 | S3a 已实现 authorized snapshot + release 生命周期；负责人只需 178 个币种直接可用 | A 内置 178 币种直接表 / B 保留 release/importer / C 只支持单币种                                                   | A：删除无消费者的发布机制，保留来源哈希和 lookup | 2026-10-05 选 A；取消授权 snapshot、active release 与许可门禁 | doc/08 + 本 brief / approved |

## 执行切片（转 coding 后生效；同一分支、一个最终 PR）

| 项目     | 内容                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | `5401efea`（旧设计分支合并最新 `main` 后的提交；`main` / `origin/main` 同步点为 `eb5e2598`）                                                                     |
| 执行角色 | 实现执行器：Codex（GPT-5.6）                                                                                                                                     |
| 复审     | 高风险切片完成后由 Codex（GPT-5.6）新开只读会话独立复审；只阻塞当前切片可复现的真实业务、安全、数据真实性、兼容性或发布风险                                      |
| 禁止范围 | 市场信号模块、NPI 阶段与回程语义、授权控制面、`market-selection-handoff-v1` 已定的接受与退回规则；不得扩展人员目录、预算、权限拆分或通用契约                     |
| 提交     | 实现执行器可按切片在本分支提交；不得推送、建 PR、改 brief 状态或写入 frontmatter / `doc/08`，这些由主代理收口                                                    |
| 停止条件 | 每片返回 `HANDOFF`，state 只能 `ready-for-review` 或 `blocked`；只以真实当前业务风险、权威冲突、范围冲突或验证环境不可用为 blocked，不以范围外重构或未来扩展阻塞 |

### 切片 `S1-resource-commitment`

1. **立项**（`approve`）新写入在现有门槛之外，还要求：承接团队或岗位、资源说明、目标日期、下一决策日期、下一决策问题；缺任一项失败并列出缺项（`PRODUCT_INITIATIVE_INCOMPLETE`，沿用现有错误形态）。立项责任人由服务端绑定为当前认证用户（PS-D01），请求体不得传入他人。
2. **暂缓**（`defer`）新写入须有验证重点和重判日期；缺失沿用“待补、不关闭”规则。重判日期不得早于当天（UTC 日期，界面按用户时区显示）。
3. **交接快照**：`ProductInitiativeHandoff` 追加资源承诺各项与立项责任人，不可变；NPI 交接详情只读显示，不改变 NPI 领取。
4. **队列**：选品队列新增最前分组“暂缓到期”（重判日期 ≤ 今天的暂缓项），按重判日期、更新时间、id 稳定分页；不新增逾期状态。
5. **迁移**：追加迁移新增可空列与 CHECK（新写入由服务端保证完整）；存量行不回填、不伪造。附空库与旧版本升级集成测试。
6. **界面**：立项面板写明“由我对此立项负责”，资源承诺四项直接填写；暂缓面板写“这次要验证什么”“哪天重判”。回执重读服务端，409 重读后保留输入。
7. **验证命令**：选品领域单测、`product-initiative-flow` 与迁移升级 PostgreSQL 集成测试、契约生成物一致、字典检查、受影响 Web 单测、一条选品立项 E2E、受影响模块 lint/typecheck。

### 切片 `S2-evidence-integrity`（已验收）

岗位结果：选品人员引用证据形成评审结论时，系统只允许使用当前租户、当前机会来源信号上真实存在的证据；格式正确的任意 UUID 不能满足立项门槛。

1. **服务端核验**：`DecideProductInitiativeService` 在领域准备完成、持久化之前，从当前 `handoffId` 的机会记录取得来源 `signalId`，通过现有 `READ_EVIDENCE_REFS` 读取该租户该信号的合法证据集合，并核对命令中每个评审要点的 `evidenceRefs`。无需新表、迁移、公共契约字段或通用证据平台。
2. **失败语义**：任一引用不存在、属于其他租户、或属于同租户其他信号时，整个决定稳定失败为 `PRODUCT_INITIATIVE_EVIDENCE_INVALID: <sorted-comma-separated-uuids>`；不得部分采信、静默丢弃或把错误引用写入当前态/快照。UUID 排序去重，便于岗位定位具体条目和测试稳定。
3. **事务与并发**：证据核验发生在写事务之前，不改变现有 initiative 版本、幂等和 advisory lock 语义；核验通过后仍由 repository 在事务内重新检查机会已接受、版本与当前去向。存量记录与历史快照不回填、不重写。
4. **权限与租户**：沿用写接口认证、`planning.draft` 和现有 tenantId；证据读取必须带同一 tenantId。跨租户 UUID 在当前租户合法集合中不存在，按同一稳定错误拒绝，不泄露该证据属于哪个租户或信号。
5. **界面反馈**：Web 把稳定错误翻成岗位语言并列出无效引用，明确“该证据不存在或不属于当前机会，请重新选择”；保留当前未提交草稿，不新增证据管理界面或自动替换证据。
6. **测试先行**：先增加失败测试，证明当前实现会接受格式正确但不存在/其他信号/跨租户的 UUID；再实现最小核验。领域/Application 单测覆盖合法集合、排序去重和不调用 persist；真实 PostgreSQL 集成分别覆盖成功、同租户其他信号、跨租户、完全不存在以及失败后没有 initiative/handoff/outbox 写入；Web 单测覆盖人话与草稿保留。
7. **验证命令**：选品决定相关 API 单测、`product-initiative-flow` PostgreSQL 集成、受影响 Web 单测、API/Web lint 与 typecheck、`repo:check`、`git diff --check`。本片不改契约/Schema/字典，`contract:drift` 只在发现意外生成差异时运行。

**禁止范围**：不校验证据是否足以支持结论、不改变 verificationState/validity 采信政策、不实现 U1 完整元数据、不新增证据评分、角色、迁移、字段、契约或页面；这些不是 S2 已定业务结果。

### 切片 `S3-unit-economics`（当前执行：S3a core）

岗位结果：“利润可接受”必须变成第二个人能复算的基准/保守两组单件金额区间；口径或币种不明不能立项。没有证据的数字只能标为待验证假设，不能冒充事实。本片不设利润率阈值、不做汇率换算。

#### A. 公共契约与唯一结构

1. 在 `product-initiative.v1` 新增两类结构，禁止用一个“看似完整”的对象混装草稿和快照：
   - `ProductInitiativeUnitEconomicsDraftV1`：命令与当前 initiative 的可恢复草稿；`channelCode`、`currencyCode`、两个情景及各区间都允许部分缺失，不含客户端计算结果。
   - `ProductInitiativeUnitEconomicsSnapshotV1`：完整、规范化且服务端已计算的快照；只在所有口径齐全时产生，approve 当前态和 NPI handoff 使用。
   - 两者的 `marketCode` 都由服务端只读继承当前机会包；命令不得另传一份市场。
   - `channelCode` 来自当前机会包；命令草稿可带 `channelCode`，服务端要求与 handoff 当前非空值一致，机会缺渠道或输入不一致均明确失败，不允许选品改写上游事实。
   - `currencyCode` 是 ISO 4217 大写代码，完整计算前必须由 master-data 内置 `CurrencyCodeReference` 解析成功。
   - `scenarios.baseline`、`scenarios.conservative`：各包含 `salePrice`、`landedCost`、`platformFee`、`fulfillmentFee`、`advertisingCost`、`returnCost` 六个单件金额区间。
   - 每个区间为 `{ min, max, basis, evidenceRefs }`；草稿属性可部分缺失，快照全部必填。`min/max` 是 0～999999999999.9999 的规范定点十进制字符串且 `min <= max`；`basis` 只允许 `evidence | assumption`。`evidence` 至少一个当前机会合法证据，`assumption` 必须 `evidenceRefs=[]`，不得以任意 UUID 冒充依据。
   - 快照每个情景包含服务端 `contribution: { min, max }`；命令和 draft 不接受计算结果。计算固定为 `售价下限 - 六类中除售价外五项成本的上限之和` 与 `售价上限 - 五项成本下限之和`。
   - `negativeConservativeReason: string | null` 独立保存在 initiative 与 handoff；只有保守情景 contribution.min < 0 时立项必填，非负时必须为空，避免无意义理由。
2. `ProductInitiativeDecisionCommandV1` 增加可选 `unitEconomicsDraft` 和 `negativeConservativeReason`；`ProductInitiativeV1` 必返可空的 `unitEconomicsDraft`、`unitEconomicsSnapshot`、`negativeConservativeReason`；`ProductInitiativeHandoffV1` 只增加可空 `unitEconomicsSnapshot` 与理由。存量均为 null，不回填。
3. 保留现有 `price_band_and_margin` 评审要点及其证据引用，不删除、不改义；S3 的结构化单位经济是新增的投资门事实，不能从旧自由文本推导。

#### B. 金额与计算

1. 在 product-selection Domain 新建独立、纯函数的单位经济模块；不依赖 Web/Prisma。金额解析与格式化只使用 `bigint` 定点 4 位，不用 `number`、浮点库或费用模块内部实现。
2. 输入规范化：允许 `0`、`1`、`1.2`、`1.2300`，统一输出最多 4 位且去除无意义尾零；拒绝负输入、指数、千分位、符号前缀、超过 12 位整数或超过 4 位小数。贡献结果可为负，规范输出负号 + 定点字符串。
3. 两情景和六项字段顺序使用固定常量，缺项错误稳定列出完整路径，例如 `unitEconomics.scenarios.baseline.salePrice.min`；不得只返回笼统“单位经济不完整”。
4. `approve` 新写入必须有完整且可计算的 `unitEconomics`，否则沿用 `PRODUCT_INITIATIVE_INCOMPLETE` 并列出单位经济缺口；defer/reject/return 可部分提交并保存为草稿，不改变它们的完成语义。
5. 同一事务内把规范输入和计算结果写入当前 initiative；`approve` 时冻结进不可变 NPI handoff。NPI 只读显示市场、渠道、币种、两情景各项区间、依据/假设标签、贡献区间和负值理由；存量 null 明确“历史交接未记录”。

#### C. 币种参考数据（负责人 2026-10-05 收窄）

1. 负责人定案直接使用所提供 `D:\aosom\Downloads\list-one.xml` 中 `Pblshd=2026-09-17` 的数据，按 alpha code 折叠地区重复后内置 178 个唯一币种；不再建设 `authorized_official` snapshot、synthetic rehearsal、staged/active/superseded release 生命周期或生产导入门禁。
2. `CurrencyCodeReference` 改为独立内置参考表：alphaCode、numericCode、minorUnit（`N.A.` 显式可空）、currencyName、sourceVersion、sourceUrl、sourceSha256、recordsSha256、sourceRowHash；alpha 与 numeric code 全局唯一。迁移直接写入 178 条确定性记录，不提交原始 XML。
3. master-data 保留稳定 `REFERENCE_CURRENCY_DIRECTORY` Port；`listActive()` 的兼容方法名直接列出全部内置币种并按 code 稳定排序，`resolve()` 只区分 `active | unknown | unavailable`：表有 178 条且代码存在为 active，表为空为 unavailable，表非空但代码不存在为 unknown；删除 inactive/release 判断。
4. 固定来源证据：source URL=`https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml`、version=`2026-09-17`、sourceSha256=`33139b438657d1cee116ba737807ea71d19d6de4b90f799a09c56f0cc6a1b0ff`、recordsSha256=`10f3266f8cfefacda248330d0612cf3b61febdcb38875432a20025bab607673d`；277 coded rows 折叠为 178 个币种，无格式、alpha 元数据或 numeric code 冲突。
5. 删除 currency snapshot generator/validator、authorized importer/verifier、synthetic fixture/seed 和对应 package scripts；其他使用 `ReferenceDataRelease` 的国家/港口/货主等参考数据不受影响。

#### D. 数据库与迁移

1. `CurrencyCodeReference` 改为不依赖 release 的内置表，迁移直接创建并写入 178 条确定性记录；每条保留 alpha/numeric/minorUnit/name 及来源版本、URL、源文件哈希、记录哈希、逐行哈希。Schema、Domain 和 PostgreSQL 约束共同保证新写形状；Repository 显式映射。
2. `ProductInitiative` 增加可空 JSON 字段 `unit_economics_draft` 与 `unit_economics_snapshot`，分别承载可恢复草稿和服务端完整计算；`ProductInitiativeHandoff` 只增加可空 `unit_economics_snapshot`。当前态与 handoff 各增加可空 `negative_conservative_reason`，handoff 只在 approve 时冻结。JSON 避免把 24 个区间端点铺成列，但 Schema、Domain 和 PostgreSQL CHECK 共同保证新写形状；Repository 显式映射，不把 JSON 当无校验袋。
3. 加法迁移保留存量 null；CHECK 约束：非 approve/returned_from_npi 可为空或部分草稿，approve/returned_from_npi 完整；handoff 要么整组 null（legacy），要么完整快照。当前任务迁移尚未进入共享环境，按负责人收窄决定原位调整，不另叠加过渡 release 迁移。
4. 数据字典把新字段标为 `confirmed_business`，引用 `doc/08` 选品单位经济权威，owner/module=`product-selection`；生成物随片更新。

#### E. 界面承接

1. 在现有选品行动 pane 内新增 `ProductInitiativeUnitEconomicsPanel`，位于“责任与资源”之后、提交动作之前；不另建页面、不复制状态。先显示只读市场/渠道与币种选择，再显示基准/保守两个可辨识分组。
2. 每个情景六项使用紧凑区间行：项目名、min、max、`有证据/待验证假设` 文字选择；有证据时就地选择当前合法 evidence，假设时不显示伪证据。前端只展示服务端返回贡献，编辑中显示“保存后由服务端计算”，不得自行算金额。
3. 服务端返回单位经济缺口时，进度头和行动按钮使用具体人话；保守贡献下限为负时，就地要求“仍要投入的理由”，不自动拦截为不立项、不显示 AI 建议阈值。
4. NPI 快照只读展示输入、标签和贡献；桌面/窄屏/移动端继续满足 S1 的 sticky 主动作和无横向溢出。金额表在窄屏改为逐项纵向，不依赖横向滚动。
5. 负责人 2026-10-05 确认方案 A：同一选品办理台内，工作详情与结果详情彻底分离。未完成任务的中间详情服务于“是否值得投入”的投资门判断；已立项任务的中间详情服务于读取已冻结并交给 NPI 的投资结论，不再渲染 disabled radio/textarea 或把当前新门槛反算成历史记录的“待补 55 项”。任务详情切换不得改变办理台三栏壳、队列和岗位上下文。
6. 结果态按 `结论与责任 → 经营机会摘要 → 单位经济与下一决策 → 评审依据摘要 → 按需展开证据/交接原文` 排列。历史没有记录的事实使用“历史未记录”聚合说明，不计入当前待办，不使用警示色冒充阻断。
7. 删除大量常驻免责声明、教学句和重复眉题；只有“为何只读”“后补事实语义”“历史为何未记录”等不影响当前动作的说明进入现有 `InfoTooltip`，并保持点击、键盘聚焦、Esc 关闭。当前状态、责任、目标/下一决策日期、引用失效、真实阻断、失败与恢复动作必须常驻。

#### F. 执行分片、验证与停止条件

1. **S3a-unit-economics-core（已完成，待 S3c 收窄）**：已交付单位经济 Domain、契约、Schema/迁移、Repository、API 与初版币种 release/importer 机制；负责人 2026-10-05 取消其中 release/importer 方案，由 S3c 原位收窄。
2. **S3b-unit-economics-ui（已完成）**：消费单位经济契约，交付选品录入、服务端计算结果/缺口显示、NPI 只读快照、Web 单测与选品到 NPI 三视口 E2E。
3. **S3c-currency-reference-simplification（已完成，提交 `35e92bad`）**：`CurrencyCodeReference` 已收窄为迁移内置的 178 币种直接表；release 关联、authorized/synthetic snapshot、importer/verifier、seed 和脚本已删除；目录 Port 与选品消费者行为保持兼容。
4. **S4-product-selection-result-mode（当前修复）**：按负责人确认的方案 A 在固定办理台三栏壳内分开未完成详情与冻结结果详情；基于当前未提交的 `ProductInitiativeReviewPanel` / `ProductSelectionWorkbench` 改动继续收口，不回退。只改 Web 视图与组件/测试，不改 API、契约、Schema、迁移、立项门槛或责任政策。
5. S4 结果详情验收：办理台 PageHeader、岗位/交接上下文、队列与右侧操作上下文栏位保持不变；中间详情只保留对象、真实结果、当前责任与下一决策，机会事实合并为紧凑摘要；评审要点每项一行显示结论/证据数/失效状态，展开才显示证据和备注；单位经济有快照时显示基准/保守贡献摘要，无快照时显示“历史立项未记录”；禁止把历史缺失渲染成当前“还不能立项/待补 N 项”。
6. S4 工作态验收：保留三栏与 sticky 主动作，但完备度按业务区域聚合，不把 48 个金额端点铺成警示墙；点击区域可定位到对应输入。大量免责声明与解释删除，必要说明使用 `InfoTooltip`，不能隐藏真实状态、当前阻断或恢复动作。
7. TDD 顺序：S3c 先完成币种目录测试与收口；S4 再先写结果态/历史快照/工作态聚合缺口的失败组件与页面测试，再改 UI，并按 1440×900、1024×768、390×844 做真实页面视觉复验。
8. S3c 定向门禁：币种目录/API 单测，product-initiative PostgreSQL 与迁移升级，空库 178 条/唯一性/来源哈希测试，contract/drift，data-dictionary generate/check，db generate，API/Web lint/typecheck/unit，选品到 NPI 三视口 E2E、`repo:check`、格式与 diff 检查。S4 增加受影响 Web 全量单测与三视口 E2E/截图复验。
9. 出现需要新增利润率、默认币种、汇率、销售量、预算或证据采信阈值时返回 `blocked` 交负责人定案；不得自行填默认。
10. 实现执行器每片完成后返回 HANDOFF；不得推送、建 PR、修改 brief 状态或覆盖不属于当前片的并行改动。

### S4 主代理验收裁决

```yaml
protocol: logix-disposition/v1
slice: S4-product-selection-result-mode
decisions:
  - finding: PS-S4-R01
    status: accepted
    reason: >
      新结果面板正确移除了 disabled 编辑器和历史“待补 N 项”，但同时遗漏 S1 已定且新立项强制写入的核心资源承诺：立项责任人、
      承接团队/岗位、资源说明、目标日期、下一决策日期。页面只显示机会领取人的 currentOwner 和下一决策问题，已交 NPI 后仍可能把
      dev-operator 标成“当前责任”，无法回答“谁接、投入什么、何时交付、何时再决定”。测试夹具也遗漏这些字段，导致回归未被发现。
      同时 DOM 把评审摘要放在单位经济之前，违背负责人确认的“单位经济与下一决策优先于评审依据”结果主线。
    writeback: 本 brief S4 E/F；doc/08 4.2 资源承诺与交接快照
  - finding: PS-S4-R02
    status: accepted
    reason: >
      负责人用真实截图复验确认：R01 修复虽补回字段，但整体仍偏离方案 A。页面保留“选品岗位工作台”眉题和长说明；队列仍有“先处理什么”、
      “经营团队判断值得进一步评估”、逐项待补/后补噪声，并在 handed_off 项上显示“已立项 · 待补 N 项”；结果页继续采用大量等权灰底字段卡，
      重复“历史未记录”，没有紧凑状态条、市场/渠道/商品范围与一次性后补说明，也没有把投资结论组织成责任资源与单位经济的双主轴。
      评审摘要还暴露 target_user_and_market 等内部 code 和“已核实（走查）”原始拼接，而非岗位可读结论。该实现满足了组件存在性，未满足
      “投资结果优先、历史缺失不冒充当前待办、删除免责声明与重复解释”的已批准视觉与业务动线。
    writeback: 本 brief S4 E/F；负责人 2026-10-05 真实截图复验
  - finding: PS-S4-R03
    status: accepted
    reason: >
      第二轮真实截图复验显示 R02 仍未关闭：1440/1024 结果页继续用 10+ 个等权灰底字段块，顶部同时保留 PageHeader、成功横幅、队列状态和重复结果头；
      390×844 首屏只看到 PageHeader、横幅、结果/责任卡与部分机会摘要，单位经济、目标日期和下一决策仍在首屏之外。负责人确认 PageHeader 作为工作台身份应保留，
      问题是其下重复表达结果的成功横幅与第二套状态头。队列继续显示“先处理什么/其他机会/含信号后补”，结果页没有市场、渠道、商品范围、验证目标、
      一次性后补说明或交接原文入口。说明实现仍在“给旧结构补字段”，而非按方案 A 建立 `PageHeader + 紧凑结果带 + 经营机会 + 投资结论/责任与下一决策 + 评审依据` 的信息架构。
    writeback: 本 brief S4 E/F；负责人第二轮 1440/1024/390 截图复验
  - finding: PS-S4-R04
    status: accepted
    reason: >
      fresh Codex 复审确认结果态 PageHeader 仍复用“核对依据与待补项，再决定是否进入正式立项评审”的工作态说明。负责人要求保留 PageHeader，
      但结果态必须改用简短已完成语义，不能继续显示当前待补/待决文案。主代理已按 TDD 增加反例并修复为“查看已冻结的立项结论与 NPI 交接”。
    writeback: 本 brief S4 uiStructure/uiForbidden；ProductSelectionWorkbench
  - finding: PS-S4-R05
    status: accepted
    reason: >
      工作态“还差 60 项”把单位经济两情景的 48 个 min/max/basis/evidenceRefs 技术字段，与目标、责任、时间、评审和币种混成一个总数；
      当前样本为 目标1 + 责任资源3 + 时间决策3 + 评审4 + 币种1 + 基准24 + 保守24 = 60。用户无法知道先做什么、去哪里补，且提示与禁用按钮
      重复同一句。底层精确缺口继续用于服务端校验，界面必须聚合为 `目标结果 / 责任与资源 / 时间与下一决策 / 评审依据 / 单位经济` 五个业务区域，
      每类显示内部缺口数并提供直接定位入口；按钮只显示主动作或“先补齐上方 5 类”，不得再展示技术字段总数。
    writeback: 本 brief S4 工作态强制结构；ProductSelectionWorkbench/ProductInitiativeOutcomePanel
  - finding: PS-S4-R06
    status: accepted
    reason: >
      负责人 2026-10-05 真实路径验收确认：从业务工作台进入选品立项后，选择已立项任务时，当前实现把“所选任务已形成结果”提升为
      “整个工作台进入结果模式”，隐藏顶部岗位/交接上下文与右侧操作上下文，并把三栏收缩为两栏。正确语义是选品岗位办理台的三栏壳始终不变：
      左侧任务队列负责切换当前对象，中间详情依据所选任务状态显示办理详情或冻结结果，右侧保持该对象的操作上下文位置；已完成对象只关闭写入口，
      不得替换整个工作台模式、改变队列语义或丢失岗位上下文。负责人进一步定案该结构为所有工作台统一全局 UI 布局不变量，而非本页特例。
    writeback: 本 brief S4 uiStructure/uiMustStayVisible；负责人 2026-10-05 真实路径验收与全局 UI 布局定案
  - finding: PS-S4-R07
    status: accepted
    reason: >
      R06 实现已恢复固定三栏和完整任务队列，但为让三视口 E2E 通过删除了结果头与投资事实必须位于首屏的 bounding-box 断言。
      新截图证据显示 1024×768 的基准/保守贡献、目标日期、下一决策日期/问题底部达到 785～855px，未满足首屏要求；390×844 在立项后
      仍保留编辑阶段滚动位置，结果头 top=-235px，截图直接从投资结论中段开始，用户看不到结果起点、队列和只读操作上下文。自动化无横向溢出
      不能替代已删除的首屏与滚动复位验收，必须恢复结果切换后的可见起点和三视口断言，不得继续降低门槛。
    writeback: 本 brief uiViewportEvidence；workbench-network E2E；负责人 2026-10-06 截图复验
  - finding: PS-S4-R08
    status: accepted
    reason: >
      R06 要求“保留完整队列”不等于恢复此前已判定为噪声的队列标题和解释。当前结果截图重新出现“先处理什么 / 其他机会”，回退了 R02/R03
      与验收反证 6/11；handed_off 行本身已正确只显示“已立项 / 历史缺失 N 类”。队列须在工作态和结果详情态都保留完整可切换对象，统一只保留
      “经营机会”或省略队列头，并删除“其他机会”分组标题及无信息量原因文案；暂缓到期等真实优先分组仍须保留。
    writeback: 本 brief S4 R02/R03/R06；ProductOpportunityQueue
  - finding: PS-S4-R09
    status: accepted
    reason: >
      R07/R08 截图与坐标已满足三视口首屏及无横向溢出，但主代理新鲜 `pnpm repo:check` 发现
      `ProductInitiativeResultPanel.vue` 新增 `margin-top: 3px`，违反 UI_SYSTEM 只允许间距令牌的门禁。该值须改为最接近的现有
      `var(--space-1)`，不得加 style-scale 豁免；修复后复跑 repo:check、focused Web 与三视口专项 E2E。
    writeback: UI_SYSTEM §7.3；ProductInitiativeResultPanel
  - finding: PS-S4-R10
    status: accepted
    reason: >
      负责人 2026-10-06 对真实工作态截图复验确认，中间详情仍把同一缺口和操作说明重复表达：五类缺口导航已经说明“先补什么”，下方又用
      “交接时未填”“暂时生成不了”“优先处理 N 项”形成第二、第三套催办；“经营团队交来了什么 / 希望选品验证 / 机会说明”与事实区拆成过多
      等权标题；“评估阶段才会出现 / 本机会适用的专业要求 / 为什么适用 / 补进去会成为……”是常驻教学文案；“立项依据 / 评审要点 /
      优先处理 N 项”再次重复导航职责。固定三栏壳下，中栏应只保留当前对象的紧凑事实、当前适用专业要求和评审依据摘要；五类导航唯一负责
      缺口定位，规则适用理由、证据流向、交接缺失语义和 withheld 原因进入 InfoTooltip 或按需展开，不得再铺说明墙或第二套缺口墙。
    writeback: 本 brief uiProgressiveDisclosure/uiForbidden；ProductOpportunityDetail/ProductEvaluationRequirementsPanel/ProductInitiativeReviewPanel
  - finding: PS-S4-R11
    status: accepted
    reason: >
      负责人追问顶部“带入”的价值后核验实现：它只在目标结果为空时，把市场、渠道、商品范围、机会说明和经营判断机械拼成一段文字写入
      objective；不补责任、资源、日期、评审或单位经济，不调用服务端、不落账。上游机会事实不等于选品负责人承诺的目标结果，机械拼接容易把
      事实摘要冒充投资目标；目标已有内容时按钮无动作，只产生“未覆盖”提示和额外视觉焦点。当前无真实岗位证据证明该捷径减少损失，删除按钮、
      提示、`productInitiativeApplyHandoff` helper 及测试/E2E 引用；未来若有样本再另行评估“用机会摘要起草”，不得在本片保留无效入口。
    writeback: 本 brief uiForbidden；ProductSelectionWorkbench/productInitiativeApplyHandoff
  - finding: PS-S4-REVIEW-01
    status: accepted
    reason: >
      fresh Codex 独立复审确认：`return_requested` 与 `handed_off` 都被 `decided` 归为只读详情，但 S4 新右栏与 PageHeader 对所有只读对象固定写成
      “结论已冻结 / 已交 NPI”。退回请求实际仍等待市场接回，责任仍在选品，尚未发生 NPI 交接；当前文案会伪造责任转移。只读壳可以共用，
      结果语义必须按 `returnPending` 分支：退回请求显示“等待市场接回 / 当前责任仍在选品”，不得出现“已交 NPI”；handed_off 保持冻结交接语义。
    writeback: doc/08 §4.2 恢复路径；ProductSelectionWorkbench
  - finding: PS-S4-REVIEW-02
    status: accepted
    reason: >
      fresh Codex 独立复审确认：专业要求的“已登记证据”来自组件本地 `registeredCodes`，任务切换不清空、重载不能恢复，会跨对象泄漏并把一次点击
      冒充服务端事实。进一步核对契约发现 `requirementCode` 只存在 Web 草稿，`registerMarketSignalEvidence` 不提交该字段，服务端 evidence candidate
      也无专业要求归属，因此当前不能可靠显示逐要求“已登记/待添加”。删除该二态标签，不扩公共契约；登记成功后继续重读服务端证据候选，评审依据
      才是证据是否可引用/已引用的权威呈现。同时按 handoffId 重建专业要求面板，避免半开表单与草稿切到另一任务。
    writeback: ProductEvaluationRequirementsPanel/ProductSelectionWorkbench；不改 API/契约
  - finding: PS-S4-R12
    status: accepted
    outcome: fixed
    reason: >
      独立 reviewer 核验发现：任务切换触发新详情请求时 `load()` 只设置 loading，旧 `detail` 仍保留；`loadToken` 只阻止迟到响应写回，不能阻止等待期间
      页面把新 `selected` 的标题/机会事实与旧 initiative 的冻结结论、责任和金额一起渲染。`initiativeReady` 只保护工作态，结果面板与右栏仍由旧
      `isInitiated` 驱动。这是当前任务切换的数据真实性风险。详情及其派生状态必须携带/核对当前 handoffId：切换后直到新 handoff 的详情加载完成，
      中栏与右栏只显示该任务正在读取，不能显示旧任务结果；同对象 `keepDraft` 证据刷新继续保留草稿和现有详情，不制造闪烁。实现现已在跨 handoff
      请求开始时清除旧详情，并拒绝响应 handoffId 不匹配；同对象 keepDraft 路径不 reset。deferred request 回归与定向 58 条通过。
    writeback: useProductInitiativeDecision/ProductSelectionWorkbench
  - finding: PS-S4-R13
    status: deferred-non-blocking
    reason: >
      独立 reviewer 核验发现：无单位经济快照时结果面板仅用 `initiative-result__history-note` 显示“历史立项未记录单位经济”，但移动端媒体查询把所有
      history-note 隐藏；贡献行又因无快照不渲染，导致 390px 历史立项完全看不出是历史缺失还是界面遗漏。该问题真实，但只影响 legacy 无快照对象的
      移动端解释，不影响当前主任务的固定工作台壳、任务切换和新立项路径；按负责人 2026-10-06 收口要求延期，不阻塞 S4 提交与集成。
    writeback: 后续 legacy 结果兼容切片候选；不在本轮继续扩单
unknowns: []
verificationGaps:
  - id: PS-S4-VG01
    status: closed
    reason: >
      端口 5173 的用户开发服务未停止、未修改。主代理在相同 development 身份下完成三视口专项 E2E 3/3，并逐张人工复核
      1440x900、1024x768、390x844：PageHeader、岗位上下文、完整任务队列、中栏详情与右栏上下文保持统一壳；结果详情关键投资事实均在首屏，
      工作详情已合并对象事实、收拢专业要求与评审依据且无重复说明墙；页面无横向溢出。R11 的“带入”按钮、提示、helper 与测试已删除，目标结果只由
      负责人手填。独立复审 REVIEW-01/02 修复后，return_requested 三处语义与责任已分轨，专业要求虚假本地证据状态已删除且任务切换草稿隔离。
      focused review-fix 35、全量 Web 148 文件/695 条、三视口专项 3/3、typecheck/lint/format/repo/build/diff 均通过。R12 修复另经 deferred request
      反例与定向 58 条验证通过；R13 按负责人收口要求转非阻塞延期。
nonBlockingSuggestions:
  - id: PS-S4-R13
    disposition: deferred
    reason: legacy 无单位经济快照的移动端缺失说明真实但不在当前主路径；后续结果兼容切片处理。
next: commit
```

修复验收反证：

1. `initiativeRecord()` 使用完整新立项契约字段：responsibleActorId、receivingTeamOrRole、resourceDescription、targetDate、nextDecisionDate、nextDecisionQuestion。结果态必须常驻显示立项责任、NPI 承接、资源、目标日期与完整下一决策点；缺失的 legacy 字段只显示“历史未记录”。
2. handed_off 结果态不得把 selected.assignedActorId 作为“当前责任”。选品页面应分别显示“立项责任人”与“已交 NPI / 承接团队或岗位”；若尚无 NPI 领取事实，不虚构具体产品负责人。
3. 结果态 DOM 顺序固定为：结论与责任 → 机会摘要 → 单位经济与时间/下一决策 → 评审摘要。评审详情继续按需展开；不恢复编辑控件或“待补 N 项”。
4. 新组件必须被 Git 跟踪并有独立组件测试，覆盖完整新快照与 legacy 缺失；复跑 focused Web、全量 Web、lint/typecheck/format/repo/build、三视口 E2E 和真实视觉截图。
5. 结果态移除页面眉题与长 summary；顶部使用一条紧凑结果带：对象标题、`已立项 · 已交 NPI`、立项责任人、目标日期/下一决策日期。不得再以“实际结果/当前责任”两个等权灰底字段重复表达状态。
6. 左侧队列删除“先处理什么”和无信息量的“经营团队判断值得进一步评估”；handed_off 项只显示“已立项”和聚合的“历史缺失 N 类”，不得显示“已立项 · 待补 N 项”。后补事实聚合为一次性状态，不逐行重复。
7. 经营机会摘要必须常驻市场、渠道、商品范围与验证目标；后补语义只显示一次 `含后补事实 + InfoTooltip`。事实与经营判断并排，证据折叠；原始交接仅按需展开。
8. 投资结果使用两个主区而非多张等权字段卡：左侧 `投资结论`（目标结果 + 单位经济贡献摘要），右侧 `责任与下一决策`（立项责任人、NPI 承接、资源、目标日期、下一决策日期/问题）。相同的“历史未记录”按业务类别聚合一次，不为每个字段复制灰卡。
9. 评审依据每项单行使用岗位文案：要点名、结论档位、证据数、引用失效；禁止展示 `target_user_and_market` 等内部 code，禁止把“已核实（走查）”等存储拼接原样作为主结论。展开后才显示原文、备注与证据详情。
10. 视觉验收不以 text contains 代替：三视口截图必须证明首屏先看到结果、责任、经济性与下一决策；桌面结果态不超过 2 个主要内容层级、无横向溢出；移动端顺序为结果 → 机会 → 投资摘要 → 评审依据 → 原文。对比负责人截图，常驻“历史未记录”不得形成重复墙。
11. 结果态保留单个 `PageHeader` 作为工作台身份、标题和简短目的说明；删除其下重复表达“已立项”的成功横幅，以及结果组件中再次重复页面身份的 eyebrow/长说明。PageHeader 下直接进入紧凑结果带；队列头只保留“经营机会”或直接省略，删除“先处理什么/其他机会/经营团队判断值得进一步评估”，后补仅一个短标记 + tooltip。
12. 桌面主要结构最多四块：结果带、经营机会、两列投资摘要、评审依据；单块内部用 definition rows/分隔线，不为每个字段单独铺灰底。1440/1024 截图中目标日期、下一决策日期/问题、基准/保守贡献必须在首屏可见。
13. 390×844 截图首屏必须至少完整显示：状态+对象、立项责任/NPI 承接、基准/保守贡献、目标日期、下一决策日期/问题；经营机会摘要可紧随其后，评审依据在下方。若空间不足，压缩页头和队列，不得牺牲投资摘要。
14. 结果态经营机会必须显示 `市场 · 渠道 · 商品范围`、验证目标、事实/经营判断与证据折叠；当字段来自后补时只在对象级显示一次“含后补事实”及 tooltip，不重复每字段标签。交接原文提供折叠入口。
15. 自动化结构断言增加：结果态只有一个 PageHeader、无 success duplicate/第二套页面说明、队列无上述噪声词、主内容灰底数据块数量受限、内部 code 不可见；E2E 记录关键元素 bounding boxes，断言三视口投资摘要在首屏。截图必须由主代理肉眼验收，不能只报告数字。
16. 工作态缺口必须按五个业务区域聚合：`目标结果`、`责任与资源`、`时间与下一决策`、`评审依据`、`单位经济`。每类显示真实内部缺口数，但不得把 min/max/basis/evidenceRefs 等端点总数作为主 CTA；点击区域入口须将焦点/滚动定位到对应输入组。单位经济可在展开后按基准/保守情景和金额项说明具体缺什么。
17. 工作态顶部改为“还差 N 类”及区域入口；主按钮禁用时显示“先补齐上方 N 类”，旁边只保留一处原因说明。补齐任一区域后类别数单调减少，全部齐备后显示“立项并交给产品开发”。测试须证明空草稿为 5 类而不是 60/61 项，并覆盖每类定位目标存在。
18. 五类入口必须解决“在哪里补”：`目标结果` 聚焦目标结果输入；`责任与资源` 聚焦责任承诺组；`时间与下一决策` 聚焦日期/问题组；`评审依据` 滚动到评审面板并展开第一个缺口；`单位经济` 聚焦币种或第一个缺失金额项。区域入口使用按钮或链接语义，支持键盘触发；定位后目标获得可见焦点，不能只滚动到附近。
19. 专业要求面板删除“评估阶段才会出现”“规则生成/这里管拿依据”等教学段落；常驻只保留适用要求名和添加证据动作。适用理由和证据如何进入评审放入 `InfoTooltip`；逐要求证据状态因当前服务端契约不能证明而不得显示，证据候选与引用事实统一在评审依据呈现。暂时生成不了的要求压成一行状态，可展开查看原因，不再用大面积蓝色说明块抢占注意力。
20. 评审面板删除“立项依据/评审要点/优先处理 N 项”等重复标题链；只保留“评审依据”与五个摘要行。每行显示缺证据/缺结论/已齐，点击缺口入口时自动展开对应项。展开内容直接进入证据选择和判断，不重复“证据/判断/暂无证据”等多层标签。
21. 选品办理台的三栏壳不得由当前选中任务的结果状态控制：PageHeader、岗位/交接上下文、左侧任务队列、中间详情区和右侧操作上下文的区域顺序及网格宽度保持办理态；删除整页 `selection-workbench--initiated` / `workbench-grid--initiated` 模式切换。
22. 左侧选择任务只更新 `handoffId` 和当前对象。中间详情依据该对象状态局部切换：未完成对象显示机会事实、专业要求与评审依据；已立项对象显示 `ProductInitiativeResultPanel` 冻结结果。随后选择另一条未完成对象，必须恢复该对象的办理详情，且队列、页头和三栏壳全程不卸载、不改序。
23. 右侧操作上下文始终保留原栏位。未完成对象显示接收或立项动作；已立项对象显示紧凑只读状态，明确“结论已冻结/已交 NPI”、当前责任去向及无可编辑动作，不得重新显示提交控件，也不得删除整栏造成布局跳变。
24. 回归测试先构造同一队列中一条办理中任务与一条 handed_off 任务：点击 handed_off 后断言三栏、工作上下文和队列仍存在，仅中栏出现结果详情且右栏为只读状态；再点回办理中任务，断言中栏恢复办理详情与右栏动作。该测试必须在修复前因当前两栏整页 Mode 失败，再实施最小修复。
25. 已立项详情显示后必须把应用内容滚动容器恢复到能看到 PageHeader、岗位/交接上下文和结果详情起点的位置；不得沿用单位经济编辑阶段的深滚动位置。E2E 必须恢复并保留结果头、基准/保守贡献、目标日期、下一决策日期/问题的三视口 bounding-box 断言；若 1024/390 因固定壳占位无法满足，则压缩结果详情的首屏信息密度，不删除断言。
26. 完整队列在所有任务状态下保持可切换，但队列头只保留“经营机会”或省略；标准组不显示“其他机会”，无 initiative 的对象不显示“经营团队判断值得进一步评估”。真实优先分组（如“暂缓到期”）继续显示，不得为去噪破坏优先级。
27. 工作态中栏的对象事实合并为一个紧凑区：对象标题 + 市场/渠道/商品范围 + 验证目标 + 事实/经营判断 + 证据数；删除“经营团队交来了什么”“希望选品验证”“机会说明”等重复眉题。交接缺失只保留一次短状态及 InfoTooltip，原始快照继续按需展开，不再常驻逐项标签和说明段。
28. 专业要求区只保留“专业要求”标题、每项要求名和“添加证据”动作。删除“评估阶段才会出现”“本机会适用的”“这里管拿依据”等教学段落；适用理由和进入哪个评审要点通过既有 InfoTooltip 按需查看。当前契约无法证明逐要求证据状态，因此不显示“已登记/待添加”；真实候选与引用状态在评审依据统一呈现。withheld 压成一行“另有 N 项待商品范围后生成”，展开后才显示名称和缺失原因，不使用大面积蓝色说明块。
29. 评审区只保留单个“评审依据”标题和五个摘要行；删除“立项依据 / 评审要点 / 优先处理 N 项”标题链。五类导航激活评审区域时自动展开第一个缺口；摘要行已表达“缺证据 / 缺结论 / 已齐”，展开后直接进入引用证据和判断，不再显示“证据 / 暂无已引用证据 / 暂无可引用证据”等重复空话，只有可操作入口或真实失效原因常驻。
30. R10 的截图验收同时覆盖工作态 1440×900、1024×768、390×844：同一中栏可快速识别对象、当前事实、唯一缺口导航和当前编辑区域；删除的文案不得残留，纵向高度须明显低于负责人 2026-10-06 截图，不得以缩小字号或隐藏真实事实换密度。
31. 删除进度头“带入”按钮、`applyNotice` 成功/未覆盖提示、`applyHandoffToObjective` / `buildObjectiveFromHandoff` 及其专用测试和 E2E 操作。目标结果必须由选品负责人明确填写；上游市场/渠道/范围/机会说明/经营判断继续作为旁边可见事实，不得机械拼接成 objective。移除后进度头只保留完备度与进度条，不新增替代按钮或默认值。
32. R11 回归测试须断言工作态无“带入”入口，目标结果初始为空且不会因加载/选择任务自动变化；手工填写目标结果后五类缺口从 5 降为 4，证明进度仍由真实草稿驱动。
33. `return_requested` 与 `handed_off` 都保持只读详情和固定三栏壳，但文案、责任和交接事实必须分轨：前者 PageHeader/中栏状态/右栏显示“等待市场接回”，右栏常驻“当前责任仍在选品”，全页不得出现“已交 NPI”或 NPI 承接已成立；后者继续显示“已立项 · 已交 NPI / 结论已冻结 / 当前承接”。页面测试分别覆盖两种去向，不得只断言中栏没有误显示。
34. 专业要求区不得显示无法由服务端证明的逐要求“已登记证据 / 待添加证据”状态；删除 `registeredCodes` 与相应测试。要求行只保留名称、InfoTooltip 和添加动作。`ProductEvaluationRequirementsPanel` 必须以当前 handoffId 为 key 或显式重置，在任务 A 半开表单并填写草稿后切到任务 B 时，表单关闭且草稿不可见；切回 A 也不得把未提交草稿冒充已登记事实。成功登记后的服务端候选刷新继续由现有 `reloadInitiative()` 证明。
35. 任务详情必须与当前 `handoffId` 绑定。测试用 deferred promise 构造 A=`handed_off`、B=`accepted/needs_decision`：A 已显示冻结结果后点击 B，在 B 的详情请求 resolve 前，中栏不得出现 B 标题配 A 结果、右栏不得出现 A 的已交 NPI/冻结责任，只显示 B 正在读取；resolve 后只显示 B 的工作详情和动作。反向快速切换与迟到 A 响应仍由 loadToken 拒绝。实现优先为 detail/current handoff identity gate，不得在切换时无条件 reset 破坏同对象 `keepDraft` 刷新。
36. 历史 initiative 的 `unitEconomicsSnapshot=null` 时，1440×900、1024×768、390×844 均须在投资结论区显示一次“历史立项未记录单位经济”；该说明不使用 warn/risk、不进入当前待补类别。移动端只可隐藏机会区重复的 `历史缺失 N 类`，不得用共用 class 隐藏单位经济缺失。组件测试与 390×844 实际渲染都须覆盖。

### S3c 主代理验收裁决

```yaml
protocol: logix-disposition/v1
slice: S3c-currency-reference-simplification
decisions:
  - finding: PS-S3C-R01
    status: accepted
    reason: >
      负责人已取消 authorized snapshot、active release 与许可部署门禁，但单位经济迁移尾注仍声称生产启用依赖 approved official
      active release；TIME_CURRENCY_REFERENCE_CONTRACT_V1 仍把 CURRENCY_INACTIVE 列为当前稳定错误码，Web 也保留不可达的 inactive
      翻译。这三处会让代码、权威和运维说明继续传播已取消政策，必须在 S3c 同步删除或改为直接表语义。
    writeback: 本 brief S3c C/F；doc/08 4.2；TIME_CURRENCY_REFERENCE_CONTRACT_V1
  - finding: PS-S3C-R02
    status: accepted
    reason: >
      TIME_CURRENCY_REFERENCE_CONTRACT_V1 的迁移内置措辞是负责人新政策的必要权威同步；该文件已在 authorityRefs 但遗漏于
      writeScopes。主代理补入精确写入范围，不扩大生产实现。
    writeback: 本 brief frontmatter
unknowns: []
verificationGaps:
  - id: PS-S3C-VG01
    status: non-blocking-external
    reason: >
      repo:check 当前只因未归属的 ProductInitiativeReviewPanel.vue 使用裸 padding-top:2px 失败；该文件属于已批准、排在 S3c 后的
      S4 UI 现有工作，S3c 未覆盖。主代理逐条核验迁移 178 条与负责人提供 XML 完全一致，alpha/numeric/id 唯一且逐行哈希无误。
  - id: PS-S3C-VG02
    status: closed
    reason: >
      PS-S3C-R01/R02 已收口：迁移删除 active release gate 注释，时间/币种权威移除 CURRENCY_INACTIVE，Web 删除不可达翻译，
      TIME_CURRENCY_REFERENCE_CONTRACT_V1 已纳入精确 writeScopes。API 28、Web 27、PostgreSQL 45 及 db/contract/dictionary/lint/typecheck/format/diff 均通过。
nonBlockingSuggestions: []
next: review
```

修复验收反证：

1. 删除迁移中 approved official active release 的生产 gate 尾注，改成内置 178 币种及来源哈希语义；不得恢复 importer/release 流程。
2. `TIME_CURRENCY_REFERENCE_CONTRACT_V1.md` 当前稳定错误码移除 `CURRENCY_INACTIVE`，说明内置表只区分 unknown 与目录 unavailable；Web 删除不可达的 inactive 错误翻译及对应测试（若有）。
3. 复跑币种目录/单位经济/API 单测、两条 product-initiative PostgreSQL 集成、db generate、contract/drift、dictionary check、API/Web lint/typecheck、受影响格式和 diff；`repo:check` 若仍仅由未归属 Web 裸值失败，按路径如实报告，不修改该文件。

**一手来源**：负责人提供 `D:\aosom\Downloads\list-one.xml`，根属性 `Pblshd=2026-09-17`。S3c 只提交迁移内置的 178 个折叠币种记录和来源哈希，不提交原始 XML；该文件已核验为 277 coded rows、178 个唯一币种、无格式/alpha 元数据/numeric code 冲突。

## 业务步骤五面映射

| 业务步骤与岗位结果   | 岗位任务来源/状态   | 相关数据事实子集                                     | 技术保障                                        | 权限边界                                                 | 界面承接                           | 验收证据/状态 |
| -------------------- | ------------------- | ---------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------------------------- | ------------- |
| 立项并承诺资源       | PS-D01/D02 approved | 立项责任人、承接团队、资源说明、目标日期、下一决策点 | 同事务写立项与不可变快照；幂等、expectedVersion | `planning.draft`；actor 来自认证身份；须已接受（MS-D04） | “由我负责”+ 四项承诺；缺项逐项提示 | S1 待验       |
| 暂缓并约定重判       | PS-D03 approved     | 验证重点、重判日期                                   | 日期校验；待补不关闭                            | 同上                                                     | “验证什么”“哪天重判”               | S1 待验       |
| 到期重判             | PS-D03 approved     | 重判日期 × 当前日期                                  | 稳定排序分页；派生投影，不存逾期状态            | `planning.read`；租户隔离                                | 队列最前“暂缓到期”分组             | S1 待验       |
| NPI 看到立项承诺     | 基线差距 8          | 交接快照中的承诺                                     | 快照不可变                                      | 沿用 NPI 读取能力                                        | NPI 交接详情只读                   | S1 待验       |
| 复算利润并据口径立项 | UE-D01/D02 approved | 币种、渠道、两情景单件区间、证据/假设标记、贡献区间  | 领域单一计算；定点十进制；快照冻结              | 同立项                                                   | 两情景并排、缺项与负值理由就地提示 | S3 待验       |
| 评审证据可信         | 基线差距 1          | 证据存在、租户、来源信号                             | 写入时核验，稳定错误码                          | 跨租户拒绝                                               | 指出具体无效引用                   | S2 待验       |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                                                                   | 当前证据/来源                                                                                         | 建议承载方式                                     | 决策 ID                | 决策与实现状态               |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------- | ---------------------------- |
| `current_physical`   | 当前认证用户显式接受立项责任；资源承诺与暂缓重判已落当前态和不可变 NPI 快照 | `database/schema.prisma`、`ProductInitiative` / `ProductInitiativeHandoff`、S1 PostgreSQL 集成        | 已有                                             | PS-D01～D03            | implemented                  |
| `current_physical`   | 评审证据写入时按当前租户与当前机会来源信号核验；无效引用整体拒绝且不落账    | `DecideProductInitiativeService`、`READ_EVIDENCE_REFS`、`product-initiative-flow.integration.test.ts` | 已有                                             | S2                     | implemented                  |
| `approved_gap`       | 资源承诺四项、立项责任、暂缓验证重点与重判日期、证据核验、两情景单位经济    | `选品立项.md` 已定基线（负责人 2026-10-04 确认）；PS-D01～D03、UE-D01/UE-D02                          | 列 + CHECK、JSON 草稿/快照、不可变快照、派生队列 | PS-D01～D03、UE-D01/02 | S1/S2 implemented；S3 coding |
| `industry_candidate` | 预算区间、逾期标记、指定他人为立项责任人                                    | 本轮未采纳选项 B                                                                                      | `undecided`                                      | PS-D01～D03            | 不进入本任务                 |

## 23 台共同最低可用线（本任务承接）

| 基线     | 本任务承接                           | 状态 |
| -------- | ------------------------------------ | ---- |
| `WB-B04` | 立项责任人、下一决策点、暂缓重判日期 | S1   |
| `WB-B05` | 证据事实可信                         | S2   |
| `WB-B07` | 交接快照携带承诺且不可变             | S1   |
| 其余     | 后续切片；WB-B10 需真实岗位六类路径  | —    |

## S1 主代理验收裁决

```yaml
protocol: logix-disposition/v1
slice: S1-resource-commitment
decisions:
  - finding: PS-S1-R01
    status: accepted
    reason: >
      brief 要求暂缓的验证重点与重判日期缺任一项时“待补、不关闭”。当前领域只用 reason 判断 completion；只填
      validationFocus、缺 reconsiderationDate 时实际返回 completed/deferred，且数据库 defer plan CHECK 会拒绝半组写入。
      这会让无重判日期的暂缓事项错误关闭或保存失败，是当前业务恢复路径与数据一致性风险。
    writeback: 本 brief S1；doc/08 选品立项资源责任
  - finding: PS-S1-R02
    status: accepted
    reason: >
      服务端投影按 pageSize/cursor 稳定分页，但 Web 固定只取 pageSize=200 的第一页并把缺失投影视为“还没看过”。
      超过 200 条立项记录时，后续机会的到期暂缓事实会消失，无法保证“到期项出现在队列最前、不重不漏”。
      修复只需完整消费投影分页并增加跨页反例，不扩展业务政策。
    writeback: 本 brief S1
  - finding: PS-S1-R03
    status: accepted
    reason: >
      PS-D01～D03 已由负责人批准，doc/08 在本片正式写回；当前字典却把新责任、资源、日期和验证字段标成
      needs_business_confirmation、无 owner/source，形成“代码已落库、数据权威仍宣称未知”的第二套事实。
      必须按已定业务含义补齐字典注释并重新生成，不新增字段或政策。
    writeback: 本 brief S1；doc/08 选品立项资源责任
  - finding: PS-S1-R04
    status: accepted
    reason: >
      ProductNpiWorkbench.test.ts 与新增 ProductOpportunityQueue.test.ts 都覆盖 S1 明确要求的 NPI 只读承诺和到期分组，
      属当前业务路径而非扩单；主代理补入 writeScopes。分页修复允许补 useProductOpportunityWorkbench 及其测试的精确范围。
    writeback: 本 brief frontmatter
  - finding: PS-S1-R05
    status: accepted
    reason: >
      R02 修复已完整消费立项投影分页，但工作台的机会源仍只调用一次 listProductOpportunities()，默认最多 100 条。
      第 101 条之后的机会即使对应“暂缓到期”投影，也不会进入 UI 对象集合，因而无法出现在第一组。
      必须在当前 workbench 消费完机会分页并保留服务端顺序；只做本台局部消费，不建设通用分页抽象。
    writeback: 本 brief S1
  - finding: PS-S1-R06
    status: accepted
    reason: >
      半填暂缓经服务端保存为 pending_completion / needs_decision 后，Web 仍固定回执“已暂缓，仍留在选品队列”。
      这与实际落账不符，会让岗位误以为重判承诺已经成立。回执必须读取保存响应的 currentDestination：只有 deferred
      才称“已暂缓”，needs_decision 明确提示已保存但仍待补验证重点或重判日期。
    writeback: 本 brief S1
  - finding: PS-S1-R07
    status: accepted
    reason: >
      主代理在真实应用中按 1440×900、1024×768、390×844 三视口检查：页面无横向溢出且令牌、状态文字、窄屏单列成立，
      但新增承诺项与既有评审形成 2914/4042/5361px 长页；主 CTA 距首屏约 826/3249/4492px，不能持续可达。
      同时进度头显示“必填剩 11 · 已齐 0/5”，分母仍只算目标结果和四项门槛，已与七项新增必填不一致。
      这违反 UI_SYSTEM UI-D06/UI-D10 与改版规范的一屏焦点、常驻行动条和真实完备度要求，属于当前岗位可用性风险。
    writeback: 本 brief S1；UI_SYSTEM §3/§5 与 WORKBENCH_VISUAL_FLOW_REDESIGN §2/§5
  - finding: PS-S1-R08
    status: accepted
    reason: >
      新迁移的 resource commitment CHECK 仅允许承诺字段非空时 outcome=approve；现有 NPI 回程会把当前立项行改成
      returned_from_npi 而保留承诺字段，PostgreSQL 必然拒绝，直接破坏已定恢复路径。修复应允许已承诺的当前行进入
      returned_from_npi 并保留事实，不改写不可变 handoff；增加“立项→NPI 领取→退回选品”真实 PostgreSQL 集成反例。
    writeback: 本 brief S1；doc/08 §4.2 交接快照与恢复
  - finding: PS-S1-R09
    status: accepted
    reason: >
      legacy handoff 的 responsibilityAccepted=null 表示没有显式责任承诺，responsibleActorId 仅能证明历史操作人。
      NPI 详情无条件标为“立项责任人”会伪造责任；仅 true 时显示 actor，null 时显示“历史交接未记录”。
    writeback: 本 brief S1；doc/08 §4.2 存量快照规则
  - finding: PS-S1-R10
    status: accepted
    reason: >
      outcomeHintFor 只看 reason，未接收 reconsiderationDate；暂缓只填验证重点时会预告“提交后关闭”，而服务端正确保存为
      pending_completion/needs_decision。提示和 CTA 必须同时依据验证重点与重判日期：两项齐全才预测关闭，半填或全缺都明确待补。
    writeback: 本 brief S1
unknowns: []
verificationGaps:
  - 完整 validate 按 brief 留到任务级最终集成候选；S1 的定向门禁、真实三视口与独立复审 finding 修复已完成。
nonBlockingSuggestions: []
next: S2-evidence-integrity
```

修复验收反证：

1. 领域单测分别覆盖“只填验证重点”和“只填重判日期”，两者都必须保存为 `pending_completion / needs_decision`；两项齐全才是 `completed / deferred`，迁移 CHECK 不拒绝待补形态。
2. Web 单测构造超过一页的立项投影，证明继续请求 `nextCursor`，跨页的到期暂缓仍进入第一组；请求失败时不得把缺失投影伪装成未处理。
3. 新增字段的数据字典注释使用 `confirmed_business`、`moduleCode/ownerModule=product-selection`，引用正式选品工作台权威；重新生成后 `data-dictionary:check` 通过。
4. 复跑 S1 交接中的全部定向检查；不为范围外重构、通用分页抽象或未来人员目录扩单。
5. Web 单测构造超过 100 条机会、到期项位于第二页，证明继续请求机会 `nextCursor` 且该项进入“暂缓到期”第一组；重复 cursor 必须明确失败，不能无限请求或静默截断。
6. Web 单测分别模拟暂缓保存响应为 `needs_decision` 与 `deferred`：前者回执“已保存、仍待补”，后者才回执“已暂缓”；两者都以服务端响应为准。
7. 进度头的总必填数必须由当前 `blockingGaps` 对应的完整门槛集合计算：空草稿显示 `必填剩 11 · 已齐 0/11`；逐项补齐后单调到 `11/11`，不得硬编码旧分母 5。
8. 立项输入把“由我负责 + 承接团队/岗位 + 资源说明”组织为责任与资源组，把目标日期、下一决策日期和问题组织为时间与下一决策组；组标题和 helper 使用现有人话与 token，不增字段、不改业务政策。
9. 保留现有桌面三栏。桌面行动 pane 在应用内容滚动容器内 sticky 且主 CTA 在 1440×900 可达；≤1100px 与移动端只在同一行动 pane 内提供 sticky 底部动作区，不能复制业务按钮或另存状态。覆盖 1440×900、1024×768、390×844 结构断言、无横向溢出和真实页面视觉复验。
10. PostgreSQL 集成测试走完“带完整承诺立项 → NPI 领取 → NPI 退回选品”，当前立项行允许转为 `returned_from_npi` 且保留责任/资源承诺；不可变 handoff 值不变。迁移 CHECK 同时继续拒绝非立项/非回程状态携带伪造承诺。
11. NPI UI 测试覆盖 legacy `responsibilityAccepted=null` 显示“历史交接未记录”，新快照 `true` 才显示 `responsibleActorId`；不得从 actor 字段自行推断承诺。
12. 提示函数和组件测试覆盖暂缓四种组合：全缺、只填验证重点、只填重判日期均提示“保存为待补、不关闭”；两项齐全才提示“提交后关闭”。移动 CTA 文案不得反向暗示半填已成立。

## S3a 主代理验收裁决

```yaml
protocol: logix-disposition/v1
slice: S3a-unit-economics-core
decisions:
  - finding: PS-S3A-R01
    status: accepted
    reason: >
      迁移宣称 Domain + Schema + PostgreSQL CHECK 共同保证快照形状，但主代理以同一 CHECK 建临时表后插入
      min="garbage"、assumption 带非 UUID evidenceRefs 的完整外壳，数据库实际接受并输出 INVALID_SNAPSHOT_ACCEPTED。
      当前 CHECK 只数键和 contribution，未逐项验证 min/max/basis/evidenceRefs；负值理由对 NULL 也受 SQL 三值逻辑影响。
      这会允许绕过应用写入的 JSON 破坏不可变 NPI 快照，属于当前数据真实性风险。
    writeback: 本 brief S3a D/F
  - finding: PS-S3A-R02
    status: accepted
    reason: >
      active currency 仅有内部 Port，没有公共契约/API 向 S3b 提供可选项；按 S3b 不改 S3a 契约的边界，UI 只能手输或硬编码，
      与“只从 active 参考数据选择”冲突。最小修复是在 ProductInitiativeDetailV1 增加 currencyOptions，
      GetProductInitiativeService 通过 REFERENCE_CURRENCY_DIRECTORY.listActive() 返回 code/name/minorUnit，不建维护后台或新 Controller。
    writeback: 本 brief S3a A/C/F
  - finding: PS-S3A-R03
    status: accepted
    reason: >
      resolve() 在找不到 active 行后，只要存在 staged/superseded 行就统一返回 inactive。默认 db:seed 会写 staged synthetic USD，
      因而生产参考数据未就绪时会错误报“USD 已停用”。Port 必须区分 unavailable（没有 active release）与 inactive
      （存在 active release，但该 code 仅在非 active 历史 release 中），服务端返回稳定 REFERENCE_CURRENCY_RELEASE_UNAVAILABLE。
    writeback: 本 brief S3a C
  - finding: PS-S3A-R04
    status: accepted
    reason: >
      generator 能生成 authorized_official snapshot，但 seed 函数和路径硬编码 synthetic fixture、类型固定 synthetic_rehearsal、
      并拒绝非 staged；仓库没有官方 snapshot 导入/激活命令，deployment gate 无法被执行关闭。必须提供受审计 CLI：
      对外部 authorized snapshot 复用 validator，事务导入记录、supersede 旧 active、activate 新 release，并提供 verify 命令；
      不提交官方数据、不自动联网、不允许 synthetic 激活。
    writeback: 本 brief S3a C/F
  - finding: PS-S3A-R05
    status: accepted
    reason: >
      5 个下游集成测试只把既有合法 approve fixture 补齐渠道、资源承诺和单位经济，共享 fixture 消除重复；两个 module manifest
      只登记新增 Port 与依赖边。它们是新 approve 不变量和仓库治理的当前兼容范围，不改变下游业务断言；主代理补入 writeScopes。
    writeback: 本 brief frontmatter
  - finding: PS-S3A-R06
    status: accepted
    reason: >
      Domain 对完整但保守贡献为负、未填理由的 draft 生成 snapshot 并把 negativeConservativeReason 记为 pending；这对 defer/reject/return
      应允许保存草稿。Repository 会写 snapshot + null reason，但 PostgreSQL validator 对任何 snapshot 都要求负值理由，导致非 approve 去向
      被数据库拒绝，违背“单位经济可部分保存，不阻塞暂缓或不立项”。数据库只应在 terminal approve/returned_from_npi 或 handoff
      快照强制负值理由；当前态非 terminal snapshot 可带 pending reason 缺口。
    writeback: 本 brief S3a B/D
  - finding: PS-S3A-R07
    status: accepted
    reason: >
      主代理在回滚事务中插入 authority='UNTRUSTED TEST AUTHORITY'、datasetCode='ISO_4217_LIST_ONE' 的 active release 与 ZZZ，
      `REFERENCE_CURRENCY_DIRECTORY.resolve('ZZZ')` 实际返回 active。directory、importer supersede 和 verifier 都只按 datasetCode/status，
      未共同限定 authority='SIX'，会让任意同名数据集冒充 ISO 4217 权威或被官方导入错误 supersede。
      所有读取、唯一 active 判断、supersede 和 verify 必须同时限定 SIX + datasetCode；数据库现有唯一索引已按 authority+datasetCode 分轨。
    writeback: 本 brief S3a C/F
unknowns: []
verificationGaps:
  - id: PS-S3A-VG01
    status: deferred-non-blocking
    reason: >
      fresh Codex 确认当前代码与查询条件正确且没有可复现业务风险；验收反证 7 明确允许 PostgreSQL 或 Prisma adapter
      反例，现有 adapter 查询断言已覆盖 importer supersede 与 verifier 的 SIX + datasetCode 边界，真实 PostgreSQL 已覆盖目录隔离。
      临时 schema 的 importer/verifier 全事务反例可增强证据，但不阻塞当前切片。
nonBlockingSuggestions:
  - id: PS-S3A-NBS01
    disposition: deferred
    reason: >
      临时 schema 的跨 authority importer/verifier 事务测试是额外纵深，不改变当前消费者结果、数据边界或发布安全；待后续参考数据
      运维测试切片与其他 authority 场景共同收口，避免为本片重复铺基础设施。
  - id: PS-S3A-NBS02
    disposition: rejected
    reason: >
      importer 在激活前已对 authorized snapshot 做 SIX + datasetCode 强校验，并按 authority_datasetCode_version 复合身份查找或创建；随后
      id 来自该已验证 release。给 update 再叠相同条件并断言行数只增加防御性重复，不修复当前可达风险。
next: S3b-unit-economics-ui
```

修复验收反证：

1. 迁移升级 PostgreSQL 测试逐项插入非法 snapshot：非法/缺失 min/max、min>max、basis 非法、assumption 有 refs、evidence 空 refs/非 UUID、缺 contribution、贡献非法、负值理由 NULL；均须由具体 CHECK 拒绝。合法 snapshot 与 legacy null 通过。CHECK 可以调用 immutable SQL function 校验 JSON，但函数和约束必须由同一迁移创建、可升级验证且不复制第二套业务计算。
2. `ProductInitiativeDetailV1.currencyOptions` 使用正式契约类型 `{ code, name, minorUnit }[]`；只返回 active release、按 code 稳定排序。无 active release 返回空列表供页面明确显示“币种参考数据未接通”，写操作则稳定失败 `REFERENCE_CURRENCY_RELEASE_UNAVAILABLE`。
3. `REFERENCE_CURRENCY_DIRECTORY.resolve` 区分 `active | inactive | unknown | unavailable`：先查 active release 是否存在；无 active release 为 unavailable；有 active release且 code 在该 release 中为 active；仅历史/superseded含该 code 为 inactive；完全不存在为 unknown。
4. 新增只读/离线 CLI（精确路径写回当前 brief）：`currency:snapshot:validate` 校验外部 snapshot；`db:import:currency-reference -- <snapshot>` 只接受 `authorized_official` 且许可/来源/hash 完整，事务导入并激活；`db:verify:currency-reference-data` 验证唯一 active release、元数据、记录数与 hash。不得联网下载或提交 official snapshot。synthetic seed 始终 staged，任何激活尝试失败。
5. 下游兼容测试只引用共享合法 fixture，不改原业务断言；manifest 只登记 `REFERENCE_CURRENCY_DIRECTORY` 与 product-selection→master-data 依赖。
6. PostgreSQL flow 增加完整负贡献单位经济在 `defer`（验证计划齐全）、`reject`（原因齐全）和 `return_to_market`（原因/依据齐全）且无 negative reason 的保存反例：当前态保存 draft/snapshot、pending 含 `negativeConservativeReason`，不生成 handoff；同样输入用于 approve 必须被 Domain 门槛拒绝。NPI handoff 和 returned_from_npi 仍必须带理由。
7. 币种目录、importer、verifier 的所有 release 查询/更新都同时限定 `authority='SIX'` 与 `datasetCode='ISO_4217_LIST_ONE'`。增加回滚 PostgreSQL 或 Prisma adapter 反例：其他 authority 的同名 active ZZZ 不出现在 listActive/resolve，不被 SIX importer supersede，也不被 verifier 计入；SIX staged-only 仍为 unavailable。

## S3b 主代理验收裁决

```yaml
protocol: logix-disposition/v1
slice: S3b-unit-economics-ui
decisions:
  - finding: PS-S3B-R01
    status: accepted
    reason: >
      useProductInitiativeDecision.decide() 对服务端 400 PRODUCT_INITIATIVE_INCOMPLETE 会把人话写入 initiativeError，并正确把
      negativeConservativeReason 记入服务端单位经济缺口；但 ProductSelectionWorkbench 的 initiativeReady 同时要求
      !initiativeError，导致同一次响应后整个 ProductInitiativeOutcomePanel、单位经济输入和主动作被隐藏，只剩“重新加载”。
      负责人无法按 brief 要求就地填写“仍要投入的理由”；点击重新加载还会用未保存的服务端旧值 hydrate，丢失本次完整单位经济草稿。
      这是当前负贡献立项恢复路径的可复现业务阻塞，不是一般错误提示偏好。
    writeback: 本 brief S3b E/F
  - finding: PS-S3B-R02
    status: accepted
    reason: >
      ListProductOpportunitiesService 与 IntakeProductOpportunityService 已使用 READ_MARKET_SIGNAL_LIVE + mergeHandoffWithSignalLive，
      把原始不可变 handoff 的空 market/channel 用同一来源信号当前态补全为工作视图，同时保留 handoffSnapshot；这是现有已测试的正式
      业务投影。S3b 从该工作视图显示并提交 channelCode，但 DecideProductInitiativeService 仍只从 repository 返回的原始 handoff
      读取 market/channel。原始交接为空、信号后补后，页面显示完整却必然被服务端以 channel mismatch 或 market 缺失拒绝，且岗位无可执行恢复入口。
      决定服务必须复用既有 live-signal 补全规则，不能让 Web 猜测或改写不可变 handoff。
    writeback: 本 brief S3b A/E/F
unknowns: []
verificationGaps:
  - id: PS-S3B-VG01
    status: closed
    reason: >
      主代理在 R02 修复后新鲜复跑 API 单测、真实 PostgreSQL flow、Web 145 文件 682 条、三视口专项 E2E 63 条、完整 E2E
      169 passed / 7 skipped，以及 API/Web lint、typecheck、受控路径格式、repo/diff 和 build，均通过。
  - id: PS-TASK-VG01
    status: non-blocking-environment
    reason: >
      最终 pnpm validate 在 repo/contract/drift/dictionary/db generate/lint 通过后，根 format:check 枚举已被 .prettierignore 排除且与本任务无关的
      apps/ai-service/.pytest_cache 时被 Windows ACL 以 EPERM 拒绝，因而整条命令退出 2。未删除缓存或修改权限；随后对 API、Web、database、contracts、
      scripts 与当前 brief 显式执行 Prettier 均通过，并继续执行剩余 typecheck、unit、integration、E2E、build 到末尾全部通过。
nonBlockingSuggestions: []
finalReview:
  baseline: eb5e25981db0b6ae9872e2853761b9615dd75bfb
  reviewedHead: 35193da1161b64dd2724598f748758e8f339742c
  verdict: no-findings
  scope: S1/S2/S3a/S3b full integration
  reviewer: fresh Codex read-only
  writes: none
externalGates: []
next: S3c-currency-reference-simplification
```

修复验收反证：

1. `ProductSelectionWorkbench.test.ts` 从真实页面链模拟 `PRODUCT_INITIATIVE_INCOMPLETE: negativeConservativeReason`：首次提交后错误横幅显示人话，但 action pane、单位经济草稿、服务端缺口和主按钮继续存在；出现“仍要投入的理由”输入，已填两情景内容不丢，补理由后可再次提交。
2. 明确分离“初始详情读取失败”和“写动作失败”：只有读取失败隐藏判断入口；保存失败保留当前未提交草稿与可恢复动作。现有版本冲突仍按既定语义重读服务端事实并保留草稿，不回退该能力。
3. 复跑 S3b 全部 Web 单测、Web lint/typecheck/format、三视口 `workbench-network` E2E、`repo:check` 与 `git diff --check`；不改 API、契约、Schema、迁移或币种政策。
4. `DecideProductInitiativeService` 增加原始 handoff 的 `marketCode/channelCode` 均为空、`READ_MARKET_SIGNAL_LIVE` 对同一 signal 返回两者的失败先行单测；完整单位经济命令必须使用 `mergeHandoffWithSignalLive` 的 display market/channel 通过 prepare，不得返回 channel mismatch 或 market 缺失，且持久化收到规范化 snapshot。
5. 决定服务对 live signal 不存在或仍未补齐的情形继续保留真实缺口；原始 handoff 已有值时继续优先不可变快照，不得由 live signal 覆盖。复用现有 Port 与 merge helper，不复制补全规则，不改公共契约、Schema、迁移或币种政策。
6. 增加真实 PostgreSQL 或应用集成反例：先生成 market/channel 为空的 handoff，再更新同租户来源 signal 补齐两者、接受交接并完成单位经济决定；服务端须采用同一补全工作上下文成功落当前态/快照。Web E2E 不得通过“交接前先填渠道”绕开该路径。
7. 复跑受影响 API 单测、`product-initiative-flow` PostgreSQL 集成、S3b Web 全量单测与三视口 E2E、API/Web lint/typecheck、`repo:check`、格式和 diff 检查；不扩展到可编辑市场/渠道或重写历史 handoff。

## 验收

- [ ] 缺任一资源承诺项不能立项，提示具体缺项；立项责任人只能是当前登录用户
- [ ] 暂缓必须写验证重点和重判日期；到期项出现在队列最前，分页稳定、不重不漏
- [ ] NPI 交接详情显示立项承诺，快照不可变，存量快照不伪造
- [ ] 无效、跨租户或来源不符的证据引用被拒绝并指出具体条目
- [ ] 迁移空库与旧版本升级通过；契约、生成物、字典一致
- [ ] 两情景单件区间可录入，服务端算出贡献区间；币种或任一项缺失不能立项；保守下限为负须写理由；快照冻结输入与结果
- [ ] 最终候选完整 `pnpm validate` 通过并经 fresh Opus 复审裁决

## 进度 log

| 日期       | 阶段    | 负责        | commit     | 说明                                                                                                                                                                                                                                                                                          |
| ---------- | ------- | ----------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | design  | Cursor      | —          | 负责人确认选品 13 条基线、第一刀为资源责任；与交接 S1 并行澄清 PS-D01～D03                                                                                                                                                                                                                    |
| 2026-10-04 | design  | Cursor      | —          | 负责人定案 PS-D01～D03 均为 A；切片 S1 资源责任、S2 证据完整性已定义，待交接任务合入后转 coding                                                                                                                                                                                               |
| 2026-10-04 | design  | Cursor      | —          | 主代理发现 PS-D01 与基线 R1 冲突并提请裁决：负责人选过渡保留 A（PS-D01-X）；单位经济定薄版 F1 + 口径门槛（UE-D01/D02），作为 S3 预授权                                                                                                                                                        |
| 2026-10-04 | coding  | Claude Code | `5401efea` | 前置 PR #136 已合入；分支合并最新 `main`（含 PR #137、#138），角色、写入范围与锁按现行治理更新。当前下发 S1，不重复请求负责人授权。                                                                                                                                                           |
| 2026-10-04 | fix     | Claude Code | 未提交     | 主代理核验 S1 handoff，接受 PS-S1-R01～R04：暂缓半填错误关闭/落库失败、Web 漏消费投影分页、字典错误标记已定字段、测试范围漏列。已写回 doc/08 与 brief，定向下发修复。                                                                                                                         |
| 2026-10-04 | fix     | Claude Code | 未提交     | 复验 R01～R03 通过；追加 PS-S1-R05/R06：机会源仍只取首 100 条使老到期项不可见，半填暂缓回执与服务端 needs_decision 不符。限定最后一轮 Web 修复。                                                                                                                                              |
| 2026-10-04 | fix     | Claude Code | 未提交     | R05/R06 代码复验通过；真实三视口视觉检查追加 PS-S1-R07：主 CTA 远离首屏、承诺区形成长填空墙、进度分母仍为旧值 5。限定为分组、正确口径与同一动作区 sticky，不重做整页。                                                                                                                        |
| 2026-10-04 | fix     | Claude Code | 未提交     | R07 真实三视口复验通过。fresh Codex 独立复审返回 R08～R10，主代理逐项核验并全部接受：NPI 回程触发新 CHECK、legacy 操作人被冒充责任人、半填暂缓提示错误预测关闭。                                                                                                                              |
| 2026-10-04 | coding  | Claude Code | `4f75798e` | R08～R10 修复通过 API 37、Web 48、PostgreSQL 27 条及契约/字典/静态门禁；S1 生产提交完成并合入最新 main。修正 disposition 结构后按预授权下发 S2 证据真实性。                                                                                                                                   |
| 2026-10-04 | review  | Claude Code | 未提交     | S2 实现交回后主代理核验：API 31、Web 22、PostgreSQL 24 条及 API/Web lint/typecheck、repo:check、diff check 通过；7 个文件均在范围内，无 Schema/契约漂移。转 fresh Codex 只读复审当前证据边界。                                                                                                |
| 2026-10-04 | coding  | Claude Code | `ae796ac2` | S2 fresh Codex 独立复审 no-findings，主代理 fresh verification 通过后提交。S3 核对正式币种权威与仓库现状，拆为 S3a 核心和 S3b UI；当前下发 S3a。                                                                                                                                              |
| 2026-10-04 | fix     | Claude Code | 未提交     | S3a 主代理核验接受 R01～R05：数据库 CHECK 接受非法 JSON、S3b 无 active 币种公共边界、staged 被误报 inactive、官方 snapshot 无导入激活路径；下游 fixture/manifest 范围接受。                                                                                                                   |
| 2026-10-05 | fix     | Claude Code | 未提交     | S3a 增量复验 R01～R04 路径已落；追加 R06/R07：数据库错误阻断非 terminal 负贡献草稿、其他 authority 同名 active 数据集可冒充 SIX 并被误参与激活/验证。限定迁移与币种目录/importer/verifier 修复。                                                                                              |
| 2026-10-05 | review  | Claude Code | 未提交     | 主代理验收 R06/R07：聚焦 API 单测 48 条、importer/verifier 6 条、snapshot 5 条、真实 PostgreSQL flow+migration 44 条及 contract/drift、字典、repo、lint、API typecheck、diff check 均通过；未发现新 blocking finding。按治理待 fresh Codex 只读复审，当前环境未安装 Codex，未以 Claude 替代。 |
| 2026-10-05 | coding  | Claude Code | `06cb41ab` | fresh Codex 独立复审 no-findings；VG01/NBS01 为非阻塞测试纵深并延期，NBS02 因复合身份已先验证而拒绝重复条件。S3a 提交完成，按预授权立即下发 S3b 单位经济录入与 NPI 只读承接。                                                                                                                 |
| 2026-10-05 | fix     | Claude Code | 未提交     | S3b 主代理验收接受 PS-S3B-R01：服务端负贡献理由缺口返回后，保存错误被误当作初始读取错误，整个行动 pane 被隐藏且重新加载会覆盖未保存草稿。限定分离读/写错误并增加真实页面恢复反例，不改 API/契约/Schema。                                                                                      |
| 2026-10-05 | review  | Claude Code | 未提交     | R01 增量复验通过：真实工作台覆盖负贡献缺理由首次 400 后保留两情景草稿、action pane、理由输入与重提；Web 145 文件 682 条、三视口 E2E 63 条、lint/typecheck/format/repo/diff 均通过。转 fresh Codex 只读复审 S3b 全差异。                                                                       |
| 2026-10-05 | review  | Claude Code | 未提交     | 首次 reviewer 指令被送回该切片原实现会话；该会话按治理返回 blocked、未运行评审、无 finding、无写入。此为复审席位不独立，不是产品代码阻塞；S3b 保持 review，重新下发全新 Codex 只读会话。                                                                                                      |
| 2026-10-05 | fix     | Claude Code | 未提交     | fresh Codex 确认 PS-S3B-R02：机会列表/接收用信号当前态补全原始 handoff 空市场/渠道，但决定服务仍只读原始快照，形成页面完整却必然保存失败。主代理接受并限定复用 READ_MARKET_SIGNAL_LIVE + 既有 merge 规则，补 API 与真实 PostgreSQL 反例。                                                     |
| 2026-10-05 | review  | Claude Code | `897e4a34` | R02 修复复用 live-signal merge，API 12、PostgreSQL 34、Web 682、专项 E2E 63 及静态门禁通过并提交。任务级剩余 typecheck/test/integration 189/E2E 169+7 skipped/build 均通过；根 format:check 仅被无关 ignored `.pytest_cache` ACL EPERM 中断，受控路径格式通过。                               |
| 2026-10-05 | review  | Claude Code | `ab9b0e8c` | fresh Codex 对 `b9621af6..HEAD` 的 S3b 复审 no-findings，确认 live-signal merge 与写失败草稿恢复；该范围仅 2 个提交/16 文件。任务最终范围 `eb5e2598..HEAD` 另含此前 20 个提交/70 文件，故只关闭 S3b 复审，不冒充最终集成复审。                                                                |
| 2026-10-05 | blocked | Claude Code | `35193da1` | fresh Codex 对 `eb5e2598..35193da1` 全任务最终复审 no-findings。代码与任务级门禁达到 PR 集成条件；根 format ACL 例外已披露。因官方 SIX List One 获准数据与许可证据尚未导入，按既定 deployment gate 阻止生产启用与 task done，但不阻止 PR/合并。                                               |
| 2026-10-05 | blocked | Claude Code | 未提交     | 负责人提供 `D:\aosom\Downloads\list-one.xml`。主代理核验 Pblshd=2026-09-17、源 SHA-256 `33139b…b0ff`、277 coded rows 折叠为 178 币种、记录哈希 `10f3266…673d`，无格式/同码冲突；SIX 一手法律页未授予本用途许可且商业使用要求事先书面同意，故未生成 official snapshot、未 active 导入。        |
| 2026-10-05 | fix     | Claude Code | 未提交     | 负责人明确收窄：直接内置 178 个币种，不要 authorized snapshot 与 active release。主代理写回 doc/08 与 UE-D03，取消许可/deployment gate，建立 S3c 删除 release/importer/synthetic 机制并保留来源哈希与现有 lookup/UI 行为。                                                                    |
| 2026-10-05 | coding  | Claude Code | `35e92bad` | S3c 主代理验收及定向门禁通过；同一实现会话复查 no-findings 但不满足 fresh 独立性，仅作辅助证据。负责人同意不单独重派，S3c 与 S4 在最终增量统一交 fresh Codex。当前按方案 A 执行 S4，并继承 4 个未提交 Web 文件。                                                                              |
| 2026-10-06 | review  | Claude Code | 未提交     | S4 R06～R11 主代理验收通过：固定工作台办理壳、结果/工作详情局部切换、队列去噪、结果首屏、工作详情减密及删除低价值“带入”均已落；三视口专项 3/3、focused Web 99、Web 全量 148 文件/695 条及 typecheck/lint/format/repo/build/diff 通过。转 fresh Codex 只读复审当前 S3c 后的 S4 增量。          |
