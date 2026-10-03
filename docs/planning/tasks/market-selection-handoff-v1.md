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
  - apps/web/src/data/productInitiativeQueue.ts
  - apps/web/src/data/productInitiativeQueue.test.ts
  - apps/web/src/components/market-signals/**
  - apps/web/src/components/product-selection/**
  - apps/web/src/views/MarketSignalsWorkbench.vue
  - apps/web/src/views/MarketSignalsWorkbench.test.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:MS-D04
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

### 切片 `S3-post-accept-evidence`：接受后市场追加新证据（S2 通过即预授权）

岗位结果：市场退出结果责任后仍能维护来源事实、追加新证据；选品在机会详情看到“交接后新增证据”，已交出的机会包快照不改。

1. 先核对现有证据登记在 `handed_off` 去向下是否被拒；按 `doc/08` 4.1.1 允许追加，不改写既有交接快照。
2. 选品机会详情区分“交接快照内证据”与“交接后市场新增证据”（时间、登记人），不自动触发重新接受或新版本；是否要求选品重新确认属于未定政策。
3. 验证：集成测试证明快照哈希不变、新增证据可见、跨租户拒绝；Web 单测与 E2E 各一条。

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

| 决策 ID             | 已知事实与未知                                                                | 选项、成本/收益/风险/可逆性                                              | 推荐与理由                               | 负责人结论                         | 权威落点 / 状态           |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------- | ------------------------- |
| MS-D04 交接责任     | 领取/接受只登记处理人；决定不查接受；退回一步改写市场；市场在交接时即退出     | D1 领取/接受语义；D2 市场退出时点；D3 退回与恢复（A/B/C 由决策顾问提供） | A/A/A：单一责任主体，接受才转责          | 2026-10-04 定案 D1-A + D2-A + D3-A | `doc/08` 4.1.1 / approved |
| HO-T01 退回依据两类 | 负责人要求选品自身判断不成立不得退回；`doc/08` 4.1 指标只列证据不足、方向错误 | 主代理据权威派生，结构化两类；可逆：后续追加类别只需放宽 CHECK           | 采用，防止退回沦为代办通道               | 主代理技术派生，非新业务政策       | 本 brief / approved       |
| HO-P01 未定事项     | 退回被拒、撤回请求、接受前不可行动、能力拆分                                  | 每轮定 1～3 项                                                           | 先跑通已定路径，再按真实使用暴露的问题定 | 未定                               | `pending`，只阻塞对应动作 |

## 业务步骤五面映射

| 业务步骤与岗位结果       | 岗位任务来源/状态         | 相关数据事实子集                                  | 技术保障                                   | 权限边界                                  | 界面承接                                           | 验收证据/状态 |
| ------------------------ | ------------------------- | ------------------------------------------------- | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------- | ------------- |
| 选品领取（不转责）       | `doc/08` 4.1.1 / approved | intake `claimed`、处理人、时间                    | 现有幂等、expectedVersion                  | `planning.draft`；actor 来自认证身份      | 市场看到“已被领取·待接受”（S2）                    | S2 待验       |
| 选品接受（转责）         | 同上                      | intake `accepted`                                 | 现有；成为后续决定前置                     | 同上；仅领取人可接受（现有）              | 市场待办移出、详情显示已接受（S2）                 | S1/S2 待验    |
| 选品决定须已接受         | 同上                      | intake 状态 × initiative 版本                     | 同事务读取 intake；稳定冲突码              | 有权 ≠ 业务允许：未接受即拒绝并审计       | 未接受时只显示“先接受”                             | S1 待验       |
| 请求退回（责任仍在选品） | 同上                      | `returnBasis`、`returnReason`、`return_requested` | 跨模块同事务追加不可变判断；幂等重放不重复 | `planning.draft`；租户内                  | 两类依据必选、需补内容必填；“等待市场接回”         | S1 待验       |
| 市场接回（责任转回）     | 同上                      | `selection_return` 判断、两侧去向                 | 两侧 expectedVersion，原子提交或整体失败   | `planning.draft`；租户内；未知/跨租户拒绝 | “选品请求退回”分组 + 主动作“接回”，回执与 409 恢复 | S1 待验       |
| 再验证并再次交接         | 同上                      | 机会包新版本、旧版本 `isCurrent=false`            | 旧行不改写                                 | 沿用                                      | 沿用现有入口                                       | S1 待验       |
| 接受后追加证据           | 同上                      | 证据登记时间晚于交接快照                          | 快照哈希不变                               | 沿用证据登记能力                          | 选品详情分列“交接后新增证据”                       | S3 待验       |

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

| 日期       | 阶段   | 负责   | commit     | 说明                                                                                     |
| ---------- | ------ | ------ | ---------- | ---------------------------------------------------------------------------------------- |
| 2026-10-04 | coding | Cursor | `cb44abcb` | 负责人定案 MS-D04 并写回 `doc/08` 4.1.1；建立连续三片队列，下发 S1；GC-012 G1 暂停不派发 |
