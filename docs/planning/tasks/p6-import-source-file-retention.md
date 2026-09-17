---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 2026-09-17 本地 `pnpm validate` 全绿（仓库规则、契约、Prisma、Lint、格式、类型、单元/集成测试、E2E 50 通过/7 跳过及生产构建通过）；现有库应用并对齐 39 条迁移，4 种 retained 缺失元数据均被 CHECK 以 23514 拒绝且非法记录为 0；专用空库从零回放 39 条成功（约束 2、唯一索引 1）后已删除；MinIO 实际对象写入/删除成功且容器健康；高危生产依赖审计通过。
---

# 任务：导入原始文件留存

## 目标

把每次新建导入批次的原始 `.xlsx` / `.csv` 文件保存到 MinIO/S3，并在批次中记录不可变对象引用、SHA-256、大小和 MIME 类型。对象存储失败时不得创建批次；数据库创建失败时补偿删除该批次独占对象，为后续服务端重新解析提供可信输入。

## 边界 / 不做

- 权威边界见 `../../../ENGINEERING_RULES.md` §4.3、`../../architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md` §10.1 和 `../../product/domain/IMPORT_DOMAIN_MODEL.md`。
- 本切片只保存原文件及元数据，不新增“后台重解析”端点，不自动替代旧批次，不复制旧映射、审核或执行结果。
- 历史批次没有可恢复的原文件，迁移只将其标记为 `not_retained`，不得伪造对象引用。
- 不提供公共下载端点；原文件仍受服务端租户与操作权限控制。

## 兼容性与影响

- `import_batch` 加法新增来源文件留存状态、对象键、MIME 类型和字节数；历史行保持可读。
- API 批次响应只公开留存状态与文件大小，不公开内部 bucket、endpoint 或对象键。
- 本地开发新增 MinIO 服务；生产环境必须显式配置对象存储凭据，禁止回退到本地磁盘或内存。

## 验收

- [x] 新批次在解析完成后保存原文件，数据库元数据与实际 SHA-256、大小、MIME 类型一致。
- [x] 幂等命中不重复上传；对象存储失败不建批，数据库创建失败删除该 UUID 对应的独占对象。
- [x] 对象键不包含原始文件名或租户名称，避免路径注入与敏感信息泄露。
- [x] 历史批次为 `not_retained`；新批次为 `retained` 且元数据受数据库约束。
- [x] 迁移通过现有库与空库重放，相关测试和 `pnpm validate` 通过。

## 方案

1. 在 integration-import 定义对象存储 Port；S3 Adapter 使用固定 bucket、超时和有限重试。
2. 应用层生成批次 UUID，以 `imports/{batchId}/source` 为独占对象键；先解析和建议，再上传原文件，最后创建批次与行。
3. 批次创建失败时按独占对象键补偿删除；补偿失败保留原错误并结构化记录孤儿对象键，后续由运维清理。
4. 迁移以 nullable 元数据兼容历史数据，并用 CHECK 约束保证 `retained` 元数据完整、`not_retained` 元数据为空。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                    |
| ---------- | ------ | ----- | ------ | --------------------------------------- |
| 2026-09-17 | coding | Codex | —      | 建立原文件留存边界与失败补偿验收项      |
| 2026-09-17 | done   | Codex | —      | 完成 S3 留存、迁移双链路与全量门禁      |
| 2026-09-17 | fix    | Codex | —      | 修复 retained 元数据 CHECK 的 NULL 漏洞 |
| 2026-09-17 | done   | Codex | —      | 约束修复通过现有库、空库回放与全量门禁  |
