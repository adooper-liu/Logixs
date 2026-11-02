---
status: coding
branch: docs/business-first-workbench-delivery
verification: # S1-five-focus 与 S2 internal baseline 待主代理复审；不得标 done
owner: main
writer: claude
risk: high
dependsOn: []
writeScopes:
  - AGENTS.md
  - apps/api/src/app.module.ts
  - docs/planning/tasks/ocean-operations-source-review-v1.md
  - docs/planning/tasks/_template.md
  - apps/api/src/modules/charges-settlement/engines/overdue-deadlines/**
  - apps/api/src/modules/charges-settlement/index.ts
  - apps/api/src/modules/charges-settlement/compute-staged-overdue-deadlines.port.ts
  - apps/api/src/modules/charges-settlement/application/compute-staged-overdue-deadlines.service.ts
  - apps/api/src/modules/charges-settlement/application/compute-staged-overdue-deadlines.service.test.ts
  - apps/api/src/modules/charges-settlement/charges-settlement.module.ts
  - apps/api/src/modules/ocean-operations/**
  - apps/api/src/modules/ocean-port-visibility/**
  - apps/api/src/modules/lifecycle-control/**
  - apps/api/src/modules/shipment-registry/**
  - apps/api/src/infrastructure/integration/**
  - apps/web/src/api/oceanOperations.ts
  - scripts/restore-ocean-review-sample.mts
  - scripts/restore-ocean-review-sample.test.ts
  - scripts/ocean-reference-case.ts
  - scripts/ocean-reference-case.test.ts
  - apps/api/src/modules/shipment-registry/infrastructure/prisma-container-dispatch-snapshot.repository.test.ts
  - database/seeds/fixtures/ocean-reference-case-v1.json
  - doc/cross-border-supply-chain/07-import-transition.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/12-external-data-integration.md
  - apps/web/src/views/OceanOperationsWorkbench.vue
  - apps/web/src/views/OceanOperationsWorkbench.test.ts
  - apps/web/src/data/liveWorkspaceProjection.ts
  - apps/web/.tmp/ocean-operations-s1/**
  - apps/web/src/components/ocean-operations/**
  - apps/web/src/components/attachment/**
  - apps/web/src/modules/workbench-network/routes.ts
  - docs/planning/progress-board.html
  - database/schema.prisma
  - database/migrations/**
  - packages/contracts/schemas/v1/**
  - database/seeds/fixtures/freightower-container-reference-v1.json
  - database/seeds/external-ocean-reference-mappings.ts
  - scripts/reference-data/**
  - apps/api/src/modules/master-data/**
  - database/seeds/internal-ocean-reference-data.ts
  - database/seeds/seed-external-ocean-reference-mappings.ts
  - database/seeds/provider-profiles/**
  - apps/web/src/data/customsClearanceDocumentRequirements.ts
  - database/seed.ts
  - database/seeds/freightower-reference-data.ts
  - database/seeds/internal-ocean-reference-v1.1.ts
  - database/seeds/reference-data/smdg-liner-codes-20261028.json
  - database/seeds/reference-data/smdg-liner-codes-20261028.xlsx
  - database/seeds/seed-internal-ocean-reference-data.ts
  - database/seeds/seed-ocean-reference-v1.1.ts
  - database/seeds/smdg-liner-directory.ts
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/wisdom-baseline/海运运营工作台.md
  - docs/product/domain/INDUSTRY_STANDARDS_ALIGN.md
  - docs/product/domain/TARGET_FIELD_CATALOG.md
  - scripts/freightower-reference-data.test.ts
  - .gitignore
  - .claude/commands/workbench-slic.md
  - database/dictionary/**
exclusiveLocks:
  - database-schema
  - public-contract
  - business-policy:ocean-workbench-fact-driven-attention
  - business-policy:ocean-date-adoption-lock
  - business-policy:integration-three-layer-boundary
  - repository-governance
  - business-policy:workbench-information-action-separation
  - reference-data-governance
  - reference-data-approval-separation
  - reference-data-explicit-consumer-binding
  - database-schema
  - public-contract
sharedIntegrationScopes:
  - apps/web/src/modules/workbench-network/routes.ts
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/01-authoritative-business-chain.md
  - doc/cross-border-supply-chain/05-shipment-lifecycle-blueprint.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/12-external-data-integration.md
  - doc/cross-border-supply-chain/16-confirmed-lifecycle-business-rules.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/海运运营工作台.md
  - docs/planning/tasks/post-departure-shipment-risk-queue-v1.md
  - docs/planning/tasks/p6-trackingeyes-event-candidate.md
  - docs/planning/tasks/p6-trackingeyes-ingestion-authority.md
  - docs/planning/tasks/p6-unified-lifecycle-date-facts.md
uiStructure:
  - "复用 WorkbenchLayout standard：正式页头 → 岗位/交接上下文 → 当前判断/缺口摘要 → 左运输待办 + 中运输概况/具体问题/来源依据/缺口 + 右到港准备判断/理由/下一步/唯一提交/回执与恢复；办理顺序不等于纵向堆叠"
  - "1440x900 内部三栏并列满高、各栏独立滚动；1024x768 左窄轨/抽屉、中右并列；390x844 队列→详情→办理显式分屏；状态不改变壳和队列可达性"
  - "中栏运输概况按负责人参考图：上方左 ETD/ATD、右 ETA/ATA → 左起运港/中航线及服务端货物状态/右目的港 → 货柜号及备货单 → 船公司及船名航次；保留来源提单；actual只读正式字段，模拟性质标在来源，不另设日期分叉，不由日期推断状态"
uiMustStayVisible:
  - "货柜、备货单/提单、船名航次、出运日期来源观察、ETA及其事实类型"
  - "当前复核状态、来源版本、冲突/缺口、当前责任和下游交接未接通提示"
  - "保存结果、待补原因、失败/并发冲突恢复入口"
uiProgressiveDisclosure:
  - "原始载荷、文件哈希、解析器版本、完整来源字段和历史版本"
  - "财务影响引用、actual回流和跨工作台追溯详情"
uiForbidden:
  - "不得把来源日期显示为canonical actualDepartureAt"
  - "不得把ETA单值显示成ETA历史或自动判定换船/延误"
  - "不得把通知发送、页面保存或下游岗位领取显示为交接完成"
  - "不得复制成字段卡墙、通用后台表格或第二套决定卡"
  - "不得自建两栏长正文、把站点导航算作工作台三栏、使用 stacked 模式、因对象状态隐藏栏位或手机隐藏非选中队列入口"
uiViewportEvidence:
  - "1440x900：站点导航之外左队列/中事实依据/右判断恢复三栏并列满高，各自单一主滚动区；左右折叠可恢复；无横向溢出，主动作与所选依据相邻"
  - "1024x768：左窄轨/可恢复抽屉，中详情与右办理继续并列；不能把表单下放成长正文；无横向溢出"
  - "390x844：队列→详情→办理显式分屏；办理屏保留对象/问题/依据摘要，返回恢复焦点、滚动和草稿；所有队列对象可达，无横向溢出"
---

# 任务：海运运营到港准备首片

### 治理增量：Claude 直接交付（负责人定案，2026-10-31）

- 负责人明确“以后都不需要转codex执行了”，覆盖此前人工转发 TASK。当前及后续任务默认由 Claude 直接实施、测试、差异审查和集成；writer 恢复 `claude`。本轮治理留痕放在当前唯一 brief，不改已完成历史治理 brief，也不新建另一份需求。
- 根角色映射与 `_template.md` 同步；独立复审、单写入者、范围/锁、业务待决和风险对应验证不变。历史 TASK/HANDOFF 和模型署名保留，不是当前等待负责人转发的前置。
- 当前 S7 直接按下述接口、写域和 RED→GREEN 计划执行，不再等待 Codex/HANDOFF；S7 原文的人工转发及“主代理禁止实现”表达由本节覆盖。实现和 brief 维护串行进行，不引入第二写入者，不扩业务范围。

### 当前执行：S8 海运期限读模型与页面（2026-10-31）

负责人要求直接接通服务端和页面。本片使用 S7 核心，经 charges-settlement 公开只读 Port 加载当前租户标准；海运服务端在既有受保护详情 GET 派生期限和缺口，Web 只展示，不增写入口、不调用供应商、不改共享壳、不填造费率。S9 人工保存/锁定不在本片，旧日期/附件红测单列不放宽。

- 文件：新增 charges `compute-staged-overdue-deadlines.port.ts`、`application/compute-staged-overdue-deadlines.service.ts/.test.ts`，修改 charges module/index；海运 repository/domain/service/module及定向测试；Web既有 oceanOperations API类型、海运页及原测试。前述路径为本片范围，不修改Schema/迁移/seed/标准写入或其他工作台。
- 接口：`COMPUTE_STAGED_OVERDUE_DEADLINES.execute` 接收 tenantId 与服务端取得的 matching context/facts，返回 S7 分项目结果及已识别缺口。查询不得猜货代、把MSC字符串当任意UUID、从多个候选标准反推业务身份，或将 America/New_York 当UTC。缺标准与缺匹配身份/日历分别表达；无法计算时日期保持null，主业务事实继续可读。计算读取失败单独提示不可用，不伪装成没有标准。
- 海运 context 只消费当前精确对象、地点、事件及已具备资格的实际事实；pending实际、非目的港/中转arrived、多个当前候选不得静默采信。阶段不按 ETA 已过或container.status推断。当前未维护货代/标准日历绑定必须如实缺失，不从原文猜。
- 输出最晚提柜/最晚还箱的日期、预计/计划/历史性质、阶段、计算原因、决定性标准和分项依据；服务端日期序列化为业务date-only或明确时刻，不用浏览器时区重新换日。两项日期没有结果时各自说明原因；部分结果不冒充完整期限。既有清关期限、金额和人工表单不改变。
- 五面：岗位可理解期限或待补；数据引用当前事实与标准；技术只读、同租户、可重读无副作用；权限沿原GET服务端认证/对象范围，内部Port不新增对外权限；UI在原日期区显示结果与原因，三栏和三视口约束不变。
- 测试先行：Port覆盖租户隔离、零标准、缺货代/日历、匹配齐备UTC预计日期、实际起点及不支持日历；海运覆盖投影消费和服务失败事实仍可读；Web覆盖有日期、缺标准、不可用、刷新结果更新且date-only不换日。运行受影响API/Web测试、typecheck/lint/build与格式/repo/diff；真实5173→3000 GET和三视口只读截图另核，不使用mock冒充live。无业务POST/seed/迁移。

### S8 实施与验证记录（2026-11-02）

- Claude 直接接通 S7 到期读模型：charges-settlement 公开 `COMPUTE_STAGED_OVERDUE_DEADLINES` Port、tenant-scoped service/module export；海运 repository 构造已资格筛选的当前目的港 ETA/到港/卸船/提柜上下文，明确缺少 port/company/forwarder/calendar binding 时返回缺口，不猜身份或标准。
- 海运 GET 投影服务消费 Port，序列化 date-only、阶段、预计/计划/历史性质、标准/来源和 issue；计算异常显示 `DEADLINE_COMPUTATION_UNAVAILABLE` 但保留运输事实。Web 期限区消费服务器结果，翻译标准/匹配/日历/缺事实/计算失败提示，不用浏览器时区换日；未接入人工日期保存/锁定。
- RED：新增API Port/service、repository、Web日期结果与缺口测试先失败（缺模块/未投影/仍显示未取得）；GREEN：API charges+ocean定向13文件66项通过，Web期限新增2/2通过，API/Web typecheck、API/Web路径lint、API build、repo check、diff check通过。
- Web完整测试复跑为22/23：唯一失败仍为历史日期/附件“未保存/刷新丢失”测试；该行为不在S8范围，未放宽断言或冒称全Web通过。未运行迁移、seed、业务POST或全仓validate；本票费用标准仍0条，因此只读页面会显示“未配置适用费用标准/费用匹配身份未绑定/计日日历未绑定”，不产生期限日期。
- 架构门禁曾发现海运domain直接依赖charges，已改为本模块 `OceanDeadlineContext` 结构，S8验证后repo check通过。live 5173→3000浏览器验收因会话结束未形成证据，不能声称真实三视口完成；新逻辑由API/Web自动化测试覆盖。fresh S8局部复审待交回；不标brief done。

### S7-staged-deadline-core（2026-10-31）

负责人已要求开建并落地，沿本 brief 串行推进，不另建需求/计划/ledger。正式政策仍见 `08-role-workbenches.md` 日期与三阶段条款。主代理本轮完成只读运行盘点和当前切片定义；按根规则默认人工转发链登记 writer=codex，未授权其他会话同时写工作区。历史 Claude 直接实施记录保留，不沿用为本片分工变更。

#### S7 实施记录（2026-10-31）

- Claude 直接新增三阶段纯函数及测试，经引擎与模块 index 公开导出；复用既有匹配、费用约束目录和免费期计算，不改旧入口语义、不改 Web/Schema/业务数据。
- RED：先缺模块导致加载失败，补最小未实现桩后明确观察 14 项行为测试全部因未实现失败。GREEN：14 新测试＋7 旧期限测试通过；费用/内陆 16 文件 76 项通过。首轮 typecheck 发现费用类型索引未正确收窄，修复后通过，未改配置或放宽测试。
- API 全部单元测试 344 文件 1885 项通过；API typecheck/build、触及路径 ESLint/Prettier、repo/docs/diff check 通过。未运行整仓 validate、Web全套、E2E或迁移，纯函数片未进行业务写入。
- 当前只交付显式 UTC 自然日的阶段计算，不支持工作日/业务时区，不把 UTC 测试夹具当成本票费用政策。S8 页面与服务端接线、S9 保存/锁定尚未实施；MEDU 仍无费用标准，不能宣称已算出可用期限。
- fresh 局部只读复审 S7-001 accepted：重算输入校验失败会清空独立历史提柜期限。补两项回归观察 RED（无效匹配身份/不支持日历），将历史保持统一到失败分支后 GREEN；本修复不放宽日历或事实资格。此复审仅 S7，不代替整任务最终独立复审，brief 不标 done。现有 Web 日期/附件提示失败未在本片修复或复跑，不报告为已通过。

- 最终修复后 API 全部单元测试 344 文件 1887 项通过，费用/内陆回归 78/78、typecheck 与路径 lint 复跑通过。S7 当前纯核心切片验收通过；下一步 S8 消费接线，未形成任务最终 PR 候选，不在中间片重复全仓 validate。

#### 已执行的样本与规则核实

- 基线 `b2e91678172338930e81e3cb903c40455617f427`，分支 `docs/business-first-workbench-delivery`，工作区 `D:/Logixs`。已知未提交内容仅本 brief 与 `08-role-workbenches.md` 的负责人日期政策，由主代理维护，必须保留。
- 真实本地 `logix.public`，租户 `demo-real-sample-20260921`：MEDU7620177 与 Shipment `71000000-0000-4000-8000-000000000003` 有唯一 active link v1；船司 MSC，目的港 USSAV，状态 in_transit。只读事务核对，未 seed/修改数据。
- `overdue_charge_standard`、`overdue_charge_rate_tier` 在该租户均为 0 条。因此匹配标准、免费天数、含首日、日历口径、货代匹配身份和合同适用版本尚未确定，不得为该票输出虚构期限。
- ETA 位于 current `LifecycleDateFact`：destination_arrival/arrived/estimated，rawValue=2026-11-01，timezone=America/New_York，projectionVersion=1，pending/provisional/not_applicable。Shipment.etaAt/ataAt 为空；ShipmentTimeFact 无本票行。不能误以为没有 ETA，亦不能把该预计来源提升为实际。
- 已核现有 `applyFreePeriod`、`computeOverdueDeadlines` 和公开 Port；当前 UTC 自然日、隐式提柜回退、还箱日期钳制只是既有行为，不能自动成为新三阶段政策。现有消费者继续兼容，新入口不复制日期加减公式。
- 2026-10-31 `repo:check` 与 diff check 通过。跨 worktree 检查仍有 primary 功能分支/dirty、其他旧 worktree 未归属差异及 UI 任务依赖问题；本片不碰其文件或共享壳，仅新增费用期限纯核心。未声称全仓校准通过。

#### 切片顺序与当前边界

| 切片    | 可验收交付                                                                        | 条件与边界                                                                                                                  |
| ------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| S7 当前 | 在已有期限引擎中提供三阶段、可解释、缺项明确的纯计算入口及测试；旧入口保持兼容    | 不依赖本票真实费率；测试标准明确为夹具，不写业务库；本片仅显式 UTC 自然日，工作日/其他时区返回未支持，不伪造日历            |
| S8 下一 | 以海运为真实消费者，经公开 Port 读取标准并显示预计/计划期限或具体缺口；不复制公式 | S7 验收后下发精确写域；本票仍缺标准时显示缺口，不以缺标准阻塞读模型开发                                                     |
| S9 后续 | 日期可靠更新、重算、采用/锁定和刷新回读                                           | 服务端版本/幂等/对象授权和 actual 资格；普通手工默认锁定仍待决，可用显式选择避免猜默认；涉及新存储/契约先完成精确设计与复审 |

工作日日历、业务时区和金额组件按实际消费者及已定规则增量补齐；当前不批准默认节假日、默认免费期、预测提柜回退、阶梯解释、费率参数或规则优先级。费用金额仍使用已有金额域，不与期限核心合并；不扩账单/核费/支付平台。

#### S7 文件、接口与测试先行计划

允许实现写入仅：

- 新增 `apps/api/src/modules/charges-settlement/engines/overdue-deadlines/staged-overdue-deadlines.ts` 与同名 `.test.ts`；
- 修改同目录 `index.ts` 和 `apps/api/src/modules/charges-settlement/index.ts`，仅公开新纯函数及类型。

禁止改旧 `computeOverdueDeadlines`/`applyFreePeriod` 语义、Schema/迁移、标准CRUD、HTTP入口、权限码、Web、共享壳、样本/seed、业务事实、其他 worktree 与主代理文档。当前 slice 的精确允许集优先于 frontmatter 累计历史写域。

接口固定：导出 `computeStagedOverdueDeadlines(input: StagedOverdueInput): StagedOverdueResult`。

- `StagedDateFact = { at: Date; sourceRef: string; sourceVersion: string }`；调用方只传经其资格判断的事实，本函数不把来源 pending 自动批准。
- 输入含现有 `OverdueStandard[]`、`OverdueMatchQuery`，`facts: { estimatedArrival, estimatedDischarge, estimatedPickup, actualArrival, actualDischarge, actualPickup }`（各为 StagedDateFact 或 null），`calendarBasis: 'UTC/calendar_days'` 的显式声明；运行时其他日历值明确返回未支持。另可传 `previousPickupDeadline: { date: Date; calculationRef: string } | null`，仅供实际提柜后保留历史。
- 阶段 `before_arrival | after_arrival | after_pickup`，优先看 actualPickup，其次 actualArrival/actualDischarge，最后预计；不能按今天/ETA大小猜阶段。
- 每条匹配标准先按现有 `matchOverdueStandards` 选择，再按 calculationBasis 分别取对应事实。到港前使用相应预计输入；到港后 arrival/discharge 只用各自实际，缺实际不回退 ETA；pickup 在实际发生前只能用显式 estimatedPickup，发生后用 actualPickup。不能隐式用最晚提柜或 ETA 补提柜事实。
- 每项沿用 `applyFreePeriod`，输出 standardId、约束目标、起算事实引用/版本、起算性质、计算日期及 issue。字段和错误码在本文件有限常量定义，不引入新全局状态目录。
- 输出含 stage、items、`pickup`/`return` 两个汇总；每个汇总为 `{ state: 'complete' | 'incomplete' | 'not_applicable' | 'historical'; date: Date | null; nature: 'estimated' | 'planned' | 'historical' | null; limitingStandardIds: string[]; issues: string[] }`。匹配缺失时两者 incomplete；某目标有关分项缺依据时该目标 incomplete/date=null，保留 items 已算结果，不冒称最终期限；无相关类型为 not_applicable。提柜后 pickup 仅回传 previousPickupDeadline 为 historical，缺历史则明确 issue，不重算或用 actualPickup 覆盖旧期限。
- 实际提柜前还箱如仍依赖 estimatedPickup，则 nature=estimated；相应起点全为实际时可为 planned。实际提柜后 return 仍为 planned，不变实际还箱。不同约束取最早并保留全部同日决定性标准；不将还箱日早于提柜日的矛盾钳制成另一天，保留原计算值及明确 issue，供业务处理。
- 纯函数无IO/当前时间/状态写入/锁定副作用；锁定只影响后续采用，不进入免费期数学计算。

- [ ] 先新增失败测试并运行 RED：before_arrival 使用预计 arrival，5 天含起日 2026-11-01→11-05；ETA 改为11-02结果→11-06；测试日期为 UTC 夹具，不是为本票批准免费期。
- [ ] RED 覆盖 after_arrival：arrival 标准用 ATA；discharge 标准无实际卸船则对应汇总 incomplete，不能拿 ATA/ETA 替代；另一目标独立可计算。
- [ ] RED 覆盖 after_pickup：实际提柜11-06、detention免费4天含起日→11-09；D&D到港起算仍用到港；保留旧pickup期限，actualPickup不覆盖；后续ETA变化不改变实际起点结果。
- [ ] RED 覆盖缺标准、缺预测提柜、工作日拒绝、无效日期/负数天数/未知类型、同日最早多标准、结果矛盾不钳制、输入对象不被修改。新测试必须在实现前因缺函数/行为失败，不以修改旧测试换绿。
- [ ] 最小实现 GREEN，并从公开 index 导出；旧测试保持通过。额外断言重算结果不修改任何外部采用/锁定对象。
- [ ] 运行定向新旧期限测试、费用与内陆模块回归、API typecheck、触及路径 ESLint/Prettier、repo:check、diff check。本纯函数片不跑迁移/seed、不为机械中间片全跑 validate。

验证命令：

```text
pnpm --filter @logix/api exec vitest run src/modules/charges-settlement/engines/overdue-deadlines
pnpm --filter @logix/api exec vitest run src/modules/charges-settlement src/modules/inland-fulfillment
pnpm --filter @logix/api typecheck
pnpm --filter @logix/api exec eslint src/modules/charges-settlement/engines/overdue-deadlines/staged-overdue-deadlines.ts src/modules/charges-settlement/engines/overdue-deadlines/staged-overdue-deadlines.test.ts src/modules/charges-settlement/engines/overdue-deadlines/index.ts src/modules/charges-settlement/index.ts
pnpm exec prettier --check apps/api/src/modules/charges-settlement/engines/overdue-deadlines/staged-overdue-deadlines.ts apps/api/src/modules/charges-settlement/engines/overdue-deadlines/staged-overdue-deadlines.test.ts apps/api/src/modules/charges-settlement/engines/overdue-deadlines/index.ts apps/api/src/modules/charges-settlement/index.ts
pnpm repo:check
git diff --check
```

期望定向测试/类型/lint/格式/政策均通过；旧 Web 红测与其他 worktree 问题继续单列，不在 S7 放宽或假称已修。主代理在 HANDOFF 后逐项审实际差异，高风险最终集成安排 fresh 整体复审，S7 不冒充页面交付/整任务完成。

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S7-staged-deadline-core base=b2e91678172338930e81e3cb903c40455617f427 role=implementer workspace=D:/Logixs
```

已知两份主代理文档改动为本任务批准决策，不是待清理内容。执行器先核工作区、准确基线、规则和当前 S7；发现其他新增/不归属变化即 blocked，不覆盖。实施期间主代理停止写本工作区，等待 HANDOFF。交回必须按 `AGENTS.md` §1.3 使用 `logix-handoff/v1`，首行 `HANDOFF ...#S7-staged-deadline-core base=<实际审核基线> role=main workspace=D:/Logixs commit=<sha|none>`；列实际模型、精确 changed、RED/GREEN及所有命令结果、失败/未运行项、无业务写入事实。不得把该纯函数片称为本票期限已算出。

### 日期来源与锁定决策记录（2026-10-30，待实现）

- 负责人明确手工录入的目的就是修改上方对应日期；本轮确认 ETD/ATD/ETA/ATA 支持外部 API（如飞驼）与人工更新，最晚提柜/最晚还箱支持按逻辑计算与人工更新。
- 锁定方案比较：A 锁采用值而继续接收、比较、提醒（推荐：兼顾稳定安排与新风险，增加版本对比成本，可解锁）；B 锁后停止接收（减少当前干扰，但可能漏掉提前期限和来源更正，恢复需补取）。负责人明确选 A。
- 正式业务权威：`doc/cross-border-supply-chain/08-role-workbenches.md`“日期多来源更新与采用值锁定”。本 brief 不复制完整规则；本次只写回已确认结论，不改产品代码、Schema、公共契约、业务数据或已有验收状态。
- 现状与缺口：页面日期仍为内存追加，不更新上方正式值；截止日计算核心已存在，但海运读模型未接且未发现 ETA 自动重算链。已有人工 actual 记录/独立复核/受控 apply 不能直接冒充 Shipment 日期同步；本轮没有完成这些接线。此前日期/附件提示红测仍是历史未通过项，不因业务定案自动关闭。
- 五面承接目标：岗位能更新对应日期、选择采用版本与锁定/解锁；数据保留原值/来源/版本/计算依据；技术保障可靠保存、重算与采用分离、并发和恢复；权限沿服务端对象范围及 actual 资格；UI 保留三栏，只在现有日期上下文显示采用值、锁定状态、新变化差异与处理入口。五面均待实施设计及验收，不声明闭环。
- 负责人追加三阶段定案：到港前两项期限基于 ETA 预测；到港后最晚提柜依适用标准的实际到港/卸船依据重算为计划期限；实际提柜日独立生成并锁定，并用于重算最晚还箱。正式口径已写入同一业务权威“动态期限的三阶段口径”，不是仅给日期加锁开关，不以 actual 提柜覆盖最晚提柜，也不把全部还箱标准强改为提柜起算。实现尚未开始。
- 后续设计必须显式处理：到港但卸船事实未取得时不得冒用 ATA；提柜前按提柜起算的还箱预测须有明确预测依据；阶段切换产生新结果不静默覆盖锁定值或把旧预计值改名为计划。当前算法的 UTC 自然日、预测提柜回退及还箱早于提柜时钳制行为只是现有实现事实，本轮不将其一并批准为完整业务政策，需在当前消费者接入时核对。
- 待负责人定案：普通人工修改后默认自动锁定，或保持原模式并由人员显式选择；已确认的实际提柜日生成并锁定不再待决。只阻塞未定默认行为，不重开已经确认的六项日期来源和锁定政策。最晚清关不在本次新增双来源决定内；附件上传/核验不在本轮范围。

### S6：MEDU7620177 标准数据消费与五类关注验收（2026-10-30）

本轮Claude直接实施，仅通过MasterData公开Port给海运读模型补标准解释（船司名称/柜型原值及映射待核/港口精确识别）；不改业务原值、不采信候选、不新增迁移/seed/API。验收中发现页面与test反复被同工作区其他修改覆盖，负责人在选项中明确选择“保留当前页面”，因此本轮范围收窄为标准数据消费、同票刷新与三视口只读核验，不再恢复五类页签或修改页面日期/附件功能。原定五类关注的完整内容、可靠日期/附件落账、查看来源定位和保存判断路径作为未通过/未验证项，不能宣称已办理或闭环。保留当前三栏、概况、环节轨、财务/清关资料及视觉调整。实际使用1440×900、1024×768、390×844，无mock，不重跑seed/恢复脚本，不为验收造新判断或提交业务记录。服务端只改ocean module/app service/tests及读仓储containerTypeCode投影，经MasterData公开Port消费；不改共享壳/状态机/运输原值。

#### S6 保留当前页面的只读验收结果（2026-10-30）

- 负责人在冲突选项中选择保留当前页面；未恢复五类页签、不再修改页面/test，未运行seed或POST业务操作。页面/test最终hash与本轮保留起点相同：`b318486c91527ab2eadddd44e5352903b11f3e0b` / `9c8f2574b341c44ab13c279f2c8885bdb337eec6`。
- 真实5173→3000→数据库，同一柜`e6a45d96-46e3-43c9-8fa3-3794b36c1d96`：MSC由MasterData基准1.1.0解释为地中海航运；柜型40HQ原值保留，candidate不显示为40HC；CNFOC标来源码待映射，USSAV精确识别为Savannah。不覆写港口中文候选、不猜地图关联。
- 本机Playwright三视口1440×900、1024×768、390×844已实际切当前5个页签并刷新，同票投影前后相同，无API写请求、无横向文档溢出。截图在既有临时目录`acceptance-preserved-{1440x900,1024x768,390x844}.png`及`acceptance-preserved-390-context.png`，对应API/readback/页签内容/溢出数据在`acceptance-preserved-readonly.json`。截图逐张人工查看：桌面三栏、窄屏左轨、手机分屏保留；手机责任带挤压和日期断行明显，未以无横溢冒称视觉质量通过。
- 核对四张业务表全行hash（本轮只读前后）一致：Shipment=`d91c549745ff0eac54627ace7578232f`，ContainerRecord=`ac0bef9b55f430385562957876c758c0`，source review=`d952883229fa0c7d624b0787ac99c87c`，arrival result=`d41d8cd98f00b204e9800998ecf8427e`。历史来源review仍v6，arrivalPreparation为空，不把它变成新的到港准备判断。
- 不通过/未验证：当前右侧是进展/风险/信息/协同/财务，缺独立到港变化内容；风险和协同仅标题；日期记录和附件保存在浏览器内存，不是正式落账；“查看依据”恢复与保存新判断不在保留页面版本通过项。国别资料清单仅参考，不能证明本票适用、缺失或已经核验。页面/API存在不等于岗位办理或下游接收完成。
- 服务端定向20/20、当前页面16/16、API/Web typecheck通过，服务端增量ESLint通过。一次API typecheck进程异常退出3221226505，串行复跑通过，未篡改工具配置。容器浏览器因Vite allowedHosts被拒，用本机浏览器验证，未修改运行配置。fresh局部只读复审无已核阻塞，覆盖app service/module；reviewer明确未完整核测试/domain/repository输出，主代理另有定向测试和真实读回，不冒称整任务复审完成。
- 验收时其他会话将基线提交至`f4dac5e6c42689f198505754b32794db25a44439`，本轮未执行提交/回退/暂存。当前`repo:check`失败项为任务权威/写域对账（TASK_AUTHORITY_WRITE_UNDECLARED和15个历史tracked path out-of-scope），不因本轮验收而扩大写域或覆盖他人改动；`git diff --check`通过。该门禁失败与本轮只读业务结果分轨，整brief不标done。

- 最终补充：API完整343文件1870项、Web完整178文件999项全部通过；API build通过。此前边界检查失败保持如实记录，不用单测通过覆盖repo门禁；本轮只读消费验收可确认，五类办理/最终集成仍未通过。

### S5：船公司初始目录及柜型依据（2026-10-30）

负责人授权Claude直接补齐内部基础数据，不扩平台/映射/状态机。本片读取SMDG官方LCL 20261028工作簿（含Description/有效期/VOCC/NVOCC）形成项目1.1.0追加版本，保留1.0.0及原MSC/HMM canonical，旧profile仍绑定原版。初始目录按实际源行收录，不以船司营业/资质已批准冒充代码有效；到期项保留但不作新业务可选，空分类为unknown，不猜中文译名。柜型保留现有12个组合码，仅追加BIC公开ISO6346尺寸/类型说明依据，不把GP/HC/FR/OT/RF商用简称强配为唯一四位ISO设备码；不添加尺寸/承载数值。

允许增量：schema、追加迁移、`database/seeds/reference-data/smdg-liner-codes-20261028.xlsx`及确定性生成JSON、`scripts/reference-data/compile-smdg-liners.mts`、internal baseline数据/seed、只读Port与测试、本brief。复用既有ReferenceDataRelease，不改现有标准seed接口，不改国家/港口/码头/供应商profile或Shipment/Container；不跑外部运输API。验证含新旧版本并存、官方行hash/重复代码、有效期/空分类、未知柜型与same-version冲突、幂等导入、真实数据库readBaseline和profile-v1兼容；最终fresh只读复审。官方网页未声明许可，元数据如实保留public-download/license-not-stated，不伪造开放许可或完整SCAC目录。

#### S5 实际交付与复审（2026-10-30）

- 官方下载SMDG LCL 20261028 XLSX，SHA256=`464c19a571026272a9c949472a0d614e6b79298bc5d938612a6deb76ef8c87da`。确定性解析373源行（包括G2O/TI2字母数字码），保留有效期和VOCC/NVOCC unknown，2026-10-30快照362 active/10 deprecated/1 review_required；TFP原日期2025-1010隔离，不猜改。当前code active不代表资质/经营资格获批。官方页可下载但无许可声明，如实保留license-not-stated。
- 新增基准1.1.0（releaseId末尾0002），carrier表补标准代码/来源/行号/有效期/分类，中文未知为空；12柜型standard_basis记录BIC两页公开ISO6346指南，不强配唯一ISO设备码、不造尺寸/重量。原1.0.0保留并superseded，旧provider profile仍绑定原release，现有运输/状态机和外部mapping未改。
- 迁移在本地logix.public成功；专用apply两次与原样db:seed均通过，真实回读373/362/12；API健康HTTP200/database=up。正式MasterData readBaseline只返回当前active版可选船司，附来源/分类和柜型依据；不新增UI/API。
- 定向真实数据库集成5/5通过：新旧版本、重复零增量、旧profile兼容、同版本内容冲突、候选解析约束；API全单测342文件1867项通过，API typecheck/build、模块路径lint、源码/文档格式及repo/docs/diff检查通过。首次解析X/x标记差异和TFP坏日期已明确处理；最初额外tsc在根环境缺Node types，改用API原类型环境验证通过，不改工具配置。
- fresh只读复审：logix-review/v1/S5/无阻塞findings=[]/writes=none；逐行源工作簿/生成JSON和hash一致。柜型不唯一ISO、旧profile绑定、无自动迁移已核实。未跑整仓validate、全量integration、生产部署或Git集成，整海运brief仍非done。
- 操作与来源范围写入`scripts/reference-data/README.md`，不是另建第二套业务权威。只交付本次初始数据与依据，不扩通用治理平台。

### S4 Nest 启动修复（2026-10-30）

根因：新增内部基准Port时误替换了既有CARGO_OWNER_DIRECTORY provider别名，exports保留但providers缺失，造成UnknownExportException；TS类型检查不能验证Nest DI注册。恢复 `CARGO_OWNER_DIRECTORY → CargoOwnerDirectoryService`，不删除exports、不改货主能力。新增MasterDataModule实际compile/init回归，先RED复现相同错误，修复后GREEN，并验证货主Port调用及两个海运Port可解析。API typecheck/build通过，当前3000 `/api/health` 实际返回HTTP200、status=ok/database=up；未手动重启或替换服务。

### S4 seed 入口修复（2026-10-30）

负责人实际执行 `pnpm db:seed` 暴露参数装饰器编译错误：seed→profile importer→Nest repository 的运行时依赖加载了API装饰器，但标准seed入口没有experimentalDecorators。根因修复是把canonical查找移到无Nest运行时依赖的 `infrastructure/canonical-reference-lookup.ts`，由importer与Nest仓储共用，不改package.json或全局tsconfig。新增子进程回归按根目录原生tsx配置加载seed依赖图，先复现相同错误RED，修复后GREEN；原样 `pnpm db:seed` 已成功（重复导入新增0/0）。这是当前S4增量，不扩映射/状态机范围。

### S4 修正：配置加载与指定版本解析（2026-10-30）

负责人授权 Claude 直接修正：供应商 JSON 配置驱动导入，禁止写死 provider；同 provider/version/dataset 内容不同明确冲突；查询显式指定版本；候选查阅与正式解析分离。标准命名空间仅在指定内部 release 校验，不复制全量映射；非标准值只消费 confirmed 映射。保留已批准独立复核政策，本轮不新增确认接口、不预填审批。旧 Freightower `40HQ` 归属不实，原版本保留但停用，新 Freightower 配置只录官方已取得值；`40HQ` 移到独立 legacy 来源配置且仍 candidate。未知、待核、停用、不支持命名空间分别返回，不修改 canonical 或业务状态。

精确增量范围：本 brief、`database/schema.prisma`、新增 `20261030120000_add_provider_profile_configuration` 迁移、`database/seeds/seed-external-ocean-reference-mappings.ts`/`external-ocean-reference-mappings.ts`、`database/seeds/provider-profiles/**`、`apps/api/src/modules/master-data/**`、`apps/api/src/infrastructure/integration/provider-profile.integration.test.ts`、`scripts/reference-data/provider-profile.mts`。保留其他改动；不重跑全库 seed。默认 audit，显式 apply 仅授权本地 logix.public；确认后用真实库验证重复导入无增量、版本隔离、candidate 不解析、标准码无需映射及 canonical/业务零写入。正式 Port 从 master-data/index 导出，不新增 HTTP 入口、权限平台或外部 API。

#### S4 配置修正验证与裁决（2026-10-30）

- 已实际运行 `scripts/reference-data/provider-profile.mts import <JSON>` 默认 audit，再显式 `--apply`：Freightower v2 新增3个dataset profile/4条candidate，独立logix_legacy新增1个profile/1条candidate；重复导入Freightower v2新增0/0。不是API连接器，未接外部网络。
- 正式解析实测：指定Freightower v2 + logix/40HC → resolved；scac/MEDU → pending_review；port_code/CNFOC → pending_review；旧错误Freightower版本 → unavailable；legacy/40HQ → pending_review。不预造confirmed。
- 纠偏：原先“CNFOC已是现有UN/LOCODE”的表述不成立。实际库和版本fixture无CNFOC，存在CNFZG/CNFZH/CNFZX等不同福州地点；新配置将供应商CNFOC候选目标置空，未猜选、不改运输记录。旧3个Freightower profile保留但deprecated，旧40HQ来源不再消费。当前canonical表仍2 carriers/12 types，业务仍1票/1柜；没有用事后计数冒称已有完整业务零变化对账。
- 独立只读复审F-01 accepted/fixed：同provider/version但不同datasets集合可能漏报内容冲突。新增失败回归先RED，随后在dataset循环前校验整版本hash并保留事务锁；GREEN及数据库版本差异反证通过。
- 最终验证：API完整339文件1864单测通过；定向真实PostgreSQL隔离schema集成4/4（迁移、audit零写入、重复导入、候选/版本隔离、标准码无需映射、审核元数据约束、内容冲突、失败事务回滚）；API typecheck/build、修改路径ESLint、CLI/seed额外tsc、repo:check、docs:check、Prisma validate、diff check通过。初次集成因CNFOC不存在失败，修正为null候选；初次typecheck因导入ESM seed的import.meta失败，测试改用官方fixture最小地点行后通过；lint初次unused import已去除。未运行全仓validate/全量integration，未宣称整海运闭环或生产发布。
- 可复制本地操作及边界见 `scripts/reference-data/README.md`；正式模块消费从master-data/index导出Port，candidate查阅使用inspectProfile、业务转换使用resolve且显式指定provider/version/dataset/namespace。无审批命令，不建议手动SQL提升confirmed。

### S3 当前实现记录：外部映射候选（2026-10-30）

- 新增外部映射候选输入/校验：`database/seeds/external-ocean-reference-mappings.ts`，当前仅包含 `freightower` 的 `40HQ→40HC`、`MEDU→MSC`、`CNFOC→CNFOC` candidate；没有数据库写入、没有 confirmed、没有状态机影响。
- 映射校验要求 provider+providerVersion+dataset+sourceCode 唯一，canonical 不能为空；任何 confirmed 直接拒绝，必须走后续独立复核。外部映射不改变 `ocean_carrier_reference`、`container_type_reference`、Shipment/Container 或 UN/LOCODE。
- 定向候选映射测试通过后，下一步才考虑映射表的最小持久化；本片不接 API、不自动确认、不把飞驼快照转内部标准。

### S4 可复制 TASK：最小供应商 profile + 稀疏映射

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S4-provider-profile-sparse-mapping base=ef3b7b3c05958e8640f5f012af90567e99ca6966 role=implementer workspace=<Codex独占worktree绝对路径或分支>
```

目标：在已固定 Logix 内部 canonical 基准之上，建立最小可版本化供应商 profile 和稀疏映射层；支持未来替换飞驼/新增供应商，但不做全量外部字典平台、不接真实 API、不改变内部基准或状态机。

允许写入：`database/schema.prisma`、追加 `database/migrations/**`、`apps/api/src/modules/master-data/**`、`packages/contracts/schemas/v1/**`（必要契约）、`database/seeds/external-ocean-reference-mappings.ts` 及其测试、`scripts/reference-data/**` 及对应验证。禁止 `apps/web/**`、外部凭据/真实连接器、lifecycle-control/ocean-port-visibility、Shipment/Container 字段、全量码头表、全量国家/港口/船司映射、`db:seed` 无关重构。

必须交付：

1. **Provider profile**：provider、profileVersion、dataset、字段/查询参数名称、能力（仅当前承运人/柜型/局部港口消费者需要）、状态和版本；配置描述外部，不改变内部 canonical。新供应商可通过新增 profile + mapping 接入；特殊协议暂不实现。
2. **稀疏 mapping**：最小持久化表/读 Port，字段至少 provider/profileVersion/datasetCode/sourceCode/sourceName/canonicalCode/mappingState(candidate|confirmed|rejected)/effective区间/reason/source fixture row hash。唯一键按 provider+profileVersion+dataset+sourceCode+context，不以 SCAC/API 参数全局唯一；同 hash 幂等、异 hash 冲突；confirmed 必须通过独立复核命令/权限，当前 slice 只落 candidate。
3. **当前三类范围**：承运人只覆盖真实消费者需要的 `MEDU→MSC` 等候选；柜型只覆盖 `40HQ→40HC` 等实际需要候选；港口只允许局部 `CNFOC→CNFOC` 等 UN/LOCODE candidate。码头不建全量映射，国家不做供应商全量映射。
4. **稳定内部消费**：读 Port 返回内部 canonical；业务模块不读取 provider code，不自动把 candidate 当 confirmed；内部标准 release 不被外部 mapping 更新覆盖。映射版本替换可回滚，历史事实仍引用内部标准版本。
5. **profile/映射与飞驼 fixture 分离**：飞驼 fixture 是一个 provider input，不是内部标准；未知、碰撞、未覆盖和多对一进入待处理/差异，不自动创建内部 canonical。`AUTO`、“暂不支持”和无 canonical 值不得入 confirmed。

测试先行：覆盖新增供应商 profile 可并存、承运人/柜型/局部港口 mapping candidate、候选不进入 confirmed、重复同 hash/异 hash冲突、provider 参数碰撞、内部 canonical 不变、港口 sparse scope、码头无全量表、版本回滚/active 绑定、无外部 HTTP。运行定向测试、Prisma generate/validate、真实数据库迁移/回读、API typecheck/lint/format、repo:check、git diff --check；不得接真实 API。

交回首行：

```text
HANDOFF docs/planning/tasks/ocean-operations-source-review-v1.md#S4-provider-profile-sparse-mapping base=<实际审核基线SHA> role=main workspace=<Codex工作区> commit=<sha|none>
```

必须列实际模型、profile/mapping rows、checks、数据库读回、exceptions、未运行项；不得声称全量映射或飞驼生产接通。

### S4 当前实现记录：最小 profile + 稀疏映射（Claude 直接实施，2026-10-30）

负责人明确本片不交 Codex，由 Claude 直接实施。已落地：

- `external_ocean_provider_profile`：按 provider/profileVersion/datasetCode 保存最小 profile；本地 Freightower 3 个 dataset profile，描述字段/版本与来源，不代表 API 已开通。
- `external_ocean_reference_mapping`：按 profile/sourceCode 稀疏保存外部值→内部 canonical；当前仅 `MEDU→MSC`、`40HQ→40HC`、`CNFOC→CNFOC`，全部 `candidate`；只读 Master Data Port 不会把 candidate 当 confirmed。
- 不建码头全量、不做国家/港口/船司全量映射；不改内部 `ocean_carrier_reference`、`container_type_reference`、UN/LOCODE、Shipment/Container 或状态机。
- 本地数据库迁移成功；两次 `pnpm db:seed` 均报告 3 profiles/3 candidate mappings。PostgreSQL 回读确认 3 profiles、3 mappings、全部 candidate，内部仍为 2 carriers/12 container types。
- 定向 mapping/domain/repository 测试 5/5、API typecheck、Prisma generate/validate 通过；未接真实 API，未确认任何 mapping，未做网页/工作台改动。

> 本 brief 是海运运营首片的唯一业务与设计载体，不建立第二套业务权威。
> 当前唯一实施切片为 `S1-five-focus`（2026-10-29）：负责人锁定运输进展、到港时间变化、航程及承运风险、信息缺失或冲突、下游信息与协同五类关注，并明确由 Claude 直接实施，不交 Codex。覆盖旧 TASK 的逐票 ETA 审批、正常等待制造缺口口径；外部接入层不在范围。
> 原实施切片为 `S1-arrival-preparation-business-slice`：查看运输现状 → 核对当前目的港 ETA 依据 → 形成供清关到港准备使用的办理结论。来源复核、旧 finding 修复和一柜演示落库均为这个业务结果的支撑，不再单独作为交付终点。
> 历史 TASK 的要求仅在与当前活动切片不冲突时沿用；不并行执行多个旧 TASK。下游接受与专业执行仍分轨，未接通时不宣称交接完成。

## 目标

在海运运营现有入口，岗位人员打开一票运输，看清货柜、承运人、船名航次、起讫港、目的港预计到港与已有上游事实；围绕“当前 ETA 能否供清关开始到港准备”核对已有依据，记录本次办理结论、理由、影响/不确定项及结果用途，刷新后继续办理。不得把“保存来源复核记录”替代本片业务结果。

本片支持在出运工作台尚未完整落地时继续办理：按负责人开发授权在当前演示库补齐一条逻辑正确的业务链，必要补充值标记 development_demo；非必要上游/下游字段保持为空并保留正确接口。需要的演示数据、页面与办理能力同片交付，不再等待原 XLSX、完整出运台或完整清关台。

## 边界 / 不做

- 不把当前经营决定卡建设成新的工作台、影子账或跨域写权限；它只连接上游依据、本台判断、下游接收和 actual 回流。
- 不新增把来源观察自动提升成生产 actual 的通道。业务资料中的计划/实际出运必须分开；开发演示可以按当前活动切片的明确演示规则补全所需 actual，不反向宣称它来自原文件。不影响当前办理的上游字段允许为空。
- 不把缺少的计划出运日期、完整出运交接、ETA 历史或下游期限静默补成默认值；不影响当前动作的字段保持为空或未知。
- 不自动判定换船、甩柜、改港、延误、实际到港、卸船、可提、Gate Out、清关放行或仓库接收。
- 不由海运运营按 ETA 推算统一下游截止时间；清关、提柜、仓库分别提供自己的最晚行动时间。
- 不把通知发送当作下游接收，不把下游接收当作专业执行完成；事实裁决、交接、执行和 actual 分轨。
- 不接管出运、清关、提柜、送仓、卸柜、还箱或费用结算的专业事实所有权。
- 不先建设实时船司连接、通用 ETA 预测、全量换船模型、全套异常中心或全仓 UI 迁移。
- 不因演示数据某项验证未通过而整体阻塞；错误按字段隔离修正，只有影响当前安全、解释、落账、授权或交接的错误阻塞对应动作。
- 不在本 brief 阶段修改产品代码、测试、迁移、契约、权限或生成物。

## 当前业务步骤

```text
已出运货柜
→ 核对 Shipment/Container/Bill 身份与实际离港条件
→ 读取来源观察、航次、航段、ETA/ETD 和时间语义
→ 标出冲突、损坏、过期或缺失
→ 形成当前采用事实或待复核结论
→ 判断清关/提柜/仓库影响
→ 形成下游交接
→ 记录下游接收/拒绝/待补
→ 回收 actual 并解释差异
```

## 业务目的与唯一结果

- **目标岗位：** 海运运营人员；“进口海运运营专员或值班组”仍是基线中的具体组织候选，真实组织名称和班组范围未知。
- **业务目的：** 从实际离港开始持续掌握航段和货柜执行变化，使下游基于最新且可解释的海运事实工作。
- **优先减少的损失：** 当前首片聚焦来源冲突或陈旧事实导致的错误催办、错误预约和错误资源重排；完整优先级沿用“逾期启动 → 异常失控 → 错误改排”。
- **本片唯一结果：** 对一个已出运货柜形成可追溯的事实裁决/待复核结论，并把影响、不确定项和下游行动交给对应责任域；事实裁决与下游交接分开记录。

负责人已确认：

1. 事实裁决与下游交接分开记录；通知发送不等于下游接收，下游接收不等于专业执行完成。
2. 下游最晚行动时间由清关、提柜、仓库等责任域分别提供；海运运营只消费期限并判断影响，不按 ETA 推算统一截止时间。

## 真实样本与当前办理对象

首片参考对象：

- 货柜：`MEDU7620177`
- 备货单：`26DSA01885`
- HBL：`1811F026PE36668R2`
- 承运人：MSC
- 路线：福州 → 萨凡纳
- 出运日期来源值：`2026-09-23`，当前只作为 date-only 出运来源观察/待复核值
- ETA：`2026-11-01`，事实类型为 `estimated`
- 母船出运日期来源值：`2026-10-02`，单独作为待复核观察
- 母船名称/航次：未取得
- 当前问题：出运日期与母船出运日期的事件语义和关联身份待复核
- 当前不能宣称：canonical `actualDepartureAt` 已采信、发生换船或延误

该对象是负责人确认的演示/真实业务资料，当前不要求重新证明真实性。技术和业务核对只关注对象关系、字段语义、来源版本、当前动作所需完整性和后续回写。

## 数据流

### 上一个工作台输出：出运交接

出运工作台最终拥有并交给本台：

- 稳定 Shipment 身份；
- Shipment 与 Container、Cargo、MBL/HBL 的 typed reference；
- 计划出运日期 `plannedDepartureAt`（可为空）；
- 实际出运日期/时间 `actualDepartureAt`（可为空）；
- 时间精度与事实类型；
- 实际离港依据和证据引用；
- 承运人、船名、航次、起运港、目的港和原始运输基线；
- 上游交接版本、缺口和来源。

出运工作台尚未完整落地时，本片可以消费兼容临时投影：只为当前来源复核读取所需字段建立出运日期来源观察/待复核状态；保留原值、来源、版本、日期精度、补全原因和 `writeBackTarget`。在取得合格实际离港证据前，不得将该观察写成 canonical `actualDepartureAt`，也不得把 `orderStatusSource=已出运` 单独当作实际离港证据。上游开工后，该观察必须能回写上游权威，不得形成第二套出运账。

### 本台读取

本台只读取当前步骤所需的：

- Shipment/Container/Bill 身份与租户/主体/对象范围；
- 计划、预计、实际离港和到港时间；
- 当前航段、港序、船名、航次、承运人、中转/途经信息；
- 原始来源、来源记录、来源版本、接收时间、解析状态、新鲜度和证据；
- 当前已采用事实及前一版本；
- 清关、提柜、仓库提供的最晚行动时间及其版本；
- 既有交接和下游回执；
- 与当前对象相关的双面财务投影引用，不复制金额权威。

### 本台产生

本台产生：

- 来源观察引用和来源复核项；
- 当前采用的计划/预计/实际事实或待复核结论；
- 冲突、损坏、过期、无法匹配和待补事项；
- 对清关/提柜/仓库的影响判断；
- 下游交接快照、版本和接收状态；
- 人工裁决、拒绝、请求更正和恢复记录；
- 对当前经营决定卡的引用：上游版本、本台判断、交接版本和后续 actual 引用。

本台不改写上游出运事实，不确认下游专业执行事实，不生成费用、收入、现金或库存权威金额。

### 下游消费与回执

- 清关消费可信到港窗口、变化、来源、不确定项和清关自己的最晚行动时间。
- 提柜消费到港/航段影响、货柜引用、提柜准备事项和提柜自己的最晚行动时间。
- 仓库/送仓消费到港窗口、目的地影响、准备事项和仓库自己的最晚行动时间。
- 下游分别返回已接收、拒绝、待补或版本冲突；接收仅表示能够开始本岗工作，不表示专业执行完成。

### actual 回流

后续从清关、提柜、送仓/卸柜或合格外部来源取得实际到港、卸船、可提、Gate Out、到仓等事实。回流必须引用本片采用事实和交接版本，与原计划/预计/影响判断比较，差异分类为需求变化、运输变化、执行偏差、来源错误或其他未知；不能用 actual 覆盖历史采用值。

## 岗位执行层

| 项目     | 本片定义                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 当前任务 | 处理一个已出运货柜的来源/航次/ETA 复核项                                                                                      |
| 当前责任 | 海运运营人员；具体组织/班组范围待补                                                                                           |
| 等待对象 | 来源补证、上游回写或下游 deadline/接收回执                                                                                    |
| 主动作   | 复核来源并形成采用值/待复核结论，然后形成或更新下游交接                                                                       |
| 允许动作 | 确认/驳回来源候选、锁定人工核验值、关联换船/新航段（有证据时）、登记异常、通知受影响岗位                                      |
| 禁止动作 | 以冲突自动判定换船/延误；用 ETA 推算 deadline；改写上游事实；代替下游确认专业执行                                             |
| 完成语义 | 事实裁决、交接发送、下游接收、专业执行、actual 分轨；本片业务步骤在约定的交接接收回执形成后完成，缺 deadline 时及时性保持未知 |
| 失败恢复 | 保留原观察和原尝试；补证后追加版本；来源更正后重新判断并重新交接；下游拒绝进入待补/重交接                                     |

## 双面财务投影层

本片不直接确认金额：

- **收入/贡献：** 航期变化可能影响销售窗口和可售时间；当前只有 `projected/unknown`，不产生收入确认。
- **成本/费用：** 可能影响滞港、仓储、加急、改配或重排费用；当前是 `risk/projected`，不产生费用确认。
- **现金：** 当前没有现金收支事实；保持 `unknown`，不把货值或运输金额当现金。
- **库存：** 可能影响到货和可售时间；当前没有入仓余额，保持 `unknown/projected`。
- **风险/机会：** 错误 ETA 可能导致错误预约、重复催办或延误响应，记录为风险信号。

每一项财务投影都引用对象、期间、币种、事实所有者和来源版本。不可比时保留分项，不强行合成净额。本动作无直接金额确认。

## 关键业务记录与字段

### 出运交接/兼容投影

- `shipmentRef`、`containerRef`、`replenishmentOrderRef`、`billRefs`
- `plannedDepartureAt?`
- `actualDepartureAt?`（只有合格实际离港证据成立后才能追加；当前样本保持为空）
- `departureObservationValue?`、`departureFactType`：`plan | estimated | actual | unknown | review_required`
- `departureTimePrecision`
- `departureSourceRef?`、`departureEvidenceRef?`
- `upstreamHandoffVersion?`
- `temporaryBackfill?`、`backfillReason?`、`writeBackTarget?`

### 来源观察与复核

- `observationId`、对象引用、`sourceSystem`、`sourceRecordRef`
- `observedAt?`、`receivedAt`、`sourceVersion`、`parserVersion?`
- `rawValue`、`normalizedValue?`、`factType`
- `sourceStatus`、`freshness`、`evidenceRef?`
- `reviewId`、`conflictType`、参与观察、当前问题、缺失证据
- `reviewDecision`、`decisionReason`、`decidedBy`、`decidedAt`
- `supersedesRef?`、`writeBackTarget?`

### 当前采用事实

- 对象/事实代码、采用值、事实类型；
- 采用来源、未采用来源、采用理由；
- 生效时间、事实版本、前一版本、更正引用；
- 采用人/规则主体和证据引用。

### 影响判断与交接

- `impactAssessmentId`、采用事实版本；
- 受影响工作台、影响说明、下一动作、不确定项；
- 下游 `deadlineSourceRef?`、`deadlineAt?`、`deadlineStatus`；
- `handoffVersion`、`handoffStatus`、接收人、接收时间；
- 拒绝原因、待补项、恢复动作和上一交接引用。

### 追溯/财务/actual

- 上游交接引用、本台判断引用、下游回执引用、actual 引用；
- 收入/贡献、成本/费用、现金、库存、风险投影标签及来源；
- 事实类别、对象/期间/币种/数量基础；
- 计划与实际差异类型和解释；
- 幂等键、版本、expectedVersion、审计身份和恢复引用。

以上是业务字段集合，不预先决定新增物理表；承载方式在实现设计阶段依据现有表、契约和当前消费者确定。

## 数据事实三轨

| 轨道                 | 内容                                                                                               | 当前状态                                    | 本片处理                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `current_physical`   | Shipment 当前标量 ETA/ATD、OceanRoute、TimeFact、TrackingEyes 原始事件、现有出运后 package/fixture | 已有部分承载；没有完整海运运营读模型        | 复用并建立兼容投影，不能用单值 ETA 冒充历史           |
| `approved_gap`       | 计划/实际出运分离、事实裁决/下游接收分轨、下游分别提供 deadline、下游回执和版本化交接              | 已写回 `08-role-workbenches.md`；实现未接通 | 作为本片业务要求；缺 deadline 只限制及时性结论        |
| `industry_candidate` | DCSA/船司接口的完整事件覆盖、更多 ETA 算法或统一严重度阈值                                         | 非本片已定政策                              | 不进入当前 Schema/契约/界面；待真实消费者和负责人定案 |

## 五面映射

| 面       | 本片状态与证据                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 岗位任务 | `design`：已明确复核→影响判断→交接；真实队列和岗位办理未实现                                                                                |
| 数据事实 | `design`：上游交接、来源观察、采用事实、影响、交接、回执、actual 分轨；当前承载分散在 Shipment/TimeFact/TrackingEyes/package                |
| 技术保障 | `design`：保留原值、来源、版本、证据；幂等、版本冲突、租户隔离、待重放沿用现有能力；海运运营专用读写/回执仍缺                               |
| 权限边界 | `design`：只读/复核/锁定/交接按服务端 capability、租户/主体/Shipment/Container 范围控制；不能用前端角色代替；具体 capability 待实现设计核定 |
| 界面承接 | `design`：优先复核队列→对象/来源→冲突/缺口→允许动作→影响→交接/回执→恢复；当前 ocean 页面仍为 planned，dispatch 风险页不可冒充本台           |

## 负责人决策记录

| 决策 ID   | 已知事实与未知                                     | 选项、成本/收益/风险/可逆性                        | 推荐与理由                                      | 负责人结论                | 权威落点 / 状态                                                                |
| --------- | -------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| OCEAN-D01 | 事实裁决、通知发送、下游接收和专业执行语义容易混淆 | A 分轨记录；B 通知发送即完成；C 只完成来源复核     | A：保持责任边界和可验证交接，代价是需要下游回执 | A，事实裁决与交接分开记录 | `doc/cross-border-supply-chain/08-role-workbenches.md` 海运运营补充；confirmed |
| OCEAN-D02 | 清关、提柜、仓库的最晚行动时间不属于海运运营权威   | A 各责任域提供；B 海运按模板推算；C ETA 减固定时间 | A：不发明统一 SLA；缺失只保持及时性未知         | A，各责任域分别提供       | `doc/cross-border-supply-chain/08-role-workbenches.md` 海运运营补充；confirmed |

## 验收

- [ ] 目标岗位能从真实/现有演示对象进入本片，识别对象、来源、冲突和当前问题。
- [ ] 计划出运与实际出运分开，当前只有来源日期观察时不把它写成 canonical actual；实际离港缺失时不把计划/预计/来源状态当实际。
- [ ] 上游未落地时，当前必要字段可用兼容投影承接；非必要字段保持为空；临时补全保留来源、版本、原因和回写目标。
- [ ] 损坏 ETA 修正值被隔离，不覆盖可用来源；母船日期冲突不自动判定换船或延误。
- [ ] 当前采用事实保留采用来源、未采用来源、理由、版本和更正关系。
- [ ] 下游 deadline 分别来自清关、提柜、仓库；缺失时及时性结论为未知，不按 ETA 推算。
- [ ] 事实裁决、交接发送、下游接收、专业执行和 actual 分轨显示。
- [ ] 下游可返回接收、拒绝、待补或版本冲突；拒绝/冲突后可重新复核和交接。
- [ ] actual 能引用本片采用事实和交接版本，形成差异解释，不覆盖历史。
- [ ] 双面财务投影分别表达收入/贡献、成本/费用、现金、库存和风险；本片无直接金额确认，不补虚构金额。
- [ ] 五面均有实现与验收证据后，才能宣称本片完成；不能用页面/API/Schema/测试单独宣称。

## 首片精确切片：来源复核可见办理

### 业务结果

海运运营人员从 `/workspaces/ocean-operations` 进入一个待复核对象，能看懂：

- 这是哪个货柜、备货单/提单和当前运输引用；
- 出运日期只是来源观察还是已经有合格实际离港事实；
- ETA 是预计值，不是实际到港；
- 哪些来源值冲突、损坏或缺失；
- 当前可以作出的唯一复核动作是什么；
- 保存后形成了什么复核记录；
- 下游交接尚未接通时，不能误显示为已完成。

### 本片唯一写动作

保存一条来源复核结论，至少支持：

- `review_required`：保留当前来源观察，说明待补证/待核原因；
- `adopt_observation_for_review`：仅将某条来源观察标为当前复核投影采用值，不把它写成 canonical lifecycle actual；
- `reject_observation`：拒绝当前来源观察并说明原因。

本片不写 canonical `actualDepartureAt`，不推进生命周期，不直接产生下游接收回执。真实下游交接字段先显示“未接通/待后续切片”，不冒充完成。

### 本片最小数据承载

优先复用现有 `Shipment`、`ShipmentContainerLink`、`ContainerRecord`、`OceanRoutePlan`、`LifecycleDateFact` 和 `OceanProviderEventIngestion` 的读取能力。首片需要一个可追溯的复核记录/投影承载；是否追加物理表、契约或仅由现有事实派生，必须由实现设计在当前消费者和迁移风险基础上确定，不可用 `Shipment.etaAt` 或 `LifecycleDateFact` 单值字段冒充完整采用事实。

复核记录至少需要：

- 对象引用和租户范围；
- 原始观察引用、来源记录、来源版本、解析状态和日期精度；
- 原始值与规范值；
- `reviewDecision`、理由、操作者、时间；
- 前一复核版本/更正引用；
- `writeBackTarget`；
- 幂等键、expectedVersion、审计和失败恢复信息。

### UI 首片结构

```text
优先复核队列
→ 当前货柜/Shipment与来源
→ 冲突、损坏和缺口
→ 唯一复核主动作
→ 保存回执
→ 下游交接未接通/下一步
```

不得把页面做成通用字段表或来源原文墙。原始载荷、哈希、解析版本和历史更正进入渐进披露。

### 首片验收反证

- `2026-09-23` 只显示为日期来源观察/待复核，不显示为 canonical actual；
- `2026-11-01` 显示为 `estimated`，不显示为 ATA/实际到港；
- 母船日期缺身份时不能判定换船或延误；
- 损坏 ETA 修正值不能覆盖可用 ETA；
- 缺少下游 deadline 不阻塞来源复核，但及时性保持 unknown；
- 保存刷新后复核结论仍可见，重复提交不产生第二条结果；
- 版本冲突保留草稿/原结果并提供重读恢复；
- 无权限、跨租户或对象不匹配被服务端拒绝；
- 页面不能显示下游交接已完成。

## 可复制的首片 TASK 定位信封

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S1-source-review-visible-slice base=ef3b7b3c05958e8640f5f012af90567e99ca6966 role=implementer workspace=<Codex独占worktree绝对路径或分支>
```

S1 只允许实现：

- 当前对象/来源复核的最小查询投影；
- 一个海运运营复核入口和唯一主动作；
- 复核结论可靠落账、版本/幂等/权限/审计/失败恢复；
- 现有演示对象 `MEDU7620177` 的兼容读取和待复核表达；
- 页面、服务端、测试和必要契约/迁移按五面同片交付。

S1 禁止：

- 实时船司接入、ETA 预测、全量换船/改港模型；
- 写 canonical `actualDepartureAt` 或推进生命周期；
- 统一下游 deadline；
- 把通用 handoff claim/close 冒充海运接收回执；
- 直接改写上游出运事实；
- 建设第二套决定卡、全量异常中心或无消费者权限平台；
- 修改不属于本片的工作台或清理既有未跟踪内容。

S1 停止条件：

- 发现当前复核记录承载会改变公共契约语义、跨租户边界或不可逆业务政策，立即停下并回报 `blocked`；
- 仅缺少下游 deadline、actual、母船身份或上游完整出运字段，不阻塞 S1，按 unknown/pending 保持；
- UI 实现前必须提供 brief 中三视口证据对应的真实截图和无横向溢出数据；
- 交回必须以 `HANDOFF docs/planning/tasks/ocean-operations-source-review-v1.md#S1-source-review-visible-slice ...` 开头，并列实际模型、文件、检查和未运行项。

## 方案

1. S1 先以一个真实对象完成“可见复核→可靠落账→刷新可见”的岗位结果，服务端先重授权，前端不推断 actual、权限或交接完成。
2. 现有 Shipment/Container/OceanRoute/TimeFact/TrackingEyes 作为来源读取和证据复用；新增承载只在当前消费者必要时采用，并保留版本/幂等/恢复。
3. 下游 deadline、交接接收回执和 actual 回流作为后续切片；本片显示缺口和下一步，不虚构完成。
4. S1 通过后再设计第二切片的海运影响判断与一个下游接收回执；整台工作台仍需后续五面验收。

## 主代理复审裁决（2026-10-26）

当前审核基线为 `ef3b7b3c05958e8640f5f012af90567e99ca6966` 加本工作区 S1 未提交实现。主代理实际读取实现，复现 API 11/11、Web 1/1 定向测试通过；`git diff --check` 通过。执行器报告的全仓 lint/build、迁移与集成结果尚未由主代理逐项复现，分别记录，不冒充主代理已验证。

### 既有 finding 的处置与纠偏

- 来源快照由服务端读取、空观察货柜过滤、provider 标记方向、Shipment 关联 ID 保存：当前实现已修复对应代码路径，不重复下发同一 finding。
- “截图船名与样本不同，因此运行库串票”：`rejected`。截图/组件夹具与 live 数据必须区分，仅凭截图值不能证明运行库关联错误。不要求把样本值硬编码进产品，也不以缺 live MEDU 样本阻塞独立代码修复。
- “匿名 Shipment 不可展示船名/航次”：`rejected`。内部 UUID 与唯一有效 typed link 才是身份基础；`shipmentNumber` 可空不是额外真实性或发布资格。已有可信关联事实按自身来源显示，缺失的展示编号显示待补，不得连带隐藏已有字段。
- “手机保存按钮必须无条件放最前”：`rejected`。主动作可见须同时有当前对象、所选来源和待核问题；不能为了按钮坐标倒置先看证据再作决定的业务顺序。
- “未全跑 validate/未 fresh 即本轮实现错误”：`rejected`。整任务最终质量门禁、fresh 复审和真实岗位验收仍必须完成，但不是每次修复增量的重复前置。迁移已执行不等于迁移并发/幂等集成已验证；只保留当前风险相关证据要求。
- provider 的 `review_required` 是待核信号，不当然是两来源事实冲突；UI 不得据此宣称已证实冲突，待核与冲突后续表达保持可区分。

### 已接受的当前修复项

| ID        | 失败场景与证据                                                                                                                                          | 当前必要性                                                        | 验收反证                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OCEAN-F01 | repository 的 `shipmentIdentity`、Web 的 `hasStableShipmentIdentity` 仅因 `shipmentNumber=null` 隐藏已关联船名/航次/单证/计划实际时间；样本允许编号待补 | 不得为当前海运步骤引入上游非必要字段门槛                          | 唯一有效海运 link、内部 ID 和已有船名航次，但 number 为空：保留字段与来源；多 link 歧义仍拒绝/标缺口；不改事实                            |
| OCEAN-F02 | `etaObservations` 只按 `timeKind=estimated` 过滤；预计离港/中转/卸船会进入 ETA 区                                                                       | 岗位必须区分哪种事件的预计时间，不把 ETD 或卸船时间误认目的港 ETA | 同时返回 estimated departed、transit_arrived、arrived、discharged：ETA 只呈现目的港预计抵港；其他以本来语义显示；不得按日期或字符串猜用途 |
| OCEAN-F03 | Web `select` 无请求序号/取消/对象一致性守卫，`submit` 完成后重新取可变 selected ID；快切 A/B 或 A 保存期间换 B，迟到响应可覆盖/重载当前对象并丢草稿     | 防止复核错对象和操作上下文污染                                    | 使用可控制 Promise，B 先返回/A 后返回仍保持 B；A 保存期间切 B 不回跳 A、不覆盖 B 草稿；失败保留原尝试，版本冲突提供重读入口               |
| OCEAN-F04 | 1024 和 390 截图把完整结论表单排在来源证据之前，手机仅有货柜与 ETA 摘要、不说明当前待核观察                                                             | 先了解依据再作判断是当前 UI 强制结构，不是装饰偏好                | 三视口按“对象/所选来源/待核问题→动作→回执”自然办理；可用紧凑上下文或操作条，不为首屏挤满全部表；业务主文案中文，技术码和 raw UTC 进详情   |

### 修复切片 S1-fix-context-and-semantics

- 不新增表、迁移、Schema、权限码、公共契约或新工作台；不扩大 S1。只修改本模块投影语义、当前 Web 页面/API 类型（必要时）和对应测试。
- F01 复用内部 UUID、有效单一海运 link 与字段来源；不把“无编号”当无资格，不默认展示无法关联来源的值。
- F02 从现有 `semanticKey`/事件目录明确识别目的港抵港，必要时在局部 DTO 明确字段语义；不把所有 estimated 都当 ETA，不造历史或新来源。
- F03 为读取/保存固定提交对象与 payload、增加晚响应隔离。恢复原尝试使用原键/原载荷；修改意图后允许新尝试，不能因重用旧键永久冲突。来源 superseded 不得让已提交成功结果的安全重试丢失；未提交的新操作仍检查来源当前版本。
- F04 修复响应式阅读顺序与交互上下文，保留原有页头/三栏壳和当前队列；不得为追求按钮首屏可见把证据移到结论之后。
- 无法启动端口、Docker 权限或缺 live 样本时如实记未运行，不停止/替换现有 5173 服务、不绕过安全限制。相关环境证据待可用环境补，不阻塞先完成上述代码/单测修复。

允许写入：`apps/api/src/modules/ocean-operations/**`、`apps/web/src/views/OceanOperationsWorkbench.vue`、`apps/web/src/views/OceanOperationsWorkbench.test.ts`、`apps/web/src/api/oceanOperations.ts`。不修改主代理 brief、权威、全局布局或其他模块。

验证命令：

```text
pnpm --filter @logix/api exec vitest run src/modules/ocean-operations/infrastructure/prisma-ocean-operations-source-review.repository.test.ts
pnpm --filter @logix/web exec vitest run src/views/OceanOperationsWorkbench.test.ts
pnpm --filter @logix/api typecheck
pnpm --filter @logix/web typecheck
pnpm exec eslint apps/api/src/modules/ocean-operations apps/web/src/views/OceanOperationsWorkbench.vue apps/web/src/views/OceanOperationsWorkbench.test.ts apps/web/src/api/oceanOperations.ts
pnpm repo:check
git diff --check
```

仅运行当前变更风险对应验证；不为本次投影/前端修复重跑迁移或整仓 validate。补可运行环境下三视口截图/溢出与保存刷新路径。真实数据库并发/幂等验证、最终完整门禁和 fresh 整体复审仍为整任务收口项，不在本切片冒充通过。

交回使用完整信封，`base` 必须为实际审核基线、`model` 未知写 unknown；列真实 changed/checks/exceptions。保留所有既有其他修改，不提交、不停用其他开发服务。

## 实际运行入口核对（2026-10-26）

负责人页面截图出现 `读取海运来源复核队列失败（500）`，同时页面误显示“暂无可复核货柜”。主代理在独立后台诊断标签页中，使用当前前端会话身份，只发 GET 请求，不提交业务写入，观察到：

- 入口：`http://127.0.0.1:5173/workspaces/ocean-operations`；
- 当前租户：`demo-real-sample-20260921`；
- `/api/ocean-operations/source-reviews` 当前返回 HTTP 200、`items: []`；
- `/api/containers?pageSize=100` 当前返回 HTTP 200、0 条记录；
- 当前 API 进程从 `D:/Logixs/apps/api/dist/main` 运行；本次未重启、未 seed、未执行迁移、未改变身份或租户；
- 原截图的 500 本次未复现，原因尚未取得后端日志证据，不得宣称已修复或归因为分支/迁移；
- API 返回空集合不等于数据库全库为空，也不等于资料不存在；需要核对运行数据库/schema/租户范围与现有演示数据的实际落点。

### 下一运行诊断切片 S1-runtime-diagnosis

这是运行状态调查，不是新增业务功能或第二套样本真实性审查。先停止使用 mock 截图证明当前入口业务可用：

1. 核对前端代理目标、API 实际 database/schema 配置与当前租户，仅回报非敏感定位信息，不输出连接密码或 Token。
2. 用只读数据库查询定位本租户和现有演示样本的货柜、Shipment/link、原始导入行和海运观察，检查 MEDU7620177 是否已在库及当前查询是否过度过滤；不扫描或泄露无关租户明细。
3. 若 500 重现，取得后端堆栈/稳定错误码，定位实际失败 SQL/模型/版本；没有日志就明确未复现，不猜测。
4. 输出最小接通方案：复用现有来源/对象引用，不在页面硬编码样本、不用 mock 替代 API、不删旧数据、不静默把来源日期提升 actual。不执行 seed、导入、迁移、环境配置变更或重启，待主代理审受影响范围及恢复方案后下发精确动作。
5. 前端错误与成功空集合需分开：读取失败只能显示失败与重试，不能同时断言“暂无可复核货柜”；修复由执行器按原 UI 范围完成，不以改错误文案掩盖 API 数据未接通。

交回必须包含准确 base/workspace/model、实际 GET 结果、只读数据定位结论、500 是否复现及最小接通路径；不把 `ready-for-review` 写成当前业务步骤已完成。

## 开发演示数据接通 S1-connect-dev-demo（2026-10-26）

负责人明确要求：当前是开发阶段，基于现有演示资料和业务需求，直接补齐并落库一条逻辑正确的海运演示事项，以支持工作台开发。取消前版 R1/R2 恢复工具、独立预检审批和分阶段执行要求；不再等待原 XLSX 或外部真实性证明。

### 唯一交付结果

打开 `http://127.0.0.1:5173/workspaces/ocean-operations`，可以看见 `MEDU7620177`，查看船名航次/ETA/来源，保存一次复核结论，刷新后仍可见。实际前端→API→当前开发数据库贯通，不用 mock 响应或截图夹具冒充。

### 数据与范围

- 已授权在本地 `logix.public`、租户 `demo-real-sample-20260921` 新增/幂等补齐这一条演示业务事项及其必要关联。不得操作生产、其他租户、删除旧数据或扩到20柜。
- 采用仓库现有 `post-departure-source-package-20260923.json` 的资料：MEDU7620177、26DSA01885、提单引用1811F026PE36668R2、MSC、MSC MAKALU III、HD638A、福州→萨凡纳、ETA 2026-11-01。
- 复用现有业务身份/关系和日期事实模型，用最小开发数据脚本落账即可，不为这一条记录建设通用恢复平台，也不强制先重建上游四文件导入过程。
- 需要补充的技术身份、关联、版本和必要演示值由执行器按正确规则补齐，并明确标为 `development_demo` 来源/命名空间；保留实际原资料引用，补充值不冒充原文件或船司事实。不补不存在的 XLSX、对象存储地址、TrackingEyes 回包或审批。
- 计划出运、实际出运、预计抵港分开；本切片沿用 S1 不写 canonical actual、不推进生命周期的边界。已有出运原文可用于复核观察，不为让页面运行而改成真实离港事件。非必要上游/下游字段留空，不因此暂停开发。
- ETA 用正式已有事件 `arrived + estimated + destination_arrival`（不得使用未注册的 eta 事件码）；来源和日期精度按既有规则正确保存。业务编号可空不影响已有船名航次展示。
- 保留上游待回写的来源/关联信息与财务来源引用；本次不建财务账本、不虚构收入利润或现金，不新增表、迁移、权限和公共契约。

### 实施边界

允许 `scripts/restore-ocean-review-sample.mts`（最小开发数据脚本）、`scripts/restore-ocean-review-sample.test.ts`、`apps/api/src/modules/ocean-operations/**`、`apps/api/src/infrastructure/integration/ocean-operations-retained-sample.integration.test.ts`、`apps/web/src/views/OceanOperationsWorkbench.vue` 及同名测试、`apps/web/src/api/oceanOperations.ts`。不再要求新增 integration-import 恢复服务或修改普通上传策略。必要的公共类型/其他路径变更先返回准确原因，不顺手扩范围。

执行器完成代码、定向验证后，**同一 TASK 直接在上述已获授权的本地开发目标执行一柜落账**，不再等下一轮审批。脚本限定环境/租户/业务键、支持重复运行不重复建柜/来源；遇已存在的冲突资料明确报告，不覆盖。记录实际命令、新增/复用数量和业务ID即可，不建设复杂备份恢复工程。不得重启不属于本任务的服务；若必须更新当前 API 编译产物或重启，先明确该最小运行操作，不能用假截图替代。

### 开发演示接通验收

1. 真实 GET 海运队列返回 MEDU7620177；详情显示现有 MSC/MSC MAKALU III/HD638A 和预计到港2026-11-01。
2. 页面查看来源→保存“待复核”结论→刷新仍能读取保存结果；操作人为实际开发身份，不预造人工复核结论。
3. 重复执行不重复产生业务身份/观察；不写 actual、不推进生命周期、不改其他租户记录。
4. API失败只显示失败/重试，不同时显示成功空态；补最近测试。
5. 运行受影响测试、typecheck、lint/格式与 repo:check；不重复无关全仓检查。重点交付实际页面地址、当前库落账结果和真实保存刷新证据。

HANDOFF 使用 `#S1-connect-dev-demo`，列实际执行命令、目标库/租户、数据结果、验证与未运行项。不再返回只有方案而运行库仍空的交付；遇真正权限/安全阻塞如实报告，不绕过。

## 当前唯一实施切片 S1-arrival-preparation-business-slice（2026-10-26）

### 交付单位与本轮业务问题

交付单位是海运运营工作台的一个到港准备步骤，不是独立的来源复核工具或数据恢复工具。

本轮问题：**这票货的当前目的港预计到港信息，能否作为清关岗位开始到港准备的依据？如仍待核，具体待什么、本次已经处理了什么、下一步供谁使用？**

选清关作为首个结果消费者，只使用已定的“海运向清关提供到港窗口”边界，不给清关代设截止时间、不替清关接受交接或完成申报。不扩到提柜/仓库执行，保留其未来接口。

### 开发演示验收口径（负责人确认）

开发演示数据只验是否符合真实业务规则，不验是否真实发生；本规则覆盖此前把演示离港也一律保持 unknown 的约束。为当前办理所需，可补一套标记为 development_demo 的计划离港、实际离港、航段/预计到港和必要金额场景值。检查事件类型、时间先后/时区/精度、对象主外键、数量金额/单位币种、职责和状态转换，不索取真实船司回包、原 XLSX 或外部实际证明。

演示 actual 可以作为演示运输已进入海运阶段的依据，但不能冒充生产实际或原资料已经证明的事实；走已有受控业务入口与状态规则，不关闭服务端安全检查、不替生产新增自动采信政策。演示金额是演示场景值，不是实际核费/销售/现金结果。开发种子与岗位随后在页面作出的真实测试操作记录要区分。

### 从当前演示事项完成一次办理

1. 在当前开发库落库 MEDU7620177 及必要关联，数据要求沿用“开发演示数据接通”中的限定授权；不用 mock 响应顶替，不另建恢复平台。
2. 工作台身份为“海运运营”，主要选择源是运输待办，不是全量日期事实。当前任务清楚说明“核对目的港 ETA，供清关到港准备使用”；该任务是 development_demo 业务场景，不编造已发生的延误/费用损失或审批。
3. 打开事项先看 MSC / MSC MAKALU III / HD638A、福州→萨凡纳、货柜/备货单/来源提单和 ETA 2026-11-01；计划出运、实际出运、当前采用的预计值分开，已有字段不因业务展示编号为空被隐藏。
4. 具体问题区说明目的港 ETA 的来源、所选版本和缺项。出运来源日期与母船日期只列为各自未明的观察，不因不同日期直接制造冲突、换船或延误。
5. 办理动作复用现有来源采用/待补/拒绝的领域语义；主按钮使用岗位语言“记录到港准备判断”。选择来源是依据处理，不等同最终放行或下游已接受。
6. 保存结果必须让岗位看到：本次结论与理由、所用 ETA/来源版本、尚存缺项、结果用途“供清关到港准备”、当前责任及下一步。可从同一对象恢复，不只显示“第几版已保存”。
7. 尚未有清关接受入口时显示“办理结论已记录；清关尚未接收/接收入口未接通”，不可伪造接收、通知或责任转移。清关 deadline 未取得时显示“及时性暂不能判断”，但海运当前判断照常保存。

### 数据流与最小承载

| 来源/所有者        | 本片使用或产生                                                              | 去向                             |
| ------------------ | --------------------------------------------------------------------------- | -------------------------------- |
| 出运/现有留存资料  | 运输身份、柜/单关系、船名航次、路线、离港原文；上游未开工时演示补全明确标识 | 海运读取，不覆盖上游事实         |
| 海运依据           | 目的港预计到港、来源/版本、当前缺项                                         | 本次到港准备判断的依据           |
| 海运本岗产生       | 本次判断、理由、采用/待补/拒绝的观察引用、操作者、版本及回执                | 清关到港准备可引用的海运办理结果 |
| 清关责任域         | 最晚行动时间、接受/拒绝回执                                                 | 当前空值保持未接通，不由海运伪造 |
| 费用/销售/库存来源 | 当前事项的财务来源引用及后续 actual                                         | 本台按需引用，不复制成影子总账   |

保留现有复核记录、服务端派生快照、租户隔离、追加版本和幂等，不另建一套办理/决定卡表。当前结果消费者固定为清关，可先由本岗结果读模型明确用途；不为尚无操作消费者的未来接收状态增加表/公共 Schema。若现有字段确实无法表达当前业务结果，执行器返回具体字段/关系缺口，主代理裁决，不静默新增平台。

### 双面财务投影与追溯必须可见

- 收入/贡献面：该 ETA 与到货可售/销售窗口的关系，当前无销售贡献事实则显示“待销售/库存结果回流”，不填收入金额。
- 成本/费用面：可读取样本3925美元海运费来源引用时，标为“来源金额、待核费”，不得当本次新增费用或已核定应付；不可读就显示未接入，不为凑展示重复记账。
- 现金、库存本金、费用和利润分开；当前无现金/库存 actual 就明确待回流，不做净额合计，不计算虚构节省。
- 页面保留一个“本次结果去向与验证”区域：上游资料/来源版本→本次判断版本→供清关使用（接收未接通）→实际到港/后续费用结果待回流。能定位当前对象和来源，不预建全局追溯平台。

### 任务/权限/技术/UI 同片

- 任务：一个运输事项，明确为什么现在办、当前问题、现有责任/等待项和下一步；无期限不制造逾期。
- 权限：沿用服务端已定 read/operate 与租户/对象校验；读事实和提交人的判断分开，不允许客户端伪造来源。
- 技术：不写 canonical actual、不推进生命周期；保存与重读真实服务端结果；切对象晚响应、重复提交、冲突/失败恢复不污染当前对象。
- UI：页头仍是海运运营；队列→运输概况→具体问题/依据→办理动作→结果用途/财务影响/追溯。来源原文和技术码进入详情，主要内容中文，不出现免责声明墙。
- 开发数据：同一 TASK 在已授权本地目标落账一柜，并用实际 5173→3000→数据库验证，不把数据落库推到以后。

### 准确执行范围与验收

允许修改：`apps/api/src/modules/ocean-operations/**`、`apps/web/src/api/oceanOperations.ts`、`apps/web/src/views/OceanOperationsWorkbench.vue`、`apps/web/src/views/OceanOperationsWorkbench.test.ts`、`apps/web/src/components/ocean-operations/**`、`scripts/restore-ocean-review-sample.mts`、`scripts/restore-ocean-review-sample.test.ts`、`apps/api/src/infrastructure/integration/ocean-operations-retained-sample.integration.test.ts`、`apps/web/.tmp/ocean-operations-s1/**`。本次不修改权威/brief、Schema/迁移、其他工作台、全局布局或公共契约。

以实际页面一次自然操作作为验收：

1. 打开页面看见一条运输待办，不是500或空库；识别船名航次、路线、目的港 ETA、当前要判断的问题。
2. 查看一项依据并作出一次判断；保存后看到“处理了什么、依据哪版、供谁使用、还缺什么”；刷新可恢复。
3. 看见相关收入/成本投影、未回流项和追溯引用；不能把金额来源当核定财务结果，也不能把未接通当已交接。
4. 上游普通空字段不阻塞独立办理，源日期不默认为actual；开发补充值明确标识且关系正确。
5. 定向覆盖保存/刷新、服务端来源派生、ETA事件语义、跨租户拒绝、切对象迟到响应、500与成功空态分轨。截图只作UI证据，另列实际API/数据库结果。

执行受影响 API/Web 测试、typecheck、触及源码 lint/格式、`repo:check`、`git diff --check`；数据脚本重复执行核对，三视口查看真实页面。无需重跑每一项全仓检查或重建全部上游链。实际落库授权沿用现有开发授权，不等待原文件或新一轮审批。

交回首行使用 `#S1-arrival-preparation-business-slice`，base 使用实际完整审核 SHA；完整 logix-handoff/v1 列实际模型、changed、checks、开发库落账结果、页面入口/保存刷新证据和未完成项。旧 TASK 未完成内容仅在本节范围内合并，不继续按旧 TASK 扩成来源复核平台。

## 当前活动切片：S1-arrival-preparation-business-slice（2026-10-26，替代旧来源复核中心口径）

### 下发给 Codex 的唯一业务指令

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S1-arrival-preparation-business-slice base=ef3b7b3c05958e8640f5f012af90567e99ca6966 role=implementer workspace=D:\\Logixs
```

### 这次交付的不是“来源复核页”

海运运营是统一 UI 的第一位真实消费者。本片必须让目标岗位围绕一票运输完成一个完整业务结果：

```text
运输待办
→ 运输概况
→ 当前具体问题
→ ETA 与来源依据
→ 记录到港准备判断
→ 结果用途与下一责任
→ 双面财务投影与 actual 待回流
```

来源复核是“ETA 依据处理”这一局部动作，必须服务于上面的业务结果，不得继续作为页面标题、首页唯一目的或首片完成语义。

### 必须同片交付的五面

#### 1. 岗位任务

海运运营人员打开 `MEDU7620177` 这票开发演示运输，必须能回答：

- 这票货当前处于什么运输状态；
- 为什么现在需要我处理；
- 当前要判断什么；
- 当前依据是否足够；
- 我记录的结果供谁使用；
- 还缺什么、谁补；
- 下一步由谁继续。

主动作必须使用岗位语言：

> **记录到港准备判断**

允许结果：

- 当前 ETA 可供清关开始准备；
- 当前 ETA 仍待补证；
- 当前 ETA 不作为清关准备依据。

这三个结果必须要求理由，并且保存为本次办理记录；不能只保存一个泛化“来源复核状态”。

#### 2. 数据事实

开发数据直接在当前开发库落一条逻辑完整的 `MEDU7620177` 事项，标记 `development_demo`，并使实际页面 API 可读：

- Container、Shipment、有效海运 link；
- MSC、MSC MAKALU III、HD638A、福州→萨凡纳；
- 备货单 `26DSA01885`、来源提单 `1811F026PE36668R2`；
- 目的港 ETA `2026-11-01`，`arrived + estimated + destination_arrival`；
- 计划/演示实际出运分开；演示 actual 可按负责人开发口径补齐，但不得伪称原始文件事实；
- 来源版本、原始资料引用、开发演示分类；
- 清关 deadline 保持未知，清关接收保持未接通；
- 海运费 `3925 USD` 只作为来源金额/待核费投影，不能显示成已核定费用；
- 收入/贡献、现金、库存 actual 保持待回流，不补虚构净额。

必须支持重复执行不重复建身份、link、ETA 或费用引用；不改其他租户、不删除已有数据。

#### 3. 技术保障

复用已有来源复核、租户、幂等、版本和错误处理能力，但技术必须服务于本次岗位结果：

- 服务端从来源观察派生快照，客户端只提交本次判断和理由；
- 保存“记录到港准备判断”后，刷新页面仍可见；
- 切换运输对象时迟到响应不能污染当前对象；
- HTTP 失败显示失败/重试，不能显示成功空态；
- 版本冲突保留原尝试并给重读恢复；
- 不写 canonical `actualDepartureAt`，不推进生命周期，不伪造清关接收。

不要为了复用现有复核表而把业务主动作继续命名为“保存复核结论”。可以扩展现有记录的业务字段，或在当前模块内做最小结果投影；不要新增通用平台、公共权限矩阵或第二套决定卡。

#### 4. 权限边界

- 读取和保存均由服务端从当前开发身份注入租户、操作者和对象范围；
- 不信任客户端来源字段、租户、操作者或 shipment/container 关联；
- 只复用当前已定的 `lifecycle.read` / `lifecycle.operate` 和当前对象范围；
- 不新增未来角色和全局权限平台；
- “记录海运判断”不等于拥有清关、提柜或仓库写权限。

#### 5. 统一 UI 第一片

页面必须复用已合入的统一工作台壳（现已有市场等真实消费者），结构按岗位办理而不是字段表。下列箭头是办理顺序，不代表把动作纵向堆叠在详情后方；具体三栏与响应式映射以 frontmatter 和当前修复切片为准：

```text
岗位页头/运输上下文
→ 运输待办
→ 当前运输概况
→ 当前具体问题与依据
→ 记录到港准备判断
→ 结果用途/责任/恢复
→ 双面财务投影/actual 待回流
```

统一承接的第一批结构只包括当前真实消费者需要的：

- 页面头和岗位上下文；
- 运输待办队列；
- 对象概况；
- 事实/来源/缺口区；
- 单一主动作；
- 结果回执和下一步；
- 错误、空态、待补、版本冲突和恢复。

禁止：

- 把来源复核表单当首屏唯一内容；
- 先显示结论表单、后显示依据；
- 把技术状态码当岗位文案；
- 把页面保存/通知发送/清关未接通显示成完成；
- 做通用字段卡墙或全仓 UI 迁移。

### 实际页面验收

使用当前运行入口，不使用 mock 截图代替：

1. `http://127.0.0.1:5173/workspaces/ocean-operations` 能看到 `MEDU7620177`；
2. 能看见当前运输概况和目的港 ETA；
3. 能看见“当前 ETA 能否供清关开始准备”的问题；
4. 能看见来源依据、缺失 deadline 和待接收状态；
5. 通过“记录到港准备判断”保存一次；
6. 刷新/重新加载后能看到本次判断、理由、结果用途“供清关使用”和下一步；
7. 财务投影明确“海运费来源金额/待核费”、销售/库存/现金 actual 待回流；
8. API 失败不显示空列表，跨租户和对象越权被拒绝；
9. 390×844、1024×768、1440×900 遵守 frontmatter 的标准三栏/抽屉/分屏规则，保留同一业务办理顺序，无横向溢出；真实截图逐张人工核对，不能以文案或组件存在替代。

### 复审边界

主代理只按以上业务结果审实际 diff，不再把“来源复核表是否像一个独立产品”作为验收目标。旧 finding 只有在影响本次运输办理、数据逻辑、权限、落账、恢复或 UI 业务顺序时才修；非阻塞的历史技术优化另建任务，不拖住本片。

| 日期       | 阶段       | 负责        | commit | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ---------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-25 | fix/review | Codex       | —      | v3 fix review: unique active ocean Shipment identity; exclude customs/unloading facts; unresolved dates keep normalized time unknown; mobile primary action visible; full lint/build and migration status recorded; integration/E2E/independent review remain pending                                                                                                                                                                                                                                                                                                               |
| 2026-10-25 | fix/review | Codex       | —      | v4 finding repair: ocean queue now uses explicit event whitelist; declared MEDU7620177 evidence uses MSC MAKALU III / HD638A with Shipment identity pending when unlinked; 1024px action moved above object; unresolved-date regression added; three viewport evidence regenerated                                                                                                                                                                                                                                                                                                  |
| 2026-10-25 | fix/review | Codex       | —      | v4 verification: focused API 9/9 and web 1/1 passed; live `db:migrate` reported no pending migrations; `repo:check`, full lint and full build passed; integration 281/287 passed with 4 pre-existing product-initiative validation failures and 2 Docker named-pipe permission failures; E2E blocked by existing port 5173 server; fresh independent review remains required                                                                                                                                                                                                        |
| 2026-10-25 | fix/review | Codex       | —      | v5 修复新 findings：匿名 Shipment 仅保留关联 ID，服务端不再投影未确认的船名/航次/承运人/计划出运；节点与事件码双重海运白名单，拒绝海运节点下的清关/卸柜事件；截图夹具移除伪造的 `MSC MAKALU III`、`HD638A` 和 `2026-09-23` 计划时间。聚焦 API 11/11、Web 1/1、API/Web typecheck、API/Web lint、全仓 lint、build、repo:check、live migration 与 migration status 通过；三视口截图及 overflow JSON 已更新。集成 281/287 通过，4 个既有 product-initiative 失败、2 个 Docker named-pipe 权限失败；项目 E2E 仍因 5173 已被非本测试 Logix 开发服务器占用而未运行；fresh 独立复审仍待执行 |
| 2026-10-25 | design     | Claude Code | —      | 基于负责人确认的裁决/交接语义和下游 deadline 责任，建立海运运营首片唯一 brief；未写实现                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-25 | design     | Claude Code | —      | 完成物理承载/样本/服务核对；收敛 S1 为来源复核可见办理，不把来源日期写成 canonical actual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 主代理业务结果复审（2026-10-26）

当前 HANDOFF 的页面动线已回到运输待办/概况/具体问题/依据/到港准备判断，但实际业务落账仍有两项阻塞：

- **OCEAN-B01：业务结果仍漂移为来源复核。** 当前开发库最新记录仍是 `review_decision=adopt_observation_for_review`，页面虽显示“记录到港准备判断”，数据库实际只知道来源复核枚举，无法区分“来源被采用作依据”和“当前 ETA 可供清关开始准备/仍待补证/不作为依据”。修复必须让本次岗位判断结果、理由、依据版本、结果用途和下一责任可被重读；历史来源复核不能静默冒充本次办理结果。
- **OCEAN-B02：开发演示未补实际出运事实。** 当前 Shipment `atdAt` 为空、状态为 `in_transit`；负责人已确认开发演示可以补符合规则的演示 actual。修复需在 `development_demo` 命名空间补齐演示 actual，并保留计划/实际分开、来源和演示标记；不得冒充生产事实或推进未授权生命周期。

本切片暂不接受完成。原始文件是否存在、船司回包、真实生产发生证明、提柜/仓库接收和第二台工作台不再阻塞。下一 TASK 只修 B01/B02，不继续扩大来源复核平台或 UI 范围。

### 下一修复切片：S1-fix-arrival-result-and-demo-actual

允许修改当前海运模块、页面、定向测试和开发演示脚本；不得改其他工作台、业务权威、公共契约或新增通用平台。必须完成：

1. 业务结果落账能区分三种到港准备判断，保留理由、依据版本、结果用途 `customs_arrival_preparation`、下一步和追加版本；旧 review 记录只作历史依据。
2. 真实页面保存“记录到港准备判断”后，刷新仍读回本次业务结果；来源观察处理与业务结果不是同一枚举冒充。
3. 演示脚本在开发租户为该运输补一条规则正确、明确 `development_demo` 的实际出运事实；计划出运、演示实际出运、ETA estimated 分开；不写生产 actual，不推进生产生命周期。
4. 页面显示“演示实际出运”或同等清晰标识，避免把开发场景值当原始/生产 actual。
5. 运行 API/Web/脚本定向测试、typecheck、lint、repo:check、git diff check，并通过实际 5173→3000→数据库→刷新路径验收。

交回首行：

```text
HANDOFF docs/planning/tasks/ocean-operations-source-review-v1.md#S1-fix-arrival-result-and-demo-actual base=<实际审核基线SHA> role=main workspace=D:\\Logixs commit=<sha|none>
```

### 当前修复：S1-fix-unified-three-pane（2026-10-28）

负责人依据实际截图指出未正确应用统一三栏，并明确本次不交 Codex、由 Claude 直接实施。本次局部覆盖人工转发实施方式，writer 登记为 `claude`；不改变其他任务的执行分工，不扩仓库治理。基线 `ef3b7b3c05958e8640f5f012af90567e99ca6966`，原工作区 `D:\Logixs` / `docs/business-first-workbench-delivery`，保留所有已有改动。

- **OCEAN-UI01 accepted**：当前页面自建两列网格和纵向 `.case-flow`，未接入 main 已有 `WorkbenchLayout`；截图中的站点导航不是工作台三栏之一。历史“保留三栏壳”不是本轮已完成证据。前文线性办理顺序缺少栏位归属，本次已补正 frontmatter 及当前 UI 验收，不改历史记录。
- 范围仅本 brief、`apps/web/src/views/OceanOperationsWorkbench.vue`、同名测试及既有截图目录；复用 `WorkbenchLayout` standard、`WorkbenchPane`、`WorkbenchPageHeader`、`WorkbenchResponsibilityBand`、`WorkbenchDecisionStrip`，不改共享组件、路由、API、Schema/迁移、样本脚本和其他工作台。
- 左队列是唯一对象选择源；中栏呈现概况、问题、来源依据与缺口；右栏承接判断、理由、下一步、唯一实际提交、回执与失败/冲突恢复。保留当前保存/重读、草稿、幂等和迟到响应隔离。
- 测试先补三栏归属、壳稳定、折叠恢复、手机分屏返回保留草稿，观察旧实现失败再修；保留原业务回归。定向运行 Web 页面与布局测试、Web typecheck、修改路径 lint/format、repo:check、diff check。
- 实际页面三视口截图/溢出数据与逐张视觉审查为本修复验收，不能以文案存在或测试全绿替代；B01/B02 与整任务独立复审/最终门禁仍按原约定，不因本结构修复自动关闭。
- 本节建立时：实现和验证尚未执行；后续结果在本节增量登记，不建第二份 ledger 或 handoff 文件。

#### 本轮实施与验证（2026-10-28）

- Claude 直接实现：接入 `WorkbenchLayout` 默认 standard 和三个 `WorkbenchPane`；页头消费正式岗位目的投影，增加现有事实责任带与判断摘要。中栏保留事实/依据/缺口，财务追溯渐进披露；右栏承接原判断表单、回执、错误和冲突恢复。移除自建两列网格、手机隐藏其他队列项与固定锚点动作。
- RED：旧实现 8 项中 4 失败（缺三栏、折叠/分屏入口，以及原有版本显示断言）；随后修复。GREEN：页面 8/8 + 原共享布局 18/18，共 26/26；Web 全部单测 177 文件、988/988；Web typecheck、修改路径 ESLint/Prettier、Web build、repo:check、git diff --check 通过。最初测试中 `.get().exists()` 类型错误及格式警告已修复并复跑通过。
- 实际访问当前 `5173` 页面（无 API mock）：1440×900 三栏并列满高；1024×768 左抽屉、中右并列；390×844 显式分屏，草稿往返保留。桌面双侧折叠恢复与中右独立滚动已操作，页面滚动为 0；三个视口无文档横向溢出。截图由主代理逐张查看，确认栏位归属、依据/动作上下文与恢复入口。
- 证据：`apps/web/.tmp/ocean-operations-s1/three-pane-{1440x900,1024x768,390x844}.png`、`three-pane-1440-action.png`、`three-pane-1024-drawer.png`、`three-pane-390-{navigation,detail,context}.png`，以及 `three-pane-viewports.json`、`three-pane-interactions.json`、`three-pane-web-suite.log`。手机非活动 pane 采用共享壳的离屏保留机制，其内部测量不作为可见区域横溢证据。
- **OCEAN-UI-R01 accepted / fixed**：本次 fresh 局部复审发现手机队列选择对象后，仅成功才切详情，读取失败的提示和重读入口会留在非活动屏。新增回归先 RED（detail 未激活），随后把显式选择的切屏提前到读取开始；真实断网验收再发现“保留旧详情”分支也缺提示，补第二个 RED 后在详情顶部提供失败和直接重读。最终手机断网→提示→联网重读真实 API 已通过，队列仍可返回。不修改 API 或共享布局。此复审只覆盖本次 UI 修复，不替代整海运任务收口复审。
- 最终增量验证：页面 10/10、共享布局 18/18；Web 完整 177 文件 990/990，typecheck、修改路径 ESLint、repo:check、diff check 与最终 Web build 均通过；错误恢复截图为 `three-pane-390-retry.png`。所有业务写入仍为未执行。
- 边界：本轮浏览器只读与未提交草稿，不提交新业务判断；未执行迁移、种子或演示脚本。当前运行 API 仍返回“未记录到港准备判断/无演示实际出运”，因此 B01/B02 的真实页面→API→数据库→刷新验收仍未完成，不能以布局通过冒充已落账。未运行整仓 validate、项目全量 E2E、整海运任务收口复审，未提交或推送；现有其他工作区修改保持原样。

### 当前调整：S1-overview-reference-layout（2026-10-28）

负责人提供运输概况参考图，要求仅中栏概况按图布局；继承本次 Claude 直接实施授权。保留三栏与中右职责，不改业务表单、API/迁移或样本。上方左右时间对、中央港口航线及货物状态、下方单证身份与船舶信息；沿用主题令牌/字体，蓝色航线复用 info 令牌，真实内容不照抄参考图日期。

- ETD 读取已有计划出运，ETA 读取当前目的港 estimated 观察；ATD 只读真实实际出运，开发演示单独标注；ATA 当前接口未接通，显示待回流，不从 ETA 或货柜状态猜实际到港日期。时间戳按用户本地日期展示，date-only 不做时区换日，原始值可追溯。
- 货物状态只翻译服务端 container.status，复用 `liveWorkspaceProjection.ts` 现有状态标签权威，最小导出展示函数；原消费者行为不变。不新增状态机/状态字典，不以演示实际日期推断已离港。
- 写域为本 brief、海运页面/同名测试及上述标签函数所在文件（仅复用出口）；截图证据沿用原目录。先补缺 actual/演示/未知状态与参考区域内容测试并观察 RED，再实现并验三视口真实页面，不扩整仓 UI。
- 已实现并验证：新增 2 项回归在旧布局 RED，页面 12/12 + 原状态投影 8/8 GREEN；Web 全部 177 文件 992/992 通过。Web typecheck、修改路径 lint/format、repo:check、Web build 和 diff check 通过；初次测试字面量类型错误与裸字号门禁已修正复跑。
- 当前真实页面（无 mock）截图 `overview-1440x900.png`、`overview-1024x768.png`、`overview-390x844.png` 已逐张查看，`overview-viewports.json` 记录页面/概况均无横向溢出；概况在原中栏内呈现参考图时间/航线/身份/船舶层级，三栏不变。仅布局和展示，未写业务数据、未提交 Git；B01/B02 及整台验收仍不自动关闭。

### 当前前置：S1-reference-case（2026-10-28）

负责人确认围绕同一票 MEDU7620177 逐台实施；选择“补设演示场景”，授权 Claude 在本地隔离演示范围补缺货物行/装箱/出运初始结果。模拟性质记录在来源/证据元数据，不另建演示 ATD 业务字段。不删旧数据、不改生产 authority、不预填海运/清关/后续成功，不重开上游整台实施。

- 唯一身份：tenant `demo-real-sample-20260921`，Container `e6a45d96-46e3-43c9-8fa3-3794b36c1d96`，Shipment `71000000-0000-4000-8000-000000000003`，备货单 `26DSA01885`。已有身份保留，图冲突停止。
- 版本化场景：`database/seeds/fixtures/ocean-reference-case-v1.json`。原值保留911箱/12364 KGM/66.26 MTQ；合成两行 `DEMO-OCEAN-001:600 piece`、`DEMO-OCEAN-002:311 piece`，一件一箱是明确模拟假设，不是原资料推断。封条 `DEMO-MEDU7620177-01`、Booking `DEMO-BOOK-HD638A-001`、VGM 16364 KGM/method_1（合成皮重4000）、ATD `2026-09-23T10:00:00+08:00`，装箱/VGM模拟发生时间早于该ATD。原date-only和母船日期保留独立观察，不升级为该精确事实。
- 五面：岗位消费同一出运基线；数据保存正式领域表和精确引用；技术按阶段幂等/版本/事务恢复；权限固定本地目标与单案例写集合；UI仅去除日期值分叉、保留来源提示和三栏。下游review/arrival/pending原样保留。
- 顺序：只读audit → 场景预检 → 明确apply → 正式行/SKU绑定/allocation/装箱快照/出运快照/精确单证关系 → ATD及provenance同事务 → 正式消费者重读。使用不replay的snapshot服务并核验证据主体，防间接推进未知业务。
- Ruling：沿原brief串行实施，不另建ledger/spec；当前前置不等于完整上游工作台验收。使用脚本层专用协调器复用领域用例，不在海运生产服务中嵌入通用seed平台。
- 验收：audit零写入、目标/对象拒绝、同键异内容冲突、阶段中断恢复、ATD+来源原子、两次apply零增量、目标外/pending/海运下游零变化，以及真实API/页面同票一致；最终统一fresh复审。

#### 基准初始化实施记录（2026-10-28）

- 只读事务确认：原Order/Container/Shipment存在，产品行、allocation、stuffing/dispatch和本柜Evidence为空；保留身份，未清库或跑旧seed。
- 新增小型版本fixture和专用脚本协调器，默认audit只读；明确本地目标、固定case、确认版本和审计hash才apply。正式SKU注册/绑定、行投影、allocation和snapshot用例复用；不调用AndReplay，不改生产authority。
- 写前复审 R1～R4 accepted：将snapshot内容冲突提前至audit，核验实际字段和引用（不能只信存储hash），校验cargo→行/SKU关系，固定provenance作用域/活动状态；对应反证RED→GREEN。尚无任何写入时完成这些修正。
- 第一次apply在readiness查询失败前保存了两行/配载/装箱/出运v1，ATD仍空。根因是既有dispatch `findCurrent` 把readiness的evidenceRefs展开为Prisma过滤；新增回归RED后改为显式tenant/container过滤。协调器审计还误把command-only contractVersion当物理列，新增恢复回归后排除。续跑保留相同snapshot ID/v1，无补偿删除。
- 当前正式基准：600 piece＋311 piece，两条ShipmentCargoLine和备货行/绑定；allocation/stuffing/dispatch均v1；911箱、12364KGM、66.26MTQ、合成VGM16364KGM；精确柜—HBL关系；Shipment编号DEMO-OCEAN-MEDU7620177；正式ATD=2026-09-23T02:00:00Z，同事务追加合成provenance。旧来源观察未提升或改写。
- 真实apply和再次apply成功：完整auditHash相同、preservedHash相同，未新增行/版本/identity/来源；原海运review v6、arrival为空、现有生命周期时间事实未变。证据在既有临时目录reference-audit/自适应恢复/原apply/reapply JSON，非第二套需求。
- 海运真实5173→3000已返回正式actualDepartureAt与同一事实source；去除demonstrationActualDepartureAt日期分叉。正式身份客户端读取cargo/stuffing/dispatch全部成功，并返回同柜、同allocation/stuffing版本。直接裸fetch因无认证401，改用原requestJson身份注入后通过，未绕过授权。
- API全单测332文件1844项、Web177文件992项通过，API/Web typecheck和build通过；脚本定向最终15项，相关正式领域23项通过。脚本不在默认lint/tsconfig范围，额外显式tsc已通过，ESLint原配置忽略该类文件已如实记录，不冒称lint覆盖。根目录一次混合API/Web ESLint因tsconfigRootDir歧义失败，改用各模块原入口后全部通过，未修改工具配置。
- 定向真实数据库海运integration通过。首次错误命令携带`--`误启动全integration，期间出现既有product-initiative-flow四失败；另一次exec入口缺npm_execpath失败，均保留输出。有效定向命令为`pnpm --filter @logix/api run test:integration src/infrastructure/integration/ocean-operations-retained-sample.integration.test.ts`。
- 定向integration还暴露旧restore创建非法factCode=departure，不符合现有迁移约束；本轮已取消创建该独立actual分支，仅保留历史观察，不修改迁移或放宽约束，之后定向integration通过。
- 尚未声明整海运工作台闭环、生产生命周期已采信或下游完成；完整validate、外部生产部署和本任务Git集成尚未执行。
- 消费者验收证据：`reference-formal-api-readback.json`、`reference-live-{1440,1024,390}.png`；逐张确认原三栏/分屏不变、正式ATD与来源提示可见，无横向溢出。最终只读audit仍ready且hash与二次apply完全相同。并行只读audit的pg驱动deprecated提示不影响结果，本次未顺手重构。
- 最终fresh只读复审：`logix-review/v1` / `S1-reference-case` / `NO_BLOCKING_FINDINGS`，findings=[]，writes=none；范围仅本票基准与消费者，不替代整海运发布/业务闭环验收。已确认正式ATD+来源、精确引用、阶段恢复和不预填下游，无新增阻塞。当前基准可作为后续逐台实施起点，原brief继续fix，未提交Git。
- 恢复命令先 audit：`pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/restore-ocean-review-sample.mts`；确认无冲突后使用该次auditHash：同命令追加 `--apply --confirm=ocean-reference-case-v1 --audit-hash=<本次hash>`。这是单票初始化，不是生产导入或全库seed。已成功执行，不应为续线重复造样本。

### 局部展示调整：提单身份归位（2026-10-29）

负责人明确要求直接由 Claude 修改，不交 Codex。本次仅调整海运页面、同名测试与本 brief：中栏身份区按货柜号→备货单→提单号（HBL）展示，窄屏沿此顺序换行；移除船名下方重复的提单号码，保留 ATD 来源提示。复用当前 houseBillNumber，不改 API、业务数据、保存逻辑、共享布局或其他工作台。继承既有三视口结构约束，定向回归先 RED 再 GREEN，运行 Web typecheck、路径 lint/format 与 repo:check；真实页面证据单独记录，不把单测当作视觉验收。

### 负责人纠偏：去除开发演示的重复提示（2026-10-29）

负责人明确开发过程中不反复提示演示性质，避免无业务价值的展示与代码。本决定覆盖此前要求概况常驻演示 ATD 说明的展示口径：删除 ATD 演示来源提示、空容器及专属样式，正式 ATD 和来源元数据不变；不新增演示徽标、替代免责声明或新的日期字段。沿用 Claude 直接修改授权，仅修改页面、原测试与本 brief。

### 当前标准化：关注项目与三段职责（2026-10-29）

- 负责人要求先理清“关注项目→对应事实→判断标准→触发动作”，不得为了展示制造问题；外部 API 当前未开通，未来由独立集成写入对应数据承载，海运工作台只读库内信息，不驱动外部取数。三段职责必须形成标准，防止后续漂移。
- 单一权威落点：岗位关注矩阵及待办成立条件写在 `doc/cross-border-supply-chain/08-role-workbenches.md` 海运章节；接入/业务处理/工作台职责写在 `doc/cross-border-supply-chain/12-external-data-integration.md` §2.1。本 brief 仅记录当前映射，不复制规则表、不新增另一份 spec/ledger。
- 基线处置：`沿用`可信事实→必要处置→可行动交接的单一结果链及三类优先损失；`补强`三段读写/命令边界；`修正`旧任务固定生成 ETA 题目、把未到港无 ATA 和系统未接通当运输缺口的表达。无负责人新定数值阈值，不设置默认窗口或自动采信资格。
- 当前物理映射：`Shipment`/有效 `ShipmentContainerLink`/单证关系承载运输身份，`OceanRoutePlan`承载航程版本；`OceanProviderEventIngestion`承载来源接入，`ShipmentTimeFact`/`LifecycleDateFact`承载相应时间事实，`CanonicalEvent`/`ShipmentEventApplication`等承载规范事件及应用结果；`OceanOperationsSourceReview`与`OceanOperationsArrivalPreparationResult`承载现有本岗记录，不是清关接收回执。各记录须按自身资格使用，不能混读为已采信当前事实；不因本次梳理新增表。
- 实现差距：海运 repository 仍固定返回问题和部分缺项；读取的当前观测不等于完整 ETA 历史，也没有完整下游准备/接收消费者。TrackingEyes 内部链仍止于待复核，现有人工日期复核入口不能冒充供应商候选采信。上述是事实差距，不在本轮扩建 API 或接收平台。
- 五面映射：岗位只办有事实触发的核对/处置/交接；数据引用当前事实和当时版本；技术由业务层裁决/受控 apply、读操作无取数副作用；权限保持本岗命令与服务端租户/对象边界，不授予下游确认权；UI保留统一壳但不强制每票出题。本轮仅标准化，无产品实现或新验收通过声明。
- 后续最小切片先把本票已有进展、是否存在触发及可办动作核实，再按矩阵修正查询/页面；正常事实不生成异常，缺下游期限不反推 ETA 无效。明确不做连接器、供应商凭据/轮询/Webhook、通用平台或全台功能扩写；本轮不提交业务判断、不重跑样本。
- 标准验收反证：打开/刷新/切对象不得触发供应商请求或状态推进；ETA 更新不推进 actual 节点；同语义事实变化才比较；到港前无 ATA 不生成异常；缺 deadline 只限制及时性判断；无接收回执不显示责任转移。以上为后续实现验收要求，本轮未执行对应运行验证。

### S2 当前实现记录（Claude 直接实施，2026-10-30）

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S2-internal-reference-baseline-v1 base=ef3b7b3c05958e8640f5f012af90567e99ca6966 role=implementer workspace=<Codex独占worktree绝对路径或分支>
```

目标：只把项目内部 canonical 基准落成可回读数据，不建设完整外部治理平台；飞驼仍是下一切片的映射来源。

允许范围：`database/schema.prisma`、追加 `database/migrations/**`、`apps/api/src/modules/master-data/**`、`database/seeds/**` 中新的内部基准 fixture/seed、对应测试、必要的 `packages/contracts/schemas/v1/**` 和 scripts 中精确的基准验证。不得接外部 API，不写外部 provider client/凭据，不改 `apps/web/**`、lifecycle-control、ocean-port-visibility、Shipment/Container业务字段、现有状态机、CanonicalEvent catalog 语义或五类关注实现；不得把飞驼49/17/12直接写入内部 canonical，不接 `db:seed` 全库流程。

必须交付：

1. 内部柜型基准表/模型：一个组合 `containerTypeCode` canonical code，保留受控属性 `length` 与 `type`；落首版实际需要且已有依据的组合值（不得因飞驼表全量而扩张），`40HQ/20DV` 不进入 canonical，只留下一切片映射入口；未知明确失败，不回退。
2. 内部承运人基准：只收录当前项目业务已确认使用的内部 code（至少 `MSC`、`HMM`）及项目确认名称/状态；不把 SCAC、飞驼 API 参数或49行自动创建成内部主体。
3. 地点基准：复用现有 active `port_code_reference`/UNLOCODE（至少回读 `CNFOC`、`USSAV`）；不复制飞驼港区，不改已有地点权威 release。
4. 事件/时间只引用现有 canonical catalog 与 `planned/estimated/actual`，不新增状态机、事件码或生命周期节点。
5. 为内部基准提供版本/来源/行hash/幂等的最小 fixture/seed 与只读回读验证；可复用 `ReferenceDataRelease`，但不实现完整 SourceArtifact/Diff/Approval/ConsumerBinding 平台。本切片输出的是项目拥有的基准数据，不是外部映射发布。

测试先行：先写 RED 再 GREEN，覆盖 canonical 组合码/属性唯一性、未知柜型拒绝、MSC/HMM 复用与重复幂等、飞驼字段不能直接写 canonical、地点 active-only 回读、状态机/事件目录不变、重复 seed 零增量、历史 Shipment/Container 不改。运行定向 API/数据库测试、Prisma generate/validate、空库/旧库/重复 seed 验证、typecheck/lint/format、repo:check、git diff --check。不要运行 destructive reset；不做真实 API 联调。

交回首行：

```text
HANDOFF docs/planning/tasks/ocean-operations-source-review-v1.md#S2-internal-reference-baseline-v1 base=<实际审核基线SHA> role=main workspace=<Codex工作区> commit=<sha|none>
```

必须列实际模型、changed、checks、数据库是否仅开发目标落账、exceptions、未运行项；不得声称外部映射或飞驼生产接通。

本切片不再交付完整外部参考数据治理平台，也不把飞驼49/17/12直接写成内部标准。先交付项目拥有的内部 canonical 基准：

- 柜型使用一个内部组合 `containerTypeCode`，字典属性记录 `length` 与 `type`；首版只固定项目需要且资料明确的组合值，`40HQ/20DV` 等外部/历史写法留待映射，不改现有业务字段、不拆成两个业务字段、未知不静默回退。
- 承运人只收录当前项目业务已确认使用的内部代码（至少 `MSC`、`HMM`）及项目确认名称；飞驼船司行不自动创建内部主体。
- 地点复用现有 active UN/LOCODE canonical（当前样本 `CNFOC`、`USSAV`）；不复制飞驼港区为内部地点。
- 事件/时间复用现有 canonical event catalog 与 `planned/estimated/actual`，不新增状态机、事件码或生命周期节点。

首片允许写入收窄为内部标准 reference 表/fixture/幂等 seed、对应迁移/测试和必要的 active release 记录；不接外部 API、不建完整 SourceArtifact/Provider/Channel/Capability 平台、不把飞驼数据直接 publish 为内部 canonical、不改 Shipment/Container 业务字段或现有状态机。外部 provider code、SCAC、API 参数、外部柜型别名和港区别名作为下一切片的版本化 mapping 输入，不能覆盖内部基准。

验收：基准可回读、重复 seed 零增量、未知值明确失败、历史业务字段不改写、状态机/事件契约不变、工作台无外部 HTTP。

```text
TASK docs/planning/tasks/ocean-operations-source-review-v1.md#S2-reference-data-governance-foundation base=ef3b7b3c05958e8640f5f012af90567e99ca6966 role=implementer workspace=<Codex独占worktree绝对路径或分支>
```

目标：在不接真实飞驼 API、不中断现有海运/其他未提交改动的前提下，交付长期参考数据治理基础链的第一切片，而不是一次性飞驼 seed。

允许写入：本 brief 已列 `database/schema.prisma`、新增迁移、`apps/api/src/modules/master-data/**`、`packages/contracts/schemas/v1/**`、`database/seeds/fixtures/freightower-container-reference-v1.json`（机制化输入/元数据修正）、`scripts/reference-data/**` 及对应测试；若需修改 `scripts/freightower-reference-data.test.ts` 仅为迁移到受控门禁并修复其 scope 矛盾。不得写 `apps/web/**`、外部 provider client/凭据、lifecycle-control、ocean-port-visibility、Shipment/Container业务字段、现有五类关注实现、`db:seed` 全库接线或直接发布飞驼 active。

必须交付：

1. 通用 source artifact/dataset/release/value/external mapping candidate/release diff/review approval/consumer binding/deprecation/citation 的最小 append-only 模型，扩展现有 ReferenceDataRelease 而不复制发布平台；所有状态、唯一键、hash、FK、历史和职责分离约束由迁移/应用校验承接。
2. collect（API未开时仅文件/fixture）、validate、diff、review/approval、publish、rollback、consumer-check 的 application Port/CLI；默认 dry-run/audit，发布需独立复核+发布人，发布者不能批准自己；消费者显式绑定 release，不自动跟随 active。不得由 seed 直接 active。
3. 现有 ISO/UNLOCODE 先保留兼容读取，至少提供初始 release/consumer binding 的兼容迁移/检查方案，不静默重写历史；飞驼首包只拆 carrier/port/container-type candidate，保存49/17/12实际scope、license unknown、row lineage和collision/diff，不自动 canonical。
4. 将 schema/fixtures/场景加入现有 contracts manifest/check；生成类型/派生产物遵守单一权威源，不手改生成物。临时 Freightower 测试必须纳入可靠 package/CI 门禁，不得保留一个永远先因固定49而失败的伪门禁。

长期规则：飞驼仅供应商候选；SCAC/API参数/能力/内部身份分开；AUTO/暂不支持不成为代码；未知/歧义/冲突进 review；mapping 与 authority policy 分离；旧 release/历史事实不可变；工作台不直连外部 API。

测试先行与验证：先写并运行 RED 测试，覆盖 artifact schema/hash、49/17/12 scope、碰撞、license unknown、重复同hash/异hash、diff增删改未知、review职责分离、并发单active、publish rollback、consumer blocking、历史不可变、未授权网络零调用；再实现 GREEN。运行新增定向测试、Prisma generate/validate、空库与旧库迁移、真实数据库重复/回滚集成、API typecheck/lint/format、contracts/repo:check。不要运行 destructive reset；未配置真实 API 不做网络联调。`HANDOFF` 必须列实际模型、changed、checks、exceptions、数据库落账（如仅 audit 则明确）、未运行项，且不得声称飞驼生产接通。

停止条件：发现必须改变 canonical 权威范围、不可逆发布权限或公共契约业务含义，立即返回 blocked；普通工程选择由执行器按本 brief 处理。

本任务沿原 brief 串行追加长期机制切片；不把飞驼临时 49/17/12 快照当成发布数据，不修改五类关注实现，不接真实外部 API，不让工作台直连外部来源。

- 飞驼仅作供应商 reference/candidate；ISO 3166-1、UNECE UN/LOCODE、SCAC、箱型等 canonical 由各自标准权威确认。
- 发布流程固定为采集/整理 → 独立复核 → 发布人三段分离；发布人不能批准自己提交的版本。
- **固定内部基准：** 负责人已锁定柜型内部标准为方案 A：长度与类型分开（长度 `20/40/45/53`；类型 `GP/HC/RH/FR/FQ/OT/OQ/TK/TQ/RF/HT/HH`），`40HQ/20DV` 等外部/历史组合码只做映射和兼容展示；未知不静默回退。首次蒸馏确认后，外部变化不得覆盖内部 canonical，只能追加映射版本、别名或待审核差异；不改变现有状态机和历史事实。
- 机制流水线固定为 `SourceArtifact → DatasetProfile → staged Release → typed Value/ExternalMappingCandidate → ReleaseDiff → Review/Approval → Publish/ConsumerBinding → ActiveCatalogQuery`。现有 `ReferenceDataRelease`、Import/Evidence/Ocean ingestion 的 hash/幂等/追加模式只作复用材料，不把专用表直接冒充通用治理模型。
- 首片写入范围（执行器获准后）：`database/schema.prisma`、追加 `database/migrations/**`、`apps/api/src/modules/master-data/**` 的长期 application/query port、`packages/contracts/schemas/v1/**` 与 fixture manifest、`database/seeds/fixtures/freightower-container-reference-v1.json` 的机制化重构、对应测试与 `scripts/reference-data/**`；禁止 `apps/web/**`、外部连接器/凭据、生命周期状态机、Shipment/Container 业务字段和 `db:seed` 全库接线。
- 首片必须先形成 artifact/dataset/release/value/mapping/diff/review/approval/consumer-binding/deprecation/citation 的最小可审计链和 collect/validate/diff/review/publish/rollback/consumer-check application 命令，再迁移既有 ISO/UNLOCODE 的 staged→review→approved→active 兼容发布；飞驼适配仅产 candidate/diff，不自动 active。
- 验收反证：无批准不能 active；49 不能声称97；license unknown 不得批准；碰撞/未知/歧义不进 active；同 hash 重放零增量、异 hash 冲突；并发发布仅一个 active且失败无半发布；rollback/历史解释成立；API未开时无外部请求；工作台无外部HTTP。
- 本切片属 high-risk Schema/公共契约/发布权限任务，执行前必须下发准确 TASK 并保留现有在途修改；完成后需定向门禁、真实数据库空库/旧库/重放验证和 fresh 独立复审，未满足不得标 done。

负责人将本轮海运纠偏确认为全部工作台纪律，写入 `AGENTS.md` §1.1 第9条及 `08-role-workbenches.md` §2.1，规则与验收不在此重复。海运具体应用：已有 ETA、进展及待核项按权限供下游及时消费；不以“ETA判断已保存”、来源逐项确认、清关接收或整单齐备作为清关组织资料等无依赖工作的前置。仅具体依赖未满足项的动作受限，接收回执仍用于证明责任承接。本条覆盖旧 TASK/矩阵可能被理解为“先确认全部事实再交信息”的解释，不自动确认来源资格、不推进实际状态、不伪造下游接收。本轮仅改纪律、共同业务权威与原 brief，未修改运行行为；后续代码/岗位验收仍需按该标准执行。

### S2 当前实现记录（Claude 直接实施，2026-10-30）

负责人明确本切片不交 Codex，由 Claude 直接落地；局部覆盖默认 writer 分工，仅限内部标准基准 v1，不扩展到外部映射或完整治理平台。已实现/待收口范围：

- `OceanCarrierReference`：Logix 内部 canonical `MSC`、`HMM`。
- `ContainerTypeReference`：单一组合 canonical code，含 length/type 属性，12 个内部组合值。
- `ReferenceDataRelease`：`Logix/ocean_internal_baseline/1.0.0` active release；seed 事务、确定性 ID、行 hash、重复执行幂等。
- Master Data 只读 repository/port：只按 active 内部 release 查询承运人/柜型；工作台和外部映射尚未消费这些字段。
- 地点复用现有 active UN/LOCODE；事件/时间复用已有 catalog；未改 Shipment/Container 字段和生命周期状态机。

实际运行证据：迁移已在本地开发库应用；`pnpm db:seed` 首次与再次执行均报告 2 carriers/12 container types；定向 API 3/3、Prisma generate/validate、API typecheck 通过。某次内联 TS 回读命令无输出，尚未将其当作数据库回读证据；需以正式验证脚本/SQL 回读补齐。Prettier 对 Prisma schema 报“无 parser”，不将其误报为源码格式通过；其他触及 TypeScript/Markdown 文件已格式化。

负责人锁定五类关注并授权 Claude 直接写代码。复用当前分支/基线与三栏壳：左运输列表（不宣称每票异常）→中运输概况与五类关注→右所选关注的依据/触发/可用动作和结果。颜色、字体、间距沿既有令牌，不改共享布局；手机保留三屏往返与草稿恢复。仅修改海运模块及其测试、Web API 类型、海运页面/测试、本 brief、08 权威与原截图目录；不新增 Schema/迁移、公开端点/权限码，不写外部连接器或下游接收模块。

五面实施：岗位围绕有依据的关注项工作；数据从已有身份/日期/历史/观察/本岗结果读取，历史仅明确更正链同事件同位置航段可比时表达变化，不按版本号猜先后；技术以领域纯函数产生五类读模型及当前可用动作，保留原保存幂等/版本/范围与迟到隔离；权限沿服务端 read/operate，查询无写/取数副作用；UI不固定 ETA 审批题、不把无ATA/无deadline当运输异常，现有人工记录作为按需展开的可选本岗判断，不作为信息流通前置。风险信号、正式路线变更、下游接收无已接通消费者时明确未接入，不造信号/按钮。保留历史保存结果，不重跑样本、不预填新判断。

测试先行：领域覆盖正常事实、无历史不造变化、同一明确更正链比较、预计与实际/不同位置航段不误判冲突、provider待核不等异常、缺期限不否定ETA；repository验证读真实字段、五类输出、无写；Web验证五类切换、可选记录、非审批语义、原保存/冲突/迟到/恢复。运行定向API/Web测试、模块typecheck/lint/build、路径格式/repo:check，实际当前入口三视口截图与读回；高风险最终独立只读复审。不能运行的环境验证单独记录，不以mock替代。
