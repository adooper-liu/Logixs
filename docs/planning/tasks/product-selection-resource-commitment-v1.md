---
status: fix
branch: feat/product-selection-resource-commitment-v1
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/product-selection-resource-commitment-v1.md
  - packages/contracts/schemas/v1/product-initiative.schema.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/dictionary.annotations.json
  - database/dictionary/DATA_DICTIONARY.generated.md
  - database/dictionary/NATIVE_OBJECTS.generated.md
  - database/dictionary/database-data-dictionary.xlsx
  - apps/api/src/modules/product-selection/**
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
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
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - public-contract:product-initiative-v1
  - generated:contracts
sharedIntegrationScopes:
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - docs/planning/tasks/market-selection-handoff-v1.md
---

# 任务：选品立项——立项资源责任与可复算单位经济 V1

## 目标

消除“立项通过但没人、没资源、没下一检查日期”和“暂缓后无人重判”：立项前必须明确立项责任人、下一阶段资源承诺、目标日期和下一决策点；暂缓必须带验证计划与重判日期，到期回到选品优先队列。立项交 NPI 的不可变快照携带这些承诺。随后让“利润可接受”变成可复算的两情景数字，口径不明不能立项。

## 阶段与调度

- `market-selection-handoff-v1` 已由 PR #136 合入 `main`，本分支已合并至 `eb5e2598`（含 PR #137、#138）；原串行前置与 Schema / 契约锁冲突均已解除。
- 2026-10-04 转 `coding`：当前只执行 `S1-resource-commitment`；S2、S3 保持预授权，但须待前一片由主代理验收并回写 brief 后再下发。
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

| 决策 ID             | 已知事实与未知                                                     | 选项、成本/收益/风险/可逆性                                                                                        | 推荐与理由                                   | 负责人结论                                              | 权威落点 / 状态          |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| PS-D00 基线确认     | 13 条“已定基线”此前未写回 `doc/08`                                 | 全部确认 / 部分确认 / 再开智慧开启                                                                                 | 全部确认，分刀实现                           | 2026-10-04 全部确认                                     | 待写回 doc/08            |
| PS-D00b 第一刀      | 候选：资源责任 / 单位经济 / 证据完整性                             | —                                                                                                                  | 资源责任                                     | 2026-10-04 选资源责任                                   | 本 brief                 |
| PS-D01 立项责任人   | 现有 `responsibleActorId` = 作决定的操作人，界面未表达其为立项责任 | A 当前认证用户，服务端绑定 / B 指定他人并经其接受 / C 取机会接受人                                                 | A：最小改动，转派另定，可逆                  | 2026-10-04 选 A                                         | 待写回 doc/08 / approved |
| PS-D02 资源承诺内容 | 现有快照无资源、目标日期、下一决策点                               | A 承接团队或岗位 + 资源说明 + 目标日期 + 下一决策点（日期 + 决策问题），不含金额 / B 另加预算区间 / C 只要两个日期 | A：针对“没人没资源”，预算随单位经济切片      | 2026-10-04 选 A                                         | 待写回 doc/08 / approved |
| PS-D01-X 与基线冲突 | PS-D01 A 与基线 R1“不得由点按钮的人自动代替”冲突；系统无人员目录   | 过渡保留 A / 改为指定他人并接受 / 本刀不写责任人                                                                   | 过渡保留 A：先解决没资源没日期，退出条件明确 | 2026-10-04 选过渡保留 A                                 | 待写回 doc/08 / approved |
| UE-D01 单位经济范围 | 现有“价格带与利润”只有自由文本结论与证据引用                       | 薄版 F1 / F1+U1 / 单情景                                                                                           | 薄版 F1：可复算，录入负担可控                | 2026-10-04 选薄版 F1                                    | 待写回 doc/08 / approved |
| UE-D02 单位经济门槛 | 基线：口径不明不能立项；无数据前无可信阈值                         | 口径门槛 / 另加数值门槛 / 只展示                                                                                   | 口径门槛：不硬编码利润阈值                   | 2026-10-04 选口径门槛；保守情景贡献为负时须写仍投入理由 | 待写回 doc/08 / approved |
| PS-D03 暂缓验证计划 | 现有暂缓只要 `deferReason`；无重判日期，队列按更新时间             | A 验证重点 + 重判日期，责任人为当前用户，到期进最前分组，不自动改状态 / B 另加逾期标记 / C 只要日期                | A：与市场“单一当前验证承诺”同构              | 2026-10-04 选 A                                         | 待写回 doc/08 / approved |

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

### 切片 `S2-evidence-integrity`（S1 通过即预授权）

服务端核验评审要点引用的证据确实存在、属于同租户、且来自该机会的来源信号（基线差距 1，数据真实性不变量，无需新业务定案）。不存在、跨租户或不适用的引用稳定失败并指出是哪条；存量记录不改写。验证：领域单测、PostgreSQL 集成（含跨租户反例）、Web 错误呈现单测。

### 切片 `S3-unit-economics`（S2 通过即预授权）

岗位结果：“利润可接受”变成第二个人能复算的两组数字；口径不明不能立项。

1. **输入**：每个立项一个市场（沿用机会包）、一个渠道、一种币种（ISO 4217）。基准、保守两个情景，每个情景填单件售价区间、到岸成本区间，以及平台费、履约费、广告、退货四项单件金额区间。金额为定点十进制字符串并共用该币种，不做汇率换算。每项标明“有证据”（须引用已登记证据，S2 核验）或“待验证假设”；无依据的数字只能是假设，不得冒充证据。
2. **计算**：服务端按情景算贡献空间区间：下限 = 售价下限 − 各成本上限之和，上限 = 售价上限 − 各成本下限之和。领域层单一实现，前端只展示服务端结果，不自行计算。
3. **门槛**（UE-D02）：立项新写入要求两个情景全部可算且币种明确，否则 `PRODUCT_INITIATIVE_INCOMPLETE` 并列出缺项；保守情景贡献下限为负时必须填写“仍要投入的理由”，不自动拦截，不设利润率阈值。“保守情景为负”按下限判断，属主代理技术解释，可逆。
4. **暂缓与草稿**：单位经济可部分保存为待补，不阻塞暂缓或不立项。
5. **快照**：交 NPI 的不可变快照冻结输入与计算结果；存量立项不回填。现有 `price_band_and_margin` 评审要点保留，不在本刀删除或改义。
6. **界面**：两个情景并排，逐项显示“有证据 / 待验证假设”（文字标签，不只靠颜色），服务端算出的贡献区间与缺项；保守为负时就地要求理由。
7. **验证**：领域计算与门槛单测（含边界与负值）、PostgreSQL 集成与迁移升级、契约生成物、Web 单测、一条 E2E。

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

| 轨道                 | 字段/事实                                                      | 当前证据/来源                                                                                               | 建议承载方式                     | 决策 ID     | 决策与实现状态      |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------- | ------------------- |
| `current_physical`   | `responsibleActorId`=操作人；暂缓仅 `reason`；快照无资源与日期 | `database/schema.prisma` `ProductInitiative`、`ProductInitiativeHandoff`；`product-initiative.ts` 37 行注释 | 已有                             | —           | structure-confirmed |
| `current_physical`   | 评审证据只校验 UUID 格式与去重                                 | `product-initiative.ts` `uniqueUuids`                                                                       | 已有                             | —           | gap-confirmed       |
| `approved_gap`       | 资源承诺四项、立项责任、暂缓验证重点与重判日期、证据核验       | `选品立项.md` 已定基线（负责人 2026-10-04 确认）；PS-D01～D03                                               | 列 + CHECK、不可变快照、派生队列 | PS-D01～D03 | approved / design   |
| `industry_candidate` | 预算区间、逾期标记、指定他人为立项责任人                       | 本轮未采纳选项 B                                                                                            | `undecided`                      | PS-D01～D03 | 不进入本任务        |

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
unknowns: []
verificationGaps:
  - 完整 validate 按 brief 留到风险切片集成候选；本轮修复后先复跑 S1 定向门禁。
nonBlockingSuggestions: []
next: fix
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

## 验收

- [ ] 缺任一资源承诺项不能立项，提示具体缺项；立项责任人只能是当前登录用户
- [ ] 暂缓必须写验证重点和重判日期；到期项出现在队列最前，分页稳定、不重不漏
- [ ] NPI 交接详情显示立项承诺，快照不可变，存量快照不伪造
- [ ] 无效、跨租户或来源不符的证据引用被拒绝并指出具体条目
- [ ] 迁移空库与旧版本升级通过；契约、生成物、字典一致
- [ ] 两情景单件区间可录入，服务端算出贡献区间；币种或任一项缺失不能立项；保守下限为负须写理由；快照冻结输入与结果
- [ ] 最终候选完整 `pnpm validate` 通过并经 fresh Opus 复审裁决

## 进度 log

| 日期       | 阶段   | 负责        | commit     | 说明                                                                                                                                                                   |
| ---------- | ------ | ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | design | Cursor      | —          | 负责人确认选品 13 条基线、第一刀为资源责任；与交接 S1 并行澄清 PS-D01～D03                                                                                             |
| 2026-10-04 | design | Cursor      | —          | 负责人定案 PS-D01～D03 均为 A；切片 S1 资源责任、S2 证据完整性已定义，待交接任务合入后转 coding                                                                        |
| 2026-10-04 | design | Cursor      | —          | 主代理发现 PS-D01 与基线 R1 冲突并提请裁决：负责人选过渡保留 A（PS-D01-X）；单位经济定薄版 F1 + 口径门槛（UE-D01/D02），作为 S3 预授权                                 |
| 2026-10-04 | coding | Claude Code | `5401efea` | 前置 PR #136 已合入；分支合并最新 `main`（含 PR #137、#138），角色、写入范围与锁按现行治理更新。当前下发 S1，不重复请求负责人授权。                                    |
| 2026-10-04 | fix    | Claude Code | 未提交     | 主代理核验 S1 handoff，接受 PS-S1-R01～R04：暂缓半填错误关闭/落库失败、Web 漏消费投影分页、字典错误标记已定字段、测试范围漏列。已写回 doc/08 与 brief，定向下发修复。  |
| 2026-10-04 | fix    | Claude Code | 未提交     | 复验 R01～R03 通过；追加 PS-S1-R05/R06：机会源仍只取首 100 条使老到期项不可见，半填暂缓回执与服务端 needs_decision 不符。限定最后一轮 Web 修复。                       |
| 2026-10-04 | fix    | Claude Code | 未提交     | R05/R06 代码复验通过；真实三视口视觉检查追加 PS-S1-R07：主 CTA 远离首屏、承诺区形成长填空墙、进度分母仍为旧值 5。限定为分组、正确口径与同一动作区 sticky，不重做整页。 |
