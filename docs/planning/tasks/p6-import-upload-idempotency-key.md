---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-16）：pnpm validate 全部通过；Web 52 个测试文件 / 172 项通过，E2E 50 passed / 7 skipped，生产构建通过。
---

# 任务：导入上传幂等键兼容中文文件名

## 目标

修复中文文件名被写入 `Idempotency-Key` 后，浏览器在发送请求前因请求头编码失败的问题。上传幂等键必须只包含 ASCII，并以文件内容而非文件名和大小识别重复上传。

## 边界 / 不做

- 仅调整 Web 上传客户端和调用方，不修改服务端导入流程、数据库或迁移。
- 保留服务端 `Idempotency-Key` 契约，不通过删除幂等头规避问题。
- 不改动当前工作树中的其他导入闭环改动。

## 验收

- [x] 中文文件名可进入上传请求构造，且 `Idempotency-Key` 只包含 ASCII。
- [x] 相同内容不同文件名生成相同幂等键；不同内容生成不同幂等键。
- [x] `pnpm --filter @logix/web test -- src/api/importBatches.test.ts` 通过。
- [x] `pnpm validate` 通过。

## 方案

在上传 API 边界读取文件内容并计算 SHA-256，使用带版本前缀的十六进制摘要作为幂等键。页面不再自行拼接文件名和大小，从接口设计上阻止非 ASCII 文件名再次进入请求头。

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                                   |
| ---------- | ------ | ---- | ------ | ------------------------------------------------------ |
| 2026-09-16 | coding | —    | —      | 已定位中文文件名直接进入请求头，先补上传客户端回归测试 |
| 2026-09-16 | done   | —    | —      | 内容哈希幂等键已落地，完整质量门禁通过                 |
