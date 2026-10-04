---
status: coding
branch: feat/market-selection-handoff-v1
owner: cursor
writer: codex
risk: high
dependsOn: []
writeScopes:
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/market-selection-handoff-v1.md
  - docs/planning/tasks/market-signals-opportunity-radar-v1.md
  - packages/contracts/schemas/v1/market-opportunity.schema.json
  - packages/contracts/schemas/v1/product-initiative.schema.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/dictionary.annotations.json
  - database/dictionary/DATA_DICTIONARY.generated.md
  - database/dictionary/NATIVE_OBJECTS.generated.md
  - database/dictionary/database-data-dictionary.xlsx
  - apps/api/src/modules/market-intelligence/**
  - apps/api/src/modules/product-selection/**
  - apps/api/src/infrastructure/integration/market-opportunity-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/market-selection-handoff-migration-upgrade.integration.test.ts
  - apps/web/src/api/marketSignals.ts
  - apps/web/src/api/marketSignals.test.ts
  - apps/web/src/composables/useMarketSignalWorkbench.ts
  - apps/web/src/composables/useProductOpportunityWorkbench.ts
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/data/marketSignalScenarios.ts
  - apps/web/src/data/workbenchNetwork.ts
  - apps/web/src/data/workbenchNetwork.test.ts
  - apps/web/src/data/productInitiativeQueue.ts
  - apps/web/src/data/productInitiativeQueue.test.ts
  - apps/web/src/data/marketSignalEvidenceFlow.test.ts
  - apps/web/src/data/productInitiativeApplyHandoff.test.ts
  - apps/web/src/components/market-signals/**
  - apps/web/src/components/product-selection/**
  - apps/web/src/views/MarketSignalsWorkbench.vue
  - apps/web/src/views/MarketSignalsWorkbench.test.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:ms-d04
  - database-schema
  - database-migrations
  - database-dictionary
  - generated:database-catalog
  - public-contract:market-opportunity-v1
  - public-contract:product-initiative-v1
  - generated:contracts
sharedIntegrationScopes:
  - database/schema.prisma
  - database/migrations/**
  - packages/contracts/generated/contracts.d.ts
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/market-signals-opportunity-radar-v1.md
  - doc/cross-border-supply-chain/wisdom-baseline/市场与经营信号.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
---

# 任务：市场信号 → 选品立项交接责任 V1

## 目标

让市场信号和选品立项之间“谁对机会负责”在任一时刻只有一个答案，并由服务端执行：领取不转责，接受才转责；接受后选品只能请求退回，市场接回后责任才转回；选品自身判断不成立时在选品侧暂缓或不立项，不退给市场代办。业务权威见 `doc/08` 4.1.1（MS-D04）。

本任务是 `market_signals` 与 `product_selection` 的连续业务队列：三个切片共用本分支和一个最终 PR，每片完成即按本 brief 预授权进入下一片，不另开状态 PR。

## 边界 / 不做

- 不实现退回被市场拒绝、选品撤回退回请求、接受前选品判定机会包不可行动，也不拆分领取/接受/正式决定的能力码；这些在 `doc/08` 4.1.1 明确未定，只阻塞依赖它们的动作。
- 不改变 NPI 回程（`returned_from_npi`）、立项门槛、立项后交 NPI 的语义。
- 不实现 GC-012 共享交接契约（G1 已暂停）；本任务只在两台工作台的领域内实现，状态名对齐 GC-012 spec 的 `return_requested` / `return_accepted` 词汇，便于将来收编，不建共享平台。
- 不新增可信机会、评分、KPI 或真实样本结论；合成演练不冒充 WB-B10。
- 安全不变量沿用：默认拒绝、租户隔离、服务端从认证身份绑定 actor、未知值拒绝；本任务继续使用 `planning.read` / `planning.draft`，不新增角色。

## 执行切片与代理交接

| 项目     | 内容                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | 见下发的 `TASK` 行；各切片在同一分支上连续提交                                                                                                |
| 执行角色 | 实现执行器：Codex（GPT-5.6）                                                                                                                  |
| 复审     | 独立复审：Cursor 独立只读会话，Claude Opus（写入者为 GPT-5.6，家族不同），在 S3 完成后对整条分支一次复审；S1 迁移若出现新风险由主代理加审     |
| 写入范围 | frontmatter `writeScopes`；`doc/08` 与两份 brief 只由主代理写                                                                                 |
| 禁止范围 | NPI 回程与产品定义语义、`apps/api/src/modules/product-selection/**` 中 NPI/产品定义文件的业务行为、授权控制面、共享 UI 门面、GC-012 目录/契约 |
| 提交     | 授权实现执行器在本分支按切片形成单一主题提交，不推送、不建 PR、不合并、不改 brief 状态                                                        |
| 停止条件 | 每片完成后返回 `HANDOFF`，state 只能 `ready-for-review` 或 `blocked`；5173 等端口被占用时返回 `blocked`，不得终止未获授权进程                 |

### 切片 `S1-return-request-takeback`：接受前置 + 退回请求 + 市场接回

岗位结果：选品只能对已接受的机会作决定；退回变成“请求 → 市场接回”两步，责任在接回时才转回；接回后同一信号可再验证并再次交接出新版本。

1. **选品决定前置**：立项、暂缓、不立项、请求退回的新写入，要求该机会包当前 intake 为 `accepted`；否则稳定冲突 `PRODUCT_INITIATIVE_NOT_ACCEPTED`。存量已有判断的记录不改写；对它们的后续新写入同样执行前置（可先领取再接受，路径已存在）。
2. **请求退回**：`return_to_market` 新写入必须带结构化 `returnBasis`（仅 `insufficient_evidence` 证据不足 / `wrong_direction` 方向错误，来源 `doc/08` 4.1 与 4.1.1）和 `returnReason`（市场需要补什么）。缺任一项沿用现有“待补、不关闭”规则；未知 basis 失败关闭。立项记录进入新去向 `return_requested`，责任仍是选品；请求期间选品不得再作其他决定（`PRODUCT_INITIATIVE_RETURN_PENDING`）。
3. **市场侧待接回**：同一事务内，信号追加不可变 `selection_return_request` 判断并进入新去向 `selection_return_requested`；不再在请求时直接写 `returned_from_selection`。
4. **市场接回**：新增市场动作“接回”（`planning.draft`，租户内，`expectedSignalVersion` + 幂等键）。同一事务内追加现有 `selection_return` 判断、信号转 `returned_from_selection`、立项转 `returned_to_market`；任一侧版本不符整体失败，不留半边状态。
5. **恢复**：接回后沿用现有观察/交接动作；再次交接生成新的机会包版本，旧版本 `isCurrent=false` 且旧立项、旧判断不改写。只补自动化证明，不新设动作。
6. **迁移**：追加迁移，放宽两张表去向/判断类型 CHECK、加入 `return_basis`（可空、受 CHECK 约束）；存量 `returned_to_market` / `returned_from_selection` 行保持合法。附空库与旧版本升级集成测试。
7. **界面**：选品“退回市场”改为“请求退回市场”，必须选择“证据不足 / 方向错误”并写“市场需要补什么”；旁注“利润、供应或组合不成立请选暂缓或不立项”。请求后显示“等待市场接回”。市场队列新增“选品请求退回”分组，详情显示退回依据与需补内容，主动作“接回”；接回回执后重读服务端结果，409 重读并保留可恢复反馈。
8. **验证命令**：两个模块 domain/unit 测试；`market-opportunity-flow`、`product-initiative-flow` 与新迁移升级 PostgreSQL 集成测试；`pnpm --filter @logix/contracts` 契约检查与生成物一致；dictionary 检查；受影响 Web 单测；`workbench-network.spec.ts` 中市场 ↔ 选品退回路径 E2E；受影响模块 lint/typecheck。不跑完整 `validate`。

### 切片 `S2-responsibility-projection`：领取不转责，接受才退出（S1 通过即预授权）

岗位结果：市场能看见“已交给选品但尚未被接受”的机会仍是自己的结果责任，接受后自动离开待办，并持续看到选品反馈。

1. 市场队列把“已交选品·待接受”（当前交接 intake 为 `queued` 或 `claimed`）列为市场待跟进，显示领取人与领取时间、交出时长；`accepted` 后离开市场待办。由服务端从 intake 事实派生投影，不新增可写状态。
2. 信号详情显示选品反馈（接受、立项/暂缓/不立项、请求退回、接回）的时间与结果，只读，来源为选品侧事实；不复制选品数据为第二份权威。
3. 跨模块读取经现有 Port，不跨包引用内部路径；分页、稳定排序和租户隔离沿用。
4. 验证：领域投影单测、PostgreSQL 集成（queued/claimed/accepted 三态与跨租户反例）、Web 单测和一条 E2E。
5. S1 验收遗留（主代理 accepted）：接回命令的 `contractVersion` 校验目前在 `PrismaProductInitiativeRepository.takeBackSelectionReturn` 内，移到领域或 Application 层的命令校验（与 `prepareProductInitiativeDecision` 同一模式），Repository 只做持久化；补一条错误版本被拒的单测。

### 切片 `S2b-pending-wording`：队列与回执去“待补”催办（S2 通过即预授权）

岗位结果：市场和选品在队列、回执上看到的是“哪项没填”的事实，而不是状态当文案的催办；“待补”只在依据区进度头出现一次（`docs/product/WORKBENCH_VISUAL_FLOW_REDESIGN.md` §1 T2、§6.3 第 1 条、§8.1，及 §4.2 禁止“仍待补，不影响先处理”）。依据区本体已由 #84 完成，本片只清剩余处。

0. S2 遗留（主代理 accepted）：`MarketSelectionFeedback.vue` 的 `margin-top: 2px` 未通过 `repo:check` 令牌纪律，改用 `var(--space-*)` 令牌；本片交回前必须运行 `node scripts/check-repository.mjs` 并通过。
1. `MarketSignalQueue.vue`：活跃态缺市场/渠道时与关闭态一致写“市场未填 / 渠道未填”；删除“仍待补 N 项，不影响先处理”，改为中性的“依据缺 N 项”。
2. `MarketSignalOperationReceipt.vue`：回执里的“仍待补”改为“尚未填写”，列出项不变。
3. `ProductOpportunityQueue.vue`：“市场待补 / 渠道待补”改为“市场未填 / 渠道未填”。
4. `ProductOpportunityDetail.vue`：“仍待补”改为“交接时未填”，说明这些项来自交接快照，选品不在此处补录。
5. 只改文案与对应单测/E2E 断言，不改服务端、契约或缺口计算；验证为受影响 Web 单测、`workbench-network.spec.ts` 中相关断言和 Web lint/typecheck，并在 `apps/web/src` 内搜索不再出现“仍待补”“市场待补”“渠道待补”。
6. 主代理扩范围（S2b 首次交回 blocked 后 accepted）：`apps/web/src/data/workbenchNetwork.ts` 市场台 `missingHandling` 说明同步新口径——队列写“依据缺 N 项”而非“仍待补 N 项，不影响先处理”，交给选品时未填项在选品侧显示为“交接时未填”；只改该说明文字，不改阶段、路由、关系或状态；如 `workbenchNetwork.test.ts` 断言该文字则同步。`gc012-g0-catalog-v1` 已 `done`，无在途任务写该文件。

### 切片 `S3-post-accept-evidence`：接受后市场追加新证据（S2b 通过即预授权）

岗位结果：市场退出结果责任后仍能维护来源事实、追加新证据；选品在机会详情看到“交接后新增证据”，已交出的机会包快照不改。

按同一业务步骤五面推进，缺一面不得交回 `ready-for-review`：

1. **岗位任务**：市场在已交选品（含已接受）的信号上仍可“追加证据”；选品在机会详情看到市场交接后新增了什么，自行判断是否影响决定。不触发重新接受、不生成新版本；是否要求选品重新确认属于 `doc/08` 4.1.1 未定政策，本片不实现。
2. **数据事实**：先核对现有证据登记在 `handed_off` 去向下是否被拒；按 `doc/08` 4.1.1 允许追加，复用现有证据记录，不新增可写状态。“交接后新增”由服务端以证据登记时间晚于当前机会包交接快照时间派生，不在前端推断；交接快照及其哈希不改。
3. **技术保障**：沿用现有证据登记的 `expectedSignalVersion`、幂等键与稳定冲突码；选品侧读取经现有 Port，分页/稳定排序与租户隔离沿用；如契约需增加只读字段，同步契约检查与生成物。
4. **权限边界**：追加沿用现有证据登记能力（`planning.draft`），actor 来自认证身份；选品读取沿用 `planning.read`；跨租户与未知信号拒绝。不新增能力码。
5. **界面承接（前端必须可感知）**：
   - 市场信号详情：已交选品后证据入口仍可用，旁注“交接后新增，不改已交给选品的快照”；登记回执写明“已追加，选品可见”，失败或 409 时重读并保留可恢复反馈。
   - 选品机会详情：依据区分两组——“交接时快照”与“交接后市场新增（N）”，后者逐条显示时间、登记人；无新增时不显示空组。
   - 文案不得写“待补”“仍待补”等催办词（承接 S2b）。
6. **验证**：集成测试证明快照哈希不变、新增证据可见、跨租户拒绝、重复提交不产生第二条；Web 单测覆盖两组分列与空组隐藏；`workbench-network.spec.ts` 增一条“市场交接后追加 → 选品详情可见”E2E；受影响模块 lint/typecheck 与 `node scripts/check-repository.mjs`。交回时 HANDOFF `changed` 须分列五面各自的改动。

### `R-branch-review` 与 `PR`

S3 完成后主代理运行一次完整 `pnpm validate`（需 `pnpm infra:up`），派 fresh Opus 只读复审整条分支，按 `logix-disposition/v1` 裁决；无 finding 即按本 brief 预授权推送、建单一 PR、CI 通过后合并。brief 状态回写随该 PR，不另开状态 PR。合并后若 MS-D04 未定项仍无定案，下一片从市场信号 brief 的候选中由负责人每轮定 1～3 项继续，不让两台同时回到 `blocked`。

## 智慧开启基线

| 基线文件与原结论（摘要 + 位置）                                                         | 处置   | 依据                                                              | 落点 / 决策 ID      |
| --------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- | ------------------- |
| 市场 R1：分阶段回流，先回流选品接受、退回、不立项及原因（`市场与经营信号.md` 247、296） | `沿用` | `doc/08` 4.1.1“接收选品反馈”                                      | S2 / MS-D04         |
| 市场 X1：不采纳可重开、归档可激活、作废关联正确记录（248、297）                         | `补强` | 负责人 D3-A：接回后沿用同一信号开启新验证周期，再交接出新版本     | S1 第 5 项 / MS-D04 |
| 市场指标“因证据不足或方向错误被退回的比例”（549）                                       | `沿用` | `doc/08` 4.1 首批指标；据此限定退回依据两类                       | S1 第 2 项          |
| 选品：上游机会领取、接受和具体责任人（`选品立项.md` 26）                                | `补强` | 负责人 D1-A：领取只登记处理人不转责，接受才转责                   | S1 第 1 项、S2      |
| 选品 G1：四种结果都有后续责任，退回须指出上游需补什么（98）                             | `补强` | 负责人 D3-A：先请求后接回；选品自身利润/供应/组合不成立不得退回   | S1 第 2～4 项       |
| 选品 L1：市场退回与 NPI 退回均形成新版本，不改旧快照（156、218）                        | `沿用` | `doc/08` 4.1.1 恢复规则                                           | S1 第 5 项          |
| 选品：领取、接受与正式决定共用 `planning.draft`，权限过粗（50、952）                    | `存疑` | `doc/08` 4.1.1 列为未定；本任务不拆能力码                         | 待负责人            |
| 选品 R1：投入前须明确立项责任人与资源承诺（124）                                        | `沿用` | 不在本任务范围，不改动                                            | —                   |
| 全局 3：每个未关闭对象任一时刻只有一个责任主体，下游显式接收或拒收（`全局.md`）         | `沿用` | 本任务即该规则在市场 ↔ 选品段的参考实现；“拒收”在接受前的处理未定 | MS-D04 / 待负责人   |

## 负责人决策记录

| 决策 ID              | 已知事实与未知                                                                                           | 选项、成本/收益/风险/可逆性                                              | 推荐与理由                               | 负责人结论                                    | 权威落点 / 状态           |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------- | ------------------------- |
| MS-D04 交接责任      | 领取/接受只登记处理人；决定不查接受；退回一步改写市场；市场在交接时即退出                                | D1 领取/接受语义；D2 市场退出时点；D3 退回与恢复（A/B/C 由决策顾问提供） | A/A/A：单一责任主体，接受才转责          | 2026-10-04 定案 D1-A + D2-A + D3-A            | `doc/08` 4.1.1 / approved |
| HO-T01 退回依据两类  | 负责人要求选品自身判断不成立不得退回；`doc/08` 4.1 指标只列证据不足、方向错误                            | 主代理据权威派生，结构化两类；可逆：后续追加类别只需放宽 CHECK           | 采用，防止退回沦为代办通道               | 主代理技术派生，非新业务政策                  | 本 brief / approved       |
| HO-UI01 屏四剩余并入 | 改版规范屏四依据区已由 #84 完成；队列、回执、选品详情仍有“待补”状态文案；这些文件均在本 brief 写入范围内 | 并入本 brief 由同一写入者做，或交接合并后另开 brief                      | 并入：不新增写入者冲突，随同一 PR 上线   | 2026-10-04 负责人原话“屏四并入交接、屏五开工” | 本 brief S2b / approved   |
| HO-P01 未定事项      | 退回被拒、撤回请求、接受前不可行动、能力拆分                                                             | 每轮定 1～3 项                                                           | 先跑通已定路径，再按真实使用暴露的问题定 | 未定                                          | `pending`，只阻塞对应动作 |

## 业务步骤五面映射

| 业务步骤与岗位结果       | 岗位任务来源/状态                                                        | 相关数据事实子集                                  | 技术保障                                   | 权限边界                                  | 界面承接                                                                                      | 验收证据/状态                                         |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 选品领取（不转责）       | `doc/08` 4.1.1 / approved                                                | intake `claimed`、处理人、时间                    | 现有幂等、expectedVersion                  | `planning.draft`；actor 来自认证身份      | 市场看到“已被领取·待接受”（S2）                                                               | S2 主代理验收（`a4b5f52e`），终审待 R                 |
| 选品接受（转责）         | 同上                                                                     | intake `accepted`                                 | 现有；成为后续决定前置                     | 同上；仅领取人可接受（现有）              | 市场待办移出、详情显示已接受（S2）                                                            | S1（`8101512e`）/S2（`a4b5f52e`）主代理验收，终审待 R |
| 选品决定须已接受         | 同上                                                                     | intake 状态 × initiative 版本                     | 同事务读取 intake；稳定冲突码              | 有权 ≠ 业务允许：未接受即拒绝并审计       | 未接受时只显示“先接受”                                                                        | S1 主代理验收（`8101512e`），终审待 R                 |
| 请求退回（责任仍在选品） | 同上                                                                     | `returnBasis`、`returnReason`、`return_requested` | 跨模块同事务追加不可变判断；幂等重放不重复 | `planning.draft`；租户内                  | 两类依据必选、需补内容必填；“等待市场接回”                                                    | S1 主代理验收（`8101512e`），终审待 R                 |
| 市场接回（责任转回）     | 同上                                                                     | `selection_return` 判断、两侧去向                 | 两侧 expectedVersion，原子提交或整体失败   | `planning.draft`；租户内；未知/跨租户拒绝 | “选品请求退回”分组 + 主动作“接回”，回执与 409 恢复                                            | S1 主代理验收（`8101512e`），终审待 R                 |
| 再验证并再次交接         | 同上                                                                     | 机会包新版本、旧版本 `isCurrent=false`            | 旧行不改写                                 | 沿用                                      | 沿用现有入口                                                                                  | S1 主代理验收（`8101512e`），终审待 R                 |
| 接受后追加证据           | 同上                                                                     | 证据登记时间晚于交接快照                          | 快照哈希不变                               | 沿用证据登记能力                          | 市场详情证据入口保留 + 回执“已追加，选品可见”；选品详情分列“交接时快照 / 交接后市场新增（N）” | S3 待验                                               |
| 队列与回执只陈述未填事实 | `docs/product/WORKBENCH_VISUAL_FLOW_REDESIGN.md` 屏四 / HO-UI01 approved | 交接快照 `pendingFieldCodes`、信号缺口            | 只改文案，不改缺口计算                     | 不涉及                                    | “依据缺 N 项”“市场未填/渠道未填”“尚未填写”“交接时未填”                                        | S2b 主代理验收（`aa5dafa4`）                          |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                                                                                                        | 对应业务步骤与消费者 | 当前证据/来源                                                                                                                         | 建议承载方式                                        | 决策 ID | 决策与实现状态      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------- | ------------------- |
| `current_physical`   | intake `queued/claimed/accepted/superseded`；initiative 去向含 `returned_to_market`；信号判断 `selection_return` | 领取、接受、退回     | `database/schema.prisma` `ProductOpportunityIntake`、`ProductInitiative`、`MarketSignalDecision`；迁移 20260925223000、20260928150000 | 已有                                                | —       | structure-confirmed |
| `current_physical`   | 选品决定不检查 intake；退回经 `applySelectionReturnWithin` 一步改写信号                                          | 决定前置、退回       | `prisma-product-initiative.repository.ts` 136～248；`prisma-market-signal.repository.ts` 482～560                                     | 需修改                                              | MS-D04  | gap-confirmed       |
| `approved_gap`       | 退回请求/接回两步、退回依据、接受才转责、接受后追加证据                                                          | S1～S3               | `doc/08` 4.1.1                                                                                                                        | 去向 CHECK、`return_basis` 列、不可变判断、派生投影 | MS-D04  | approved / coding   |
| `industry_candidate` | GC-012 共享交接回执（`return_requested` / `return_accepted`）                                                    | 将来跨台收编         | `docs/superpowers/specs/2026-10-03-gc12.md` 5.4                                                                                       | `undecided`（只对齐词汇）                           | —       | pending             |

## 23 台共同最低可用线（本任务承接）

| 基线     | 本任务承接                                                  | 状态   |
| -------- | ----------------------------------------------------------- | ------ |
| `WB-B03` | 退回请求、接回与再交接的恢复路径                            | S1     |
| `WB-B04` | 接受前后与退回请求期间的当前/下一责任                       | S1、S2 |
| `WB-B07` | 再交接新版本、旧快照不改、接受后新增证据不改快照            | S1、S3 |
| 其余     | 不在本任务范围；WB-B10 仍需真实岗位六类路径，合成演练不计入 | —      |

## 验收

- [ ] 未接受的机会，选品任何决定被服务端拒绝；接受后才能决定
- [ ] 退回只能以“证据不足 / 方向错误”请求，且写明需补内容；请求期间责任仍在选品，选品不能再作其他决定
- [ ] 市场接回原子完成两侧转回；任一侧版本冲突整体失败
- [ ] 接回后再次交接生成新版本，旧机会包、旧立项、旧判断不改写
- [ ] 市场能看到“已交待接受”仍属自己的待跟进，接受后移出并持续看到选品反馈
- [ ] 接受后市场可追加证据，交接快照不变，选品可分辨新增证据
- [ ] 迁移空库与旧版本升级通过，存量退回记录合法
- [ ] 契约、生成物、字典一致；跨租户与未知值拒绝；关键路径 E2E 通过
- [ ] 最终候选完整 `pnpm validate` 通过并经 fresh Opus 复审裁决

## 进度 log

| 日期       | 阶段   | 负责   | commit     | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------ | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | coding | Cursor | `cb44abcb` | 负责人定案 MS-D04 并写回 `doc/08` 4.1.1；建立连续三片队列，下发 S1；GC-012 G1 暂停不派发                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-04 | coding | Cursor | `8101512e` | S1 验收通过：46 个文件均在 writeScopes 内；接受前置、退回请求期间阻断、双边原子接回和幂等重放已核对；主代理复跑迁移升级与两条流程集成 3 文件 27 条通过。遗留 contractVersion 校验分层并入 S2 第 5 项；下发 S2                                                                                                                                                                                                                                                                                   |
| 2026-10-04 | coding | Cursor | `a4b5f52e` | S2 验收通过：责任投影由服务端按 intake 派生（queued/claimed 留在市场，accepted 转选品），筛选参数有格式校验，租户隔离与键集分页沿用；S1 遗留 contractVersion 校验已移到领域层。主代理复跑集成 3 文件 28 条通过。两处测试夹具（`marketSignalEvidenceFlow.test.ts`、`productInitiativeApplyHandoff.test.ts`）因契约新增必填字段而改，原未列入 writeScopes 且交接未报，主代理补登记为 accepted 例外。`repo:check` 未过（`MarketSelectionFeedback.vue` 裸值 `2px`），并入 S2b 第 0 项修复；下发 S2b |
| 2026-10-04 | coding | Cursor | `e22dca02` | S2b 首次交回 blocked：10 个授权文件文案与 `2px` 令牌已改，`repo:check`、Web lint/format/typecheck、单测 50、E2E 3 通过；全仓搜索仍命中 `workbenchNetwork.ts:796`（不在写入范围）。主代理扩入 `workbenchNetwork.ts` 及其单测（S2b 第 6 项），原未提交差异保留在工作树，Codex 续做同一切片                                                                                                                                                                                                        |
| 2026-10-04 | coding | Cursor | `aa5dafa4` | S2b 验收通过：11 个文件均在 writeScopes 内，仅改文案与 `2px` 改为 `var(--space-1)`；主代理复核 `repo:check` 通过，`apps/web/src` 内“仍待补/市场待补/渠道待补”零命中。纯文案低风险切片，不另起独立复审；按预授权下发 S3                                                                                                                                                                                                                                                                          |
| 2026-10-04 | coding | Cursor | `ed28b767` | 按负责人要求（界面、数据字段、任务、技术底层协同，不漂移不漏项，前端可感知）校正：五面表验收列回写 S1/S2/S2b 实际状态；补 S2b 文案行；S3 改为五面逐项（岗位、数据派生、幂等并发、权限、市场与选品两侧界面）并要求 HANDOFF 分列五面改动                                                                                                                                                                                                                                                          |
