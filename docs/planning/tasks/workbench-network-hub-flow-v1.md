---
status: coding
branch: feat/workbench-network-hub-volume-v1
owner: cursor
writer: codex
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/workbench-network-hub-flow-v1.md
  - docs/product/WORKBENCH_VISUAL_FLOW_REDESIGN.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - packages/contracts/schemas/v1/workbench-network-volume.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - apps/api/src/app.module.ts
  - apps/api/src/modules/workbench-network/**
  - apps/api/src/infrastructure/integration/workbench-network-volume.integration.test.ts
  - apps/web/src/api/workbenchNetworkVolume.ts
  - apps/web/src/api/workbenchNetworkVolume.test.ts
  - apps/web/src/views/WorkbenchNetworkView.vue
  - apps/web/src/views/WorkbenchNetworkView.test.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:workbench-network-hub-flow-v1
  - public-contract:workbench-network-volume-v1
  - generated:contracts
sharedIntegrationScopes:
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - docs/product/WORKBENCH_VISUAL_FLOW_REDESIGN.md
  - docs/product/UI_SYSTEM.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md
verification: |
  S2 定向验证：workbench-network-volume 集成测试、WorkbenchNetworkView 单测、契约 drift、受影响 lint/typecheck。不跑完整 validate。
---

# 任务：业务工作台枢纽 / 管道总览动线

> 本文件是执行、评审与交接的唯一载体。状态只看 frontmatter。
> 权威改版：[WORKBENCH_VISUAL_FLOW_REDESIGN](../../product/WORKBENCH_VISUAL_FLOW_REDESIGN.md) §0、§12。
> **页面类型**：枢纽页（横向扫描），**不**套用详情页 §2 骨架。

## 目标

用户打开「业务工作台」总览时，3 秒内能回答「活现在主要压在哪一节、该点哪个台进去」；管道以业务量自述状态；交接画在节点之间；支撑模块与主干分层。

## 边界 / 不做

- 不在本页做单票详情编辑。
- 不伪造在办/阻塞数字（§12.5）；无服务端投影时显式写“尚无业务量投影”。
- 不把系统能力“已接能力 / 可体验 / 待接通”作为卡面主信息，降为小角标。
- 色与主题只认 `UI_SYSTEM` + `themes/logix/tokens.css`。
- 本页不是 23 台中的某一台工作台，不适用单台智慧开启基线；不改变任何工作台的岗位结果、成熟度或交接定义。

## 执行切片

### 切片 `S1-structure-without-volume`（现在开工）

1. 页首新增全局业务量带：在办、本周流转、阻塞三项当前没有服务端投影，如实显示“尚无业务量投影”，并提供进入异常中心的入口；不显示任何数字。
2. 卡片内删除出向交接页脚；交接改画在节点之间的连接处，沿用 `workbenchNetwork.ts` 的出向关系标签（单一关系写关系名，多条写“N 项出向交接”，链尾不画连接）。
3. 系统能力降为小角标：去掉“已接能力”卡片的品牌色内描边与大面积绿色；保留 `data-implementation` 供既有测试与无障碍识别。
4. 横向协同区更名为“支撑模块”，保持 `--surface-2` 浅灰分层。
5. 验证：`WorkbenchNetworkView` 单测更新（卡内无交接页脚、连接处有交接标签、业务量带显示无投影空态且无数字）、Web lint/typecheck；`workbench-network.spec.ts` 不改（属交接任务共享范围），只读复跑确认不回归。

### 切片 `S2-volume-projection`（现在开工）

口径（HUB-P01，负责人 2026-10-04 定 A + 阻塞优先，权威落点 `docs/product/WORKBENCH_VISUAL_FLOW_REDESIGN.md` §12.7）：

- **在办**：当前责任在本台、尚未到达本台已定完成点的业务对象数。
- **阻塞**：在办对象中带有服务端判定“异常阻断”的数量；待补缺口不计入（WB-B05）。本台服务端没有异常阻断事实时显示“未定义”，不显示 0。
- **连接线**：已交出、接收方尚未接受的数量；超过时限的单独标出。
- **本周流转**：本周到达本台完成点的数量；完成点事实不存在时显示“未接通”。
- **当前节**：阻塞数最多的阶段唯一高亮；所有阶段都无阻塞时不高亮。
- 只对有服务端投影的台显示数字，其余写“未接通”；无读取能力写“无权查看”；每个数字可点进对应工作台。

首批三台（完成点均已定）按现有事实推导，开工时先逐项核对代码事实，不符即回报主代理：

| 台   | 在办                                                                                  | 连接线（交出未被接受）                         | 本周流转                     | 阻塞                     |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- | ------------------------ |
| 市场 | 未关闭信号，含已交选品但当前 intake 尚未 `accepted` 的（MS-D04 接受才转责）           | 市场 → 选品：当前 intake 为 `queued`/`claimed` | 本周 intake 被 `accepted` 数 | 核对是否存在异常阻断事实 |
| 选品 | 已接受 intake 中尚无完成态立项判断的，含 `return_requested`（市场接回前责任仍在选品） | 选品 → NPI：按 NPI 接收事实核对                | 本周 `approve` 完成数        | 同上                     |
| 寻源 | 未定点的 SKU，加已定点但下游尚无明确接受事实的（`doc/03` 完成点为明确接受）           | 寻源 → 补货/采购：已定点待接受数               | 下游接受事实尚不存在：未接通 | 同上                     |

2026-10-04 主代理核对当前 `main`（含 PR #136）后的代码事实。上表里对不上的格子按 §12.7 已有规则改成「未接通 / 未定义」，不发明时限、时间戳或接受事实。只读查询，不新增迁移。

| 项              | 核对结果                                                                                                                   | 本片计数                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 市场在办        | 信号行有 `currentDestination`。`selection_return_requested` 期间责任在选品（MS-D04）。作废、归档、不采纳是退出，不是在办。 | `needs_decision`、`watching`、`returned_from_selection`，加上 `handed_off` 且当前 intake 为 `queued`/`claimed`。每个信号计一次。                          |
| 市场→选品连接线 | 当前 intake 版本在 `product_opportunity_intake`。                                                                          | 当前 intake 为 `queued` 或 `claimed` 的条数。                                                                                                             |
| 市场本周流转    | intake 行有 `actedAt`。                                                                                                    | 本周 `state=accepted` 的 intake 行数。周界是 UTC 周一 00:00（含）到下周一 00:00（不含），响应里带回 `weekStart`。                                         |
| 选品在办        | 立项当前去向在 `product_initiative.current_destination`。接回后去向变为 `returned_to_market`，责任回到市场。               | 当前 intake 已 `accepted`，且立项不存在，或去向为 `needs_decision`、`deferred`、`return_requested`。`handed_off`、`rejected`、`returned_to_market` 不计。 |
| 选品→NPI 连接线 | 有立项交接和领取，没有 NPI「明确接受」事实。                                                                               | `not_connected`。不得把已批准条数当成未接受数。                                                                                                           |
| 选品本周流转    | 立项行只有 `createdAt`/`updatedAt`，没有不可变的批准时刻。                                                                 | `not_connected`。不得用 `updatedAt` 代替。                                                                                                                |
| 寻源在办        | 报价按供应商+SKU 发布留当前版；定点按 SKU 发布追加版本。下游接受事实不存在，定点后完成点仍未到达。                         | 至少有一条当前报价的 SKU 发布数。没有报价的主数据 SKU 不计。                                                                                              |
| 寻源连接线      | 同上，最新定点版本就是「已定点、尚无接受记录」。                                                                           | 有最新定点版本的 SKU 发布数。                                                                                                                             |
| 寻源本周流转    | 补货/采购没有接受定点的事实。                                                                                              | `not_connected`。                                                                                                                                         |
| 三台阻塞        | 市场信号、立项、定点都没有服务端「异常阻断」事实。待补缺口不计。                                                           | 一律 `undefined`，不返回 0。                                                                                                                              |
| 超过时限        | §12.7 要求单独标出，但没有权威时限。方案 C 已被否决，原因就是多数台没有截止时间。                                          | 一律 `undefined`。不发明天数。                                                                                                                            |
| 无权查看        | 三台读取都是 `planning.read`，没有分台能力码。                                                                             | 缺能力时整个 GET 返回 403，不把各台伪装成 `forbidden`。契约仍保留 `forbidden`，留给以后真正分台的能力。                                                   |
| 当前节          | 阻塞都不可比。                                                                                                             | `currentPhase: null`。页面不高亮任何阶段。高亮规则仍由服务端给出 `currentPhase`，前端不自己比大小。                                                       |

全局带：在办是三台在办之和。本周流转是 `not_connected`（不能把缺完成点的台当成 0 加进全管道）。阻塞是 `undefined`。各台卡片仍显示自己的本周流转：只有市场是数字。

五面（同一读模型，缺一不可）：

1. **岗位任务**：打开总览的人要在一屏内看出市场、选品、寻源哪边还有活，并点进对应台。不在总览做单票处理。
2. **数据事实**：上表。对象、当前版本和租户以现有表为准。不新增列。
3. **技术保障**：`GET /api/workbench-network/volume`，契约 `workbench-network-volume.v1`。只读、租户隔离、无写入幂等。用 `pnpm --filter @logix/contracts contract:generate` 生成 `contracts.d.ts`，再跑 `contract:drift`。不要手改生成物。
4. **权限边界**：认证 + `planning.read`。无租户或无能力按现有守卫拒绝。计数查询必须带租户条件。
5. **界面承接**：市场、选品、寻源卡片主信息改为在办数字，数字链到现有工作台路由；阻塞写「未定义」；选品和寻源的本周流转写「未接通」；市场到选品、寻源到下游的连接处标出待接受数量，超时写「未定义」；选品到 NPI 的连接写「未接通」。其余台写「未接通」。加载、失败、403 都要有文案，失败时不保留上一次数字。没有 `currentPhase` 时没有任何阶段高亮。

`doc/08` 4.1.1 末尾追加一段：枢纽这三项计数使用本节责任规则；阻塞和超时在对应事实出现前显示未定义。不改 MS-D04。§12.7 追加一句：本片没有权威时限，超时显示未定义。

验证：`pnpm test:integration -- workbench-network-volume`（`apps/api`，含跨租户、无能力、上表每条反例）、`WorkbenchNetworkView` 单测、契约 drift、受影响文件 lint/typecheck、`workbench-network.spec.ts` 一条总览能看见市场在办数字并能点进市场台。不跑完整 `validate`。不要改寻源 brief，不要新增迁移。

## 五面映射（S1）

| 业务步骤       | 岗位任务                       | 数据事实                                      | 技术保障           | 权限边界                 | 界面承接                       |
| -------------- | ------------------------------ | --------------------------------------------- | ------------------ | ------------------------ | ------------------------------ |
| 找该进哪个台   | 任何岗位从总览进入自己的工作台 | 静态目录 `workbenchNetwork.ts`（23 台与关系） | 无写入；纯前端渲染 | 沿用路由与各台服务端授权 | 节点卡 + 连接处交接 + 支撑分层 |
| 判断活压在哪节 | 同上                           | **缺**：无跨工作台在办/阻塞投影               | S2 承接            | S2 定                    | S1 只显示“尚无业务量投影”空态  |

## 验收

- [ ] 卡片内无交接页脚；交接标签在节点之间
- [ ] 卡面无大面积绿色或品牌色描边；能力态为小角标
- [ ] 业务量带存在，无投影时不出现任何数字
- [ ] 支撑模块浅灰分区、标题“支撑模块”
- [ ] 单测、lint/typecheck 通过；workbench-network E2E 复跑通过
- [ ] S2 定案后：三态、唯一当前节、在办/阻塞数字、§12.6 清单与 3 秒 / 眯眼测试

## 负责人决策记录

| 决策 ID | 事实与选项                                                                                            | 负责人结论                                    | 落点                      |
| ------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------- |
| HUB-D01 | 屏五原 blocked（串行槽位 + 待投影口径）；先做不依赖数字的结构部分                                     | 2026-10-04 负责人原话“屏四并入交接、屏五开工” | 本 brief S1 / approved    |
| HUB-P01 | 每台在办/阻塞计数口径：A 责任口径 / B 队列口径 / C 只看异常；当前节：阻塞优先 / 按用户岗位 / 在办最多 | 2026-10-04 负责人原话“HUB-P01：A + 阻塞优先”  | 改版规范 §12.7 / approved |

## 进度 log

| 日期       | 阶段    | 负责   | commit  | 说明                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | design  | —      | —       | 按 §12 开 brief                                                                                                                                                                                                                                                                                                                       |
| 2026-09-28 | blocked | —      | —       | 串行 + 待业务量投影口径                                                                                                                                                                                                                                                                                                               |
| 2026-10-04 | coding  | Cursor | —       | 负责人定“屏五开工”；拆为 S1 结构（不依赖数字）与 S2 投影（待口径定案）；寻源 brief 转 blocked 腾出名额                                                                                                                                                                                                                                |
| 2026-10-04 | coding  | Cursor | S1 提交 | S1 完成：页首业务量带无投影时只显示“—”与说明并链到异常中心；卡内交接页脚移到卡外连接处；能力态只留小角标，去掉品牌色内描边与绿色文字；横向协同更名“支撑模块”。WorkbenchNetworkView 单测 2 条、Web typecheck/lint、workbench-network E2E 54 条通过。纯展示、不改业务口径与契约，未安排独立复审，以 PR 必需 CI 为准；S2 待 HUB-P01 定案 |
| 2026-10-04 | blocked | Cursor | —       | S1 已由 PR #135 合入。HUB-P01 定案 A + 阻塞优先并写回改版规范 §12.7；S2 需要新公共契约，等 `market-selection-handoff-v1` 合并释放 `generated:contracts` 后恢复 coding，不需负责人再授权；`doc/08` 写回随 S2                                                                                                                           |
| 2026-10-04 | coding  | Cursor | —       | PR #136 已合并，契约锁释放。主代理核对三台事实后下发 S2：市场在办/待接受/本周接受可计数；选品本周批准和选品到 NPI、寻源本周接受没有事实，显示未接通；三台阻塞和超时显示未定义。不发明时限。                                                                                                                                           |
