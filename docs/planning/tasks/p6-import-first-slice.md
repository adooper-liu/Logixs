---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: # 实现开始后填 feat/p6-import-first-slice
verification: 本地验证（2026-09-12）：pnpm typecheck/lint/test/build 全绿；API vitest 9 项通过（预检/落账/幂等/写端口）；端到端实测「上传→解析→AI建议→确认→预检blocker→落账→对账」全链路，缺单号禁写(409)、补全后落账成功且 /api/containers 可读新货柜；AI pytest 5 项通过
---

# 任务：P6 导入第一刀

> 唯一交接载体。状态以顶部 frontmatter 为准。实施规格是设计正文，不另开并行任务。

## 目标

按规格打通「上传已出运货柜表 → 映射确认 → 预检硬闸 → 经 shipment-registry 写端口落库 → 对账」，且 AI 不能直接写业务表。

## 权威入口

- 实施规格：[p6-import-first-slice.md](../specs/p6-import-first-slice.md)
- [IMPORT_WORKFLOW](../../product/workflows/IMPORT_WORKFLOW.md)
- [IMPORT_DOMAIN_MODEL](../../product/domain/IMPORT_DOMAIN_MODEL.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)

## 边界 / 不做

见规格 §2.1 非目标。不铺 18 个模块，不把 demo 工作台当写入口，五个 P2 候选项不升格为 Decision。

## 验收

- [~] 规格 §11 样本 S1–S8：S3 幂等/S4 预检/S5 迟绑定/S7 降级/S8 未认证 有测试+端到端证据；S1 同义列/S2 字典/S6 冲突复核延后（Mock 与字典未做，写端口不复核）
- [x] 预检 blocker 时业务表无新行（缺单号 → 409 禁写，已验证）
- [x] 未认证不能上传（缺 header → 401，已验证）
- [x] `pnpm repo:check` / 受影响模块测试通过（api vitest 9 + 前端 54 + AI pytest 5）

## 方案（design 阶段填写）

规格已按模块实施规格模板写完。交付按规格 §12 四阶段推进（A 读链路 → B AI 建议 → C 审核落账 → D 可靠性），不另开并行 brief。`p6-smart-import-slice` 已并入并标 `blocked`。本阶段只评审规格，不写业务代码。

## Review notes（review 阶段填写，只读不改代码）

2026-09-12 规格评审（已回写文档，本阶段仍为 design）：

1. 硬伤：§3.2 曾自写 `awaiting_precheck` 且与 IMPORT_WORKFLOW §4 的 `awaiting_validation` 顺序相反。已拍板「审核 → 预检」，权威与规格、架构 §11 同步。
2. 开发期身份未落地机制：已定为 header `X-Tenant-Id` + `X-Operator-Id`。
3. MinIO 为阶段 A 前置（compose + P4-06 最小集），已写入规格 §12。
4. 写端口冻结首选 `applyContainerRecord`，废弃带 Plan 的旧候选。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------ | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-12 | design | —    | —      | 初稿：P6 导入第一刀实施规格                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-12 | design | —    | —      | 吸收四阶段 MVP；并行 brief 标 blocked                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-09-12 | design | —    | —      | 评审回写：状态机审核→预检；开发期身份；MinIO 进阶段 A                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-09-12 | coding | —    | —      | 阶段 A 读链路完成：上传→幂等→解析→展示（exceljs 解析 .xlsx/.csv）；import_batch/import_row 迁移；开发期身份 guard；前端 /import + /import/:batchId。端到端验证通过（3 行 3 列、同 key 幂等返回原批次、缺 header 401）。偏离：MinIO 按计划延后阶段 C（阶段 A 内存解析）、.xls 首版不支持、ImportBatch 用 API DTO 未进 JSON Schema 契约                                                                                         |
| 2026-09-12 | coding | —    | —      | 阶段 B AI 建议完成：ai-service 加 suggest_import_mapping 能力（Mock 关键词规则，pytest 5 项过）；ai-governance 补 AiGatewayService 转发；import_batch 加 mapping_suggestions Json 留痕；前端详情页展示建议+置信度。端到端验证：中文 CSV 三列全部命中（备货单号→orderNumber 等 0.9）。偏离：真实模型/LiteLLM 延后 P7、完整 AI 治理延后 P5                                                                                      |
| 2026-09-12 | coding | —    | —      | 阶段 C 审核+落账完成：shipment-registry 加写端口 applyContainerRecord（hit 更新/miss 新建）；integration-import 加 ConfirmMappings/RunPrecheck/ExecuteImport 三用例；import_review/import_row_result 表；前端详情页加确认/预检/执行/对账。端到端验证：缺单号→REQ_ORDER blocker 且执行被拒(409)；补全后预检通过→逐行落账→/api/containers 读到新货柜(shipped)。偏离：建档统一 currentStatus=shipped、预检只做 REQ_ORDER+DUP_ROW |
| 2026-09-12 | done   | —    | —      | 阶段 D 测试+收口：apps/api 加 vitest+@nestjs/testing，4 个测试文件 9 项（预检 blocker/落账硬闸/幂等/写端口 hit-miss）；统一给靠类型的 DI 参数加 @Inject（vitest/esbuild 不 emit metadata）。偏离登记：P6-12 Temporal 化（同步实现已验闭环，异步工作流延后）、P6-13 完整 Trace（属 P8）、S1 同义列/S2 字典/S6 冲突复核（Mock/字典/写端口不复核的缺口）。P6 四阶段全部完成                                                      |
